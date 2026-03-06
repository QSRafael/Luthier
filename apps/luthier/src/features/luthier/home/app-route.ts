export type AppRoute = 'home' | 'creator'

export function routeFromPathname(pathname: string): AppRoute {
  const normalized = normalizePath(pathname)
  if (normalized === '/create') {
    return 'creator'
  }
  return 'home'
}

export function pathnameForRoute(route: AppRoute): string {
  return route === 'creator' ? '/create' : '/'
}

function normalizePath(pathname: string): string {
  const trimmed = pathname.trim()
  if (!trimmed) return '/'
  if (trimmed === '/') return '/'
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}
