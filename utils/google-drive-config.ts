export interface GoogleDriveConfig {
  clientId: string
  projectNumber: string
  apiKey: string
}

/** Nuxt parses environment values, so numeric project numbers may reach the browser as numbers. */
export function readGoogleDriveConfig(config: {
  googleDriveClientId?: unknown
  googleDriveProjectNumber?: unknown
  googleDriveApiKey?: unknown
}): GoogleDriveConfig | undefined {
  const clientId = typeof config.googleDriveClientId === 'string' ? config.googleDriveClientId.trim() : ''
  const apiKey = typeof config.googleDriveApiKey === 'string' ? config.googleDriveApiKey.trim() : ''
  const project = config.googleDriveProjectNumber
  const projectNumber = typeof project === 'string' ? project.trim()
    : typeof project === 'number' && Number.isSafeInteger(project) ? String(project) : ''
  if (!clientId || !apiKey || !/^\d+$/.test(projectNumber)) return undefined
  return { clientId, projectNumber, apiKey }
}
