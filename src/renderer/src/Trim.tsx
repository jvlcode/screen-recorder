import React, { useEffect, useRef, useState } from 'react'

export default function Trim(): React.JSX.Element {
  const [file, setFile] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(0)
  const [finalizing, setFinalizing] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)

  const seekingFromSlider = useRef(false)
  const activeHandle = useRef<'start' | 'end' | null>(null)

  /* IPC */
  useEffect(() => {
    const handler = (filePath: string) => {
      filePath = filePath.replace(/\\/g, '/')
      setFile(filePath)
      setDuration(0)
      setStart(0)
      setEnd(0)
    }

    window.api.on('recording:stopped', handler)
    return () => window.api.removeListener('recording:stopped', handler)
  }, [])

  /* Video metadata */
  const handleLoadedMetadata = () => {
    if (!videoRef.current) return
    const d = videoRef.current.duration
    setDuration(d)
    setStart(0)
    setEnd(d)
  }

  /* Seek logic */
  /* Seek logic */
  const seekVideo = (t: number, handle: 'start' | 'end') => {
    const v = videoRef.current
    if (!v) return

    if (handle === 'start') {
      setStart(t)
      // don’t force video head to start position unless you want preview
      v.currentTime = t
    } else {
      setEnd(t)
      v.currentTime = t
    }
  }

  /* Sync sliders when video moves */
  const syncSliderWithVideo = () => {
    const v = videoRef.current
    if (!v) return

    if (seekingFromSlider.current) {
      // Update whichever handle is active
      if (activeHandle.current === 'start') {
        setStart(v.currentTime)
      } else if (activeHandle.current === 'end') {
        setEnd(v.currentTime)
      }
      seekingFromSlider.current = false
      activeHandle.current = null
    }
  }

  /* Actions */
  const trimSegment = async () => {
    if (!file || !videoRef.current) return;

    // Stop playback and release file handle
    videoRef.current.pause();
    videoRef.current.src = "";
    videoRef.current.load(); // forces browser to drop reference

    await window.api.invoke("trim-segment", {
      filePath: file,
      startSec: start,
      endSec: end,
    });

    setFile(null);
  };

  const finalizeVideo = async () => {
    setFinalizing(true)
    try {
      if (!file || !videoRef.current) return;
      // Stop playback and release file handle
      videoRef.current.pause();
      videoRef.current.src = "";
      videoRef.current.load(); // forces browser to drop reference
      const out = await window.api.invoke('finalize')
      alert(`Saved at:\n${out}`)
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
      <h2 style={{ marginBottom: 8 }}>Trim Segment</h2>

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
          <div
            style={{
              position: 'relative',
              height: 30,
              background: '#1e1e1e',
              borderRadius: 6,
              overflow: 'hidden'
            }}
          >
            {/* Selected range */}
            <div
              style={{
                position: 'absolute',
                left: `${(start / (duration || 1)) * 100}%`,
                width: `${((end - start) / (duration || 1)) * 100}%`,
                top: 0,
                height: '100%',
                background: 'rgba(76,175,80,0.35)'
              }}
            />

            {/* Start handle */}
            <div
              style={{
                position: 'absolute',
                left: `${(start / (duration || 1)) * 100}%`,
                top: 0,
                width: 2,
                height: '100%',
                background: '#fff'
              }}
            />

            {/* End handle */}
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

          {/* Start slider */}
          {/* Start slider */}
          <input
            type="range"
            min={0}
            max={duration}
            step={1 / 30}
            value={start}
            onChange={(e) => {
              const t = Number(e.target.value)
              // clamp so start never goes beyond end - 0.01
              if (t < end - 0.01) {
                setStart(t)
                seekVideo(t, 'start')
              }
            }}
            style={{ width: '100%', marginTop: 6 }}
          />

          {/* End slider */}
          <input
            type="range"
            min={0}
            max={duration}
            step={1 / 30}
            value={end}
            onChange={(e) => {
              const t = Number(e.target.value)
              // clamp so end never goes before start + 0.01
              if (t > start + 0.01) {
                setEnd(t)
                seekVideo(t, 'end')
              }
            }}
            style={{ width: '100%', marginTop: 6 }}
          />

          {/* Labels */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12,
              color: '#777',
              marginBottom: 10
            }}
          >
            <span>Start: {start.toFixed(2)}s</span>
            <span>End: {end.toFixed(2)}s</span>
            <span>{duration.toFixed(2)}s</span>
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
