import { ipcMain } from "electron";
import { trimSegmentFile } from "../services/trim.service";
import { hideMainWindow } from "../windows/main.window";
import { hideTrimWindow } from "../windows/trim.windows";
import { startRecording } from "../services/recorder.service";

export function registerTrimIpc() {
    ipcMain.handle(
        "trim-segment",
        async (_e, payload: { filePath: string; startSec: number; endSec: number }) => {
            const { filePath, startSec, endSec } = payload;

            const out = await trimSegmentFile(filePath, startSec, endSec);
        
            // ✅ restore behavior (correct place)
            hideMainWindow();
            hideTrimWindow();

            startRecording();
            return { ok: true, file: out };
        }
    );
}
