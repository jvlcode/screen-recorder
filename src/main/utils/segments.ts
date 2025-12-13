import path from "path";
import fs from "fs";

export const segmentsDir = path.join(process.cwd(), "segments");

if (!fs.existsSync(segmentsDir)) {
  fs.mkdirSync(segmentsDir, { recursive: true });
}
