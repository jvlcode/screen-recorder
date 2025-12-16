import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { app } from "electron";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import path from "path";

export type FFmpegProcess = ChildProcessWithoutNullStreams;

class FFmpegService {
  private ffmpegPath: string;
  private ffprobePath: string;

  constructor() {
    this.ffmpegPath = app.isPackaged
      ? path.join(process.resourcesPath, "ffmpeg", "ffmpeg.exe")
      : ffmpegStatic!;
    if (!this.ffmpegPath) {
      throw new Error(`FFmpeg binary not found at ${this.ffmpegPath}`);
    }

    // ffprobe usually sits next to ffmpeg in packaged builds
    this.ffprobePath = app.isPackaged
      ? path.join(process.resourcesPath, "ffprobe", "ffprobe.exe")
      : ffprobeStatic.path;

  }

  spawn(args: string[]): FFmpegProcess {
    console.log("Spawning ffmpeg at:", this.ffmpegPath);
    const proc = spawn(this.ffmpegPath, args);

    proc.stderr.on("data", d => {
      console.log("[ffmpeg]", d.toString());
    });

    proc.on("error", err => {
      console.error("[ffmpeg spawn error]", err);
    });

    return proc;
  }

  stop(proc: FFmpegProcess) {
    try {
      proc.stdin?.write("q\n");
    } catch {
      if (!proc.killed) {
        proc.kill("SIGINT");
        if (!proc.killed) proc.kill();
      }
    }
  }

  async probeDuration(file: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const args = [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        file
      ];
      console.log("Spawning ffprobe at:", this.ffprobePath);
      const proc = spawn(this.ffprobePath, args);

      let output = "";
      proc.stdout.on("data", d => output += d.toString());
      proc.stderr.on("data", d => console.error("[ffprobe]", d.toString()));

      proc.on("close", code => {
        if (code === 0) {
          resolve(parseFloat(output.trim()));
        } else {
          reject(new Error("ffprobe failed"));
        }
      });
    });
  }
}

export const ffmpegService = new FFmpegService();