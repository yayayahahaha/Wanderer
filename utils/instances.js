// TODO(flyc) hash 機制有問題，有可能圖片一樣但 hash 不一樣，看還有沒有其他方法..
// > 要寫個 script 剃除掉重複的圖片，有點太多了
// > % 數的也可以
// TODO(flyc) 對於 plimit 的行為還是不太確定，到底 promise.all 在收到 error 的時候會不會停止的這件事情怪怪的，一層好像會、雙層就會怪怪的
// 或是在計算到有同樣 index 但 hash 不同的時候，直接檢查 md5 或是 % 數之類的

import { fetchApi } from '../utils/request.js'
import { generateFetchHeaders } from './header.js'
import path from 'path'

import fs from 'fs'
import {
  colorFn,
  doDownload,
  errorConsole,
  fetchDownload,
  getFileMD5,
  getMd5,
  lightBlue,
  lightGreen,
  lightMagenta,
  lightRed,
  lightYellow,
  removeSlash,
} from '../utils.js'
import pLimit from 'p-limit'

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

  constructor(link, artworkInfo, cachePossableMap) {
    this.originalLink = link
    this.artworkInfo = artworkInfo
    this.cachePossableMap = cachePossableMap
    this.newV = 0
  }

  get displayName() {
    return `${this.artworkInfo.title} - ${this.artworkInfo.id}`
  }
  get displayNameWithIndex() {
    return `${this.displayName} - ${this.index}`
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
    const folder = path.join(storage, authorFolder, artworkFolder)

    if (!fs.existsSync(folder)) return

    console.log(lightMagenta(`${this.displayName} 可能有 cache`))

    this.cachePossableMap = fs.readdirSync(folder).reduce((acc, name) => {
      if (/\.part$/.test(name)) return acc
      if (name === '.DS_Store') return acc

      const hashReg = /-(\d+)-v(\d+)-(\w{10})\.\w+$/
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

  async downloadFlow({ verbose = false, seq = 0 } = {}) {
    const artworkInfoError = (await this.genArtworkInfo().catch((error) => ({ error })))?.error
    if (artworkInfoError != null) throw artworkInfoError
    console.log(`✨✨✨ 正要開始下載 ${this.displayName} ✨✨✨`)

    // 嘗試處理 cache folder
    this.genCachePossableMap()

    const imagesError = (await this.genImages().catch((error) => ({ error })))?.error
    if (imagesError != null) throw imagesError

    let imgFinishedCount = 0
    const imgLimit = pLimit(4)
    const imgPromises = this.images.map((img) => {
      return imgLimit(async () => {
        let error = null

        error = (await img.genHeaderInfo().catch((error) => ({ error })))?.error
        if (error) throw error
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
