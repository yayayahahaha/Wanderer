// TODO(flyc): 在關閉的時候輸出 or 匯出進度資訊

import { lightBlue, lightRed, readSettings } from './utils.js'
import { Artwork } from './utils/instances.js'
import pLimit from 'p-limit'

async function start() {
  const { error, ...settings } = await readSettings().catch((error) => ({ error }))
  if (error) return

  const { idList: oriList = [] } = settings

  const artworkLinkPattern = new RegExp('^https://www.pixiv.net/artworks/(\\d+)$')
  const artworkIdPattern = /^\d+$/
  const idList = [...new Set(oriList)]
    .map((artId) => {
      if (artworkLinkPattern.test(artId)) artId = artId.match(artworkLinkPattern)[1]
      else if (!artworkIdPattern.test(artId)) return null
      return artId
    })
    .filter(Boolean)

  const totalCount = idList.length
  let finishedCount = 0
  console.log(lightBlue(`這次要處理 ${totalCount} 個`))

  const limit = pLimit(2)

  const promises = idList.map((artId, index) => {
    const artwork = new Artwork(artId)
    return limit(async () => {
      const downloadFlowError = (await artwork.downloadFlow({ seq: index }).catch((error) => ({ error })))?.error
      if (downloadFlowError) throw downloadFlowError
      finishedCount++
      console.log(`\n 🐳 ${finishedCount}/${totalCount} \n`)
    })
  })

  await Promise.all(promises).catch((error) => {
    console.log(lightRed('下載中斷了'), error)
  })
}
start()

/*process.on('SIGINT', () => {
  console.log('\n收到 Ctrl+C 信號，正在準備進度報告...')
})*/
