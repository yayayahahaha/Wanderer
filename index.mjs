// TODO
// 快取的機制的改進：
// 清除快取的指令，清除全部、清除部分等等的
// 全域變數的減少使用，如cacheDirectory 或keyword 等
// 還有模組化各個function 之類的
// 完成就可以嘗試多重keyword 了

// OTHERS TODO
// 依作者分類
// 計算作者總星星數和取出基本資訊
// 作者排序
// 攤平瀏覽
// 查詢結果如果過多的話該怎麼辦?
// electron 平台的實作
// Puppeteer 操偶師的實作必要性研究?

// TODO
// SESSID 的部分可以嘗試打post api 傳遞帳密後直接取得之類的 -> 這個會被 Google 的機器人驗正檔下來
// 或是取得多組SESSID 後放進array 做輪詢減少單一帳號的loading 之類的

import fs, { createWriteStream, write } from 'fs'
import {
  loading,
  inputChecker,
  colorMap,
  writeFile,
  getPhotoByPages,
  syncCache,
  createOrLoadCache,
} from './utils/index.js'
import { checkLoginStatus, getArtWorks, getPhotoDetail } from './api/index.js'

import MasterHouse from 'MasterHouse'
const masterHouse = new MasterHouse()

const getSearchHeader = function () {
  if (!currentSESSID) console.log('getSearchHeader: currentSESSID 為空！')
  return {
    'accept-language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6,zh-CN;q=0.5',
    cookie: `PHPSESSID=${currentSESSID};`,
  }
}
const getSinegleHeader = function (illustId) {
  if (!illustId) {
    console.log('getSinegleHeader: 請務必輸入illustId')
    return {}
  }
  return {
    referer: `https://www.pixiv.net/artworks/${illustId}`,
  }
}

function colorConsole(message, style) {
  const { Reset, FgYellow, FgRed, Bright } = colorMap
  switch (style) {
    case 'error':
      console.log(`${Bright}${FgRed}${message}${Reset}`)
      break
    case 'title':
    default:
      console.log(`${Bright}${FgYellow}${message}${Reset}`)
      break
  }
}
function titleStyle(message, newLine = true) {
  newLine ? console.log() : null
  colorConsole(message, 'title')
}
function errorStyle(message) {
  colorConsole(message, 'error')
}

async function start() {
  titleStyle('開始')

  let loadEnd = null

  loadEnd = loading('檢查 input 參數資料')
  const [inputData, errorMessage] = inputChecker()
  loadEnd(true)
  if (errorMessage) return void console.log(errorMessage)

  loadEnd = loading('檢查登入狀態')

  const { keyword, PHPSESSID } = inputData

  const isLogin = await checkLoginStatus(PHPSESSID)
  loadEnd(isLogin)
  if (!isLogin) return void errorStyle('非登入狀態! 請檢查 PHPSESSID 是否正確或已過期')

  titleStyle(`搜尋的關鍵字: ${keyword}`)

  loadEnd = loading('開始搜尋')
  const [artWorkRes, artWorkError] = await getArtWorks(PHPSESSID, keyword, 1)
  loadEnd(!artWorkError)
  if (artWorkError) return void console.log()

  const { total, data } = artWorkRes
  if (total === 0) return console.log('該關鍵字下沒有作品')
  const totalPages = countTotalPages(artWorkRes)

  console.log(`總筆數: ${total.toLocaleString()}`)
  console.log(`總頁數: ${totalPages}`)

  const cacheFileName = `${keyword}.json`
  const cachePath = `./caches/${cacheFileName}`
  const cacheData = createOrLoadCache(cachePath)

  // HINT 可以做 cache 的點
  console.log(`逐頁取得圖片的基本資料..`)
  const allPhotos = await getPhotoByPages(PHPSESSID, keyword, 3 /* totalPages */)

  // NEXT 這裡，相互綁定一下 id 之類的東西
  console.log(`取得圖片的實際位置和愛心數目..`)
  const photoMap = await getPhotosSrcAndLiked(PHPSESSID, allPhotos.slice(0, 5))

  writeFile(photoMap)

  allPhotos.slice(0, 5).forEach((photo) => {
    photo.photos = photoMap[photo.id]?.photos
    syncCache(cacheData, 'id', photo)
  })

  writeFile(cacheData, cacheFileName)
  writeFile(photoMap, `liked-${cacheFileName}`)

  const photosWithEverything = allPhotos
    .slice(0, 5)
    .map((photo) => {
      photo.likeCount = photoMap[photo.id].likeCount
      return photo
    })
    .sort((a, b) => b.likeCount - a.likeCount)

  writeFile(photosWithEverything, `all-${cacheFileName}`)
}
start()

