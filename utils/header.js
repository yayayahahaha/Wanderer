function createCookie(sessionId = '') {
  const cookieMap = Object.assign({}, basicCookie, { PHPSESSID: sessionId })
  const cookie = Object.keys(cookieMap).reduce(
    (str, key) => `${str}${key}=${cookieMap[key]}; `,
    ''
  )
  return { cookie }
}

const basicCookie = {
  PHPSESSID: '',
  device_token: '',
}

const basicHeaders = {
  accept: 'application/json',
  'accept-encoding': 'gzip, deflate, br',
  'accept-language': 'zh-TW,zh;q=0.9',
  referer: 'https://www.pixiv.net/',
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36 Edg/92.0.902.67',
}

function createHeaders(sessionId = '') {
  return Object.assign({}, basicHeaders, createCookie(sessionId))
}

function fetchConfig(sessionId) {
  return { headers: createHeaders(sessionId) }
}

module.exports = { fetchConfig }
