'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, AlertCircle } from 'lucide-react'

interface AudioPlayerProps {
  src: string
  label?: string
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function AudioPlayer({ src, label }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onLoadedMetadata = () => setDuration(audio.duration)
    const onEnded = () => setPlaying(false)
    const onError = () => setError(true)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [])

  const togglePlay = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      await audio.play()
      setPlaying(true)
    }
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <AlertCircle className="h-4 w-4" />
        <span>Recording unavailable</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <audio ref={audioRef} src={src} preload="metadata" aria-label={label ?? 'Call recording'} />
      <button
        onClick={togglePlay}
        className="p-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        aria-label={playing ? 'Pause recording' : 'Play recording'}
      >
        {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      </button>
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatTime(currentTime)} / {duration > 0 ? formatTime(duration) : '--:--'}
      </span>
    </div>
  )
}
