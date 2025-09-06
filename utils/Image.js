import { generateFetchHeaders } from './header.js'
import path from 'path'

import fs from 'fs'
import {
  errorConsole,
  fetchDownload,
  getFileMD5,
  getMd5,
  lightBlue,
  lightMagenta,
  lightRed,
  lightYellow,
  removeSlash,
} from '../utils.js'

const storage = 'check-images'

class ImageHeader {
  #neededKeys = ['last-modified', 'content-length']

  constructor(payload) {
    this.rawHeader = payload

    this.#neededKeys.forEach((key) => {
      this[key] = payload.get(key) ?? null
    })
  }
}

export class Image {
  #md5Length = 10
  #imageFetchNeededHeaders = {
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
    referer: 'https://www.pixiv.net/',
  }
  #done = false

  constructor(link, artworkInfo, cachePossableMap) {
    this.originalLink = link
    this.artworkInfo = artworkInfo
    this.cachePossableMap = cachePossableMap
    this.newV = 0
  }

  get done() {
    return this.#done
  }

  get displayName() {
    return `${this.artworkInfo.title} - ${this.artworkInfo.id}`
  }
  get displayNameWithIndex() {
    return `${this.displayName} - ${this.index}`
  }

  updateDone(value) {
    this.#done = value
  }

  download(storage = null, retryLimit = 2) {
    if (this.headerHash == null || this.headerInfo == null) {
      const errorMsg = `[${this.constructor.name}] ${this.originalLink} download 資源還沒準備好!`
      errorConsole(errorMsg)
      throw new Error(errorMsg)
    }

    if (this.cachePossableMap != null) {
      const matchCacheInfo = this.cachePossableMap[this.index] ?? null

      if (matchCacheInfo != null) {
        const { hashMap, index, maxV } = matchCacheInfo
        if (index === this.index) {
          if (hashMap[this.headerHash] == null) {
            console.log(
              lightMagenta(
                ` 💃 ${this.displayNameWithIndex} 有新的版本! ${this.headerHash} ! ${lightRed(
                  `新的版本號: ${maxV + 1}`
                )}`
              )
            )
            this.newV = maxV + 1
          } else {
            console.log(lightMagenta(` 🧿 ${this.displayNameWithIndex} 有 cache ${this.headerHash} ! 不做下載 !`))
            this.updateDone(true)
            return Promise.resolve()
          }
        }
      } else {
        // 代表這是多出來的新圖, 要下載
      }
    }

    const o = storage == null ? this.fileName : path.resolve(storage, this.fileName)

    return fetchDownload(this.originalLink, o, { headers: this.#imageFetchNeededHeaders })
      .then(() => {
        if (!fs.existsSync(o)) {
          if (retryLimit <= 0) {
            throw new Error(`[${this.constructor.name}] download ${o} 下載失敗`)
          }

          console.log(`下載完，但檔案不存在，重新嘗試.. 剩餘次數: ${retryLimit - 1}`)
          return this.download(storage, retryLimit - 1)
        }
      })
      .then(async () => {
        if (this.newV === 0) return

        console.log(
          lightMagenta(`  > ${this.displayNameWithIndex} 新版本 ${this.newV} 下載完畢，將開始比較新版與舊版的 md5`)
        )
        const matchCacheInfo = this.cachePossableMap[this.index] ?? null

        const cacheMd5Map = (
          await Promise.all(
            matchCacheInfo.hashList.map(async (hasInfo) => {
              return {
                md5: await getFileMD5(hasInfo.fileName),
                hasInfo,
              }
            })
          )
        ).reduce((acc, md5Result) => {
          acc[md5Result.md5] = md5Result.hasInfo
          return acc
        }, {})

        const newFileName = path.join(storage, this.fileName)
        const newFileMd5 = await getFileMD5(newFileName)

        const matchedMd5FileInfo = cacheMd5Map[newFileMd5]

        if (matchedMd5FileInfo != null) {
          console.log(
            lightYellow(
              `  > ${this.displayNameWithIndex} 兩個檔案一樣! 用新的檔案替換舊的檔案的 version 但保留新檔案的 hash!`
            )
          )

          const oldFileName = matchedMd5FileInfo.fileName
          const oldVersion = matchedMd5FileInfo.v

          const finalNewFileName = path.join(
            storage,
            this.#genFileNameWithVersion(oldVersion, { hash: this.headerHash })
          )

          fs.rmSync(oldFileName)
          fs.renameSync(newFileName, finalNewFileName)
          console.log(lightYellow(`  > ${this.displayNameWithIndex} 操作成功`))
        } else {
          console.log(lightBlue(`  > ${this.displayNameWithIndex} 沒有一樣的檔案! 全部都保留!`))
        }
      })
      .then(() => void this.updateDone(true))
  }

  async fetchHeaderInfo() {
    return fetch(this.originalLink, { method: 'head', ...generateFetchHeaders() })
      .then(async (res) => Promise.all([res.ok, res.text(), res.headers]))
      .then((res) => {
        const [ok, text, headers] = res
        if (ok) return { headers }
        else throw new Error(text)
      })
  }

  async genHeaderInfo() {
    const { error, ...res } = await this.fetchHeaderInfo().catch((error) => ({ error }))
    if (error) {
      errorConsole(`[${this.constructor.name}]genHeaderInfo 失敗!`, this.originalLink, error)
      throw error
    }

    this.headerInfo = new ImageHeader(res.headers)
  }

  get headerHash() {
    if (this.headerInfo == null) return null
    const pk = `${new Date(this.headerInfo['last-modified']).valueOf()}${this.headerInfo['content-length']}`
    return getMd5(pk).substring(0, this.#md5Length)
  }

  get index() {
    if (this.originalLink == null) return null
    try {
      return this.originalLink.match(/_p(\d+)\.\w+$/)[1]
    } catch (e) {
      errorConsole(`[${this.constructor.name}] index 取得 ${this.originalLink} 的 index 失敗!`)
      throw e
    }
  }

  get ext() {
    if (this.originalLink == null) return null
    return path.parse(new URL(this.originalLink).pathname).ext
  }

  #genFileNameWithVersion(version = 0, { hash: originHash = null } = {}) {
    const { title, userId, userAccount, id } = this.artworkInfo
    const { index, ext } = this
    const authorFolder = removeSlash(`${userAccount}-${userId}`)
    const artworkFolder = removeSlash(`${id}-${title}`)
    const lastFolder = path.join(authorFolder, artworkFolder)

    let hash = originHash
    if (hash == null) {
      const matchFileName =
        fs.readdirSync(path.join(storage, lastFolder)).filter((fileName) => {
          return new RegExp(`v${version}-\\w{10}${ext}$`).test(fileName)
        })[0] ?? null
      if (!matchFileName) return null

      return path.join(lastFolder, matchFileName)
    }

    const targetFile = removeSlash(`${userAccount}-${userId}-${id}-${title}-${index}-v${version}-${hash}${ext}`)
    const targetFileName = path.join(lastFolder, targetFile)

    return targetFileName
  }
  get versionZeroFileName() {
    return this.#genFileNameWithVersion(0)
  }
  get fileName() {
    return this.#genFileNameWithVersion(this.newV ?? 0, { hash: this.headerHash })
  }
}
