// 先用這個地方的載下來吧
// 然後再看看 instance 那邊怎麼調會比較順
// 然後再去調 download 的 cache

import fs from 'fs'
import { Artwork } from './utils/instances.js'
import pLimit from 'p-limit'

start()
async function start() {
  // const list = []
  const list = fs.readdirSync('./_check-images')

  console.log(`一共有 ${list.length} 個`)

  const limit = pLimit(2)

  const idList = list
    .flat()
    // .slice(0, 1)
    .map((item) => item.match(/\d+/)[0])
    .map((id) => {
      const artwork = new Artwork(id)
      return limit(() =>
        artwork
          .genArtworkInfo()
          .then(() => artwork.genImages())
          .then(() => artwork)
          .catch((error) => ({ error }))
      )
    })

  const result = await Promise.all(idList)
  if (result.some((item) => item.error != null)) return

  const moreLimit = pLimit(2)
  const more = result.map((res) =>
    moreLimit(() => {
      const artwork = res
      const headerPromises = artwork.images.map((image) =>
        limit(() => {
          return image
            .genHeaderInfo()
            .then(() => image)
            .catch((error) => ({ error }))
        })
      )
      return Promise.all(headerPromises)
    })
  )

  const aaa = await Promise.all(more)

  const pc = pLimit(2)

  const pcs = aaa.map((item) => {
    pc(() => {
      const p = pLimit(4)
      const ps = item.map((item) => {
        p(() => {
          return item.download('check-images')
        })
      })

      return Promise.all(ps)
    })
  })
  await Promise.all(pcs)
}
