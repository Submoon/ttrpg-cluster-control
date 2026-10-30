import { createRenderer } from 'vue'

interface HostNode {
  children: HostNode[]
  parent: HostNode | null
}

const renderer = createRenderer<HostNode, HostNode>({
  patchProp: () => undefined,
  insert: (child, parent, anchor) => {
    child.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    if (index < 0) parent.children.push(child)
    else parent.children.splice(index, 0, child)
  },
  remove: child => {
    if (!child.parent) return
    child.parent.children = child.parent.children.filter(candidate => candidate !== child)
    child.parent = null
  },
  createElement: () => ({ children: [], parent: null }),
  createText: () => ({ children: [], parent: null }),
  createComment: () => ({ children: [], parent: null }),
  setText: () => undefined,
  setElementText: () => undefined,
  parentNode: node => node.parent,
  nextSibling: node => {
    if (!node.parent) return null
    const index = node.parent.children.indexOf(node)
    return node.parent.children[index + 1] ?? null
  },
})

export interface MountedController<T> {
  value: T
  unmount(): void
}

/** Runs a controller factory in real Vue setup and gives its hooks a real component lifetime. */
export function mountController<T>(setup: () => T): MountedController<T> {
  let value!: T
  let hasValue = false
  const app = renderer.createApp({
    setup() {
      value = setup()
      hasValue = true
      return () => null
    },
  })
  let mounted = false
  try {
    app.mount({ children: [], parent: null })
    mounted = true
    if (!hasValue) throw new Error('The controller was not created during component setup.')
  } catch (error) {
    if (mounted) app.unmount()
    throw error
  }

  let unmounted = false
  return {
    value,
    unmount() {
      if (unmounted) return
      unmounted = true
      app.unmount()
    },
  }
}

export class ControlledEventTarget {
  private readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()

  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (!listener) return
    const listeners = this.listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (!listener) return
    const listeners = this.listeners.get(type)
    listeners?.delete(listener)
    if (listeners?.size === 0) this.listeners.delete(type)
  }

  dispatch(type: string, event: Event = new Event(type)): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      if (typeof listener === 'function') listener(event)
      else listener.handleEvent(event)
    }
  }

  dispatchEvent(event: Event): boolean {
    this.dispatch(event.type, event)
    return !event.defaultPrevented
  }

  listenerCount(type?: string): number {
    if (type !== undefined) return this.listeners.get(type)?.size ?? 0
    return [...this.listeners.values()].reduce((total, listeners) => total + listeners.size, 0)
  }
}

export interface ControlledBrowserEnvironment {
  windowEvents: ControlledEventTarget
  documentEvents: ControlledEventTarget
  mediaQueryEvents: ControlledEventTarget
  get queuedAnimationFrameCount(): number
  get cancelledAnimationFrameCount(): number
  setActiveElement(element: Element | null): void
  setCompactViewport(matches: boolean): void
  runAnimationFrames(timestamp?: number): void
}

/** Supplies controlled browser resources and restores original globals after the owner unmounts. */
export async function withControlledBrowserEnvironment<T>(
  run: (environment: ControlledBrowserEnvironment) => T | Promise<T>,
): Promise<T> {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const windowEvents = new ControlledEventTarget()
  const documentEvents = new ControlledEventTarget()
  const mediaQueryEvents = new ControlledEventTarget()
  const queuedFrames = new Map<number, FrameRequestCallback>()
  let nextFrameId = 1
  let cancelledAnimationFrameCount = 0
  let activeElement: Element | null = null
  let compactViewport = false
  let mediaQuery = ''

  const mediaList = {
    get matches() { return compactViewport },
    get media() { return mediaQuery },
    onchange: null as ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null,
    addEventListener: mediaQueryEvents.addEventListener.bind(mediaQueryEvents),
    removeEventListener: mediaQueryEvents.removeEventListener.bind(mediaQueryEvents),
    dispatchEvent: mediaQueryEvents.dispatchEvent.bind(mediaQueryEvents),
  } as MediaQueryList
  const requestAnimationFrame = (callback: FrameRequestCallback): number => {
    const id = nextFrameId++
    queuedFrames.set(id, callback)
    return id
  }
  const cancelAnimationFrame = (id: number): void => {
    if (queuedFrames.delete(id)) cancelledAnimationFrameCount += 1
  }
  const controlledWindow = {
    addEventListener: windowEvents.addEventListener.bind(windowEvents),
    removeEventListener: windowEvents.removeEventListener.bind(windowEvents),
    requestAnimationFrame,
    cancelAnimationFrame,
    matchMedia: (query: string) => {
      mediaQuery = query
      return mediaList
    },
  } as unknown as Window & typeof globalThis
  const controlledDocument = {
    addEventListener: documentEvents.addEventListener.bind(documentEvents),
    removeEventListener: documentEvents.removeEventListener.bind(documentEvents),
    get activeElement() { return activeElement },
    visibilityState: 'visible' as DocumentVisibilityState,
  } as unknown as Document
  const environment: ControlledBrowserEnvironment = {
    windowEvents,
    documentEvents,
    mediaQueryEvents,
    get queuedAnimationFrameCount() { return queuedFrames.size },
    get cancelledAnimationFrameCount() { return cancelledAnimationFrameCount },
    setActiveElement(element) { activeElement = element },
    setCompactViewport(matches) {
      compactViewport = matches
      mediaQueryEvents.dispatch('change', Object.assign(new Event('change'), { matches }) as MediaQueryListEvent)
    },
    runAnimationFrames(timestamp = 0) {
      const callbacks = [...queuedFrames.values()]
      queuedFrames.clear()
      callbacks.forEach(callback => callback(timestamp))
    },
  }

  try {
    Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: controlledWindow })
    Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: controlledDocument })
    return await run(environment)
  } finally {
    if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor)
    else Reflect.deleteProperty(globalThis, 'window')
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor)
    else Reflect.deleteProperty(globalThis, 'document')
  }
}
