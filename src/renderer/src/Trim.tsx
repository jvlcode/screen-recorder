import React, { useEffect, useRef, useState } from 'react'

export default function Trim(): React.JSX.Element {
  const [file, setFile] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [end, setEnd] = useState(0)
  const [finalizing, setFinalizing] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const seekingFromSlider = useRef(false)

  /* IPC */
  useEffect(() => {
    const handler = (filePath: string) => {
      filePath = filePath.replace(/\\/g, '/')
      setFile(filePath)
      setDuration(0)
      setEnd(0)
    }
    window.api.on('recording:stopped', handler)
    return () => window.api.removeListener('recording:stopped', handler)
  }, [])

  /* Video */
  const handleLoadedMetadata = () => {
    if (!videoRef.current) return
    setDuration(videoRef.current.duration)
    setEnd(videoRef.current.duration)
  }

  const seekVideo = (t: number) => {
    const v = videoRef.current
    if (!v) return
    seekingFromSlider.current = true
    v.currentTime = Math.max(0, Math.min(t, duration))
    v.pause()
    setTimeout(() => (seekingFromSlider.current = false), 0)
  }

  const syncSliderWithVideo = () => {
    const v = videoRef.current
    if (!v || seekingFromSlider.current) return
    setEnd(v.currentTime)
  }

  /* Actions */
  const trimSegment = async () => {
    if (!file) return
    await window.api.invoke('trim-segment', {
      filePath: file,
      startSec: 0,
      endSec: end
    })
    setFile(null)
  }

  const finalizeVideo = async () => {
    setFinalizing(true)
    try {
      const out = await window.api.invoke('finalize')
      alert(`Saved at:\n${out}`)
      window.close()
    } catch {
      alert('Finalize failed')
    } finally {
      setFinalizing(false)
    }
  }

  /* UI */
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: 16,
        boxSizing: 'border-box'
      }}
    >
      <h2 style={{ marginBottom: 8 }}>Trim Last Part</h2>

      {!file && <p>Waiting for segment…</p>}

      {file && (
        <>
          {/* PREVIEW */}
          <div
            style={{
              flex: '1 1 auto',
              minHeight: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 10
            }}
          >
            <video
              ref={videoRef}
              src={`file://${file}`}
              controls
              preload="auto"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={syncSliderWithVideo}
              onPause={syncSliderWithVideo}
              style={{
                maxHeight: '65vh',
                maxWidth: '100%',
                background: '#000',
                borderRadius: 6
              }}
            />
          </div>

          {/* TIMELINE */}
          <div>
            <div
              style={{
                position: 'relative',
                height: 30,
                background: '#1e1e1e',
                borderRadius: 6,
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  height: '100%',
                  width: `${(end / (duration || 1)) * 100}%`,
                  background: 'rgba(76,175,80,0.35)'
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: `${(end / (duration || 1)) * 100}%`,
                  top: 0,
                  width: 2,
                  height: '100%',
                  background: '#fff'
                }}
              />
            </div>

            <input
              type="range"
              min={0}
              max={duration}
              step={1 / 30}
              value={end}
              onChange={(e) => {
                const t = Number(e.target.value)
                setEnd(t)
                seekVideo(t)
              }}
              style={{ width: '100%', marginTop: 6 }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: '#777',
                marginBottom: 10
              }}
            >
              <span>0.00s</span>
              <span>Trim end: {end.toFixed(2)}s</span>
              <span>{duration.toFixed(2)}s</span>
            </div>
          </div>

          {/* ACTIONS */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={trimSegment}
              style={{
                padding: '10px 20px',
                fontSize: 15,
                borderRadius: 6
              }}
            >
              Trim & Close
            </button>

            <button
              onClick={finalizeVideo}
              disabled={finalizing}
              style={{
                padding: '10px 20px',
                fontSize: 15,
                borderRadius: 6,
                background: finalizing ? '#aaa' : '#4caf50',
                color: '#fff',
                border: 'none'
              }}
            >
              {finalizing ? 'Finalizing…' : 'Compile All Segments'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
