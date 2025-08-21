// TODO(flyc): cache 系統: 透過 method head 來快速取得 headers 的資訊，藉此判斷有沒有拉過
// 快取前置: 取得當前既有的檔案的檔名後生成連結，然後再去取一次。取回來之後計算 md5 hash, 如果不一致的話就把舊的重新取名為 v1, 然後新的就是 v2
// TODO(flyc): 在關閉的時候把完成的檔案放到 json 的另外一個 keys 裡, 寫入前檢查如果 json 有被手動異動的話，就寫成 log

// import pLimit from 'p-limit'
import {
  errorConsole,
  getFileMD5,
  lightBlue,
  lightCyan,
  lightGreen,
  lightMagenta,
  lightYellow,
  readFilesRecursively,
  red,
} from './utils.js'
import fs from 'fs'
import { Artwork } from './utils/instances.js'
import pLimit from 'p-limit'

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

const verbose = false
const excluded = new Set([
  '123077070',
  '133266390',
  '133489284',
  '133632363',
  '128804234',
  '131135611',
  '129323226',
  '123240441',
  '129965485',
])

async function start() {
  const allFiles = readFilesRecursively('./test-img')

  const artIdSet = allFiles.reduce((acc, filePath) => {
    const matched = filePath.match(/^test-img\/[^/]+-(\d+)\/(\d+)-.*/) ?? null
    if (matched == null) return acc

    const id = matched?.[2]
    acc.add(id)
    return acc
  }, new Set())
  const artworkInfoList = [...artIdSet]
    .filter((id) => !excluded.has(id))
    .map((id) => new Artwork(id))
    .slice(0, 1 /* TODO(flyc): testing codes */)

  console.log(`這次要處理 ${artworkInfoList.length} 個`)
  let finishedCount = 0

  const infoLimit = pLimit(2)
  const artPromise = artworkInfoList.map((item, artIndex) => {
    const colorFn = artIndex % 3 === 1 ? lightCyan : artIndex % 3 === 2 ? lightMagenta : lightYellow

    return infoLimit(async () => {
      let error = null
      error = (await item.genArtworkInfo().catch((error) => ({ error })))?.error
      if (error) throw error
      verbose && console.log(`取得 ${item.artworkInfo.id}-${item.artworkInfo.title} 的基本資訊成功 ✅📂`)

      // 嘗試處理 cache folder
      item.genCachePossableMap()

      error = (await item.genImages().catch((error) => ({ error })))?.error
      if (error) throw error
      verbose && console.log(`取得 ${item.artworkInfo.id}-${item.artworkInfo.title} 的圖片資訊成功 ✅📸`)

      let imgFinishedCount = 0
      console.log(
        colorFn(`🎁 ${`${item.artworkInfo.title} - ${item.artworkInfo.id} `} 有 ${item.images.length} 張圖片`)
      )

      const imgLimit = pLimit(4)
      const imgPromises = item.images.map((img) => {
        return imgLimit(async () => {
          let error = null

          error = (await img.genHeaderInfo().catch((error) => ({ error })))?.error
          if (error) throw error
          verbose && console.log(`取得圖片 ${img.fileName} 的標頭成功 ✅🎇`)

          await img.download('check-images')
          verbose && console.log(`${img.fileName} 下載成功 ✅💖`)

          const {
            artworkInfo: { userId, id },
            index,
          } = img

          const regExp = new RegExp(`${userId}.*${id}.*-${index}\\.\\w+`)

          const potentialCurrent = allFiles.find((filePath) => filePath.match(regExp)?.[0]) ?? null

          const imgDiff = new ImagesDiff({
            targetFileName: `check-images/${img.fileName}`,
            potentialCurrent,
          })

          if (imgDiff.potentialCurrent == null) {
            console.log(lightBlue(`${imgDiff.targetFileName} 沒有舊的檔案，是全新的`))
          } else {
            await imgDiff.getMd5()
            if (imgDiff.isSame == null) return

            if (imgDiff.isSame) {
              fs.rmSync(imgDiff.potentialCurrent)
              verbose && console.log(`${imgDiff.targetFileName} 相同，刪除舊的`)
            } else {
              fs.renameSync(imgDiff.targetFileName, imgDiff.targetFileName.replace(/-v0/, '-v1'))
              fs.renameSync(imgDiff.potentialCurrent, imgDiff.targetFileName)
              console.log(lightBlue(`${imgDiff.targetFileName} 不相同，移動新的到 v1, 舊的到 v0`))
            }
          }

          imgFinishedCount++
          console.log(
            `🦀 ${colorFn(`${item.artworkInfo.title} - ${item.artworkInfo.id} `)}: ${imgFinishedCount}/${
              item.images.length
            }`
          )

          return { img, imgDiff }
        })
      })
      await Promise.all(imgPromises)

      finishedCount++
      console.log(`\n🎀 ${finishedCount}/${artworkInfoList.length}\n`)
    })
  })

  await Promise.all(artPromise)
    .then(() => {
      console.log(lightGreen('成功囉'))
    })
    .catch((error) => errorConsole('出事..', error))
}
start()
