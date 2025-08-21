import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import youtubeDl from 'youtube-dl-exec'
import pLimit from 'p-limit'

const configFileName = 'setting.json'
const configFilePath = path.resolve('.', configFileName)

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

const delayTime = 100
// TODO(flyc): 要檢查格式
export async function doDownload(list, { id, title }, tryLimit = 2) {
  const failedList = []
  const limit = pLimit(4)
  const promises = list.map((payload, index) => {
    const { link, fileName, targetPath: o, addHeader } = payload

    return limit(() =>
      new Promise((resolve) => setTimeout(resolve, delayTime + Math.ceil(Math.random() * 100)))
        .then(() => youtubeDl(link, { o, dumpJson: true, addHeader }))
        .then(() => youtubeDl(link, { o, addHeader }))
        .then(() => console.log(`${fileName} 下載完成`))
        .catch((error) => {
          console.log(red(`${id}-${index} 下載失敗`))
          console.log(red(error))
          failedList.push(payload)
        })
    )
  })

  return Promise.all(promises).then(() => {
    if (failedList.length !== 0) {
      if (tryLimit <= 0) {
        console.log(red('仍有失敗的下載嘗試，但超過重試次數了', failedList))
        return { failedList }
      }

      console.log(`有 ${failedList.length} 個失敗的項目，重新嘗試下載這些檔案`)
      return doDownload(failedList, { id, title }, tryLimit - 1)
    } else {
      console.log(`${title} - ${id} 結束囉`)
      return { failedList }
    }
  })
}

export function removeSlash(str) {
  return str.replace(/\/+/g, '-').replace(/-+/g, '-')
}
