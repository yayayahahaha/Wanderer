const { checkLoginStatus, getArtWorks } = require('./api/index.js')
const { getParams, getAllArtWorks, getAllPhotos } = require('./utils/index.js')
const { checkAndWrite } = require('./utils/path.js')

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

  console.log(`總共有 ${total} 項作品, 共 ${totalPages} 頁面`)
  // return

  // TODO 比較不精準但效果較好的快取: 在逐頁取得資料時根據之前的快取檔案裡的最新一筆決定什麼時候要break;
  // 可能的問題: 由於是task 去跑，目前的task 沒有強制中斷的機制, 逐個去await 也蠻耗時間的..
  // 可能的解法: 純粹用時戳而不用id、去找出最新的那頁? 方法是二分法
  // 可能的遺漏: 如果有作者更新之前的舊有資料的話便不會更新到那塊

  // TODO 某星星數量以上的才去下載的機制
  // !!: 這個應該在取得作品詳細資料前就可以先過濾的部分
  // 快取檔可以有、但在下載的時候要提供星星數量的過濾機制
  // 然後也會依照已經存在的快取判斷機制不去做重複下載

  // TODO 頁面太多、作品太多的話該怎麼辦?
  // 感覺要一定數量後做快取、有點像是分批去載的概念
  // 前面的取完後後面再依照先前的最後一個去做接續之類的

  /**
   * 一頁一頁取得所有頁面的作品資訊: 一個作品可能會有多張圖片, 但這邊的資訊裡沒有圖片
   * */
  const artWorks = await getAllArtWorks({ PHPSESSID, keyword, totalPages })

  /**
   * 取得每個作品的圖片資訊, 但還是有依照作品做物件
   * */
  const photos = await getAllPhotos({ PHPSESSID, artWorks })

  // TODO 依照取得的完整作品資訊與先前(如果有)的快取檔案做比對
  // 比對的項目有: 作品-圖片id 是否存在、存在的話就不下載
  // further: 如果判斷存在的話依照實體資訊與新來的資訊是否一致(避免之前其實是壞圖)
  // 如果不一致的話就重新下載一個 name-2 做版本區分
  // 比對完下載完後以疊合的方式更新快取檔，且幫快取檔案加上時戳

  checkAndWrite(`./caches/${keyword}.json`, JSON.stringify(photos, null, 2))
}
