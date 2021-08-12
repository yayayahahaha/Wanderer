import fs from 'fs'

const checkFolder = (dir = './') => {
  const last = dir.split('/').pop()
  if (last.match(/\./g)) return void console.error('路徑裡除了當前路徑以外不可以有 . ')

  if (fs.existsSync(dir)) return
  fs.mkdirSync(dir, { recursive: true })
}

export { checkFolder }
