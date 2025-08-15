import { fetchApi } from '../utils/request.js'
import { generateFetchHeaders } from './header.js'
import path from 'path'
import youtubeDl from 'youtube-dl-exec'
import pLimit from 'p-limit'
import fs from 'fs'

const delayTime = 100

/**
 * Artwork 類別 - 用於處理 Pixiv 的插圖資料
 *
 * @class Artwork
 *
 * 私有屬性:
 * @property {string} #id - 插圖的唯一識別碼
 * @property {object} #fetchHeaders - 用於 API 請求的 headers
 * @property {string} #session - Pixiv 的登入 session
 *
 * 方法:
 * @method constructor(id, sessionId) - 初始化 Artwork 實例
 * @method generateCurl() - 生成對應插圖頁面的 curl 指令
 * @method getArtWorkInfo() - 獲取插圖的基本資訊（標題、作者等）
 * @method downloadAllImages() - 下載插圖的所有圖片
 * @method getAllImagesUrl() - 獲取插圖的所有原始圖片網址
 *
 * @param {string} id - 插圖的 ID
 * @param {string} sessionId - Pixiv 的登入 session ID
 */
export class Artwork {
  #id
  #fetchHeaders
  #session
  #failedList = []

  generateCurl() {
    const url = `https://www.pixiv.net/artworks/${this.#id}`
    return `curl '${url}' \
  -H 'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7' \
  -H 'accept-language: zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7' \
  -H 'cache-control: no-cache' \
  -b 'p_ab_id=4; p_ab_id_2=6; p_ab_d_id=1084913041; yuid_b=GRliJXc; PHPSESSID=${
    this.#session
  }; privacy_policy_notification=0; a_type=0; b_type=0; privacy_policy_agreement=7; login_ever=yes; c_type=25; _gcl_au=1.1.1885172841.1741453752; __cf_bm=sJ3yZdRCNDKxPQeOuh7isIIpYek1R1FzQE.7j3XLYU0-1745160056-1.0.1.1-WW.CQ7t2WK.0hvZBW.HUdr3lVvnX1JRfoiMgmXfC50jwbuNF.CFtaQAf6pP3hJwTZOywqoB7teQYhjoPAaQy84QXk637VpIfoeLXcEhxM6WzQ83.LgJJ8jFi16QZup_6; cf_clearance=JUxJMYRdNzg5Lful6rEnaQQMMqh67Yny12ixOktKOcU-1745161668-1.2.1.1-jZdXZkX7swmObgUJFxA.v.ruhxKH51DIxScQMI6Dx2OjgvCVDYYSuI83k2GPGDfBC36N.fMeqZS6Qp0Zkka3h48lXAXqB1DQUGMlXU3ak3zdMP6M1BuB.6CjyznFfrKiQCB9.hGefejT5CGtusiMtK_3gbx.rjrK4dqhxBh1BSp_.C1e.cNeLlOSUpv9LknAmKnKFlthmNJbIyrsq1t4nppAldo1w0bi8K3XSAUPxet_YTtkViQ00N4FAmIYCJltOBZbh9HdaU0hFyn8nx5PLvqp3uTNm72oHW7uQtOD4UmLNMJoMiDpAskODiqgjFAKyG5Ye99TMeA5Qjix3W61.yMpzHF2Keq93aDRuYT9Alw; _ga_75BBYNYN9J=GS1.1.1745160058.3.1.1745161701.0.0.0' \
  -H 'pragma: no-cache' \
  -H 'priority: u=0, i' \
  -H 'sec-ch-ua: "Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: document' \
  -H 'sec-fetch-mode: navigate' \
  -H 'sec-fetch-site: same-origin' \
  -H 'sec-fetch-user: ?1' \
  -H 'upgrade-insecure-requests: 1' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'`
  }

  constructor(id, sessionId) {
    this.#id = id
    this.#session = sessionId
    this.#fetchHeaders = generateFetchHeaders(sessionId, id)
  }

