const { fetchConfig } = require('../utils/header.js')
const { request } = require('../utils/request')
const qs = require('qs')

const getArtWorks = async (sessionId, keyword, page) => {
  const word = keyword
  const p = page
  const url = `https://www.pixiv.net/ajax/search/artworks/${keyword}`
  const params = Object.assign(
    {
      order: 'date_d',
      mode: 'all',
      s_mode: 's_tag',
      type: 'all',
      lang: 'zh_tw'
    },
    { word, p }
  )

  const queryString = `?${qs.stringify(params)}`
  const [response, error] = await request(`${url}${queryString}`, fetchConfig(sessionId))
  if (error) return [null, error]

  const returnData = (({ data, total }) => ({ data, total }))(response?.body?.illustManga)
  return [returnData, null]
}

/**
 * @description 取得圖片的資訊和讚數
 */
const getPhotos = async (sessionId, artWorkId) => {
  const [[photos, photosError], [likedData, likedError]] = await Promise.all([
    getPhotoInfo(sessionId, artWorkId),
    getPhotoLiked(sessionId, artWorkId)
  ])
  if (photosError || likedError) return [null, { photosError, likedError }]
  const result = { photos, ...likedData }
  return [result, null]
}
/**
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
      'uploadDate'
    ]
    const returnItem = attributes.reduce((map, key) => Object.assign(map, { [key]: data[key] }), {})
    return [returnItem, null]
  } catch (e) {
    return [null, e]
  }
}
/**
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
 * @description 檢查登入狀態
 * */
const checkLoginStatus = async function (sessionId) {
  const url = 'https://www.pixiv.net/ajax/linked_service/tumeng'

  const [data, error] = await request(url, fetchConfig(sessionId))
  if (error) return false
  if (data.error) return false

  return true
}

module.exports = { getArtWorks, checkLoginStatus, getPhotos, getPhotoLiked, getPhotoInfo }
