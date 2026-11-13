export interface GoogleDriveConfig {
  clientId: string
}

export function readGoogleDriveConfig(config: {
  googleDriveClientId?: unknown
}): GoogleDriveConfig | undefined {
  const clientId = typeof config.googleDriveClientId === 'string' ? config.googleDriveClientId.trim() : ''
  return clientId ? { clientId } : undefined
}
