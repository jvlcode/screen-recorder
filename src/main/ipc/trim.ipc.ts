import { ipcMain } from "electron";
import { trimSegmentFile } from "../services/trim.service";
import { hideMainWindow } from "../windows/main.window";
import { hideTrimWindow } from "../windows/trim.windows";
import { startRecording } from "../services/recorder.service";
import { log } from "..";

export function registerTrimIpc() {
    ipcMain.handle(
        "trim-segment",
        async (_e, payload: { filePath: string; startSec: number; endSec: number }) => {
            const { filePath, startSec, endSec } = payload;

            const out = await trimSegmentFile(filePath, startSec, endSec);
            log("trim segment IPC", filePath, startSec, endSec);
            // ✅ restore behavior (correct place)
            hideMainWindow();
            hideTrimWindow();
            log("windows hidden");
            startRecording();
            log("recording started");
            return { ok: true, file: out };
        }
    );
}
