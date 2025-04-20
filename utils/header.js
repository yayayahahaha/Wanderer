export function generateFetchHeaders(sessionId, artWorkId) {
  return {
    headers: {
      accept: 'application/json',
      'accept-language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
      Cookie: 'PHPSESSID=86899466_aWo8JKnGiBvdk6PIacsdw3iNEsH4qgut; ',
      Referer: 'https://www.pixiv.net/artworks/119216826',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  }
}
