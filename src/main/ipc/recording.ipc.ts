import { ipcMain } from "electron";
import { startRecording } from "../services/recorder.service";


export function registerRecordingIpc() {
  
  ipcMain.handle("recording:started", async (_event) => {
    

    startRecording();

    

    
  });
}
