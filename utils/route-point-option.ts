/** Keeps Inspector option values disjoint from every persisted Jump Point identity. */
export const noLocalRoutePointOption = 'route-endpoint:none'

const routePointOptionPrefix = 'route-point:'

export function encodeRoutePointOption(pointId: string | null): string {
  return pointId === null ? noLocalRoutePointOption : `${routePointOptionPrefix}${pointId}`
}

export function decodeRoutePointOption(option: string): string {
  if (option === noLocalRoutePointOption) return ''
  return option.startsWith(routePointOptionPrefix) ? option.slice(routePointOptionPrefix.length) : ''
}
