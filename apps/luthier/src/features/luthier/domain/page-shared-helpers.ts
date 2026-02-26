/**
 * domain/page-shared-helpers.ts
 *
 * Pure domain helpers extracted from `luthier-page-shared.tsx`.
 * These functions contain no JSX and do not depend on Solid.js,
 * keeping business logic decoupled from the view layer.
 */

import type { FeatureState } from '../../../models/config'

export function isLikelyAbsolutePath(path: string) {
    const trimmed = path.trim()
    return trimmed.startsWith('/') || /^[A-Za-z]:[\\/]/.test(trimmed)
}

export function isTauriLocalRuntime() {
    if (typeof window === 'undefined') return false
    const w = window as unknown as Record<string, unknown>
    return typeof w.__TAURI_IPC__ !== 'undefined' || typeof w.__TAURI__ !== 'undefined'
}

export function posixDirname(path: string) {
    const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
    if (!normalized || normalized === '/') return '/'
    const idx = normalized.lastIndexOf('/')
    if (idx <= 0) return '/'
    return normalized.slice(0, idx)
}

export function buildAncestorPathsFromExe(exePath: string): string[] {
    if (!isLikelyAbsolutePath(exePath)) return []
    const dir = posixDirname(exePath)
    const normalized = dir.replace(/\\/g, '/')
    if (!normalized.startsWith('/')) return [dir]
    const parts = normalized.split('/').filter(Boolean)
    const out: string[] = []
    let current = ''
    for (const part of parts) {
        current += `/${part}`
        out.push(current)
    }
    return out
}

export function relativeInsideBase(base: string, target: string): string | null {
    const b = base.replace(/\\/g, '/').replace(/\/+$/, '')
    const t = target.replace(/\\/g, '/').replace(/\/+$/, '')
    if (t === b) return '.'
    if (!t.startsWith(`${b}/`)) return null
    return t.slice(b.length + 1) || '.'
}

export function basenamePath(path: string): string {
    const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
    const idx = normalized.lastIndexOf('/')
    return idx >= 0 ? normalized.slice(idx + 1) : normalized
}

export function parseWxH(raw: string | null): { width: string; height: string } {
    if (!raw) return { width: '', height: '' }
    const [width, height] = raw.split('x')
    return { width: width ?? '', height: height ?? '' }
}

export function buildWxH(width: string, height: string): string | null {
    const w = width.trim()
    const h = height.trim()
    if (!w || !h) return null
    return `${w}x${h}`
}

export function featureStateEnabled(value: FeatureState): boolean {
    return value === 'MandatoryOn' || value === 'OptionalOn'
}

export function featureStateMandatory(value: FeatureState): boolean {
    return value === 'MandatoryOn' || value === 'MandatoryOff'
}

export function buildFeatureState(enabled: boolean, mandatory: boolean): FeatureState {
    if (enabled) return mandatory ? 'MandatoryOn' : 'OptionalOn'
    return mandatory ? 'MandatoryOff' : 'OptionalOff'
}
