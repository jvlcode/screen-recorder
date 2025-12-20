import path from "path";
import fs from "fs";
import { segmentsDir } from "../utils/segments";
import { ffmpegService } from "./ffmpeg.service";

const compilationsDir = path.join(process.cwd(), "compilations");

function ensureCompilationDir() {
  if (!fs.existsSync(compilationsDir)) {
    fs.mkdirSync(compilationsDir, { recursive: true });
  }
}

async function getNextCompilationFile(): Promise<string> {
  ensureCompilationDir();

  const files = await fs.promises.readdir(compilationsDir);

  const nums = files
    .map(f => {
      const match = f.match(/compilation_(\d+)\.mp4/);
      return match ? parseInt(match[1], 10) : null;
    })
    .filter(n => n !== null) as number[];

  const next = (nums.length > 0 ? Math.max(...nums) : 0) + 1;

  return path.join(compilationsDir, `compilation_${next}.mp4`);
}

export async function concatSegments(): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      // Collect all mp4 segments
      let files = (await fs.promises.readdir(segmentsDir))
        .filter(f => f.endsWith(".mp4"))
        .map(f => path.join(segmentsDir, f))
        .filter(f => fs.existsSync(f))
        .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);

      if (files.length === 0) {
        return reject(new Error("No segments found"));
      }

      // Build concat filelist directly from raw segments
      const listFile = path.join(segmentsDir, "filelist.txt");
      const content = files.map(f => `file '${f.replace(/\\/g, "/")}'`).join("\n");
      await fs.promises.writeFile(listFile, content);

      console.log("Concat filelist:\n", content);

      const outFile = await getNextCompilationFile();
      const outBase = path.basename(outFile, ".mp4");
      const outFolder = path.join(compilationsDir, outBase);

      await fs.promises.mkdir(outFolder, { recursive: true });

      const args = [
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", listFile,
        "-c", "copy",
        "-movflags", "+faststart",
        outFile
      ];

      const proc = ffmpegService.spawn(args);

      let stderr = "";
      proc.stderr.on("data", d => {
        stderr += d.toString();
        console.log("[concat ffmpeg]", d.toString());
      });

      proc.on("error", err => reject(err));

      proc.on("close", async code => {
        if (code === 0) {
          try {
            // Move originals + json files into compilation folder
            for (const f of files) {
              const dest = path.join(outFolder, path.basename(f));
              await fs.promises.rename(f, dest);
            }
            await fs.promises.rename(listFile, path.join(outFolder, "filelist.txt"));

            const jsonFiles = (await fs.promises.readdir(segmentsDir))
              .filter(f => f.endsWith(".json"))
              .map(f => path.join(segmentsDir, f));

            for (const jf of jsonFiles) {
              const dest = path.join(outFolder, path.basename(jf));
              await fs.promises.rename(jf, dest);
            }

            resolve(outFile);
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}