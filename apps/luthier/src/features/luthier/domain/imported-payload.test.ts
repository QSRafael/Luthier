import { describe, expect, it } from 'vitest'

import { defaultGameConfig } from '../../../models/config'
import {
  deriveImportedRuntimePathsFromMainExecutable,
  resolveSiblingMainExecutablePath,
  shouldRefreshImportedHeroImage,
} from './imported-payload'

function makeConfig(heroImageUrl: string) {
  return {
    ...defaultGameConfig(),
    splash: {
      hero_image_url: heroImageUrl,
    },
  }
}

describe('shouldRefreshImportedHeroImage', () => {
  it('returns false when hero url is empty', () => {
    expect(shouldRefreshImportedHeroImage(makeConfig(''))).toBe(false)
  })

  it('returns true when hero url is present', () => {
    expect(shouldRefreshImportedHeroImage(makeConfig('https://img'))).toBe(true)
  })
})

describe('resolveSiblingMainExecutablePath', () => {
  it('returns null when orchestrator path is not absolute', () => {
    expect(resolveSiblingMainExecutablePath('./age3y')).toBeNull()
  })

  it('builds sibling .exe path using orchestrator filename', () => {
    expect(resolveSiblingMainExecutablePath('/games/demo/age3y')).toBe('/games/demo/age3y.exe')
  })

  it('normalizes windows-style source path', () => {
    expect(resolveSiblingMainExecutablePath('C:\\Games\\Demo\\age3y')).toBe(
      'C:/Games/Demo/age3y.exe'
    )
  })

  it('keeps stem when orchestrator already has executable extension', () => {
    expect(resolveSiblingMainExecutablePath('/games/demo/age3y.exe')).toBe('/games/demo/age3y.exe')
  })
})

describe('deriveImportedRuntimePathsFromMainExecutable', () => {
  it('returns null for non-absolute paths', () => {
    expect(deriveImportedRuntimePathsFromMainExecutable('./age3y.exe')).toBeNull()
  })

  it('returns null for non-launcher files', () => {
    expect(deriveImportedRuntimePathsFromMainExecutable('/games/demo/readme.txt')).toBeNull()
  })

  it('derives game root and executable path for valid launcher path', () => {
    expect(deriveImportedRuntimePathsFromMainExecutable('/games/demo/age3y.exe')).toEqual({
      gameRoot: '/games/demo',
      exePath: '/games/demo/age3y.exe',
      gameRootManualOverride: false,
    })
  })

  it('uses relative_exe_path to infer game root above executable directory', () => {
    expect(
      deriveImportedRuntimePathsFromMainExecutable(
        '/home/rafael/Games/Age of Empires III/age3y.exe',
        './Age of Empires III/age3y.exe'
      )
    ).toEqual({
      gameRoot: '/home/rafael/Games',
      exePath: '/home/rafael/Games/Age of Empires III/age3y.exe',
      gameRootManualOverride: true,
    })
  })

  it('falls back to executable directory when relative_exe_path does not match executable name', () => {
    expect(
      deriveImportedRuntimePathsFromMainExecutable(
        '/home/rafael/Games/Age of Empires III/age3y.exe',
        './Age of Empires III/other.exe'
      )
    ).toEqual({
      gameRoot: '/home/rafael/Games/Age of Empires III',
      exePath: '/home/rafael/Games/Age of Empires III/age3y.exe',
      gameRootManualOverride: false,
    })
  })
})
