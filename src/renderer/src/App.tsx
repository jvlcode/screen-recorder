import React, { useState, useEffect } from 'react'
import Versions from './components/Versions'
import electronLogo from './assets/electron.svg'

function App(): React.JSX.Element {
  const [recording, setRecording] = useState(false)
  const [chunks, setChunks] = useState<BlobPart[]>([])
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const micRecorderRef = React.useRef<MediaRecorder | null>(null);

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
      // const sources = await window.api.getSources({ types: ['screen'] })
      // const selectedSource = sources[0]
      // console.log(sources);

      // Step 2: build constraints for desktop video
      // const desktopConstraints: MediaStreamConstraints = {
      //   audio: false,
      //   video: {
      //   mandatory: {
      //     chromeMediaSource: 'desktop',
      //     chromeMediaSourceId: selectedSource.id,
      //      maxFrameRate: 30,   
      //      minFrameRate: 30    // (optional)// <-- add this
      //   }
      // } as any// TS
      // }

      // Step 3: get desktop stream
      // const desktopStream = await navigator.mediaDevices.getUserMedia(desktopConstraints)

      // Step 4: get microphone stream separately
      // const micStream = await navigator.mediaDevices.getUserMedia({
      //   audio: {
      //     sampleRate: 48000,
      //     channelCount: 2,
      //     echoCancellation: false,
      //     noiseSuppression: false,
      //     autoGainControl: false
      //   }
      // })

      // Step 5: setup desktop recorder
      // let mimeType = 'video/webm; codecs=h264'
      // if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/mp4; codecs=h264'

      // const desktopRecorder = new MediaRecorder(desktopStream, {
      //   mimeType,
      //   audioBitsPerSecond: 328000,
      //   videoBitsPerSecond: 6000000
      // })
      // const desktopChunks: BlobPart[] = []
      // desktopRecorder.ondataavailable = (e) => desktopChunks.push(e.data)

      // Step 6: setup microphone recorder
      // const micRecorder = new MediaRecorder(micStream, {
      //   mimeType: 'audio/webm',
      //  audioBitsPerSecond: 320000
      // })
      // const micChunks: BlobPart[] = []
      // micRecorder.ondataavailable = (e) => micChunks.push(e.data)

      // Step 7: on stop, send both blobs together
      // const onStop = async () => {
      //   const desktopBlob = new Blob(desktopChunks, { type: 'video/webm' })
      //   const micBlob = new Blob(micChunks, { type: 'audio/webm' })

      //   const desktopBuffer = new Uint8Array(await desktopBlob.arrayBuffer())
      //   const micBuffer = new Uint8Array(await micBlob.arrayBuffer())

      //   // send both in one IPC call
      //   await window.api.invoke('save-segment', { video: desktopBuffer, audio: micBuffer })
      // }

      // desktopRecorder.onstop = onStop
      // micRecorder.onstop = onStop

      // Step 8: start both
      // desktopRecorder.start()
      // micRecorder.start()

      // mediaRecorderRef.current = desktopRecorder
      // micRecorderRef.current = micRecorder

      setRecording(true)
      window.api.invoke('recording:started')
    } catch (err) {
      console.error("Error in startRecording:", err)
    }
  }

  // Stop recording both
  const stopRecording = () => {
    console.log("recording:stopped")
    // mediaRecorderRef.current?.stop()
    // micRecorderRef.current?.stop()
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
    <div onClick={handleClick}>
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
