import { ipcMain } from "electron";
import { startRecording } from "../services/recorder.service";
import { hideTrimWindow } from "../windows/trim.windows";
import { hideMainWindow } from "../windows/main.window";

export function registerRecordingIpc() {
  ipcMain.handle("recording:started", async (_event, micName?: string) => {
    startRecording(micName);

    // ✅ restore behavior (correct place)
    hideMainWindow();
    hideTrimWindow();

    return { ok: true };
  });

}
