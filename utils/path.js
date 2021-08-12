import fs from 'fs'

const checkFolder = (dir = './') => {
  if (fs.existsSync(dir)) return
  fs.mkdirSync(dir, { recursive: true })
}

export { checkFolder }
