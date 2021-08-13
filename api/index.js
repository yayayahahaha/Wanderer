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

const checkLoginStatus = async function (sessionId) {
  const url = 'https://www.pixiv.net/ajax/linked_service/tumeng'

  const [data, error] = await request(url, fetchConfig(sessionId))
  if (error) return false
  if (data.error) return false

  return true
}

module.exports = { getArtWorks, checkLoginStatus }
