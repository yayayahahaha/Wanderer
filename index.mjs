// TODO
// 因為如果請求次數過多的話會被阻擋
// 除了減緩請求次數以外，可以嘗試看看將不用登入就可以取得的 image 資訊不用 session 去請求之類的?

// TODO 抓取某個作者的作品? 這樣的快取應該比較好做

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

import { masterHouse } from './masterHouse.js'

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
  if (artWorkError) {
    errorStyle('發生錯誤!')
    console.error(artWorkError)
    return
  }

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
  const allPhotos = await getPhotoByPages(PHPSESSID, keyword, totalPages)

  console.log(`取得圖片的實際位置和愛心數目..`)
  const photoMap = await getPhotosSrcAndLiked(PHPSESSID, allPhotos)

  allPhotos.forEach((photo) => {
    photo.photos = photoMap[photo.id]?.photos
    syncCache(cacheData, 'id', photo)
  })

  writeFile(cacheData, cacheFileName)
  writeFile(photoMap, `liked-${cacheFileName}`)

  const photosWithEverything = allPhotos
    .map((photo) => {
      photo.likeCount = photoMap[photo.id].likeCount
      return photo
    })
    .sort((a, b) => b.likeCount - a.likeCount)

  writeFile(photosWithEverything, `all-${cacheFileName}`)
}
start()

async function getPhotosSrcAndLiked(PHPSESSID, allPhotos) {
  const jobs = allPhotos.map(({ id }) => {
    return () => getPhotoDetail(PHPSESSID, id)
  })
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
