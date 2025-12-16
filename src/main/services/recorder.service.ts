import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { ffmpegService, FFmpegProcess } from "./ffmpeg.service";
import { segmentsDir } from "../utils/segments";
import { spawn } from "child_process";
import { app } from "electron";

let recordProc: FFmpegProcess | null = null;
let recordFile: string | null = null;
let recordingStartEpochMs: number | null = null;

/* ---------------- START RECORDING ---------------- */

export function startRecording(micName = "Microphone (2- HyperX SoloCast)") {
  if (recordProc) throw new Error("Recording already in progress");

  recordingStartEpochMs = Date.now();

  recordFile = path.join(
    segmentsDir,
    `record_${recordingStartEpochMs}_${uuidv4()}.mp4`
  );

  const metaFile = recordFile.replace(".mp4", ".json");

  fs.writeFileSync(metaFile, JSON.stringify({
    videoFile: recordFile,
    startEpochMs: recordingStartEpochMs,
    clicks: []
  }, null, 2));

  startMouseTracker();

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

  console.log("Recording started:", recordFile);
}

function mergeClicksIntoMeta(file: string) {
  try {
    let clicksFile;
  if (app.isPackaged) {
    // In production, packaged resources live under process.resourcesPath
    clicksFile = path.join(process.resourcesPath, 'python', 'clicks.json');
  } else {
    // In dev, point to your local source folder
    clicksFile = path.join(__dirname, 'resources', 'python', 'clicks.json');
  }

    if (!fs.existsSync(clicksFile)) return;

    const clicks = JSON.parse(fs.readFileSync(clicksFile, "utf-8"));
    const metaFile = file.replace(".mp4", ".json");

    if (!fs.existsSync(metaFile)) return;

    const meta = JSON.parse(fs.readFileSync(metaFile, "utf-8"));

    clicks.forEach((c: any) => {
      meta.clicks.push({
        x: c.x,
        y: c.y,
        button: c.button,
        timeMs: c.timeMs - meta.startEpochMs
      });
    });

    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
    console.log(`Merged ${clicks.length} clicks`);
  } catch (e) {
    console.error("Click merge failed", e);
  }
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

    setTimeout(() => mergeClicksIntoMeta(file), 100);
  });
}


let mouseTrackerProcess;

export function startMouseTracker() {
  if (mouseTrackerProcess) return; // already running

  // Adjust path to your resources/python folder

  let scriptPath;

  if (app.isPackaged) {
    // In production, packaged resources live under process.resourcesPath
    scriptPath = path.join(process.resourcesPath, 'python', 'mouse_tracker.py');
  } else {
    // In dev, point to your local source folder
    scriptPath = path.join(__dirname, 'resources', 'python', 'mouse_tracker.py');
  }


  mouseTrackerProcess = spawn('python', [scriptPath]);

  mouseTrackerProcess.stdout.on('data', (data) => {
    try {
      const str = data.toString().trim();
      if (str.startsWith('PYTHON DATA: CLICK')) {
        const json = JSON.parse(str.replace('PYTHON DATA: CLICK ', ''));
        // ✅ Send click data to renderer via IPC
        console.log('mouse:click', json);
      }
    } catch (e) {
      console.error('Mouse Tracker parse error:', e);
    }
  });

  mouseTrackerProcess.stderr.on('data', (data) => {
    console.error('Mouse Tracker error:', data.toString());
  });

  mouseTrackerProcess.on('close', (code) => {
    console.log('Mouse Tracker exited with code', code);
    mouseTrackerProcess = null;
  });
}


