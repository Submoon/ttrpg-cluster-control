import { expect, test } from '@playwright/test'
import { createRenderer, defineComponent, h, ref, shallowRef } from 'vue'
import { createLocalWorkspace, type LocalWorkspace } from '../domain/workspace'
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
  const pendingRead = deferred<{ name: string; content: unknown } | null>()
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
    pendingRead.resolve({ name: 'late-backup.json', content: '{}' })

    await opening

    expect(restore.review.value).toBeNull()
    expect(restore.error.value).toContain('active workspace or draft state changed')
    expect(replacementCount).toBe(0)
    expect(workspace.value?.cluster.name).toBe('Installed Reach')
  } finally {
    renderer.render(null, container)
  }
})
