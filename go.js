const { download } = require('npm-flyc')
const { getPhotoInfo } = require('./api/index.js')
const youtubeDl = require('youtube-dl-exec')
const path = require('path')

const session = '86899466_aWo8JKnGiBvdk6PIacsdw3iNEsH4qgut'
const idList = [
  124436065, 123535463, 122609547, 121809557, 121009719, 120286695, 119626116, 118867356, 118178777, 117630113,
  117072639, 116579445, 116042647, 115480845, 115240488,
]

async function start() {
  for (let i = 0; i < idList.length; i++) {
    const artId = idList[i]
    await downloadById(artId)
  }
}
start()

async function downloadById(artId) {
  const [linkList, error] = await getPhotoInfo(session, artId)
  if (error) return void console.log(error)

  await _recursive(linkList, 0)
  async function _recursive(list) {
    const link = list[0]
    const fileName = path.resolve('.', `test-img/${Date.now()}.png`)
    const addHeader = ['referer:https://www.pixiv.net/', `Cookie:PHPSESSID=${session}`]

    console.log(link)
    console.log(fileName)

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
