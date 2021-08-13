const { checkLoginStatus, getArtWorks } = require('./api/index.js')
const { getParams, getAllArtWorks, getAllPhotos } = require('./utils/index.js')

const envPath = './input.json'

init()
async function init() {
  const { keyword, PHPSESSID /*, device_token*/ } = await getParams(envPath)
  if (!keyword) return void console.error('請在 env 檔裡面設定 keyword!')

  const isLogin = await checkLoginStatus(PHPSESSID)
  if (!isLogin) console.log('[WARNING] 沒有登入')

  const [basicInfo, error] = await getArtWorks(PHPSESSID, keyword, 1)
  if (error) return console.log('[ERROR] 關鍵字搜尋失敗!')

  const { total } = basicInfo

  const perPage = basicInfo.data.length
  const totalPages = Math.ceil(total / perPage)

  const artWorks = await getAllArtWorks({ PHPSESSID, keyword, totalPages })

  const photos = await getAllPhotos({ PHPSESSID, artWorks })
  console.log(photos)
}
