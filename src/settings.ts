// User preferences, persisted locally. Nothing here ever leaves the browser.
import { DEFAULT_THEME } from './themes'
import type { ThemeId } from './themes'

export const FONT_SCALES = [
  { id: 'sm', label: 'Small', scale: 0.9 },
  { id: 'md', label: 'Default', scale: 1 },
  { id: 'lg', label: 'Large', scale: 1.15 },
  { id: 'xl', label: 'Largest', scale: 1.3 },
] as const

export type FontScaleId = (typeof FONT_SCALES)[number]['id']

/** Which service "Play full track" opens by default. 'ask' shows the full
 * Listen-on row with no service emphasized; any other value moves that
 * service first and highlights it as the one-click default. */
export type PreferredService = 'ask' | 'spotify' | 'apple' | 'youtube'

export interface Settings {
  theme: ThemeId
  fontScale: FontScaleId
  highContrast: boolean
  reduceMotion: boolean
  /** Draw bigger marks on the map — helps low-vision users hit and see them. */
  largeMarks: boolean
  /** Ring saved Spotify releases on the map. Off by default — connecting
   * Spotify shouldn't itself change what the map looks like without an
   * explicit opt-in. */
  showSavedReleases: boolean
  preferredService: PreferredService
  /** Open Spotify links via its `spotify:` URI (native app) instead of the
   * open.spotify.com web player. Spotify-only: Apple Music and YouTube
   * Music links are universal/app links, so the OS already picks app vs.
   * web on its own — there's no separate choice to offer for those. */
  openSpotifyInApp: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  theme: DEFAULT_THEME,
  fontScale: 'md',
  highContrast: false,
  reduceMotion: false,
  largeMarks: false,
  showSavedReleases: false,
  preferredService: 'ask',
  openSpotifyInApp: false,
}

const KEY = 'anjunatree:settings'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_SETTINGS, reduceMotion: prefersReducedMotion() }
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // Private browsing or a full quota — preferences just won't persist.
  }
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export const scaleOf = (id: FontScaleId): number =>
  FONT_SCALES.find((f) => f.id === id)?.scale ?? 1

/** Reflect settings that CSS cares about onto :root. */
export function applySettings(s: Settings): void {
  const r = document.documentElement
  r.style.setProperty('--font-scale', String(scaleOf(s.fontScale)))
  r.dataset.contrast = s.highContrast ? 'high' : 'normal'
  r.dataset.motion = s.reduceMotion ? 'reduced' : 'full'
}
