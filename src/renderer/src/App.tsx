import React, { useState, useEffect } from 'react'
import Versions from './components/Versions'
import electronLogo from './assets/electron.svg'

function App(): React.JSX.Element {
  const [recording, setRecording] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    const x = e.clientX
    const y = e.clientY
    window.api.sendClick(x, y)
  }

  useEffect(() => {

    window.api.on("recording:stopped", stopRecording);
    return () => window.api.removeListener("recording:stopped", stopRecording);;
  }, []);


  const startRecording = async () => {
    try {
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


  return (
    <div onClick={handleClick}>
      <img alt="logo" className="logo" src={electronLogo} />
      <p className="tip">
        Please try pressing <code>F12</code> to open the devTool
      </p>
      <div className="actions">
        <div className="action">
          <button onClick={startRecording} disabled={recording}>Start Recording</button>
        </div>
        <div className="action">
           <button onClick={stopRecording} disabled={!recording}>Stop Recording</button>
        </div>
      </div>
      <Versions></Versions>
    </div>
  )
}

export default App
