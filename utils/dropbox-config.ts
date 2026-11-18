export interface DropboxConfig {
  appKey: string
}

export function readDropboxConfig(config: { dropboxAppKey?: unknown }): DropboxConfig | undefined {
  const appKey = typeof config.dropboxAppKey === 'string' ? config.dropboxAppKey.trim() : ''
  return appKey ? { appKey } : undefined
}
