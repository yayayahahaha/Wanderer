import { consoleRed, readSettings } from './utils.js'
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
          consoleRed(`id ${artId} 下載失敗!`)
          console.log(error)
          return error instanceof Error ? error : new Error(error)
        })
    )
  })

  Promise.all(promises)
}
start()
