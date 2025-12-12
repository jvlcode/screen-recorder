import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { spawn } from 'child_process'
import ffmpegPath from 'ffmpeg-static'
import { fileURLToPath } from 'url'

const segmentsDir = path.join(process.cwd(), 'segments')
if (!fs.existsSync(segmentsDir)) fs.mkdirSync(segmentsDir)

export async function saveSegmentFile(buffer: Buffer, suggestedName?: string) {
  const filename = suggestedName || `segment_${Date.now()}_${uuidv4()}.webm`
  const filePath = path.join(segmentsDir, filename)
  await fs.promises.writeFile(filePath, buffer)
  return filePath
}


export function trimSegmentFile(filePath: string, startSec: number, endSec: number): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (!filePath) return reject(new Error('No file path provided'))
      if (!ffmpegPath) return reject(new Error('ffmpeg binary not found'))

      // Convert file:// URL to local path only if needed
      let localPath = filePath
      if (filePath.startsWith('file://')) {
        localPath = fileURLToPath(filePath)
      }

      // Temp output path
      const tempPath = path.join(
        path.dirname(localPath),
        path.basename(localPath, path.extname(localPath)) + '.trimmed.webm'
      )
      console.log('Trimming file', filePath, 'startSec:', startSec, 'endSec:', endSec)

      const args = ['-i', localPath, '-ss', `${startSec}`, '-to', `${endSec}`, '-c', 'copy', tempPath]
      const proc = spawn(ffmpegPath, args, { stdio: 'inherit' })

      proc.on('error', (e) => reject(e))
      proc.on('close', (code) => {
        if (code === 0) {
          fs.unlinkSync(localPath)
          fs.renameSync(tempPath, localPath)
          resolve()
        } else {
          reject(new Error(`ffmpeg exited with ${code}`))
        }
      })
    } catch (err) {
      reject(err)
    }
  })
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
      const files = (await fs.promises.readdir(segmentsDir))
        .filter(f => f.endsWith('.webm'))
        .map(f => path.join(segmentsDir, f))

      if (files.length === 0) {
        return reject(new Error('No segments found'))
      }

      // Create filelist.txt for ffmpeg
      const listFile = path.join(segmentsDir, 'filelist.txt')
      const content = files
        .map(f => `file '${f.replace(/'/g, "'\\''")}'`)
        .join('\n')

      await fs.promises.writeFile(listFile, content)

      // Generate incremented output filename
      const outFile = await getNextCompilationFile()

      // FFmpeg concat command
      const args = [
        '-f', 'concat',
        '-safe', '0',
        '-i', listFile,
        '-c', 'copy',
        outFile
      ]

      const proc = spawn(ffmpegPath as string, args)

      proc.on('error', err => reject(err))

      proc.on('close', async code => {
        if (code === 0) {
          // Remove all segment files after success
          await clearSegmentsFolder()
          resolve(outFile)
        } else {
          reject(new Error(`ffmpeg exited with code ${code}`))
        }
      })

    } catch (err) {
      reject(err)
    }
  })
}
