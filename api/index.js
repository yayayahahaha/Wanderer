const { fetchConfig } = require('../utils/header.js')
const { request } = require('../utils/request')
const qs = require('qs')

/**
 * @function getArtWorks
 * @description get both illustrations and monga, but have to login
 * */
const getArtWorks = async (sessionId, keyword, page, { mode = '' } = {}) => {
  return searchPattern('illustManga', { keyword, page, sessionId, mode, type: 'all' })
}

/**
 * @function getIllustration
 * @description get illustrations only
 * */
const getIllustration = async (sessionId, keyword, page, { mode = '' } = {}) => {
  return searchPattern('illust', { keyword, page, sessionId, mode, type: 'illust_and_ugoira' })
}

/**
 * @function getManga
 * @description get manga only
 * */
const getManga = async (sessionId, keyword, page, { mode = '' } = {}) => {
  return searchPattern('manga', { keyword, page, sessionId, mode, type: 'manga' })
}

/**
 * @function searchPattern
 * @param category<string> - illust, manga and illusManga
 * @description basic search pattern. For illustManga, illust and manga
 * */
const searchPattern = async (category, { keyword, page, sessionId, mode, type }) => {
  let param = ''
  switch (category) {
    case 'illust':
      param = 'illustrations'
      break
    case 'manga':
      param = 'manga'
      break
    case 'illustManga':
      param = 'artworks'
      break
    default:
      console.error(`[searchPattern] category can only be "illust", "manga" or "illustManga". got "${category}"`)
      return [null, 'wrong category']
  }

  const url = `https://www.pixiv.net/ajax/search/${param}/${keyword}`
  const word = keyword
  const p = page
  const query = {
    order: 'date_d',
    mode,
    s_mode: 's_tag',
    type,
    lang: 'zh_tw',
    word,
    p,
  }

  const [response, error] = await request({ url, ...fetchConfig(sessionId), params: query })
  if (error) return [null, error]

  const returnData = (({ data, total }) => ({ data, total }))(response?.body[category])
  return [returnData, null]
}

/**
 * @functoin getPhotoDetail
 * @description 取得圖片的資訊和讚數
 */
const getPhotoDetail = async (sessionId, artWorkId) => {
  const promises = [getPhotoInfo(sessionId, artWorkId), getPhotoLiked(sessionId, artWorkId)]
  const [photoSettle, likedSettle] = await Promise.allSettled(promises)
  const { status: photoStatus, value: photosValue, reason: photosReason } = photoSettle
  const { status: likedStatus, value: likedDataValue, reason: likedReason } = likedSettle

  const photosError = photoStatus !== 'rejected' ? false : photosReason
  const likedError = likedStatus !== 'rejected' ? false : likedReason

  if (photosError || likedError) return [null, { photosError, likedError }]
  const [photos] = photosValue
  const [likedData] = likedDataValue
  const result = { id: artWorkId, photos, ...likedData }
  return [result, null]
}

/**
 * @function getPhotoLiked
 * @description 取得圖片的讚數
 * */
const getPhotoLiked = async (sessionId, artWorkId) => {
  const url = `https://www.pixiv.net/artworks/${artWorkId}`
  const [response, error] = await request(url, fetchConfig(sessionId))
  if (error) return [null, error]

  const jsStr = response.split(/<meta name="preload-data" id="meta-preload-data" content='/)[1].split(/'>/)[0]
  try {
    const data = JSON.parse(jsStr).illust[artWorkId]
    const attributes = [
      'bookmarkCount',
      'likeCount',
      'commentCount',
      'responseCount',
      'viewCount',
      'createDate',
      'uploadDate',
    ]
    const returnItem = attributes.reduce((map, key) => Object.assign(map, { [key]: data[key] }), {})
    return [returnItem, null]
  } catch (e) {
    return [null, e]
  }
}

/**
 * @function getPhotoInfo
 * @description 取得圖片資訊
 * */
const getPhotoInfo = async (sessionId, artWorkId) => {
  const url = `https://www.pixiv.net/ajax/illust/${artWorkId}/pages?lang=zh_tw`
  const [data, error] = await request(url, fetchConfig(sessionId))
  if (error) return [null, error]
  const photos = data.body.map(({ urls: { original } }) => original)
  return [photos, null]
}

/**
 * @function checkLoginStatus
 * @description check login status
 * @return isLogin<boolean>
 * */
const checkLoginStatus = async function (sessionId) {
  const url = 'https://www.pixiv.net/ajax/linked_service/tumeng'
  const config = fetchConfig(sessionId)

  const [data, error] = await request({ url, ...config })
  if (error) return false
  if (data.error) return false

  return true
}

module.exports = {
  checkLoginStatus,

  getArtWorks,
  getIllustration,
  getManga,

  getPhotoDetail,
  getPhotoLiked,
  getPhotoInfo,
}
