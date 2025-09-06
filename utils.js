import fs, { createWriteStream } from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { rename, unlink } from 'fs/promises'
import { pipeline } from 'stream/promises'

const configFileName = 'setting.json'
const configFilePath = path.resolve('.', configFileName)

export function magenta(msg) {
  return `\x1b[35m${msg}\x1b[0m`
}
export function yellow(msg) {
  return `\x1b[33m${msg}\x1b[0m`
}
export function cyan(msg) {
  return `\x1b[36m${msg}\x1b[0m`
}
export function green(msg) {
  return `\x1b[32m${msg}\x1b[0m`
}
export function lightRed(msg) {
  return `\x1b[1m\x1b[31m${msg}\x1b[0m`
}
export function red(msg) {
  return `\x1b[31m${msg}\x1b[0m`
}
export function lightGreen(msg) {
  return `\x1b[1m\x1b[32m${msg}\x1b[0m`
}
export function lightBlue(msg) {
  return `\x1b[1m\x1b[34m${msg}\x1b[0m`
}
export function lightMagenta(msg) {
  return `\x1b[1m\x1b[35m${msg}\x1b[0m`
}
export function lightCyan(msg) {
  return `\x1b[1m\x1b[36m${msg}\x1b[0m`
}
export function lightYellow(msg) {
  return `\x1b[1m\x1b[33m${msg}\x1b[0m`
}
export function colorFn(index) {
  return index % 3 === 1 ? lightCyan : index % 3 === 2 ? lightMagenta : lightYellow
}

export function errorConsole(redMsg, ...others) {
  console.log(red(redMsg), ...others)
}

export async function readSettings() {
  let errorMessage = ''
  if (!fs.existsSync(configFilePath)) {
    errorMessage = `設定檔 ${configFilePath} 不存在!`
    console.log(red(errorMessage))
    throw new Error(errorMessage)
  }

  const content = fs.readFileSync(configFilePath)
  try {
    return JSON.parse(content)
  } catch {
    errorMessage = 'setting.json parse 失敗!'
    console.log(red(errorMessage))
    throw new Error(errorMessage)
  }
}

export function readFilesRecursively(pathStr, list = []) {
  fs.readdirSync(pathStr).forEach((name) => {
    const fullPath = path.join(pathStr, name)
    isDir(fullPath) ? readFilesRecursively(fullPath, list) : list.push(fullPath)
  })
  return list
}
function isDir(path) {
  return fs.lstatSync(path).isDirectory()
}

export function getMd5(value) {
  return createHash('md5').update(value).digest('hex')
}

export async function getFileMD5(filePath) {
  if (!fs.existsSync(filePath)) {
    const errorMessage = `[getFileMD5]檔案不存在: "${filePath}"`
    console.log(red(errorMessage))
    return Promise.reject(new Error(errorMessage))
  }

  return new Promise((resolve, reject) => {
    const hash = createHash('md5')
    const stream = createReadStream(filePath)

    stream.on('data', (chunk) => {
      hash.update(chunk)
    })

    stream.on('end', () => {
      resolve(hash.digest('hex'))
    })

    stream.on('error', (err) => {
      const errorMessage = `[getFileMD5]出錯了: ${err.message || err}`
      console.log(red(errorMessage))
      reject(err instanceof Error ? err : new Error(err))
    })
  })
}

export function removeSlash(str) {
  return str.replace(/\/+/g, '-').replace(/-+/g, '-')
}

export async function fetchDownload(url, outputPath, fetchConfig = {}, { verbose = false } = {}) {
  const partFilename = `${outputPath}.part`
  let partFileStream

  try {
    const response = await fetch(url, fetchConfig)
    verbose && console.log(green('[fetchDownload] fetch 成功'))

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new Error(`Download failed: ${response.status} ${response.statusText}. ${errorBody}`)
    }

    const outputDir = path.dirname(outputPath)
    fs.mkdirSync(outputDir, { recursive: true })

    partFileStream = createWriteStream(partFilename)
    await pipeline(response.body, partFileStream).catch((error) => {
      console.log(lightRed(`[fetchDownload] pipeline 失敗!`), red(`${url} 在進行 pipeline 的階段時失敗了`))
      throw error
    })
    verbose && console.log(green('[fetchDownload] pipeline 成功'))
    await rename(partFilename, outputPath).catch((error) => {
      console.log(lightRed(`[fetchDownload] rename 失敗!`), red(`${url} 在進行 rename 的階段時失敗了`))
      throw error
    })
    verbose && console.log(green('[fetchDownload] rename 成功'))
  } catch (error) {
    // If the stream was created, it needs to be closed before unlinking
    if (partFileStream) partFileStream.close()

    // Attempt to clean up the partial file, ignore errors if it fails
    await unlink(partFilename).catch(() => {})

    // Re-throw the original error to inform the caller
    throw error
  }
}
