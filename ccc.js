/**
 * 傳入 cURL 指令字串，轉換為 fetch 參數後送出請求
 * @param {string} curlString - 完整的 cURL 指令字串（可多行）
 * @returns {Promise<Response>} fetch 的回傳結果
 */
async function sendCurlViaFetch(curlString) {
  // 移除反斜線換行的多行字串
  const singleLine = curlString.replace(/\\\r?\n/g, ' ')
  const { url, options } = parseCurlCommand(singleLine)
  if (!url) {
    throw new Error('找不到請求 URL')
  }
  console.log('將以以下參數送出請求：', { url, options })
  const response = await fetch(url, options)
  return response
}

/**
 * 解析 cURL 指令字串，取得 URL、HTTP 方法、headers 與 body 等資訊
 * @param {string} curlString
 * @returns {{ url: string, options: { method: string, headers: object, body?: any } }}
 */
function parseCurlCommand(curlString) {
  // 利用正則式拆分字串，保留引號內的內容
  const tokens = curlString.match(/(?:'[^']*'|"[^"]*"|\S+)/g) || []
  // 移除引號
  const args = tokens.map((token) => {
    if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
      return token.slice(1, -1)
    }
    return token
  })

  let url = ''
  let method = 'GET'
  let headers = {}
  let body

  // 從 args 中解析參數（第一個通常為 curl）
  for (let i = 1; i < args.length; i++) {
    const token = args[i]
    if (token === '-X' || token === '--request') {
      method = args[++i]
    } else if (token === '-H' || token === '--header') {
      const headerStr = args[++i]
      const index = headerStr.indexOf(':')
      if (index !== -1) {
        const key = headerStr.substring(0, index).trim()
        const value = headerStr.substring(index + 1).trim()
        // 合併 Cookie 欄位
        if (key.toLowerCase() === 'cookie' && headers['Cookie']) {
          headers['Cookie'] += '; ' + value
        } else {
          headers[key] = value
        }
      }
    } else if (token === '-d' || token === '--data' || token === '--data-raw') {
      body = args[++i]
      if (method === 'GET') {
        method = 'POST'
      }
    } else if (token === '-b' || token === '--cookie') {
      const cookieStr = args[++i]
      if (headers['Cookie']) {
        headers['Cookie'] += '; ' + cookieStr
      } else {
        headers['Cookie'] = cookieStr
      }
    } else if (!token.startsWith('-')) {
      // 非選項且看起來像 URL 的 token 當作 URL
      if (token.startsWith('http')) {
        url = token
      }
    }
  }

  const options = { method, headers }
  if (body !== undefined) {
    options.body = body
  }
  return { url, options }
}

// 使用範例（請依需求將 curlCmd 複製進來）
const curlCmd = `curl 'https://www.pixiv.net/artworks/119216826' \
  -H 'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7' \
  -H 'accept-language: zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7' \
  -H 'cache-control: no-cache' \
  -b 'first_visit_datetime_pc=2024-09-08%2000%3A13%3A39; p_ab_id=4; p_ab_id_2=6; p_ab_d_id=1084913041; yuid_b=GRliJXc; PHPSESSID=86899466_aWo8JKnGiBvdk6PIacsdw3iNEsH4qgut; privacy_policy_notification=0; a_type=0; b_type=0; privacy_policy_agreement=7; login_ever=yes; c_type=25; _ga_75BBYNYN9J=deleted; _gcl_au=1.1.1885172841.1741453752; _ga_MZ1NL4PHH0=GS1.1.1741800760.7.1.1741800769.0.0.0; _gid=GA1.2.1705140261.1742489804; _ga_75BBYNYN9J=deleted; cf_clearance=Z06XvV0djbD3vJLbvEpngSUyF37zFhBJe9N5krfvJz8-1742578564-1.2.1.1-vM_W.IWcA2JydOFRMHrFMRBimhS.qXNErLogy1bKCpJdr7TrhElKk1P8JVNW8rOstGHrR7h0RhUhQlyi_SXpSYGV16k9st9eDjqsYjwFoyYGVRoN0cFiqUCwZFBPu_ux0P6i2uqJaGwYhJggKqsh8c.LR5vzXrQJ8o5PipgBKxXugEdbQjWmvYfeUrqVYTEPDB75obwd7xPs6topOXfioA0LjBYGTMXdBrGmBG6J5lWGKQ4uK7rTkfuBRGGvD18dtF6Ey6ml9gGaZN70tkVBRorGgdzMXmFMa9W5RY0K_yKAKN6mlLlJRhjU4Gcu6yhZHuNfcL7fOr9OSaRMZm.MZq6gqQL39FLEO92s_dgb7lA; _ga_75BBYNYN9J=GS1.1.1742577220.4.1.1742578566.0.0.0; _ga=GA1.2.1604469098.1725722020; __cf_bm=dQCDVnpWORvYt0SRLxgExPUPu7cigGMT5CSw6rjkaO8-1742579914-1.0.1.1-hOblG6RnbJyJ4lluu7Dvme2vAq1cYyZebtLAaEUs_fpcummsjH4eugYZtMkX0mW8A25_htn0EW8Se4hibKxL588aJS7DZDHX3zGgdNK.1PxoYwvD3YTUOwza16K3Xb8S' \
  -H 'pragma: no-cache' \
  -H 'priority: u=0, i' \
  -H 'sec-ch-ua: "Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: document' \
  -H 'sec-fetch-mode: navigate' \
  -H 'sec-fetch-site: same-origin' \
  -H 'sec-fetch-user: ?1' \
  -H 'upgrade-insecure-requests: 1' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'`

sendCurlViaFetch(curlCmd)
  .then(async (res) => {
    console.log('HTTP 狀態：', res.status)
    const text = await res.text()
    console.log('回應內容：', text)
  })
  .catch((err) => console.error('發生錯誤：', err))
