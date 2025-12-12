import React, { useState, useEffect } from 'react'
import Versions from './components/Versions'
import electronLogo from './assets/electron.svg'

function App(): React.JSX.Element {
  const [recording, setRecording] = useState(false)
  const [chunks, setChunks] = useState<BlobPart[]>([])
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);

   const handleClick = (e: React.MouseEvent) => {
    const x = e.clientX
    const y = e.clientY
    window.api.sendClick(x, y)
  }

  useEffect(() => {
    
    window.api.on("recording:stop", stopRecording);
    return () => window.api.removeListener("recording:stop", stopRecording);;
  }, []);

//   useEffect(() => {

// }, [mediaRecorder]);

const startRecording = async () => {
  try {
    // Step 1: get desktop sources
    const sources = await window.api.getSources({ types: ['screen'] })
    const selectedSource = sources[0]

    // Step 2: build constraints for desktop video
    const desktopConstraints: MediaStreamConstraints = {
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: selectedSource.id
        }
      } as any
    }

    // Step 3: get desktop stream
    const desktopStream = await navigator.mediaDevices.getUserMedia(desktopConstraints)

    // Step 4: get microphone stream
// Step 4: get microphone stream with 48 kHz
const micStream = await navigator.mediaDevices.getUserMedia({
  audio: {
    sampleRate: 48000,       // request 48 kHz
    channelCount: 2,         // stereo
    echoCancellation: false, // disable DSP if you want raw sound
    noiseSuppression: false,
    autoGainControl: false
  }
})
    // Step 5: merge tracks
    const combinedStream = new MediaStream([
      ...desktopStream.getVideoTracks(),
      ...micStream.getAudioTracks()
    ])

    // Step 6: setup recorder
    let mimeType = 'video/webm; codecs=vp9,opus'
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm'
    }

    const recorder = new MediaRecorder(combinedStream, { mimeType,  audioBitsPerSecond: 328000,   // ✅ set audio bitrate to 328 kbps
  videoBitsPerSecond: 6000000,  })
    
    const localChunks: BlobPart[] = []

    recorder.ondataavailable = (e) => localChunks.push(e.data)

    recorder.onstop = async () => {
      const blob = new Blob(localChunks)
      const arrayBuffer = await blob.arrayBuffer()
      const uint8 = new Uint8Array(arrayBuffer)
      await window.api.invoke('save-segment', uint8)
    }

    recorder.start()
    window.api.invoke('recording:started')

    setChunks(localChunks)
    mediaRecorderRef.current = recorder
    setRecording(true)
  } catch (err) {
    console.error("Error in startRecording:", err)
  }
}
  // Stop recording
  const stopRecording = () => {
    console.log("recording:stopped");
    mediaRecorderRef.current?.stop();
    setRecording(false)
  }

  useEffect(() => {
    

    // Resume recording after trim
    const resumeHandler = () => startRecording()
    window.api.on('recording:resume', resumeHandler)

    return () => {
    window.api.removeListener('recording:resume', resumeHandler)
    }
  }, [])

  // Existing IPC test
  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')

  return (
    <div  onClick={handleClick}>
      <img alt="logo" className="logo" src={electronLogo} />
      <div className="creator">Powered by electron-vite</div>
      <div className="text">
        Build an Electron app with <span className="react">React</span>
        &nbsp;and <span className="ts">TypeScript</span>
      </div>
      <p className="tip">
        Please try pressing <code>F12</code> to open the devTool
      </p>

      {/* Recorder Controls */}
      <div className="recorder-controls">
        <button onClick={startRecording} disabled={recording}>Start Recording</button>
        <button onClick={stopRecording} disabled={!recording}>Stop Recording</button>
      </div>

      <div className="actions">
        <div className="action">
          <a href="https://electron-vite.org/" target="_blank" rel="noreferrer">
            Documentation
          </a>
        </div>
        <div className="action">
          <a target="_blank" rel="noreferrer" onClick={ipcHandle}>
            Send IPC
          </a>
        </div>
      </div>
      <Versions></Versions>
    </div>
  )
}

export default App
