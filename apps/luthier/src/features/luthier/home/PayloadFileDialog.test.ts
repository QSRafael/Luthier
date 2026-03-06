import { describe, expect, it } from 'vitest'

import { basenamePath, normalizeDroppedPath } from './payload-file-path'

describe('PayloadFileDialog path helpers', () => {
  it('keeps plain filesystem paths unchanged', () => {
    expect(normalizeDroppedPath('/home/user/game-payload.cfg')).toBe('/home/user/game-payload.cfg')
  })

  it('normalizes and decodes file URLs from drag and drop', () => {
    expect(normalizeDroppedPath('file:///home/user/My%20Game/payload.json')).toBe(
      '/home/user/My Game/payload.json'
    )
  })

  it('extracts basename from unix and windows paths', () => {
    expect(basenamePath('/home/user/payload.json')).toBe('payload.json')
    expect(basenamePath('C:\\Games\\age3.exe')).toBe('age3.exe')
  })
})
