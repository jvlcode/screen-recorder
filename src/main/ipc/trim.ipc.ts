import { ipcMain } from "electron";
import { trimSegmentFile } from "../services/trim.service";
import { startRecording } from "../services/recorder.service";
import { log } from "..";

export function registerTrimIpc() {
   
    ipcMain.handle(
        "trim-segment",
        async (_e, payload: { filePath: string; startSec: number; endSec: number }) => {
            log("trim-segment called", payload);
            const { filePath, startSec, endSec } = payload;
            
            const out = await trimSegmentFile(filePath, startSec, endSec);
            log("trim segment IPC", filePath, startSec, endSec);
 
            log("windows hidden");
            await startRecording();
            log("recording started");
            return { ok: true, file: out };
        }
    );
}
