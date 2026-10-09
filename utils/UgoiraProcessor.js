import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import JSZip from 'jszip'
import fs from 'fs'
import path from 'path'
import { lightBlue, lightGreen, lightMagenta, lightRed } from '../utils.js'

// 設定 ffmpeg 路徑，讓它使用 ffmpeg-static 提供的位置
ffmpeg.setFfmpegPath(ffmpegPath)

export class UgoiraProcessor {
  /**
   * @param {string} zipPath - ZIP 檔案路徑
   * @param {string} jsonPath - JSON 檔案路徑
   * @param {string} outputPath - MP4 輸出路徑
   * @param {object} options
   * @param {boolean} options.verbose - 是否開啟詳細除錯日誌
   */
  static async convertToMp4(zipPath, jsonPath, outputPath, { verbose = false } = {}) {
    console.log(lightMagenta(`  🎞️ 準備將動圖轉換為 MP4: ${outputPath}`))

    const ugoiraMeta = JSON.parse(fs.readFileSync(jsonPath))
    const { frames } = ugoiraMeta

    // 使用絕對路徑
    const absoluteOutputPath = path.resolve(outputPath)
    const partPath = `${absoluteOutputPath}.part`
    const tempDir = path.join(path.dirname(absoluteOutputPath), '_temp_frames')

    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

    try {
      // 2. 解壓縮所有影格到臨時資料夾
      verbose && console.log(lightBlue('    > 正在解壓縮影格...'))
      const zipData = fs.readFileSync(zipPath)
      const zip = await JSZip.loadAsync(zipData)
      
      for (const frame of frames) {
        const fileBuffer = await zip.file(frame.file).async('nodebuffer')
        fs.writeFileSync(path.join(tempDir, frame.file), fileBuffer)
      }

      // 3. 建立 FFmpeg 拼接清單 (使用絕對路徑以避免影格找不到的問題)
      const concatFilePath = path.join(tempDir, 'input.txt')
      let concatStr = ''
      frames.forEach((frame) => {
        const frameAbsolutePath = path.join(tempDir, frame.file).replace(/'/g, "'\\''")
        concatStr += `file '${frameAbsolutePath}'\nduration ${frame.delay / 1000}\n`
      })
      // FFmpeg concat quirk: 最後一幀
      const lastFramePath = path.join(tempDir, frames[frames.length - 1].file).replace(/'/g, "'\\''")
      concatStr += `file '${lastFramePath}'`
      
      fs.writeFileSync(concatFilePath, concatStr)

      // 4. 使用 fluent-ffmpeg 進行編碼
      verbose && console.log(lightBlue('    > 正在進行 MP4 編碼 (使用絕對路徑)...'))
      
      await new Promise((resolve, reject) => {
        const command = ffmpeg()
          .input(concatFilePath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .format('mp4')
          .videoCodec('libx264')
          .outputOptions([
            '-pix_fmt yuv420p',
            '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2'
          ])
          .on('start', (cmd) => {
            verbose && console.log(lightBlue(`    [FFmpeg Command] ${cmd}`))
          })
          .on('error', (err) => {
            console.log(lightRed('    💥 FFmpeg 編碼失敗:'), err.message)
            if (fs.existsSync(partPath)) fs.unlinkSync(partPath)
            reject(err)
          })
          .on('end', () => {
            fs.renameSync(partPath, absoluteOutputPath)
            console.log(lightGreen(`    ✨ MP4 生成成功: ${absoluteOutputPath}`))
            resolve()
          })

        if (verbose) {
          command.on('stderr', (stderrLine) => {
            console.log(`    [FFmpeg Debug] ${stderrLine}`)
          })
        }

        command.save(partPath)
      })

    } finally {
      // 5. 清理臨時資料夾
      if (fs.existsSync(tempDir)) {
        console.log(lightBlue('    > 清理臨時影格資料...'))
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    }
  }
}
