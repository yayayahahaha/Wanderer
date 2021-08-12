const fs = require('fs')

const checkFolder = (dir = './') => {
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

module.exports = { checkFolder, checkAndWrite }
