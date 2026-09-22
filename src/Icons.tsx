// A handful of hand-drawn stroke icons — no icon font or library, matching
// the project's dependency-free approach to iconography (see Brand.tsx).
// Each is 16x16, `currentColor` stroked, so it inherits the button's text
// colour and the text-size setting's effect on line-height for free.

interface IconProps {
  className?: string
}

const common = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className}>
      <circle cx="7" cy="7" r="4.5" />
      <line x1="10.3" y1="10.3" x2="14" y2="14" />
    </svg>
  )
}

/** Three sliders, not a funnel — reads unambiguously as "adjust", which a
 * funnel glyph rarely does at 16px. */
export function SlidersIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className}>
      <line x1="2" y1="4" x2="14" y2="4" />
      <circle cx="6" cy="4" r="1.6" fill="currentColor" stroke="none" />
      <line x1="2" y1="8" x2="14" y2="8" />
      <circle cx="10" cy="8" r="1.6" fill="currentColor" stroke="none" />
      <line x1="2" y1="12" x2="14" y2="12" />
      <circle cx="7.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

const speaker = <path d="M2 6h2.6L8 3v10L4.6 10H2Z" fill="currentColor" stroke="none" />

/** The speaker alone, no waves — used as the base of both Volume and Mute. */
export function VolumeIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className}>
      {speaker}
      <path d="M10.5 5.5c1 .8 1 4.2 0 5" />
      <path d="M12.3 3.7c2 1.8 2 6.8 0 8.6" />
    </svg>
  )
}

export function MuteIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className}>
      {speaker}
      <line x1="10.5" y1="5.5" x2="14.5" y2="10.5" />
      <line x1="14.5" y1="5.5" x2="10.5" y2="10.5" />
    </svg>
  )
}

export function PlayIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className}>
      <path d="M4 2.5v11l9-5.5Z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  )
}

export function PauseIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className}>
      <line x1="5" y1="3" x2="5" y2="13" strokeWidth="2.4" />
      <line x1="11" y1="3" x2="11" y2="13" strokeWidth="2.4" />
    </svg>
  )
}

export function StopIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className}>
      <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** The classic "box with an arrow escaping upward" — reads as "share"
 * without needing a platform-specific share-sheet icon. */
export function ShareIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className}>
      <path d="M8 10V2" />
      <path d="M4.8 5.2 8 2l3.2 3.2" />
      <path d="M3 8v4a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8" />
    </svg>
  )
}

/** A sprout — used where the app is introducing itself ("new & growing"),
 * standing in for the 🌱 emoji so it tints with the theme like every other
 * icon instead of always rendering in its own fixed colour. */
export function SproutIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className}>
      <path d="M8 14V7.5" />
      <path d="M8 7.5C8 7.5 3.2 6.8 3.2 2.3C7.4 2.3 8 6.6 8 7.5Z" />
      <path d="M8 9.5C8 9.5 12 8.9 12 5.1C8.5 5.1 8 8.8 8 9.5Z" />
    </svg>
  )
}

/** A generic "opens elsewhere" glyph for links out to other services —
 * deliberately not any service's own logo (see musicLinks.ts) so it never
 * reads as branding or endorsement. */
export function ExternalLinkIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className}>
      <path d="M6.5 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9.5" />
      <path d="M9 3h4v4" />
      <path d="M13 3 7 9" />
    </svg>
  )
}
