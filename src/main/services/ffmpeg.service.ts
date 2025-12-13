import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import ffmpegPath from "ffmpeg-static";

export type FFmpegProcess = ChildProcessWithoutNullStreams;

class FFmpegService {
  spawn(args: string[]): FFmpegProcess {
    if (!ffmpegPath) {
      throw new Error("FFmpeg binary not found");
    }

    const proc = spawn(ffmpegPath, args);

    proc.stderr.on("data", d => {
      console.log("[ffmpeg]", d.toString());
    });

    return proc;
  }

  stop(proc: FFmpegProcess) {
    try {
      proc.stdin?.write("q\n");
    } catch {
      proc.kill("SIGINT");
    }
  }
}

export const ffmpegService = new FFmpegService();
