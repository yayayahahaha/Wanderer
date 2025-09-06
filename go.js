// TODO(flyc)
// > 要寫個 script 剃除掉重複的圖片，有點太多了
// > % 數的也可以
// TODO(flyc) 對於 plimit 的行為還是不太確定，到底 promise.all 在收到 error 的時候會不會停止的這件事情怪怪的，一層好像會、雙層就會怪怪的

import fs from 'fs'
import path from 'path'
import { green, lightBlue, lightGreen, lightRed, lightYellow, readSettings, red } from './utils.js'
import { Artwork } from './utils/Artwork.js'
import pLimit from 'p-limit'

const logList = []

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
    logList.push(artwork)

    return limit(async () => {
      const downloadFlowError = (await artwork.downloadFlow({ seq: index }).catch((error) => ({ error })))?.error
      if (downloadFlowError) throw downloadFlowError
      finishedCount++
      console.log(`\n 🐳 ${finishedCount}/${totalCount} \n`)
    })
  })

  await Promise.all(promises)
    .then(() => {
      console.log(lightGreen('💖💖💖 成功囉 💖💖💖'))
      genLog()
    })
    .catch((error) => {
      console.log(lightRed('下載中斷了'), error)
    })
}
start()

function genLog() {
  fs.existsSync('logs') || fs.mkdirSync('logs')
  const timestamp = Date.now()
  const artworksStatus = logList.map((artwork) => {
    const { id, done, artworkInfo, images } = artwork
    return {
      done,
      ...artworkInfo,
      id,
      images: images.map((img) => {
        const { index, originalLink, done } = img
        return { index, originalLink, done }
      }),
    }
  })

  const logPath = path.resolve('logs', `${timestamp}.json`)
  const logContent = { timestamp, artworksStatus }
  fs.writeFileSync(logPath, JSON.stringify(logContent, null, 2))
  console.log(green('log 檔案生成成功:'), logPath)
}

process.on('SIGINT', () => {
  console.log(red('👻 收到 Ctrl+C 信號，正在準備進度報告...'))
  genLog()
  process.exit(0)
})
