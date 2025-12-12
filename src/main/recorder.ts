import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { ChildProcess, spawn } from 'child_process'
import ffmpegPath from 'ffmpeg-static'
import { fileURLToPath } from 'url'

const segmentsDir = path.join(process.cwd(), 'segments')
if (!fs.existsSync(segmentsDir)) fs.mkdirSync(segmentsDir)

export async function saveSegmentFile(buffers: { video: Uint8Array, audio: Uint8Array }, suggestedName?: string) {
  const filename = suggestedName || `segment_${Date.now()}_${uuidv4()}.mp4`
  const filePath = path.join(segmentsDir, filename)

  // Create temporary files for ffmpeg merging
  const tmpVideo = path.join(segmentsDir, `tmp_video_${Date.now()}.webm`)
  const tmpAudio = path.join(segmentsDir, `tmp_audio_${Date.now()}.webm`)

  await fs.promises.writeFile(tmpVideo, Buffer.from(buffers.video))
  await fs.promises.writeFile(tmpAudio, Buffer.from(buffers.audio))

  // Merge using ffmpeg (copy video codec, encode audio to opus)
  await new Promise<void>((resolve, reject) => {
const args = [
  "-y",
  "-i", tmpVideo,
  "-i", tmpAudio,

  // Explicit mapping
  "-map", "0:v:0",
  "-map", "1:a:0",

  // VIDEO
  "-c:v", "libx264",
  "-preset", "fast",
  "-crf", "18",
  "-g", "30",
  "-keyint_min", "30",

  // AUDIO
  "-c:a", "aac",
  "-b:a", "320k",
  "-af", "aresample=async=1",

  // Sync & fast start
  "-shortest",
  "-movflags", "+faststart",

  filePath
];

    const proc = spawn(ffmpegPath as string, args, { stdio: 'inherit' })

    proc.on('error', (err) => reject(err))
    proc.on('close', async (code) => {
      try {
        // Cleanup temp files
        fs.unlinkSync(tmpVideo)
        fs.unlinkSync(tmpAudio)

        if (code === 0) resolve()
        else reject(new Error(`ffmpeg exited with code ${code}`))
      } catch (err) {
        reject(err)
      }
    })
  })

  return filePath
}

function buildRippleFilters(clicks: any[]): string {
  const filters: string[] = [];

  // Debug marker
  filters.push(`drawbox=x=50:y=50:w=100:h=100:color=red@0.8:t=fill`);

  // Assume recording start = first click timestamp
  const recordingStartEpoch = clicks[0].ts;

  clicks.forEach((c) => {
    const relTime = c.ts - recordingStartEpoch; // epoch → relative
    if (relTime < 0) return;

    filters.push(
      `drawbox=x=${c.x}:y=${c.y}:w=40:h=40:color=yellow@0.8:t=fill:enable='between(t,${relTime},${relTime + 0.3})'`
    );
  });

  return filters.join(",");
}
export function trimSegmentFile(
  filePath: string,
  startSec: number,
  endSec: number,
): Promise<void> {

  return new Promise((resolve, reject) => {
    try {
      if (!filePath) return reject(new Error("No file path provided"));
      if (!ffmpegPath) return reject(new Error("ffmpeg binary not found"));
// Load clicks.json from resources/python
      const clicksFile = path.join(process.cwd(), "resources", "python", "clicks.json");
      const clicks = JSON.parse(fs.readFileSync(clicksFile, "utf-8"));

      let localPath = filePath;
      if (filePath.startsWith("file://")) {
        localPath = fileURLToPath(filePath);
      }

      const tempPath = path.join(
        path.dirname(localPath),
        path.basename(localPath, path.extname(localPath)) + ".trimmed.mp4"
      );

      // Load clicks.json
      const vf = buildRippleFilters(clicks);

      console.log("Trimming file with ripple overlay", {
        filePath,
        startSec,
        endSec,
        vf,
      });

      const args = [
        "-ss",
        `${startSec}`,
        "-to",
        `${endSec}`,
        "-i",
        localPath,
        "-vf",
        vf,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-c:a",
        "copy",
        tempPath,
      ];

      const proc = spawn(ffmpegPath as string, args, { stdio: "inherit" });

      proc.on("error", (e) => reject(e));
      proc.on("close", (code) => {
        if (code === 0) {
          fs.unlinkSync(localPath);
          fs.renameSync(tempPath, localPath);
          resolve();
        } else {
          reject(new Error(`ffmpeg exited with ${code}`));
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

const compilationsDir = path.join(process.cwd(), 'compilations')

// Ensure compilations directory exists
function ensureCompilationDir() {
  if (!fs.existsSync(compilationsDir)) {
    fs.mkdirSync(compilationsDir, { recursive: true })
  }
}

// Get next compilation number
async function getNextCompilationFile(): Promise<string> {
  ensureCompilationDir()

  const files = await fs.promises.readdir(compilationsDir)

  const nums = files
    .map(f => {
      const match = f.match(/compilation_(\d+)\.mp4/)
      return match ? parseInt(match[1], 10) : null
    })
    .filter(n => n !== null) as number[]

  const next = (nums.length > 0 ? Math.max(...nums) : 0) + 1

  return path.join(compilationsDir, `compilation_${next}.mp4`)
}

// Clear segments folder
async function clearSegmentsFolder() {
  if (!fs.existsSync(segmentsDir)) return
  const files = await fs.promises.readdir(segmentsDir)
  for (const f of files) {
    await fs.promises.unlink(path.join(segmentsDir, f))
  }
}

export async function concatSegments(): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      let files = (await fs.promises.readdir(segmentsDir))
        .filter(f => f.endsWith(".mp4"))
        .map(f => path.join(segmentsDir, f))
        .filter(f => fs.existsSync(f))
        .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);

      if (files.length === 0) {
        return reject(new Error("No segments found"));
      }

      const listFile = path.join(segmentsDir, "filelist.txt");
      const content = files.map(f => `file '${f.replace(/\\/g, "/")}'`).join("\n");
      await fs.promises.writeFile(listFile, content);

      console.log("Concat filelist:\n", content);

      const outFile = await getNextCompilationFile();
      const outBase = path.basename(outFile, ".mp4");
      const outFolder = path.join(compilationsDir, outBase);

      // ensure folder exists
      await fs.promises.mkdir(outFolder, { recursive: true });

      const args = [
        "-f", "concat",
        "-safe", "0",
        "-i", listFile,
        "-c", "copy",
        outFile
      ];

      const proc = spawn(ffmpegPath as string, args);

      let stderr = "";
      proc.stderr.on("data", d => {
        stderr += d.toString();
        console.log("[concat ffmpeg]", d.toString());
      });

      proc.on("error", err => reject(err));

     proc.on("close", async code => {
        if (code === 0) {
          setTimeout(async () => {
            try {
              for (const f of files) {
                const dest = path.join(outFolder, path.basename(f));
                await fs.promises.rename(f, dest);
              }
              await fs.promises.rename(listFile, path.join(outFolder, "filelist.txt"));
              resolve(outFile);
            } catch (err) {
              reject(err);
            }
          }, 500); // wait 0.5s
        } else {
          reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}


