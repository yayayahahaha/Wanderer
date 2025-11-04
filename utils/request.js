const fetch = require('node-fetch')
const qs = require('qs')

const request = async (config) => {
  const { url, method = 'get', params = {}, data = null, headers = {} } = config
  const queryString = `?${qs.stringify(params)}`
  const path = `${url}${queryString}`

  const [response, error] = await fetch(encodeURI(path), { headers })
    .then(async (r) => {
      return r.ok ? [await r.text(), null] : Promise.reject(r)
    })
    .catch(async (e) => (typeof e.text === 'function' ? [null, await e.text()] : [null, e]))

  try {
    return [JSON.parse(response), JSON.parse(error)]
  } catch (e) {
    return [response, error]
  }
}

module.exports = { request }
