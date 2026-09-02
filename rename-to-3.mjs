import path from 'path'
import fs from 'fs'

// ==========================================
// ⚙️ 全局設定區 (每次只要修改這裡的參數即可)
// ==========================================

const showInChanged = false

// 1. 是否為測試模式 (true: 只印出結果不實際改名，false: 真正執行改名)
const IS_DRY_RUN = false

// 2. 要處理的資料夾路徑
const TARGET_FOLDER = 'check-images/'

// 3. 篩選檔案的正則表達式
const FILTER_REGEX = /-v\w+-\w+\.\w+$/

// 4. 改名的邏輯 (接收舊檔名，回傳新檔名)
const RENAME_LOGIC = (fileBase) => {
  // 將檔名開頭的數字提取出來並補零到 3 位數
  return fileBase.replace(/\d+-v\d+-\w+\.\w+$/, (tail) => {
    return tail.replace(/^(\d+)/, (_, no) => String(no).padStart(3, '0'))
  })
}

// ==========================================
// ⬇️ 以下為核心邏輯，通常不需要更動 ⬇️
// ==========================================

function start() {
  const targetRoot = path.resolve(TARGET_FOLDER)

  if (!fs.existsSync(targetRoot)) {
    console.error(`❌ 找不到資料夾: ${targetRoot}`)
    return
  }

  if (IS_DRY_RUN) {
    console.log('⚠️ 目前為 DRY RUN 模式，不會實際更動任何檔案\n')
  }

  const files = readFilesRecursively(targetRoot).filter((filepath) => {
    const fileBase = path.parse(filepath).base
    return FILTER_REGEX.test(fileBase)
  })

  let changedCount = 0

  for (let i = 0; i < files.length; i++) {
    const filepath = files[i]
    const { base: fileBase, dir } = path.parse(filepath)

    const newBase = RENAME_LOGIC(fileBase)

    if (fileBase === newBase) {
      if (showInChanged) console.log(fileBase)
      continue
    }

    changedCount++
    const newPath = path.resolve(dir, newBase)

    if (showInChanged) continue
    if (IS_DRY_RUN) {
      console.log('[模擬] 將會把:')
      console.log('  from:', filepath)
      console.log('  to  :', newPath)
      console.log('---')
    } else {
      console.log('[執行] 改名:')
      console.log('  from:', filepath)
      console.log('  to  :', newPath)
      console.log('---')
      fs.renameSync(filepath, newPath)
    }
  }

  const modeText = IS_DRY_RUN ? '模擬' : '執行'
  console.log(`✅ ${modeText}完成！共檢查了 ${files.length} 個檔案，其中 ${changedCount} 個需要改名。`)
}

function readFilesRecursively(pathStr, list = []) {
  fs.readdirSync(pathStr).forEach((name) => {
    const fullPath = path.join(pathStr, name)
    isDir(fullPath) ? readFilesRecursively(fullPath, list) : list.push(fullPath)
  })
  return list
}

function isDir(pathStr) {
  return fs.lstatSync(pathStr).isDirectory()
}

// 執行
start()
