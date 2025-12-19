import { ipcMain, dialog } from "electron";
import { trimSegmentFile } from "../services/trim.service";
import { startRecording } from "../services/recorder.service";
import { log } from "..";

export function registerTrimIpc() {
  ipcMain.handle(
    "trim-segment",
    async (_e, payload: { filePath: string; startSec: number; endSec: number }) => {
      log("trim-segment called", payload);
      const { filePath, startSec, endSec } = payload;

      try {
        const out = await trimSegmentFile(filePath, startSec, endSec);
        log("trim segment IPC", filePath, startSec, endSec);

        log("windows hidden");
        await startRecording();
        log("recording started");

        return { ok: true, file: out };
      } catch (err: any) {
        // Log the error
        log("Error in trim-segment", err);

        // Show a native alert dialog
        dialog.showErrorBox("Trim Segment Error", err?.message || "An unknown error occurred");

        // Optionally return an error object to the renderer
        return { ok: false, error: err?.message || String(err) };
      }
    }
  );
}