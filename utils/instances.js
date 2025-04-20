import { fetchApi } from '../utils/request.js'
import { generateFetchHeaders } from './header.js'
import path from 'path'
import youtubeDl from 'youtube-dl-exec'

export class Artwork {
  #id
  #fetchHeaders

  constructor(id, sessionId) {
    this.#id = id
    this.#fetchHeaders = generateFetchHeaders(sessionId, id)
  }

  getArtWorkInfo() {
    const url = `https://www.pixiv.net/artworks/${this.#id}`
    return fetchApi(url, this.#fetchHeaders)
  }

  async downloadAllImages({ session } = {}) {
    const { error, linkList } = await this.getAllImagesUrl()
      .then((linkList) => ({ linkList }))
      .catch((error) => ({ error }))
    if (error) return void console.log(error)

    await _recursive(linkList, 0)
    async function _recursive(list) {
      const link = list[0]
      const fileName = path.resolve('.', `test-img/${Date.now()}.png`)
      const addHeader = ['referer:https://www.pixiv.net/', `Cookie:PHPSESSID=${session}`]

      await youtubeDl(link, {
        o: fileName,
        dumpJson: true,
        addHeader,
      }).then(() => youtubeDl(link, { o: fileName, addHeader }))

      if (list.length === 1) return void console.log('結束囉')

      await new Promise((r) => setTimeout(r, 1000))
      return _recursive(list.slice(1))
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
