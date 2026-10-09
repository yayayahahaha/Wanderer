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

  return Promise.allSettled(promises)
    .then((settledResult) => {
      genLog()
      
      const failures = settledResult.filter(r => r.status === 'rejected')
      if (failures.length > 0) {
        console.log(lightRed('❌ 發現失敗的任務:'))
        failures.forEach((f, i) => {
          console.log(red(`  [任務 ${i+1}] 原因:`), f.reason)
        })
      }

      if (settledResult.every((reseult) => reseult.status === 'fulfilled')) {
        console.log(lightGreen('💖💖💖 成功囉 💖💖💖'))
        return
      }

      genLog(true)
      if (settledResult.some((reseult) => reseult.status === 'fulfilled')) {
        console.log(lightRed('🕷️🕷️🕷️ 沒有全部成功 🕷️🕷️🕷️'))
      } else {
        console.log(lightRed('🆘 🆘 🆘 全 部 失 敗 🆘 🆘 🆘'))
      }
    })
    .catch((error) => {
      console.log(lightRed('非預期的錯誤'), error)
      genLog()
    })
}
start()

function genLog(failedOnly = false) {
  fs.existsSync('logs') || fs.mkdirSync('logs')
  const timestamp = Date.now()
  const artworksStatus = logList
    .map((artwork) => {
      const { id, done, artworkInfo, images } = artwork
      return {
        done,
        ...artworkInfo,
        id,
        images: images.map((img) => {
          const { originalLink, done } = img
          try {
            return { index: img.index, originalLink, done }
          } catch {
            return { index: null, originalLink, done }
          }
        }),
      }
    })
    .filter((item) => {
      return failedOnly ? !item.done : true
    })

  const logPath = path.resolve('logs', `${timestamp}${failedOnly ? '-failed' : ''}.json`)
  const logContent = { timestamp, artworksStatus }
  fs.writeFileSync(logPath, JSON.stringify(logContent, null, 2))
  console.log(green(`${timestamp} log 檔案生成成功:`), logPath)
}

process.on('SIGINT', () => {
  console.log(red('👻 收到 Ctrl+C 信號，正在準備進度報告...'))
  genLog()
  genLog(true)
  process.exit(0)
})