  getArtWorkInfo() {
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

  /**
   * 下載作品的所有圖片，並以組織化的結構儲存到本地
   * @async
   * @returns {Promise<void>} 所有圖片下載完成時解析，發生錯誤時拒絕
   * @throws {Error} 當無法獲取作品資訊或無法取得圖片網址時拋出錯誤
   * @description
   * 函式執行以下步驟：
   * 1. 獲取作品資訊，包含使用者ID、標題和使用者帳號
   * 2. 取得作品相關的所有圖片網址
   * 3. 以遞迴方式下載圖片，每次下載間有指定的延遲時間
   * 4. 圖片儲存格式：test-img/[使用者帳號]-[使用者ID]/[作品ID]-[標題]/[使用者帳號]-[使用者ID]-[作品ID]-[標題]-[頁碼].png
   * 使用 youtube-dl 並帶有 Pixiv 專用的標頭進行下載
   */
  async downloadAllImages() {
    const { error: infoError, ...artworkInfo } = await this.getArtWorkInfo().catch((error) => ({ error }))
    if (infoError) return void console.log(`取得 ${this.#id} 基本資訊失敗: `, infoError)

    const { userId, title, userAccount } = artworkInfo

    console.log(`正要開始下載 ${title} - ${this.#id}`)

    const { error, linkList } = await this.getAllImagesUrl()
      .then((linkList) => ({ linkList }))
      .catch((error) => ({ error }))
    if (error) return void console.log(error)

    const downloadInfoList = linkList.map((link, index) => {
      const fileName = `test-img/${userAccount}-${userId}/${this.#id}-${title}/${userAccount}-${userId}-${
        this.#id
      }-${title}-${index}.png`
      const targetPath = path.resolve(process.cwd(), fileName)
      const addHeader = ['referer:https://www.pixiv.net/', `Cookie:PHPSESSID=${this.#session}`]

      return { link, fileName, targetPath, addHeader }
    })

    const { failedList } = await _doDownload.call(this, downloadInfoList)
    this.#failedList = [...this.#failedList, ...failedList]
    if (this.#failedList.length !== 0) {
      const failedLog = `test-img/${userAccount}-${userId}/failed-log-${Date.now()}.json`
      fs.writeFileSync(failedLog, JSON.stringify(this.#failedList, null, 2))
      console.log('下載與重新嘗試都結束了, 但仍有沒有下載成功的檔案，已寫進 log 裡')
    }

    async function _doDownload(list, tryLimit = 2) {
      const failedList = []
      const limit = pLimit(4)
      const promises = list.map((payload, index) => {
        const { link, fileName, targetPath: o, addHeader } = payload

        return limit(() =>
          new Promise((resolve) => setTimeout(resolve, delayTime + Math.ceil(Math.random() * 100)))
            .then(() => youtubeDl(link, { o, dumpJson: true, addHeader }))
            .then(() => youtubeDl(link, { o, addHeader }))
            .then(() => console.log(`${fileName} 下載完成`))
            .catch((error) => {
              console.log(`${this.#id}-${index} 下載失敗`)
              console.log(error)
              failedList.push(payload)
            })
        )
      })

      return Promise.all(promises).then(() => {
        if (failedList.length !== 0) {
          if (tryLimit <= 0) {
            console.log('仍有失敗的下載嘗試，但超過重試次數了', failedList)
            return { failedList }
          }

          console.log(`有 ${failedList.length} 個失敗的項目，重新嘗試下載這些檔案`)
          return _doDownload.call(this, failedList, tryLimit - 1)
        } else {
          console.log(`${title} - ${this.#id} 結束囉`)
          return { failedList }
        }
      })
    }
  }

  /**
   * @description 取得當前 artWork 全部圖片的網址
   * */
  async getAllImagesUrl() {
    const url = `https://www.pixiv.net/ajax/illust/${this.#id}/pages?lang=zh_tw`
    const { error, ...res } = await fetchApi(url, this.#fetchHeaders)
    if (error) throw error

    return res?.body.map(({ urls: { original } }) => original) ?? []
  }
}
