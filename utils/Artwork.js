import { fetchApi } from '../utils/request.js'
import { generateFetchHeaders } from './header.js'
import path from 'path'

import fs from 'fs'
import { colorFn, errorConsole, lightGreen, lightMagenta, lightRed, removeSlash } from '../utils.js'
import pLimit from 'p-limit'
import { Image } from './Image.js'
import { Ugoira } from './Ugoira.js'

const storage = 'check-images'

class ArtworkInfo {
  constructor(payload) {
    this.id = payload?.id ?? null
    this.title = payload?.title ?? null
    this.userId = payload?.userId ?? null
    this.userName = payload?.userName ?? null
    this.userAccount = payload?.userAccount ?? null
    this.illustType = payload?.illustType ?? null
  }
}

export class Artwork {
  #id
  #fetchHeaders
  #artworkInfo = null
  #images = []
  #ugoira = null
  #done = false

  constructor(id, sessionId) {
    this.#id = id
    this.#fetchHeaders = generateFetchHeaders(sessionId, id)
    this.cachePossableMap = null
  }

  get done() {
    return this.#done
  }

  get displayName() {
    return `${this.artworkInfo?.title} - ${this.id}`
  }

  get isUgoira() {
    return this.artworkInfo?.illustType === 2
  }

  genCachePossableMap() {
    if (this.artworkInfo == null) return

    const { userAccount, userId, id, title } = this.artworkInfo

    const authorFolder = removeSlash(`${userAccount}-${userId}`)
    const artworkFolder = removeSlash(`${id}-${title}`)

    // TODO(flyc) storage 的部分
    const folder = path.join(storage, authorFolder, artworkFolder)

    if (!fs.existsSync(folder)) return

    console.log(lightMagenta(`${this.displayName} 可能有 cache`))

    this.cachePossableMap = fs.readdirSync(folder).reduce((acc, name) => {
      if (/\.part$/.test(name)) return acc
      if (name === '.DS_Store') return acc

      const hashReg = /-(ugoira|\d+)-v(\d+)-(\w{10})\.\w+$/
      const [, index, v, hash] = name.match(hashReg) ?? []
      if (index == null) console.log(name)

      const hashInfo = {
        hash,
        fileName: path.join(folder, name),
        v,
      }

      acc[index] = {
        index,
        hashMap: {
          ...(acc[index]?.hashMap ?? {}),
          [hash]: hashInfo,
        },
        hashList: [...(acc[index]?.hashList ?? []), hashInfo],
        maxV: Math.max(acc[index]?.maxV ?? 0, Number(v)),
      }

      return acc
    }, {})
  }

  async fetchArtWorkInfo() {
    return fetchApi(`https://www.pixiv.net/ajax/illust/${this.#id}?lang=zh_tw`, this.#fetchHeaders).then((res) => {
      const { body: { illustTitle, title, userId, userName, userAccount, illustType } = {} } = res
      return {
        title: illustTitle || title,
        userId,
        userName,
        userAccount,
        illustType,
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

  async genUgoira() {
    const url = `https://www.pixiv.net/ajax/illust/${this.#id}/ugoira_meta?lang=zh_tw`
    const { error, ...res } = await fetchApi(url, this.#fetchHeaders).catch((error) => ({ error }))
    if (error) {
      errorConsole(`[${this.constructor.name}]genUgoira 失敗!`, this.id, error)
      throw error
    }

    const { originalSrc } = res.body
    this.#ugoira = new Ugoira(originalSrc, res.body, this.artworkInfo, this.cachePossableMap)
  }

  async downloadFlow({ verbose = false, seq = 0 } = {}) {
    const artworkInfoError = (await this.genArtworkInfo().catch((error) => ({ error })))?.error
    if (artworkInfoError != null) throw artworkInfoError
    console.log(`✨✨✨ 正要開始下載 ${this.displayName} ✨✨✨`)

    // 嘗試處理 cache folder
    this.genCachePossableMap()

    if (this.isUgoira) {
      const ugoiraMetaError = (await this.genUgoira().catch((error) => ({ error })))?.error
      if (ugoiraMetaError != null) throw ugoiraMetaError

      await this.#ugoira.genHeaderInfo()
      await this.#ugoira.download({ verbose })

      console.log(lightGreen(`💃 ${this.displayName} (動圖) 下載成功`))
      this.updateDone(true)
      return
    }

    const imagesError = (await this.genImages().catch((error) => ({ error })))?.error
    if (imagesError != null) throw imagesError

    let imgFinishedCount = 0
    const imgLimit = pLimit(4)
    const imgPromises = this.images.map((img) => {
      return imgLimit(async () => {
        let error = null

        error = (await img.genHeaderInfo().catch((error) => ({ error })))?.error
        if (error) {
          console.log(lightRed(`取得圖片 ${img.displayNameWithIndex} 的標頭失敗 💥`))
          throw error
        }
        verbose && console.log(`取得圖片 ${img.fileName} 的標頭成功 ✅🎇`)

        error = (await img.download(`${storage}`).catch((error) => ({ error })))?.error
        if (error) {
          console.log(lightRed(`💥 ${img.fileName} 下載失敗 💥`), error)
          throw error
        }
        verbose && console.log(`${img.fileName} 下載成功 ✅💖`)

        imgFinishedCount++
        console.log(
          `🦀 ${colorFn(seq)(`${this.artworkInfo.title} - ${this.artworkInfo.id} `)}: ${imgFinishedCount}/${
            this.images.length
          }`
        )
      })
    })
    const downloadImagesError = (await Promise.all(imgPromises).catch((error) => ({ error })))?.error
    if (downloadImagesError) throw downloadImagesError

    console.log(lightGreen(`💃 ${this.displayName} 下載成功`))
    this.updateDone(true)
  }

  updateDone(value) {
    this.#done = value
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
