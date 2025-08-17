// TODO(flyc): cache 系統: 透過 method head 來快速取得 headers 的資訊，藉此判斷有沒有拉過
// 快取前置: 取得當前既有的檔案的檔名後生成連結，然後再去取一次。取回來之後計算 md5 hash, 如果不一致的話就把舊的重新取名為 v1, 然後新的就是 v2
// TODO(flyc): 在關閉的時候把完成的檔案放到 json 的另外一個 keys 裡, 寫入前檢查如果 json 有被手動異動的話，就寫成 log

import { red, readSettings } from './utils.js'
import { Artwork } from './utils/instances.js'
import pLimit from 'p-limit'

async function start() {
  const { error, ...settings } = await readSettings().catch((error) => ({ error }))
  if (error) return

  const { session, idList: oriList = [] } = settings

  const artworkLinkPattern = new RegExp('^https://www.pixiv.net/artworks/(\\d+)$')
  const artworkIdPattern = /^\d+$/
  const idList = [...new Set(oriList)]

  const limit = pLimit(2)

  const promises = idList.map((artId) => {
    if (artworkLinkPattern.test(artId)) artId = artId.match(artworkLinkPattern)[1]
    else if (!artworkIdPattern.test(artId)) return () => null

    const artwork = new Artwork(artId, session)

    return limit(() =>
      artwork
        .downloadAllImages({ session })
        .then((res) => res ?? {})
        .catch((error) => {
          console.log(red(`id ${artId} 下載失敗!`))
          console.log(error)
          return error instanceof Error ? error : new Error(error)
        })
    )
  })

  Promise.all(promises)
}
start()
