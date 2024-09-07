const fetch = require('node-fetch')

const request = async (path = '', config = {}) => {
  const [data, error] = await fetch(encodeURI(path), config)
    .then(async r => {
      return r.ok ? [await r.text(), null] : Promise.reject(r)
    })
    .catch(async e => (typeof e.text === 'function' ? [null, await e.text()] : [null, e]))

  try {
    return [JSON.parse(data), JSON.parse(error)]
  } catch (e) {
    return [data, error]
  }
}

module.exports = { request }
