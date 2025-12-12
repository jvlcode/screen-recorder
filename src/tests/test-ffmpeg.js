const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const { v4: uuidv4 } = require('uuid');

const segmentsDir = path.join(process.cwd(), 'segments');
if (!fs.existsSync(segmentsDir)) fs.mkdirSync(segmentsDir);

let ffmpegProc = null;
let currentFile = null;

function startFfmpegRecording() {
  if (ffmpegProc) {
    console.warn("FFMPEG is already running");
    return;
  }

  const filename = `capture_${Date.now()}_${uuidv4()}.mp4`;
  currentFile = path.join(segmentsDir, filename);

  const args = [
    "-y",
    "-f", "gdigrab",
    "-framerate", "30",
    "-thread_queue_size", "512",
    "-i", "desktop",

    "-f", "dshow",
    "-i", "audio=Microphone (2- HyperX SoloCast)",

    "-c:v", "libx264",
    "-preset", "fast",
    "-b:v", "6000k",
    "-maxrate", "6000k",
    "-bufsize", "6000k",
    "-pix_fmt", "yuv420p",    // force compatible pixel format
    "-profile:v", "high",
    "-r", "30",

    "-c:a", "aac",
    "-b:a", "320k",

    "-movflags", "+faststart",
    "-f", "mp4",              // explicitly set container
    currentFile
  ];

  ffmpegProc = spawn(ffmpegPath, args, { stdio: ['pipe', 'inherit', 'inherit'] });

  ffmpegProc.on('error', (err) => {
    console.error("FFMPEG process error:", err);
    ffmpegProc = null;
  });

  ffmpegProc.on('close', (code) => {
    console.log("FFMPEG stopped, exit code:", code);
    ffmpegProc = null;
  });

  console.log("FFMPEG recording started:", currentFile);
}

function stopFfmpegRecording() {
  return new Promise((resolve, reject) => {
    if (!ffmpegProc || !currentFile) return reject(new Error("No recording in progress"));

    ffmpegProc.on("close", (code) => {
      resolve(currentFile);
      ffmpegProc = null;
      currentFile = null;
    });

    try {
      // Properly finish MP4
      ffmpegProc.stdin.write('q');
    } catch (err) {
      reject(err);
    }
  });
}

// === TEST ===
(async () => {
  console.log("Starting 10-second recording...");
  startFfmpegRecording();

  await new Promise(resolve => setTimeout(resolve, 10000));

  try {
    const savedFile = await stopFfmpegRecording();
    console.log("Recording saved to:", savedFile);
  } catch (err) {
    console.error("Error stopping recording:", err);
  }
})();
