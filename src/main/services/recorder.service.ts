import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { ffmpegService, FFmpegProcess } from "./ffmpeg.service";
import { segmentsDir } from "../utils/segments";
import { hideMainWindow } from "../windows/main.window";
import { hideTrimWindow } from "../windows/trim.windows";


let recordProc: FFmpegProcess | null = null;
let recordFile: string | null = null;
let recordingStartEpochMs: number | null = null;

/* ---------------- START RECORDING ---------------- */

export async function startRecording() {
  if (recordProc) throw new Error("Recording already in progress");
// If micName is not provided, try to find automatically
    const micName = await ffmpegService.getDefaultMic();
    if (!micName) return console.error("No microphone found");
    
  // ✅ restore behavior (correct place)
  hideMainWindow();
  hideTrimWindow();
    
  recordingStartEpochMs = Date.now();

  recordFile = path.join(
    segmentsDir,
    `record_${recordingStartEpochMs}_${uuidv4()}.mp4`
  );

  const metaFile = recordFile.replace(".mp4", ".json");

  fs.writeFileSync(metaFile, JSON.stringify({
    videoFile: recordFile,
    startEpochMs: recordingStartEpochMs
  }, null, 2));

  const args = [
    "-y",

    "-thread_queue_size", "1024",
    "-use_wallclock_as_timestamps", "1",
    "-f", "gdigrab",
    "-draw_mouse", "1",
    "-framerate", "30",
    "-i", "desktop",

    "-thread_queue_size", "1024",
    "-use_wallclock_as_timestamps", "1",
    "-f", "dshow",
    "-i", `audio=${micName}`,

    "-map", "0:v:0",
    "-map", "1:a:0",

    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "14",
    "-pix_fmt", "yuv420p",
    "-g", "30",
    "-sc_threshold", "0",
    "-fps_mode", "cfr",

    // "-vf", "trim=start=0.15,setpts=PTS-STARTPTS",
    // "-af", "adelay=50|50,atrim=start=0.15,asetpts=PTS-STARTPTS",

    "-c:a", "aac",
    "-b:a", "320k",
    "-ar", "44100",

    "-movflags", "+faststart",
    recordFile
  ];


  recordProc = ffmpegService.spawn(args);


  recordProc.on("close", code => {
    console.log("Recording stopped", code);
    recordProc = null;
  });

  console.log("Recording started on file:", recordFile);
}


export async function stopRecording(): Promise<string> {
  if (!recordProc || !recordFile)
    throw new Error("No recording in progress");

  const proc = recordProc;
  const file = recordFile;

  return new Promise((resolve, reject) => {
    proc.on("exit", code => {
      recordProc = null;
      recordFile = null;

      if (code === 0) resolve(file);
      else reject(new Error(`ffmpeg exited with ${code}`));
    });

    ffmpegService.stop(proc);

  });
}



