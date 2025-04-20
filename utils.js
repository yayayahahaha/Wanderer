import fs from 'fs'
import path from 'path'

const configFileName = 'setting.json'
const configFilePath = path.resolve('.', configFileName)

export function consoleRed(message) {
  return void console.log(`\x1b[31m${message}\x1b[0m`)
}

export async function readSettings() {
  let errorMessage = ''
  if (!fs.existsSync(configFilePath)) {
    errorMessage = `設定檔 ${configFilePath} 不存在!`
    consoleRed(errorMessage)
    throw new Error(errorMessage)
  }

  const content = fs.readFileSync(configFilePath)
  try {
    return JSON.parse(content)
  } catch {
    errorMessage = 'setting.json parse 失敗!'
    consoleRed(errorMessage)
    throw new Error(errorMessage)
  }
}