async function getPhotosSrcAndLiked(PHPSESSID, allPhotos) {
  const jobs = allPhotos.map(
    ({ id }, i) =>
      () =>
        getPhotoDetail(PHPSESSID, allPhotos[i].id)
  )
  return (await masterHouse.doJobs(jobs)).reduce((map, { result }) => {
    const info = result[0]
    if (!info) return map
    map[info.id] = info
    return map
  }, {})

  // TODO 為什麼這邊不會幫我自動補齊 masterHouse 的東西 doJobs、但會補齊 jobsCreateHelper ?
}

function countTotalPages(response) {
  const { total, data } = response
  const currentLengh = data.length
  const perPage = Math.min(total, currentLengh)
  return Math.ceil(total / perPage)
}

// 故事從這裡開始
;(async (eachPageInterval = 60) => {
  if (console) return

  // 綁定bookmarkCount 和likedCount
  const formatedImagesArray = await bindingBookmarkCount(allPagesImagesArray, keyword)

  // 過濾星星數: bookmarkCount + likedCount
  const filterImagesArray = filterBookmarkCount(formatedImagesArray, likedLevel)

  // 分割出singleArray 和multipleArray
  const { singleArray, multipleArray } = separateSingleAndMultiple(filterImagesArray)

  // 把task 展開: singleArray 的只會有一張、multiple 的會有多張
  const singleArray_format = fetchSingleImagesUrl(singleArray)
  const multipleArray_format = await fetchMultipleImagesUrl(multipleArray)
  const totalImageArray = singleArray_format.concat(multipleArray_format)

  // 開始下載
  await startDownloadTask(totalImageArray, keyword)

  fs.writeFileSync('result.json', JSON.stringify(totalImageArray, null, 2))

  console.log('下載完成!')
})()

// 取得每個作品的連結的快取
function getPageCache(list, keyword) {
  if (!fs.existsSync('./caches/')) {
    fs.mkdirSync('./caches/')
  }

  let cacheMap = {}
  const cacheFilePath = `./caches/${keyword}.json`
  if (fs.existsSync(cacheFilePath)) {
    cacheMap = JSON.parse(fs.readFileSync(cacheFilePath))
  }
  return cacheMap
}

// 透過taskSystem 逐頁取得所有圖片的項目
// 也在這個function 找出每個圖片的星星數目
async function bindingBookmarkCount(allPagesImagesArray, keyword) {
  const allPagesImagesMap = allPagesImagesArray.reduce(
    (map, item) =>
      Object.assign(map, {
        [item.illustId]: item,
      }),
    {}
  )

  // 取得cache
  const cachedMap = getPageCache(allPagesImagesArray, keyword)
  const noCacheImages = allPagesImagesArray.filter((image) => !cachedMap[image.illustId])

  const taskArray = []
  noCacheImages.forEach((imageItem) => {
    taskArray.push(_each_image_page(imageItem.illustId))
  })
  const taskNumber = taskNumberCreater()
  const bookmarkTask = new TaskSystem(taskArray, taskNumber, defaultTaskSetting())
  const bookmarkTaskResult = await bookmarkTask.doPromise()

  const resultMap = {}
  bookmarkTaskResult.forEach((result) => Object.assign(resultMap, result.data.illust))

  // cache 部分
  const cacheFilePath = `./caches/${keyword}.json`
  Object.assign(cachedMap, resultMap)
  fs.writeFileSync(cacheFilePath, JSON.stringify(cachedMap, null, 2))

  Object.keys(allPagesImagesMap).forEach((illustId) => {
    const urls = cachedMap[illustId].urls
    const bookmarkCount = cachedMap[illustId].bookmarkCount
    const likeCount = cachedMap[illustId].likeCount
    Object.assign(allPagesImagesMap[illustId], {
      urls,
      bookmarkCount,
      likeCount,
    })
  })

  return allPagesImagesMap

  function _each_image_page(illustId) {
    return function () {
      return request({
        method: 'get',
        url: `https://www.pixiv.net/artworks/${illustId}`,
        headers: getSearchHeader(),
      }).then(([data]) => {
        const splitPattern1 = '<meta name="preload-data" id="meta-preload-data" content=\''
        const splitPattern2 = '</head>'
        const splitPattern3 = "'>"
        return JSON.parse(data.split(splitPattern1)[1].split(splitPattern2)[0].split(splitPattern3)[0])
      })
    }
  }
}

