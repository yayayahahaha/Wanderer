import { generateFetchHeaders } from './header.js'
import path from 'path'
import fs from 'fs'
import {
  errorConsole,
  fetchDownload,
  getMd5,
  lightMagenta,
  lightRed,
  removeSlash,
} from '../utils.js'

import { UgoiraProcessor } from './UgoiraProcessor.js'

const storage = 'check-images'

class UgoiraHeader {
  #neededKeys = ['last-modified', 'content-length']

  constructor(payload) {
    this.rawHeader = payload
    this.#neededKeys.forEach((key) => {
      this[key] = payload.get(key) ?? null
    })
  }
}

export class Ugoira {
  #md5Length = 10
  #imageFetchNeededHeaders = {
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    referer: 'https://www.pixiv.net/',
  }
  #done = false

  constructor(zipLink, ugoiraMeta, artworkInfo, cachePossableMap) {
    this.zipLink = zipLink
    this.ugoiraMeta = ugoiraMeta // 包含 frames 資訊
    this.artworkInfo = artworkInfo
    this.cachePossableMap = cachePossableMap
    this.newV = 0
  }

  get done() {
    return this.#done
  }

  updateDone(value) {
    this.#done = value
  }

  get displayName() {
    return `[Ugoira] ${this.artworkInfo.title} - ${this.artworkInfo.id}`
  }

  async fetchHeaderInfo() {
    return fetch(this.zipLink, { method: 'head', ...generateFetchHeaders() })
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
      errorConsole(`[${this.constructor.name}]genHeaderInfo 失敗!`, this.zipLink, error)
      throw error
    }
    this.headerInfo = new UgoiraHeader(res.headers)
  }

  get headerHash() {
    if (this.headerInfo == null) return null
    const pk = `${new Date(this.headerInfo['last-modified']).valueOf()}${this.headerInfo['content-length']}`
    return getMd5(pk).substring(0, this.#md5Length)
  }

  // 仿照 Image.js 的版本判定邏輯，但 index 固定為 'ugoira'
  async download({ verbose = false } = {}, retryLimit = 2) {
    if (this.headerHash == null) {
      throw new Error(`[${this.constructor.name}] download 資源還沒準備好 (Hash 缺失)!`)
    }

    const { authorFolder, artworkFolder } = this.#genFolders()
    const index = 'ugoira'
    
    let skipDownload = false
    if (this.cachePossableMap != null) {
      const matchCacheInfo = this.cachePossableMap[index] ?? null
      if (matchCacheInfo != null) {
        if (matchCacheInfo.hashMap[this.headerHash]) {
          // 材料 (ZIP) 已經有了
          const cachedFileBase = matchCacheInfo.hashMap[this.headerHash].fileName.replace(/\.zip$/, '')
          const mp4Path = `${cachedFileBase}.mp4`
          const jsonPath = `${cachedFileBase}.json`

          if (fs.existsSync(mp4Path)) {
            console.log(lightMagenta(` 🧿 ${this.displayName} 有 cache (ZIP & MP4) ${this.headerHash} ! 不做下載 !`))
            this.updateDone(true)
            return
          } else {
            console.log(lightMagenta(` 🎞️ ${this.displayName} 材料已存在，但 MP4 遺失，將重新生成...`))
            await UgoiraProcessor.convertToMp4(matchCacheInfo.hashMap[this.headerHash].fileName, jsonPath, mp4Path, { verbose })
            this.updateDone(true)
            return
          }
        } else {
          console.log(lightMagenta(` 💃 ${this.displayName} 有新的版本! ${lightRed(`新的版本號: ${matchCacheInfo.maxV + 1}`)}`))
          this.newV = matchCacheInfo.maxV + 1
        }
      }
    }

    const baseName = this.#genBaseName(this.newV, this.headerHash)
    
    const zipPath = path.join(storage, authorFolder, artworkFolder, `${baseName}.zip`)
    const jsonPath = path.join(storage, authorFolder, artworkFolder, `${baseName}.json`)
    const mp4Path = path.join(storage, authorFolder, artworkFolder, `${baseName}.mp4`)

    // 下載 ZIP
    await fetchDownload(this.zipLink, zipPath, { headers: this.#imageFetchNeededHeaders })
    
    // 儲存 Metadata JSON
    fs.writeFileSync(jsonPath, JSON.stringify(this.ugoiraMeta, null, 2))

    // 生成 MP4
    await UgoiraProcessor.convertToMp4(zipPath, jsonPath, mp4Path, { verbose })
    
    this.updateDone(true)
    console.log(lightMagenta(` ✅ ${this.displayName} 下載完成 (ZIP & JSON)`))
  }

  #genFolders() {
    const { userAccount, userId, id, title } = this.artworkInfo
    return {
      authorFolder: removeSlash(`${userAccount}-${userId}`),
      artworkFolder: removeSlash(`${id}-${title}`)
    }
  }

  #genBaseName(version, hash) {
    const { userAccount, userId, id, title } = this.artworkInfo
    return removeSlash(`${userAccount}-${userId}-${id}-${title}-ugoira-v${version}-${hash}`)
  }
}
