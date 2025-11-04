import fs from 'fs'
import path from 'path'

const emptyList = []
start()
function start() {
  readFilesRecursively('./test-img').reduce((set, item) => {
    set.add(path.parse(item).dir)

    return set
  }, new Set())

  // console.log('allFiles:', allFiles)

  console.log('emptyList:', emptyList)

  emptyList.forEach((item) => {
    fs.rmSync(item, { recursive: true })
  })
}

function readFilesRecursively(pathStr, list = []) {
  fs.readdirSync(pathStr).forEach((name) => {
    const fullPath = path.join(pathStr, name)
    if (isDir(fullPath)) {
      if (fs.readdirSync(fullPath).length === 0) {
        emptyList.push(fullPath)
        return
      }
    }

    isDir(fullPath) ? readFilesRecursively(fullPath, list) : list.push(fullPath)
  })
  return list
}
function isDir(path) {
  return fs.lstatSync(path).isDirectory()
}
