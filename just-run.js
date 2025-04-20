import fetch from 'node-fetch'

import https from 'https'

const options = {
  hostname: 'www.pixiv.net',
  port: 443,
  path: '/artworks/119216826',
  method: 'GET',
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  },
}

const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`)
  console.log('Response Headers:', res.headers)

  res.on('data', (chunk) => {
    // 讀取回應
  })

  // 取得 TLS 連線資訊
  console.log('TLS Cipher Info:', res.socket.getCipher())
  console.log('TLS Protocol:', res.socket.getProtocol())
})

req.on('error', (e) => {
  console.error(e)
})

req.end()

// axios('https://www.pixiv.net/artworks/119216826')
//
