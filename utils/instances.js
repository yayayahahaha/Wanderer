import { fetchApi } from '../utils/request.js'
import { generateFetchHeaders } from './header.js'
import path from 'path'

import fs from 'fs'
import { doDownload, errorConsole, getMd5, lightMagenta, removeSlash } from '../utils.js'
import youtubeDl from 'youtube-dl-exec'

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

  constructor(link, artworkInfo, cachePossableMap) {
    this.originalLink = link
    this.artworkInfo = artworkInfo
    this.cachePossableMap = cachePossableMap
    this.newV = null
  }

  get displayName() {
    return `${this.artworkInfo.title} - ${this.artworkInfo.id}`
  }

  download(storage = null, retryLimit = 2) {
    if (this.headerHash == null || this.headerInfo == null) {
      const errorMsg = `[${this.constructor.name}] ${this.originalLink} download 資源還沒準備好!`
      errorConsole(errorMsg)
      throw new Error(errorMsg)
    }

    // TODO(flyc): 這種 token 的都要看一下
    const addHeader = ['referer:https://www.pixiv.net/', `Cookie:PHPSESSID=`]

    if (this.cachePossableMap != null) {
      const matchCacheInfo = this.cachePossableMap[this.index] ?? null

      if (matchCacheInfo != null) {
        const { hash, index, v } = matchCacheInfo
        if (index === this.index) {
          if (hash === this.headerHash) {
            console.log(
              lightMagenta(` 🧿 ${this.displayName} 的 ${this.index} 有 cache ${this.headerHash} ! 不做下載 !`)
            )
            return Promise.resolve()
          } else {
            console.log(
              lightMagenta(` 💃 ${this.displayName} 的 ${this.index} 有 新的版本! ${hash} ! 將有新的版本 ${v + 1}`)
            )
            this.newV = v + 1
          }
        }
      } else {
        // 代表這是多出來的新圖, 要下載
      }
    }

    const o = storage == null ? this.fileName : path.resolve(storage, this.fileName)

    return (
      this.fetchHeaderInfo()
        // TODO(flyc): 這裡要檢查 cache
        .then(() => youtubeDl(this.originalLink, { o, addHeader }))
        .then(() => {
          if (!fs.existsSync(o)) {
            if (retryLimit <= 0) {
              throw new Error(`[${this.constructor.name}] download ${o} 下載失敗`)
            }

            console.log(`下載完，但檔案不存在，重新嘗試.. 剩餘次數: ${retryLimit - 1}`)
            return this.download(storage, retryLimit - 1)
          }
        })
        .catch((error) => ({ error }))
    )
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

  get fileName() {
    const { title, userId, userAccount, id } = this.artworkInfo
    const { index, ext, headerHash } = this

    const authorFolder = removeSlash(`${userAccount}-${userId}`)
    const artworkFolder = removeSlash(`${id}-${title}`)
    const targetFile = removeSlash(
      `${userAccount}-${userId}-${id}-${title}-${index}-v${this.newV ?? 0}-${headerHash}${ext}`
    )
    const targetFileName = path.join(authorFolder, artworkFolder, targetFile)

    return targetFileName
  }
}

class ArtworkInfo {
  constructor(payload) {
    this.id = payload?.id ?? null
    this.title = payload?.title ?? null
    this.userId = payload?.userId ?? null
    this.userName = payload?.userName ?? null
    this.userAccount = payload?.userAccount ?? null
  }
}

export class Artwork {
  #id
  #fetchHeaders
  #session
  #failedList = []
  #artworkInfo = null
  #images = []

  constructor(id, sessionId) {
    this.#id = id
    this.#session = sessionId
    this.#fetchHeaders = generateFetchHeaders(sessionId, id)
    this.cachePossableMap = null
  }

  get displayName() {
    return `${this.artworkInfo?.title} - ${this.id}`
  }

