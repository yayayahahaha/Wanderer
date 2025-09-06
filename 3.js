import { fetchDownload, lightRed } from './utils.js'

/**
 * Downloads a file from a URL to a specified path using streaming.
 * Creates a .part file during download and renames it upon completion.
 * @param {string} url The URL to download from.
 * @param {string} outputPath The final path to save the file.
 * @param {object} [fetchConfig={}] Optional configuration for the fetch request.
 * @returns {Promise<void>} A promise that resolves on successful download.
 */

// --- Example Usage ---
// const iconUrl = 'https://images.puella-magi.net/thumb/8/8c/Kyouko_character_art.png/300px-Kyouko_character_art.png'
const iconUrl = 'https://i.pximg.net/img-original/img/2025/09/06/15/52/40/134775061_p0.jpg'
const iconPath = 'icon.png'

;(async () => {
  try {
    console.log(`Starting download for: ${iconPath}`)
    await fetchDownload(iconUrl, iconPath, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
        referer: 'https://www.pixiv.net/',
      },
    })
    console.log(`Successfully downloaded: ${iconPath}`)
  } catch (error) {
    console.error(lightRed('Download process failed:'), error.message)
  }
})()

const s = `
  curl 'https://i.pximg.net/img-original/img/2025/08/11/18/01/09/133756671_p3.png' \
    -H 'accept: image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' \
    -H 'accept-language: zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7' \
    -H 'cache-control: no-cache' \
    -H 'pragma: no-cache' \
    -H 'priority: i' \
    -H 'referer: https://www.pixiv.net/' \
    -H 'sec-ch-ua: "Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"' \
    -H 'sec-ch-ua-mobile: ?0' \
    -H 'sec-ch-ua-platform: "macOS"' \
    -H 'sec-fetch-dest: image' \
    -H 'sec-fetch-mode: no-cors' \
    -H 'sec-fetch-site: cross-site' \
    -H 'sec-fetch-storage-access: active' \
    -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
`
