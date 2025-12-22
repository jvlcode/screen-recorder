import { ipcMain, dialog } from "electron";
import { trimSegmentFile, discardSegmentFile } from "../services/segment.service";
import { startRecording } from "../services/recorder.service";
import { log } from "..";

/* ---------------- HELPER ---------------- */

async function runSegmentAction<T>(
  actionName: string,
  action: () => Promise<T>
) {
  try {
    const result = await action();

    log("windows hidden");
    await startRecording();
    log("recording started");

    return { ok: true, file: result };
  } catch (err: any) {
    log(`Error in ${actionName}`, err);

    dialog.showErrorBox(
      `${actionName} Error`,
      err?.message || "An unknown error occurred"
    );

    return { ok: false, error: err?.message || String(err) };
  }
}

/* ---------------- IPC ---------------- */

export function registerTrimIpc() {
  ipcMain.handle(
    "trim-segment",
    async (_e, { filePath, startSec, endSec }) => {
      log("trim-segment called", { filePath, startSec, endSec });

      return runSegmentAction("Trim Segment", () =>
        trimSegmentFile(filePath, startSec, endSec)
      );
    }
  );

  ipcMain.handle(
    "discard-segment",
    async (_e, { filePath }) => {
      log("discard-segment called", { filePath });

      return runSegmentAction("Discard Segment", () =>
        discardSegmentFile(filePath)
      );
    }
  );
}