  genCachePossableMap() {
    if (this.artworkInfo == null) return

    const { userAccount, userId, id, title } = this.artworkInfo

    const authorFolder = removeSlash(`${userAccount}-${userId}`)
    const artworkFolder = removeSlash(`${id}-${title}`)

    // TODO(flyc) storage 的部分
    const folder = `check-images/${authorFolder}/${artworkFolder}`

    if (!fs.existsSync(folder)) return

    console.log(lightMagenta(`${this.displayName} 可能有 cache`))

    this.cachePossableMap = fs.readdirSync(folder).reduce((acc, name) => {
      if (/\.part$/.test(name)) return acc

      const hashReg = /-(\d+)-v(\d+)-(\w{10})\.\w+$/
      const [, index, v, hash] = name.match(hashReg) ?? []
      if (index == null) console.log(name)

      acc[index] = {
        index,
        v: Math.max(acc[hash]?.v ?? 0, Number(v)),
        hash,
      }

      return acc
    }, {})
  }

  fetchArtWorkInfo() {
    return fetchApi(`https://www.pixiv.net/ajax/illust/${this.#id}?lang=zh_tw`, this.#fetchHeaders).then((res) => {
      const { body: { illustTitle, title, userId, userName, userAccount } = {} } = res
      return {
        title: illustTitle || title,
        userId,
        userName,
        userAccount,
      }
    })
  }

  async genArtworkInfo() {
    const { error, ...res } = await this.fetchArtWorkInfo().catch((error) => ({ error }))
    if (error != null) {
      errorConsole(`[${this.constructor.name}]genArtworkInfo 失敗!`, this.id, error)
      throw error
    }

    this.#artworkInfo = new ArtworkInfo({ ...res, id: this.id })
    return this.#artworkInfo
  }

  async genImages() {
    const { error, ...res } = await this.fetchAllImagesUrl()
      .then((list) => ({ list }))
      .catch((error) => ({ error }))
    if (error) {
      errorConsole(`[${this.constructor.name}]genImages 失敗!`, this.id, error)
      throw error
    }

    this.#images = res.list.map((imageLink) => new Image(imageLink, this.artworkInfo, this.cachePossableMap))
  }

  async downloadAllImages() {
    const { error: infoError, ...artworkInfo } = await this.fetchArtWorkInfo().catch((error) => ({ error }))
    if (infoError) return void errorConsole(`取得 ${this.#id} 基本資訊失敗: `, infoError)

    const { userId, title, userAccount } = artworkInfo

    console.log(`正要開始下載 ${title} - ${this.#id}`)

    const { error, linkList } = await this.fetchAllImagesUrl()
      .then((linkList) => ({ linkList }))
      .catch((error) => ({ error }))
    if (error) return void errorConsole(error)

    const downloadInfoList = linkList.map((link, index) => {
      const fileName = `test-img/${userAccount}-${userId}/${this.#id}-${title}/${userAccount}-${userId}-${
        this.#id
      }-${title}-${index}.png`
      const targetPath = path.resolve(process.cwd(), fileName)
      const addHeader = ['referer:https://www.pixiv.net/', `Cookie:PHPSESSID=${this.#session}`]

      return { link, fileName, targetPath, addHeader }
    })

    const { failedList } = await doDownload(downloadInfoList, { id: this.#id, title })
    this.#failedList = [...this.#failedList, ...failedList]
    if (this.#failedList.length !== 0) {
      const failedLog = `test-img/${userAccount}-${userId}/failed-log-${Date.now()}.json`
      fs.writeFileSync(failedLog, JSON.stringify(this.#failedList, null, 2))
      console.log('下載與重新嘗試都結束了, 但仍有沒有下載成功的檔案，已寫進 log 裡')
    }
  }

  /**
   * @description 取得當前 artWork 全部圖片的網址
   * */
  async fetchAllImagesUrl() {
    const url = `https://www.pixiv.net/ajax/illust/${this.#id}/pages?lang=zh_tw`
    const { error, ...res } = await fetchApi(url, this.#fetchHeaders)
    if (error) throw error

    return res?.body.map(({ urls: { original } }) => original) ?? []
  }

  get id() {
    return this.#id
  }
  get artworkInfo() {
    return this.#artworkInfo
  }
  get images() {
    return this.#images
  }
}
