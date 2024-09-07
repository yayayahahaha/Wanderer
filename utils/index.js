const { checkAndRead } = require('./path.js')
const { getArtWorks, getPhotos } = require('../api/index.js')
const { TaskSystem } = require('npm-flyc')

async function getParams(envPath = './input.json') {
  const [env, envError] = await checkAndRead(envPath)
  if (envError) {
    console.error('[ERROR] 缺少 input.json! 請從 input.json.default 複製與修改')
    return {}
  }
  return env
}

async function getAllArtWorks(config) {
  const { PHPSESSID, keyword, totalPages } = config
  const tasks = _createGetArtWorksTasks({ PHPSESSID, keyword, totalPages }).slice(0, 1) // TODO testing codes

  const taskFactory = new TaskSystem(tasks, 5, { randomDelay: 1000 /* 毫秒 */ })
  const taskResults = await taskFactory.doPromise()

  return taskResults.reduce((list, { data: [data, error] }) => {
    if (error) return list
    const {
      data: { data: artWorks }
    } = data
    return list.concat(artWorks)
  }, [])
}

async function getAllPhotos(payload) {
  const { PHPSESSID, artWorks } = payload
  const tasks = _createGetPhotosTasks({ PHPSESSID, artWorks })

  const taskFactory = new TaskSystem(tasks, 5, { randomDelay: 1000 })
  const taskResults = await taskFactory.doPromise()

  return taskResults.reduce((list, { data }) => list.concat([data]), [])
}
function _createGetPhotosTasks(config = {}) {
  const { PHPSESSID, artWorks } = config
  return artWorks.map(artWork => {
    const { id: artWorkId, userName, userId, title } = artWork
    return async function () {
      const [photoInfo, error] = await getPhotos(PHPSESSID, artWorkId)
      if (error) return [null, error]
      return { userName, userId, title, ...photoInfo, artWorkId }
    }
  })
}

function _createGetArtWorksTasks(config = {}) {
  const { PHPSESSID, keyword, totalPages } = config
  return [...Array(totalPages)].map((n, i) => {
    return async () => {
      const page = `${i + 1}`
      const [data, error] = await getArtWorks(PHPSESSID, keyword, page)
      if (error) return [null, { page, error }]
      return [{ page, data }, null]
    }
  })
}

module.exports = { getParams, getAllArtWorks, getAllPhotos }
