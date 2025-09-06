// TODO(flyc): 在關閉的時候輸出 or 匯出進度資訊

import { lightBlue, lightRed, lightYellow, readSettings, yellow } from './utils.js'
import { Artwork } from './utils/instances.js'
import pLimit from 'p-limit'

async function start() {
  const { error, ...settings } = await readSettings().catch((error) => ({ error }))
  if (error) return

  const { idList: oriList = [] } = settings

  const artworkLinkPathPattern = /^\/artworks\/(\d+)$/
  const artworkIdPattern = /^\d+$/
  const { idList, invalidList } = [...new Set(oriList)].reduce(
    (acc, link) => {
      if (artworkIdPattern.test(link)) {
        acc.idList.push(link)
        return acc
      }

      let pathname
      try {
        pathname = new URL(link).pathname
      } catch {
        acc.invalidList.push(link)
        return acc
      }
      if (artworkLinkPathPattern.test(pathname)) {
        acc.idList.push(pathname.match(artworkLinkPathPattern)[1])
        return acc
      }

      acc.invalidList.push(link)
      return acc
    },
    { idList: [], invalidList: [] }
  )

  if (invalidList.length !== 0) {
    console.log(lightYellow('有一些 link 沒辦法取得 id:'), invalidList)
  }

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
