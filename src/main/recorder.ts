import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import {spawn } from 'child_process'
import ffmpegPath from 'ffmpeg-static'

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


