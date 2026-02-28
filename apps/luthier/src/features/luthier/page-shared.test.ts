import { afterEach, describe, expect, it } from 'vitest'

import {
  basenamePath,
  buildAncestorPathsFromExe,
  buildFeatureState,
  buildWxH,
  featureStateEnabled,
  featureStateMandatory,
  isLikelyAbsolutePath,
  isTauriLocalRuntime,
  parseWxH,
  posixDirname,
  relativeInsideBase,
  tabLabel,
} from './page-shared'

describe('page-shared path helpers', () => {
  it('detects absolute and relative paths for Linux and Windows', () => {
    expect(isLikelyAbsolutePath('/games/demo/game.exe')).toBe(true)
    expect(isLikelyAbsolutePath(' C:\\Games\\Demo\\game.exe ')).toBe(true)
    expect(isLikelyAbsolutePath('./game.exe')).toBe(false)
    expect(isLikelyAbsolutePath('game.exe')).toBe(false)
  })

  it('normalizes dirname across slashes and handles edge cases', () => {
    expect(posixDirname('/games/demo/game.exe')).toBe('/games/demo')
    expect(posixDirname('C:\\Games\\Demo\\game.exe')).toBe('C:/Games/Demo')
    expect(posixDirname('/')).toBe('/')
    expect(posixDirname('game.exe')).toBe('/')
  })

  it('builds ancestor paths only for absolute executable paths', () => {
    expect(buildAncestorPathsFromExe('/games/demo/bin/game.exe')).toEqual([
      '/games',
      '/games/demo',
      '/games/demo/bin',
    ])
    expect(buildAncestorPathsFromExe('C:\\Games\\Demo\\game.exe')).toEqual(['C:/Games/Demo'])
    expect(buildAncestorPathsFromExe('./game.exe')).toEqual([])
  })

  it('computes containment relative path and rejects outside targets', () => {
    expect(relativeInsideBase('/games/demo', '/games/demo')).toBe('.')
    expect(relativeInsideBase('/games/demo/', '/games/demo/bin/game.exe')).toBe('bin/game.exe')
    expect(relativeInsideBase('/games/demo', '/games/demo2/game.exe')).toBeNull()
    expect(relativeInsideBase('C:\\Games\\Demo', 'C:\\Games\\Demo\\mods\\a.txt')).toBe('mods/a.txt')
  })

  it('extracts basename and handles trailing separators', () => {
    expect(basenamePath('/games/demo/game.exe')).toBe('game.exe')
    expect(basenamePath('C:\\Games\\Demo\\')).toBe('Demo')
    expect(basenamePath('single-file.exe')).toBe('single-file.exe')
  })

  it('parses and builds WxH values with trimming and incomplete input handling', () => {
    expect(parseWxH(null)).toEqual({ width: '', height: '' })
    expect(parseWxH('1920x1080')).toEqual({ width: '1920', height: '1080' })
    expect(parseWxH('1280x')).toEqual({ width: '1280', height: '' })

    expect(buildWxH('1920', '1080')).toBe('1920x1080')
    expect(buildWxH(' 1920 ', ' 1080 ')).toBe('1920x1080')
    expect(buildWxH('1920', '')).toBeNull()
    expect(buildWxH('', '1080')).toBeNull()
  })
})

describe('page-shared UI-state helpers (no render)', () => {
  const windowRecord = window as unknown as Record<string, unknown>

  afterEach(() => {
    Reflect.deleteProperty(windowRecord, '__TAURI_IPC__')
    Reflect.deleteProperty(windowRecord, '__TAURI__')
  })

  it('detects tauri runtime by global bridge symbols', () => {
    expect(isTauriLocalRuntime()).toBe(false)

    windowRecord.__TAURI_IPC__ = () => undefined
    expect(isTauriLocalRuntime()).toBe(true)

    Reflect.deleteProperty(windowRecord, '__TAURI_IPC__')
    windowRecord.__TAURI__ = {}
    expect(isTauriLocalRuntime()).toBe(true)
  })

  it('maps feature state flags consistently', () => {
    expect(featureStateEnabled('MandatoryOn')).toBe(true)
    expect(featureStateEnabled('OptionalOn')).toBe(true)
    expect(featureStateEnabled('MandatoryOff')).toBe(false)
    expect(featureStateEnabled('OptionalOff')).toBe(false)

    expect(featureStateMandatory('MandatoryOn')).toBe(true)
    expect(featureStateMandatory('MandatoryOff')).toBe(true)
    expect(featureStateMandatory('OptionalOn')).toBe(false)
    expect(featureStateMandatory('OptionalOff')).toBe(false)

    expect(buildFeatureState(true, true)).toBe('MandatoryOn')
    expect(buildFeatureState(true, false)).toBe('OptionalOn')
    expect(buildFeatureState(false, true)).toBe('MandatoryOff')
    expect(buildFeatureState(false, false)).toBe('OptionalOff')
  })

  it('returns consistent labels per tab order key', () => {
    const fakeController = {
      ct: (key: string) => `t:${key}`,
    } as unknown as Parameters<typeof tabLabel>[1]

    expect(tabLabel('game', fakeController)).toBe('t:luthier_label_game')
    expect(tabLabel('gameFiles', fakeController)).toBe('t:luthier_label_game_files_and_launch')
    expect(tabLabel('runtime', fakeController)).toBe('t:luthier_label_runtime')
    expect(tabLabel('performance', fakeController)).toBe('t:luthier_enhancements')
    expect(tabLabel('prefix', fakeController)).toBe('t:luthier_dependencies')
    expect(tabLabel('winecfg', fakeController)).toBe('Winecfg')
    expect(tabLabel('wrappers', fakeController)).toBe('t:luthier_launch_and_environment')
    expect(tabLabel('review', fakeController)).toBe('t:luthier_review_and_generate')
  })
})
