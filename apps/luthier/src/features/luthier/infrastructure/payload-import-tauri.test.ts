import { describe, expect, it } from 'vitest'

import { hasPathInDirectoryListing } from './payload-import-tauri'

describe('hasPathInDirectoryListing', () => {
  it('returns true when target file exists with the same casing', () => {
    expect(
      hasPathInDirectoryListing('/games/demo/age3y.exe', [
        '/games/demo/launcher.sh',
        '/games/demo/age3y.exe',
      ])
    ).toBe(true)
  })

  it('returns true when target file exists with different casing', () => {
    expect(
      hasPathInDirectoryListing('/games/demo/age3y.exe', [
        '/games/demo/AGE3Y.EXE',
        '/games/demo/README.txt',
      ])
    ).toBe(true)
  })

  it('returns false when target file does not exist in listing', () => {
    expect(
      hasPathInDirectoryListing('/games/demo/age3y.exe', [
        '/games/demo/age3.exe',
        '/games/demo/launcher.sh',
      ])
    ).toBe(false)
  })
})
