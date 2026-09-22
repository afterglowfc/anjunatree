import { useEffect, useRef, useState } from 'react'
import { labelVar } from './data'
import { MuteIcon, PauseIcon, PlayIcon, StopIcon, VolumeIcon } from './Icons'
import type { NowPlaying } from './types'

interface Props {
  nowPlaying: NowPlaying
  paused: boolean
  onPausedChange: (paused: boolean) => void
  onEnded: () => void
  onJumpTo: () => void
  onClose: () => void
}

// Plays the 30-second iTunes preview — the one source AnjunaTree ever
// embeds. Full tracks open in a listener's own Spotify/Apple Music/YouTube
// Music instead, via the "Listen on" links in ReleasePanel.tsx, so this
// component no longer needs to know anything about either service: no
// resolving, no source-switching, no third-party playback state to mirror.
// See musicLinks.ts and docs/DEVELOPMENT.md for why.

const fmt = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function PlayerBar({
  nowPlaying,
  paused,
  onPausedChange,
  onEnded,
  onJumpTo,
  onClose,
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [muted, setMuted] = useState(false)
  const [time, setTime] = useState({ positionMs: 0, durationMs: 0 })
  const { node, tracks, index, artworkUrl } = nowPlaying
  const track = tracks[index]

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !track?.previewUrl) return
    audio.src = track.previewUrl
    audio.muted = muted
    // Autoplay can be blocked before the first gesture; controls cover it.
    audio.play().catch(() => onPausedChange(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.rel.id, index, track?.previewUrl])

  const progress = time.durationMs ? Math.min(100, (time.positionMs / time.durationMs) * 100) : 0

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    if (audioRef.current) audioRef.current.muted = next
  }

  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) audio.play().catch(() => {})
    else audio.pause()
  }

  return (
    <div className="player-bar">
      <button className="player-bar-art" onClick={onJumpTo} title="Show this release on the map">
        {artworkUrl ? (
          <img src={artworkUrl.replace('300x300', '120x120')} alt="" width={56} height={56} />
        ) : (
          <span className="player-bar-art-placeholder" style={{ background: labelVar(node.lane) }} />
        )}
      </button>

      <div className="player-bar-body">
        <div className="player-bar-info">
          <span className="player-bar-title-text">{track?.trackName ?? node.rel.title}</span>
          <span className="player-bar-meta">
            {track?.artistName || node.rel.artist} · {node.rel.title} ·{' '}
            <span className="source-badge">30s preview</span>
          </span>
        </div>

        <div className="transport-track" aria-hidden="true">
          <span className="transport-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="transport-times" aria-hidden="true">
          <span>{fmt(time.positionMs)}</span>
          <span>{fmt(time.durationMs)}</span>
        </div>
      </div>

      <div className="transport-controls">
        <button
          className="transport-button primary"
          onClick={togglePlayPause}
          aria-label={paused ? 'Play' : 'Pause'}
          title={paused ? 'Play' : 'Pause'}
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
        </button>
        <button
          className={`transport-button${muted ? ' active' : ''}`}
          onClick={toggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <MuteIcon /> : <VolumeIcon />}
        </button>
        <button
          className="transport-button stop"
          onClick={onClose}
          aria-label="Stop playback"
          title="Stop"
        >
          <StopIcon />
        </button>
      </div>

      <audio
        ref={audioRef}
        hidden
        onPlay={() => onPausedChange(false)}
        onPause={() => onPausedChange(true)}
        onEnded={onEnded}
        onTimeUpdate={() => {
          // Read the live element off the ref rather than the synthetic
          // event's currentTarget: a timeupdate can still be in flight the
          // instant this element unmounts (a track switch), and
          // currentTarget going null there crashed the whole player.
          const a = audioRef.current
          if (a) setTime((p) => ({ ...p, positionMs: a.currentTime * 1000 }))
        }}
        onLoadedMetadata={() => {
          const a = audioRef.current
          if (a) setTime({ positionMs: 0, durationMs: a.duration * 1000 })
        }}
      />
    </div>
  )
}
