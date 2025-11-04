const fs = require('fs')
const qs = require('qs')
const crypto = require('crypto')

const { checkAndRead } = require('./path.js')
const { getArtWorks, getPhotos } = require('../api/index.js')
const { TaskSystem } = require('npm-flyc')

const { masterHouse } = require('../masterHouse.js')

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
  const tasks = _createGetArtWorksTasks({
    PHPSESSID,
    keyword,
    totalPages,
  }).slice(0, 1) // TODO testing codes

  const taskFactory = new TaskSystem(tasks, 5, { randomDelay: 1000 /* 毫秒 */ })
  const taskResults = await taskFactory.doPromise()

  return taskResults.reduce((list, { data: [data, error] }) => {
    if (error) return list
    const {
      data: { data: artWorks },
    } = data
    return list.concat(artWorks)
  }, [])
}

/**
 * @functoin defaultTaskSetting
 * @description defeault setting of custom task setting, it NEED TO BE INSTANCE
 * */
const defaultTaskSetting = function () {
  return {
    randomDelay: 0,
  }
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
  return artWorks.map((artWork) => {
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

/**
 * @function getKeywordsInfoUrl
 * @description get keyword fetch url
 * @return url<string>
 * */
function getKeywordsInfoUrl(keyword, page = 1) {
  const basicUrl = `https://www.pixiv.net/ajax/search/artworks/${keyword}`
  const query = {
    word: keyword,
    order: 'date',
    mode: 'all',
    p: page,
    s_mode: 's_tag',
    type: 'all',
  }

  const url = `${basicUrl}?${qs.stringify(query)}`
  return encodeURI(url)
}

/**
 * @typedef InputInfo
 * @property keyword <string> - search keyword
 * @property likedLevel <string> - max download liked-level
 * @property maxPage <string> - TODO max fetch page
 * @property PHPSESSID <string> - session
 * */
/**
 * @function inputChecker
 * @description check does input.json has needed parameters or not
 * @return [parameters<InputInfo>, errorMessage<string>]
 * */
function inputChecker() {
  let errorMessage = ''

  if (!fs.existsSync('./input.json')) {
    errorMessage = '請修改 input.json\n'
    return [null, errorMessage]
  }
  const contents = fs.readFileSync('./input.json')
  const inputJSON = JSON.parse(contents)

  const keyword = inputJSON.keyword
  const likedLevel = typeof inputJSON.likedLevel === 'number' ? inputJSON.likedLevel : 500
  const maxPage = typeof inputJSON.maxPage === 'number' ? inputJSON.maxPage : 0
  const PHPSESSID = inputJSON.PHPSESSID

  if (!keyword) {
    errorMessage = '請在 input.json 檔裡輸入關鍵字\n'
    return [null, errorMessage]
  }
  if (!PHPSESSID) {
    errorMessage = '請在 input.json 檔裡輸入SESSID\n'
    return [null, errorMessage]
  }

  return [
    {
      keyword,
      likedLevel,
      maxPage,
      PHPSESSID,
    },
    null,
  ]
}

/**
 * @function loading
 * @description do loading animation with input message
 * @return stopLoadingCallback<function> - stop loading animation with status
 * */
function loading(message = 'Loading', { duration = 300, steps = ['\\', '|', '/', '-'] } = {}) {
  let index = 0

  process.stdout.write(`\r${message} ${steps[index++]}`)
  const timer = setInterval(() => {
    process.stdout.write(`\r${message} ${steps[index++]}`)
    index = index % steps.length
  }, duration)

  return function (result) {
    clearInterval(timer)
    if (typeof result !== 'boolean') return
    const resultIcon = !!result ? '✔' : 'X'
    process.stdout.write(`\r${message} ${resultIcon}\n`)
  }
}

/**
 * @function writeFile
 * @description for saving cache file to reduce fetching time
 * */
function writeFile(rawInfo, rawFileName, { folder = 'caches' } = {}) {
  const dateMap = {}

  let info = rawInfo
  if (typeof rawInfo === 'object') info = JSON.stringify(rawInfo, null, 2)

  const fileName = rawFileName || _createFileName()

  const fullPath = [folder, fileName].join('/').replace(/\//g, '/')
  const folderPath = fullPath.match(/(.*\/).*$/)[1]
  fs.mkdirSync(folderPath, { recursive: true })
  fs.writeFileSync(fullPath, info)

  function _createFileName() {
    const timestamp = Date.now()
    dateMap[timestamp] = dateMap[timestamp] ? dateMap[timestamp] + 1 : 1

    return `file-${timestamp}-${dateMap[timestamp]}.json`
  }
}

/**
 * @function getPhotoByPages
 * @description get photo list page by page
 * */
async function getPhotoByPages(sessionId, keyword, totalPages, { startPage = 1 } = {}) {
  const searchFuncArray = []
  for (let i = startPage; i <= totalPages; i++) {
    searchFuncArray.push(_create_each_search_page(sessionId, keyword, i))
  }

  let allPagesImagesArray = await masterHouse.doJobs(searchFuncArray)
  allPagesImagesArray = allPagesImagesArray.map(({ result }) => result.data).flat()
  return allPagesImagesArray

  function _create_each_search_page(sessionId, keyword, page) {
    return async function () {
      const [res, error] = await getArtWorks(sessionId, keyword, page)
      if (error) throw error
      return res
    }
  }
}

/**
 * @function syncCache
 * @description sync cache with newest info by pushing them into history
 * */
function syncCache(cache, unique, item) {
  const hashStr = hash(JSON.stringify(item))
  const pk = item[unique]

  // 原本不存在
  if (!cache[pk]) {
    cache[pk] = { history: [{ hash: hashStr, info: item }], hash: hashStr }
    return
  }
  // 原本存在，但 hash 不一樣
  if (cache[pk].hash !== hashStr) {
    cache[pk].history.unshift({ hash: hashStr, info: item })
    cache[pk].hash = hashStr
  }
}

/**
 * @typedef
 * @reference https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color
 * @description color code of nodejs
 * */
const colorMap = {
  Reset: '\x1b[0m',
  Bright: '\x1b[1m',
  Dim: '\x1b[2m',
  Underscore: '\x1b[4m',
  Blink: '\x1b[5m',
  Reverse: '\x1b[7m',
  Hidden: '\x1b[8m',

  FgBlack: '\x1b[30m',
  FgRed: '\x1b[31m',
  FgGreen: '\x1b[32m',
  FgYellow: '\x1b[33m',
  FgBlue: '\x1b[34m',
  FgMagenta: '\x1b[35m',
  FgCyan: '\x1b[36m',
  FgWhite: '\x1b[37m',

  BgBlack: '\x1b[40m',
  BgRed: '\x1b[41m',
  BgGreen: '\x1b[42m',
  BgYellow: '\x1b[43m',
  BgBlue: '\x1b[44m',
  BgMagenta: '\x1b[45m',
  BgCyan: '\x1b[46m',
  BgWhite: '\x1b[47m',
}

/**
 * @function hash
 * @description count md5 string hash through digest 'hex'
 * */
function hash(str) {
  return crypto.createHash('md5').update(str).digest('hex')
}

/**
 * @function createOrLoadCache
 * @description loading cahche by cachePath, if it's not exist just create one
 * */
function createOrLoadCache(cachePath, { defaultValue = {} } = {}) {
  const exist = fs.existsSync(cachePath)

  if (exist) return JSON.parse(fs.readFileSync(cachePath, 'utf8'))
  writeFile({}, cachePath, { folder: 'hello' })
  return defaultValue
}

module.exports = {
  inputChecker,
  getKeywordsInfoUrl,
  loading,
  colorMap,
  writeFile,
  getPhotoByPages,
  hash,
  syncCache,
  createOrLoadCache,

  getParams,
  getAllArtWorks,
  getAllPhotos,
}
