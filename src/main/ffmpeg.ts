import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import path from "path";
import fs from "fs";
import ffmpegPath from "ffmpeg-static";
import { v4 as uuidv4 } from "uuid";
import { saveSegmentFile } from "./recorder";

const segmentsDir = path.join(process.cwd(), "segments");
if (!fs.existsSync(segmentsDir)) fs.mkdirSync(segmentsDir);

let videoProc: ChildProcessWithoutNullStreams | null = null;
let audioProc: ChildProcessWithoutNullStreams | null = null;

let videoFile: string | null = null;
let audioFile: string | null = null;

export function startRecordingSeparate(micName = "Microphone (2- HyperX SoloCast)") {
if (videoProc || audioProc) throw new Error("Recording already in progress");

videoFile = path.join(segmentsDir, `video_${Date.now()}_${uuidv4()}.mp4`);
audioFile = path.join(segmentsDir, `audio_${Date.now()}_${uuidv4()}.wav`);

if (!ffmpegPath) throw new Error("FFmpeg binary not found");

// Video process
const videoArgs = [
"-y",
"-f", "gdigrab",          // Windows desktop capture
"-framerate", "30",
"-probesize", "50M",
"-analyzeduration", "100M",
"-i", "desktop",
"-c:v", "libx264",        // CPU encoder
"-preset", "fast",        // balance speed/quality
"-crf", "18",             // high quality
"-g", "30",               // keyframe every second
"-pix_fmt", "yuv420p",
videoFile,
];
videoProc = spawn(ffmpegPath, videoArgs);

videoProc.stderr.on("data", (data) => {
    console.log("[video ffmpeg]", data.toString());
});

// Audio process
const audioArgs = [
    "-y",
    "-f", "dshow",
    "-i", `audio=${micName}`,
    "-c:a", "pcm_s16le",
    "-ar", "48000",
    "-ac", "2",
    audioFile,
];
audioProc = spawn(ffmpegPath, audioArgs);

audioProc.stderr.on("data", (data) => {
    console.log("[audio ffmpeg]", data.toString());
});

console.log("Recording started:", { videoFile, audioFile });
}

let recordProc: ReturnType<typeof spawn> | null = null;
let recordFile: string|null;

export function startRecording(micName = "Microphone (2- HyperX SoloCast)") {
  if (recordProc) throw new Error("Recording already in progress");

  recordFile = path.join(process.cwd(), "segments", `record_${Date.now()}_${uuidv4()}.mp4`);

  if (!ffmpegPath) throw new Error("FFmpeg binary not found");

const args = [
  "-y",

  // Prevent frame drops
  "-thread_queue_size", "1024",

  // ---- Video Input ----
  "-f", "gdigrab",   
  "-draw_mouse", "1",
  "-framerate", "30",
  "-i", "desktop",

  // ---- Audio Input ----
  "-thread_queue_size", "1024",
  "-f", "dshow",
  "-i", `audio=${micName}`,

  // ---- Mapping ----
  "-map", "0:v:0",
  "-map", "1:a:0",

  // ---- Video Encoding ----
  "-c:v", "libx264",
  "-preset", "veryfast",     // smoother than ultrafast
  "-crf", "14",              // << ULTRA QUALITY (near lossless)
  "-pix_fmt", "yuv420p",
  "-g", "60",                // keyframe = 2 seconds (for 30fps)
  "-vsync", "cfr",           // << constant framerate
  "-r", "30",                // << enforce output 30fps

  // ---- Audio Encoding ----
  "-c:a", "aac",
  "-b:a", "320k",            // high quality audio
  "-ar", "48000",

  // ---- Output ----
  "-movflags", "+faststart",
  recordFile
];


  recordProc = spawn(ffmpegPath, args);

if (recordProc && recordProc.stderr) {
  recordProc.stderr.on("data", (data) => {
    console.log("[record ffmpeg]", data.toString());
  });
}

  recordProc.on("close", (code) => {
    console.log("Recording stopped with code", code);
    recordProc = null;
  });

  console.log("Recording started:", { recordFile });
}

export async function stopRecording(): Promise<string> {
  if (!recordProc || !recordFile) throw new Error("No recording in progress");

  const proc = recordProc;
  const filePath = recordFile;

  return new Promise<string>((resolve, reject) => {
    proc.on("exit", (code, signal) => {
      recordProc = null;
      recordFile = null;

      if (code === 0) resolve(filePath);
      else if (signal) reject(new Error(`ffmpeg terminated by signal ${signal}`));
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });

    try {
      proc.stdin?.write("q\n"); // graceful quit
    } catch {
      proc.kill("SIGINT"); // fallback
    }
  });
}

export async function stopRecordingAndMerge(): Promise<string> {
  if (!videoProc || !audioProc || !videoFile || !audioFile)
    throw new Error("No recording in progress");

  return new Promise<string>((resolve, reject) => {
    let closedCount = 0;

    const checkDone = async () => {
      closedCount++;
      if (closedCount === 2) {
        try {
          const mergedFile = await saveSegmentFile({
            video: new Uint8Array(fs.readFileSync(videoFile!)),
            audio: new Uint8Array(fs.readFileSync(audioFile!)),
          });

          fs.unlinkSync(videoFile!);
          fs.unlinkSync(audioFile!);

          videoProc = null;
          audioProc = null;
          videoFile = null;
          audioFile = null;

          resolve(mergedFile);
        } catch (err) {
          reject(err);
        }
      }
    };

    videoProc!.on("close", checkDone);
    audioProc!.on("close", checkDone);

    // Try stdin 'q' first
    try {
      videoProc!.stdin.write("q\n");
      audioProc!.stdin.write("q\n");

      // Fallback: if still alive after 1s, send SIGINT
      setTimeout(() => {
        if (videoProc) {
          console.log("videoProc still running, sending SIGINT");
          videoProc.kill("SIGINT");
        }
        if (audioProc) {
          console.log("audioProc still running, sending SIGINT");
          audioProc.kill("SIGINT");
        }
      }, 1000);
    } catch (err) {
      // If stdin fails, kill immediately
      videoProc!.kill("SIGINT");
      audioProc!.kill("SIGINT");
    }
  });
}