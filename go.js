import { consoleRed, readSettings } from './utils.js'
import { Artwork } from './utils/instances.js'

async function start() {
  const { error, ...settings } = await readSettings().catch((error) => ({ error }))
  if (error) return

  const { session, idList = [] } = settings

  for (let i = 0; i < idList.length; i++) {
    const artId = idList[i]

    const artwork = new Artwork(artId, session)

    const { error: error2 } = await artwork
      .downloadAllImages({ session })
      .then((res) => res ?? {})
      .catch((error) => ({ error }))
    if (error2) {
      consoleRed(`id ${artId} 下載失敗!`)
      console.log(error2)
    }
  }
}
start()
