import { exportJumpCluster } from '../domain/workspace'
import type { LocalWorkspace } from '../domain/workspace'
import { exportFileName } from './browser-download'

export interface GoogleDriveBackupSnapshot {
  filename: string
  contents: string
}

/** Captures the complete applied workspace synchronously for one dated Drive backup operation. */
export function createGoogleDriveBackupSnapshot(
  workspace: LocalWorkspace,
  capturedAt = new Date(),
): GoogleDriveBackupSnapshot {
  const date = capturedAt.toISOString().replace('T', '-').replaceAll(':', '-').replace('.', '-')
  const baseName = exportFileName(workspace.cluster.name, 'jump-cluster').replace(/\.json$/, '')
  const contents = JSON.stringify(exportJumpCluster(workspace))
  if (!contents) throw new Error('The Jump Cluster could not be serialized for backup.')

  return {
    filename: `${baseName}-${date}.json`,
    contents,
  }
}
