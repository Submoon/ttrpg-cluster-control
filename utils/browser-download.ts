/** Map kinds used in the established local export filenames. */
export type DownloadMapKind = 'jump-cluster' | 'star-system'

/**
 * Dispatches a browser download and revokes its temporary object URL after the click.
 * Browser APIs are accessed only when this function is called, so importing it is SSR-safe.
 */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  try {
    link.href = url
    link.download = filename
    document.body.append(link)
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

/** Builds a download name with filesystem-reserved characters replaced. */
export function exportFileName(
  name: string,
  kind: DownloadMapKind,
  extension = 'json',
): string {
  const safeName = name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').trim() // eslint-disable-line no-control-regex -- Replace C0 controls because they cannot appear in downloaded filenames.
  return `${safeName || 'map'}-${kind}.${extension}`
}
