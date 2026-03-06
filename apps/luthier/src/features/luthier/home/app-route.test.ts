import { describe, expect, it } from 'vitest'

import { pathnameForRoute, routeFromPathname } from './app-route'

describe('home route helpers', () => {
  it('maps known creator path to creator route', () => {
    expect(routeFromPathname('/create')).toBe('creator')
    expect(routeFromPathname('/create/')).toBe('creator')
  })

  it('maps unknown paths to home route', () => {
    expect(routeFromPathname('/')).toBe('home')
    expect(routeFromPathname('/anything-else')).toBe('home')
    expect(routeFromPathname('')).toBe('home')
  })

  it('builds pathname from app routes', () => {
    expect(pathnameForRoute('home')).toBe('/')
    expect(pathnameForRoute('creator')).toBe('/create')
  })
})
