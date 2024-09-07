const fs = require('fs')

const checkFolder = (dir = './') => {
  if (dir === '.') return true
  const last = dir.split('/').pop()
  if (last.match(/\./g)) return void console.error('路徑裡除了當前路徑以外不可以有 . ')

  if (fs.existsSync(dir)) return true
  fs.mkdirSync(dir, { recursive: true })
  return true
}

const checkAndWrite = (filePath, data) => {
  let excludeFileName = filePath.split('/')
  excludeFileName.pop()
  excludeFileName = excludeFileName.join('/')

  const createFolderResult = checkFolder(excludeFileName)
  if (!createFolderResult) return false

  fs.writeFileSync(filePath, data)
  return true
}

const checkAndRead = (filePath, doJsonParse = true) => {
  return new Promise(resolve => {
    let fileText = ''
    try {
      fileText = fs.readFileSync(filePath, 'utf8')
    } catch (e) {
      return resolve([null, 'file not exist'])
    }

    if (!doJsonParse) return resolve([fileText, null])

    try {
      return resolve([JSON.parse(fileText), null])
    } catch (e) {
      return resolve(fileText, null)
    }
  })
}

module.exports = { checkFolder, checkAndWrite, checkAndRead }
