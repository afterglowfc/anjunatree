// A short, human-readable history — not a mirror of every commit. Add an
// entry here for anything a listener would actually notice; leave refactors
// and internal fixes out. CHANGELOG.md at the repo root carries the fuller,
// developer-facing version.
//
// `APP_VERSION` is a plain incrementing marker, not semver — it only has to
// change when there's something worth telling a returning visitor about.
// Bump it alongside adding an entry here; see useUpdateFlow.ts for how it's
// used to decide whether to show the changelog automatically.

export const APP_VERSION = '2026.09.22'

export interface ChangelogEntry {
  version: string
  date: string
  title: string
  items: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2026.09.22',
    date: '22 September 2026',
    title: 'A simpler way to hear the full track',
    items: [
      'Full tracks now always open in your own Spotify, Apple Music, or YouTube Music — no more connecting an account just to press play',
      'Apple Music links go to the exact track for everyone, automatically',
      'Pick a preferred service in Settings and it opens first on every release',
      'Connecting Spotify is now just for your saved releases and constellation playlists — full-track playback never needed it',
    ],
  },
  {
    version: '2026.08.20f',
    date: '20 August 2026',
    title: 'Listen on…',
    items: [
      'Every release now has a "Listen on" row — Spotify, Apple Music, and YouTube Music — that works for everyone, no account needed',
    ],
  },
  {
    version: '2026.08.20e',
    date: '20 August 2026',
    title: 'A second full-track option',
    items: [
      'Apple Music is now a second way to hear full tracks, alongside Spotify — connect it in Settings',
      'Added a Privacy Policy and Terms of Use, linked in the footer',
    ],
  },
  {
    version: '2026.08.20d',
    date: '20 August 2026',
    title: 'Countdown',
    items: [
      'Announced releases in the Release Tracker now show how far off they are — "in 8 days", "in 3 weeks", and so on',
      'Trimmed the footer disclaimer down to one clear sentence',
    ],
  },
  {
    version: '2026.08.20c',
    date: '20 August 2026',
    title: 'Share it',
    items: [
      'A share button on every release panel copies a link to that release, or to the artist constellation you’re tracing',
      'Save the map as a PNG from Settings — whatever view, theme and selection you’re looking at, with optional transparency and watermark',
    ],
  },
  {
    version: '2026.08.20b',
    date: '20 August 2026',
    title: 'Matching icons',
    items: [
      'The mute button and the welcome badge no longer use emoji — every icon in the app now tints with your chosen theme like the rest of the UI',
    ],
  },
  {
    version: '2026.08.20',
    date: '20 August 2026',
    title: 'Remember me',
    items: [
      'Saved-releases matching no longer re-checks your whole Spotify library on every visit — it’s cached for a day, with a "Refresh now" in Settings if you want it sooner',
    ],
  },
  {
    version: '2026.08.17',
    date: '17 August 2026',
    title: 'Small fixes',
    items: [
      'The "update ready" banner is now its own clear notice at the top of the screen, instead of unstyled text that could land on top of other messages',
      'A release lookup that fails now offers a Try again button instead of a dead end, and retries harder on its own first',
    ],
  },
  {
    version: '2026.08.16b',
    date: '16 August 2026',
    title: 'Make it yours',
    items: [
      'Connect Spotify and turn on “Light up my saved releases” in Settings to ring your saved albums and tracks on the map — checks a large library in parallel instead of one item at a time, so it doesn’t sit and think for ages',
      'Export any artist’s constellation as a private Spotify playlist, right from the release panel',
    ],
  },
  {
    version: '2026.08.16',
    date: '16 August 2026',
    title: 'Cleaner search',
    items: [
      'Searching for something with no matches now says so, instead of going quiet',
      'Map labels stay legible over the dots sitting underneath them',
    ],
  },
  {
    version: '2026.08.13',
    date: '13 August 2026',
    title: 'Sharper edges',
    items: [
      'Fixed the logo’s trunk and timeline rendering invisible in every theme',
      '“Radio” is now “Surprise Me”',
      'Header controls stay right-aligned and stop overlapping at every screen size, with a new one-tap Theme menu',
      'Search is visible by default instead of hiding behind an icon',
    ],
  },
  {
    version: '2026.08.11',
    date: '11 August 2026',
    title: 'Full tracks, and a proper player',
    items: [
      'Connect Spotify Premium and releases play in full, not just previews',
      'The player is now front and centre, with real play/pause, mute and stop controls',
      'The AnjunaTree mark got its real artwork — a palm fan in your theme’s own colours',
      'Fixed previews occasionally failing to load on iPhone',
      'A social preview card now shows up when a link to AnjunaTree is shared elsewhere',
    ],
  },
  {
    version: '2026.08.10',
    date: '10 August 2026',
    title: 'Personalise it',
    items: [
      'Four themes named after the music, plus text size and accessibility options',
      'Install AnjunaTree as an app — it works offline once installed',
      'A running feed of the newest releases, with what’s announced but not out yet',
    ],
  },
  {
    version: '2026.08.06',
    date: '6 August 2026',
    title: 'Follow an artist',
    items: [
      'Selecting a release traces that artist’s whole run across the map',
      'Radio mode: press play and it walks the catalogue for you',
      'A second map view arranges releases by genre instead of by label',
    ],
  },
  {
    version: '2026.08.04',
    date: '4 August 2026',
    title: 'AnjunaTree launches',
    items: [
      'Every Anjunabeats, Anjunadeep and Anjunachill release since 2000, on one map',
      'Click any release to hear a 30-second preview',
    ],
  },
]