// 過濾星星: 把bookmarkCount + likeCount 少於目標數的剔除
function filterBookmarkCount(map, level = 0) {
  const list = Object.keys(map).map((id) => map[id])
  return list.filter((item) => {
    const likedLevel = item.bookmarkCount + item.likeCount
    return likedLevel >= level
  })
}

// 區分出單張和組圖
function separateSingleAndMultiple(list) {
  return list.reduce(
    (object, item) => {
      switch (item.pageCount) {
        case 1:
          object.singleArray.push(item)
          break
        default:
          object.multipleArray.push(item)
          break
      }
      return object
    },
    {
      singleArray: [],
      multipleArray: [],
    }
  )
}

// fetchSingleImageUrl & fetchMultipleImageUrl:
// 用來取得圖片的真實路徑並整理好格式
function fetchSingleImagesUrl(list) {
  return list.map(({ id, userId, illustTitle, userName, urls }) => {
    const key = `${id}-${userId}`
    const name = `${illustTitle}_${id}_${userName}_${userId}`
    const original = urls.original

    const typeIndex = original.split('.').length - 1
    const type = original.split('.')[typeIndex]

    const folder = ''

    return {
      id,
      userId,
      folder,
      key,
      name,
      original,
      type,
    }
  })
}
async function fetchMultipleImagesUrl(list) {
  const taskArray = []
  for (let i = 0; i < list.length; i++) {
    const mulImage = list[i]
    taskArray.push(_create_get_multiple_images(mulImage.illustId))
  }
  const getMultiOriTask = new TaskSystem(taskArray, taskNumberCreater(), defaultTaskSetting())
  const getMultiOriTaskResult = await getMultiOriTask.doPromise()

  const multiMap = list.reduce(
    (map, item) =>
      Object.assign(map, {
        [item.illustId]: item,
      }),
    {}
  )

  let multiArray = []
  getMultiOriTaskResult.forEach((result) => {
    const resultItem = result.data
    const illustId = resultItem.illustId

    const { id, userId, illustTitle, userName } = multiMap[illustId]
    const multiImages = resultItem.data.map(({ urls }) => {
      const original = urls.original
      const index = original.split(original.split(/_p\d\./)[0])[1].split('.')[0]

      const key = `${id}-${userId}-${index}`
      const name = `${illustTitle}_${id}_${userName}_${userId}${index}`

      const typeIndex = original.split('.').length - 1
      const type = original.split('.')[typeIndex]

      const folder = `${illustTitle}-${id}`

      return {
        id,
        userId,
        folder,
        key,
        name,
        original,
        type,
      }
    })
    multiArray = multiArray.concat(multiImages)
  })

  return multiArray

  function _create_get_multiple_images(illustId) {
    return function () {
      return request({
        method: 'get',
        url: `https://www.pixiv.net/ajax/illust/${illustId}/pages`,
        headers: getSearchHeader(),
      }).then(([data]) => {
        return Object.assign({
          illustId,
          data: data.body,
        })
      })
    }
  }
}

// 開始下載
async function startDownloadTask(sourceArray, keyword) {
  if (!fs.existsSync('./images/')) {
    fs.mkdirSync('./images/')
  }

  const keywordFolder = `./images/${keyword}/`
  if (!fs.existsSync(keywordFolder)) {
    fs.mkdirSync(keywordFolder)
  }

  // for quick detect
  const existFolderMap = {
    [keywordFolder]: true,
  }

  const taskArray = []
  for (let i = 0; i < sourceArray.length; i++) {
    taskArray.push(_create_download_task(sourceArray[i], keywordFolder))
  }
  const downloadTask = new TaskSystem(taskArray, taskNumberCreater(), defaultTaskSetting())
  const downloadTaskResult = await downloadTask.doPromise()

  return downloadTaskResult

  function _create_download_task(image, keywordFolder) {
    return function () {
      const folder = `${keywordFolder}${image.folder}`
      switch (true) {
        case existFolderMap[folder]:
        case fs.existsSync(folder):
          break
        default:
          fs.mkdirSync(folder)
          break
      }
      existFolderMap[folder] = true

      const url = image.original
      const filePath = `${folder}/${image.name}.${image.type}`
      const headers = getSinegleHeader(image.id)

      return download(url, filePath, {
        headers,
      })
    }
  }
}
