// TODO(flyc): cache 系統: 透過 method head 來快速取得 headers 的資訊，藉此判斷有沒有拉過
// 快取前置: 取得當前既有的檔案的檔名後生成連結，然後再去取一次。取回來之後計算 md5 hash, 如果不一致的話就把舊的重新取名為 v1, 然後新的就是 v2
// TODO(flyc): 在關閉的時候把完成的檔案放到 json 的另外一個 keys 裡, 寫入前檢查如果 json 有被手動異動的話，就寫成 log

// import pLimit from 'p-limit'
import { getFileMD5, lightBlue, lightGreen, readFilesRecursively, red, removeSlash } from './utils.js'
import path from 'path'
import fs from 'fs'
import { Artwork } from './utils/instances.js'
import pLimit from 'p-limit'
import youtubeDl from 'youtube-dl-exec'

const storage = 'check-images'

class ImagesDiff {
  #newMd5 = null
  #currentMd5 = null

  constructor(payload) {
    this.downloadLink = payload.downloadLink ?? null

    this.targetFileName = payload.targetFileName ?? null
    this.potentialCurrent = payload.potentialCurrent ?? null

    this.error = payload.error ?? null
  }

  get newMd5() {
    return this.#newMd5
  }
  get currentMd5() {
    return this.#currentMd5
  }
  get isSame() {
    if (this.newMd5 == null || this.currentMd5 == null) {
      console.log(red(`[${this.constructor.name}]isSame: 還沒計算過 md5`), this)
      return null
    }

    return this.newMd5 === this.currentMd5
  }

  async getMd5() {
    this.#newMd5 = await getFileMD5(this.targetFileName).catch(() => null)
    this.#currentMd5 = await getFileMD5(this.potentialCurrent).catch(() => null)
  }
}

async function start() {
  const allFiles = readFilesRecursively('./test-img')

  const artIdSet = allFiles.reduce((acc, filePath) => {
    const matched = filePath.match(/^test-img\/[^/]+-(\d+)\/(\d+)-.*/) ?? null
    if (matched == null) return acc

    const artId = matched?.[2]
    acc.add(artId)
    return acc
  }, new Set())
  const artworkInfoList = [...artIdSet].map((artId) => new Artwork(artId)).slice(0, 5 /* TODO(flyc): testing codes */)

  const artInfoPromiese = artworkInfoList.map((artwork) => {
    const limit = pLimit(2)

    return limit(async () => {
      return Promise.all([artwork.getArtWorkInfo(), artwork.getAllImagesUrl()])
        .then((res) => {
          const artInfo = res[0]
          const { userId, userAccount, title } = artInfo
          const { artId } = artwork

          const authorFolder = removeSlash(`${userAccount}-${userId}`)
          const artworkFolder = removeSlash(`${artId}-${title}`)

          return {
            error: null,
            ...artInfo,
            artworkId: artwork.artId,
            images: res[1].map((downloadLink, index) => {
              const { ext } = path.parse(new URL(downloadLink).pathname)
              const regExp = new RegExp(`${userId}.*${artId}.*-${index}\\.\\w+`)
              const targetFile = removeSlash(`${userAccount}-${userId}-${artId}-${title}-${index}-v0${ext}`)
              const targetFileName = path.join(storage, authorFolder, artworkFolder, targetFile)

              return new ImagesDiff({
                targetFileName,
                downloadLink,
                potentialCurrent: allFiles.find((filePath) => filePath.match(regExp)?.[0]) ?? null,
              })
            }),
          }
        })
        .catch((error) => ({ error }))
        .then(({ error, ...res }) => {
          if (error != null) return { error, artworkId: artwork.artId }
          return res
        })
    })
  })

  const infoFailedList = []
  const infoList = (await Promise.all(artInfoPromiese)).filter((result) => {
    if (result.error != null) {
      infoFailedList.push(result.artworkId)
      return false
    }
    return true
  })
  if (infoFailedList.length !== 0) {
    const logName = `logs/info-failed-list/${Date.now()}.json`
    console.log(red(`有一些作品的資訊取得失敗, 存入 log: ${logName}`))
    fs.mkdirSync(path.parse(logName).dir, { recursive: true })
    fs.writeFileSync(logName, JSON.stringify(infoFailedList, null, 2))
  }

  const artDonwloadLimit = pLimit(2)
  const wholeDownloadPromises = infoList.map((artInfo) => {
    const addHeader = ['referer:https://www.pixiv.net/', `Cookie:PHPSESSID=`]

    return artDonwloadLimit(async () => {
      console.log(lightBlue(`開始處理 ${artInfo.artworkId}-${artInfo.title}, 一共有 ${artInfo.images.length} 張圖片`))
      const imageLimit = pLimit(4)

      const imagesPromise = artInfo.images.map((info) =>
        imageLimit(async () => {
          const { downloadLink: link, targetFileName: o } = info

          return new Promise((resolve) => setTimeout(resolve, 100 + Math.ceil(Math.random() * 100)))
            .then(() => youtubeDl(link, { o, dumpJson: true, addHeader }))
            .then(() => youtubeDl(link, { o, addHeader }))
            .then(() => console.log(`${o} 下載成功`))
            .then(() => new ImagesDiff({ ...info, error: null }))
            .catch((error) => {
              console.log(red(`${o} 下載失敗`))
              return new ImagesDiff({ ...info, error })
            })
        })
      )

      const images = await Promise.all(imagesPromise)
      const checkImagePromises = images.map(async (imageInfo) => {
        const checkImageLimit = pLimit(10)

        return checkImageLimit(async () => {
          await imageInfo.getMd5()
          if (imageInfo.isSame == null) return

          if (imageInfo.isSame) {
            console.log(`${imageInfo.targetFileName} 相同，刪除舊的`)
            fs.rmSync(imageInfo.potentialCurrent)
          } else {
            console.log(`${imageInfo.targetFileName} 不同，把舊的重新命名成 v0 + 把新的命名成 v1`)
            console.log(red('這裡要測, 也會有「新的比較多」的場景'))
          }

          return // TODO(flyc): 要做什麼嗎?
        })
      })
      await Promise.all(checkImagePromises)
      console.log(lightGreen(`${artInfo.title}-${artInfo.artworkId} 處理結束`))
    })
  })

  // TODO(flyc): 這邊的寫法目前很暴力，可以再改成 limit 的那種

  await Promise.all(wholeDownloadPromises)
}
start()
