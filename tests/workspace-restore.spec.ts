import { expect, test } from '@playwright/test'
import { createRenderer, defineComponent, h, ref, shallowRef } from 'vue'
import { createLocalWorkspace, exportJumpCluster, type LocalWorkspace } from '../domain/workspace'
import { useWorkspaceRestore } from '../composables/useWorkspaceRestore'
import type { WorkspaceStorageVersion } from '../utils/workspace-storage'

type HostNode = {
  kind: string
  children: HostNode[]
  parent?: HostNode
  text?: string
}

function createTestRenderer() {
  return createRenderer<HostNode, HostNode>({
    patchProp: () => undefined,
    insert(child, parent, anchor) {
      if (child.parent) {
        const previousIndex = child.parent.children.indexOf(child)
        if (previousIndex >= 0) child.parent.children.splice(previousIndex, 1)
      }
      child.parent = parent
      const anchorIndex = anchor ? parent.children.indexOf(anchor) : -1
      parent.children.splice(anchorIndex < 0 ? parent.children.length : anchorIndex, 0, child)
    },
    remove(child) {
      if (!child.parent) return
      const index = child.parent.children.indexOf(child)
      if (index >= 0) child.parent.children.splice(index, 1)
      child.parent = undefined
    },
    createElement(kind) { return { kind, children: [] } },
    createText(text) { return { kind: 'text', text, children: [] } },
    createComment(text) { return { kind: 'comment', text, children: [] } },
    setText(node, text) { node.text = text },
    setElementText(node, text) { node.text = text; node.children = [] },
    parentNode(node) { return node.parent ?? null },
    nextSibling(node) {
      if (!node.parent) return null
      const index = node.parent.children.indexOf(node)
      return index < 0 ? null : node.parent.children[index + 1] ?? null
    },
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => { resolve = complete })
  return { promise, resolve }
}

function validVersion(workspace: LocalWorkspace, revision: number): WorkspaceStorageVersion {
  return {
    workspace,
    revision,
    recordStatus: 'valid',
    fingerprint: null,
    ownerId: workspace.id,
  }
}

test('a local backup read cannot replace a workspace installed while the file is opening @pure', async () => {
  const workspace = ref<LocalWorkspace | null>(null)
  const appliedRevision = ref(0)
  const durableVersion = shallowRef<WorkspaceStorageVersion | null>({
    workspace: null,
    revision: 0,
    recordStatus: 'empty',
    fingerprint: null,
    ownerId: null,
  })
  const pendingRead = deferred<{ name: string; content: unknown; sourceKind: 'local-file' } | null>()
  let replacementCount = 0
  let restore: ReturnType<typeof useWorkspaceRestore> | undefined
  const application = defineComponent({
    setup() {
      restore = useWorkspaceRestore({
        workspace,
        appliedRevision,
        durableVersion,
        getDraftConsentState: () => ({ signature: '', hasDrafts: false }),
        replaceFromBackup: async () => { replacementCount += 1 },
        downloadCurrent: () => undefined,
        afterReplacement: () => undefined,
      })
      return () => h('div')
    },
  })
  const renderer = createTestRenderer()
  const container: HostNode = { kind: 'root', children: [] }
  renderer.render(h(application), container)
  if (!restore) throw new Error('The workspace restore controller did not initialize.')

  try {
    const opening = restore.openFrom(() => pendingRead.promise)
    const installed = createLocalWorkspace('Installed Reach', 'Vesper')
    workspace.value = installed
    appliedRevision.value += 1
    durableVersion.value = validVersion(installed, 1)
    pendingRead.resolve({ name: 'late-backup.json', content: '{}', sourceKind: 'local-file' })

    await opening

    expect(restore.review.value).toBeNull()
    expect(restore.error.value).toContain('active workspace or draft state changed')
    expect(replacementCount).toBe(0)
    expect(workspace.value?.cluster.name).toBe('Installed Reach')
  } finally {
    renderer.render(null, container)
  }
})

test('canceling a provider read releases only its restore operation and preserves a newer local restore @pure', async () => {
  const workspace = ref<LocalWorkspace | null>(createLocalWorkspace('Active Reach', 'Vesper'))
  const appliedRevision = ref(0)
  const durableVersion = shallowRef<WorkspaceStorageVersion | null>(validVersion(workspace.value!, 0))
  const canceledDriveRead = deferred<{ name: string; content: unknown; sourceKind: 'google-drive' } | null>()
  const supersededDriveRead = deferred<{ name: string; content: unknown; sourceKind: 'google-drive' } | null>()
  const pendingLocalRead = deferred<{ name: string; content: unknown; sourceKind: 'local-file' } | null>()
  let restore: ReturnType<typeof useWorkspaceRestore> | undefined
  const application = defineComponent({
    setup() {
      restore = useWorkspaceRestore({
        workspace,
        appliedRevision,
        durableVersion,
        getDraftConsentState: () => ({ signature: '', hasDrafts: false }),
        replaceFromBackup: async () => undefined,
        downloadCurrent: () => undefined,
        afterReplacement: () => undefined,
      })
      return () => h('div')
    },
  })
  const renderer = createTestRenderer()
  const container: HostNode = { kind: 'root', children: [] }
  renderer.render(h(application), container)
  if (!restore) throw new Error('The workspace restore controller did not initialize.')

  try {
    const canceledSignal = new AbortController()
    const canceledOpening = restore.openFrom(() => canceledDriveRead.promise, canceledSignal.signal)
    expect(restore.loading.value).toBe(true)
    canceledSignal.abort()
    expect(restore.loading.value).toBe(false)
    await canceledOpening

    const supersededSignal = new AbortController()
    const driveOpening = restore.openFrom(() => supersededDriveRead.promise, supersededSignal.signal)
    const localOpening = restore.openFrom(() => pendingLocalRead.promise)
    expect(restore.loading.value).toBe(true)
    supersededSignal.abort()
    expect(restore.loading.value).toBe(true)

    pendingLocalRead.resolve({
      name: 'local-backup.json',
      content: JSON.stringify(exportJumpCluster(createLocalWorkspace('Local Reach', 'Cinder'))),
      sourceKind: 'local-file',
    })
    await localOpening
    supersededDriveRead.resolve({ name: 'late-drive-backup.json', content: '{}', sourceKind: 'google-drive' })
    canceledDriveRead.resolve({ name: 'canceled-drive-backup.json', content: '{}', sourceKind: 'google-drive' })
    await driveOpening

    expect(restore.review.value?.sourceName).toBe('local-backup.json')
    expect(restore.error.value).toBe('')
    expect(workspace.value?.cluster.name).toBe('Active Reach')
  } finally {
    renderer.render(null, container)
  }
})

test('a changed draft after confirmation requires fresh consent before replacement @pure', async () => {
  const activeWorkspace = createLocalWorkspace('Active Reach', 'Vesper')
  const workspace = ref<LocalWorkspace | null>(activeWorkspace)
  const appliedRevision = ref(0)
  const durableVersion = shallowRef<WorkspaceStorageVersion | null>(validVersion(activeWorkspace, 0))
  const draftState = ref({ signature: 'system-name:Vesper', hasDrafts: true })
  let replacementCount = 0
  let restore: ReturnType<typeof useWorkspaceRestore> | undefined
  const application = defineComponent({
    setup() {
      restore = useWorkspaceRestore({
        workspace,
        appliedRevision,
        durableVersion,
        getDraftConsentState: () => draftState.value,
        replaceFromBackup: async () => { replacementCount += 1 },
        downloadCurrent: () => undefined,
        afterReplacement: () => undefined,
      })
      return () => h('div')
    },
  })
  const renderer = createTestRenderer()
  const container: HostNode = { kind: 'root', children: [] }
  renderer.render(h(application), container)
  if (!restore) throw new Error('The workspace restore controller did not initialize.')

  try {
    await restore.openFrom(async () => ({
      name: 'incoming-backup.json',
      content: JSON.stringify(exportJumpCluster(createLocalWorkspace('Incoming Reach', 'Cinder'))),
      sourceKind: 'local-file',
    }))
    restore.setDiscardDraftsConfirmed(true)
    draftState.value = { signature: 'system-name:Changed while reviewing', hasDrafts: true }
    await restore.confirm()

    expect(restore.review.value).toMatchObject({
      sourceName: 'incoming-backup.json',
      stale: true,
      hasDrafts: true,
      discardDraftsConfirmed: false,
    })
    expect(replacementCount).toBe(0)
    expect(workspace.value?.cluster.name).toBe('Active Reach')
  } finally {
    renderer.render(null, container)
  }
})

test('a Drive restore keeps its source through stale review and reports only after durable replacement @pure', async () => {
  const activeWorkspace = createLocalWorkspace('Active Reach', 'Vesper')
  const workspace = ref<LocalWorkspace | null>(activeWorkspace)
  const appliedRevision = ref(0)
  const durableVersion = shallowRef<WorkspaceStorageVersion | null>(validVersion(activeWorkspace, 0))
  const draftState = ref({ signature: 'initial', hasDrafts: false })
  const durableWrite = deferred<void>()
  const replacementStarted = deferred<void>()
  const completedSources: string[] = []
  let restore: ReturnType<typeof useWorkspaceRestore> | undefined
  const application = defineComponent({
    setup() {
      restore = useWorkspaceRestore({
        workspace,
        appliedRevision,
        durableVersion,
        getDraftConsentState: () => draftState.value,
        replaceFromBackup: async () => {
          replacementStarted.resolve()
          await durableWrite.promise
        },
        downloadCurrent: () => undefined,
        afterReplacement: sourceKind => { completedSources.push(sourceKind) },
      })
      return () => h('div')
    },
  })
  const renderer = createTestRenderer()
  const container: HostNode = { kind: 'root', children: [] }
  renderer.render(h(application), container)
  if (!restore) throw new Error('The workspace restore controller did not initialize.')

  try {
    await restore.openFrom(async () => ({
      name: 'drive-backup.json',
      content: JSON.stringify(exportJumpCluster(createLocalWorkspace('Incoming Reach', 'Cinder'))),
      sourceKind: 'google-drive',
    }))
    draftState.value = { signature: 'changed while reviewing', hasDrafts: false }
    await restore.confirm()

    expect(restore.review.value).toMatchObject({ sourceName: 'drive-backup.json', stale: true })
    expect(completedSources).toEqual([])

    const confirmation = restore.confirm()
    await replacementStarted.promise
    expect(completedSources).toEqual([])
    durableWrite.resolve()
    await confirmation

    expect(completedSources).toEqual(['google-drive'])
    expect(restore.review.value).toBeNull()
  } finally {
    renderer.render(null, container)
  }
})

test('a failed Drive replacement does not report a completed restore @pure', async () => {
  const activeWorkspace = createLocalWorkspace('Active Reach', 'Vesper')
  const workspace = ref<LocalWorkspace | null>(activeWorkspace)
  const appliedRevision = ref(0)
  const durableVersion = shallowRef<WorkspaceStorageVersion | null>(validVersion(activeWorkspace, 0))
  const completedSources: string[] = []
  let restore: ReturnType<typeof useWorkspaceRestore> | undefined
  const application = defineComponent({
    setup() {
      restore = useWorkspaceRestore({
        workspace,
        appliedRevision,
        durableVersion,
        getDraftConsentState: () => ({ signature: '', hasDrafts: false }),
        replaceFromBackup: async () => { throw new Error('The durable write failed.') },
        downloadCurrent: () => undefined,
        afterReplacement: sourceKind => { completedSources.push(sourceKind) },
      })
      return () => h('div')
    },
  })
  const renderer = createTestRenderer()
  const container: HostNode = { kind: 'root', children: [] }
  renderer.render(h(application), container)
  if (!restore) throw new Error('The workspace restore controller did not initialize.')

  try {
    await restore.openFrom(async () => ({
      name: 'drive-backup.json',
      content: JSON.stringify(exportJumpCluster(createLocalWorkspace('Incoming Reach', 'Cinder'))),
      sourceKind: 'google-drive',
    }))
    await restore.confirm()

    expect(restore.review.value?.error).toBe('The durable write failed.')
    expect(completedSources).toEqual([])
  } finally {
    renderer.render(null, container)
  }
})
