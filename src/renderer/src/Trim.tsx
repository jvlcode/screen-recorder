import React, { useState, useEffect, useRef } from 'react'

export default function Trim(): React.JSX.Element {
  const [file, setFile] = useState<string | null>(null)
  const [end, setEnd] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [finalizing, setFinalizing] = useState(false)

  useEffect(() => {
    const handler = (filePath: string) => {
      setFile(filePath)
      setEnd(0)
    }
    window.api.on('load-segment', handler)
    return () => window.api.removeListener('load-segment', handler)
  }, [])

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setEnd(videoRef.current.duration)
    }
  }

  const trimSegment = async () => {
    if (!file || !videoRef.current) return;

    // Perform trimming in main process
    await window.api.invoke("trim-segment", {
      filePath: file,
      startSec: 0,
      endSec: end
    });
    setFile(null);
    setEnd(0);
  };


  const finalizeVideo = async () => {
    setFinalizing(true)
    try {
      // Stop recording if active
      // await window.api.invoke('stop-recording')

      // Concatenate all segments
      const finalPath = await window.api.invoke('finalize')
      alert(`Final video saved at:\n${finalPath}`)
      window.close()
    } catch (err) {
      console.error(err)
      alert('Error finalizing video')
    } finally {
      setFinalizing(false)
    }
  }

  return (
    <div style={{
      padding: 20,
      maxWidth: 800,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      overflowY: 'auto',
      height: '100vh',
      boxSizing: 'border-box'
    }}>
      <h2>Trim Last Part</h2>

      {file ? (
        <>
          <video
            ref={videoRef}
            src={`file://${file}`}
            controls
            onLoadedMetadata={handleLoadedMetadata}
            style={{
              width: '100%',
              maxHeight: 400,
              border: '1px solid #ccc',
              borderRadius: 6,
              marginBottom: 20,
              objectFit: 'contain'
            }}
          />

          <div style={{ width: '100%', marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 10 }}>
              End: {end.toFixed(3)}s
            </label>
            <input
              type="range"
              min={0}
              max={videoRef.current?.duration || 0}
              step={0.001}
              value={end}
              onChange={(e) => {
                const val = Number(e.target.value)
                setEnd(val)
                if (videoRef.current) videoRef.current.currentTime = val
              }}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={trimSegment}
              style={{ padding: '10px 20px', fontSize: 16, borderRadius: 6, cursor: 'pointer' }}
            >
              Trim & Close
            </button>

            <button
              onClick={finalizeVideo}
              disabled={finalizing}
              style={{
                padding: '10px 20px',
                fontSize: 16,
                borderRadius: 6,
                cursor: 'pointer',
                backgroundColor: finalizing ? '#ccc' : '#4caf50',
                color: '#fff',
                border: 'none'
              }}
            >
              {finalizing ? 'Finalizing...' : 'Compile All Segments'}
            </button>
          </div>
        </>
      ) : (
        <p>Waiting for segment...</p>
      )}
    </div>
  )
}
