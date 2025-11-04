import fetch from 'node-fetch'

export async function fetchApi(path = '', config = {}) {
  return fetch(encodeURI(path), config)
    .then((res) => {
      const clone = res.clone()
      const text = res.text()
      const json = clone.json().catch((error) => ({ error }))

      return Promise.all([res.ok, text, json])
    })
    .then(([ok, text, json]) => {
      if (ok && !json.error) return json
      throw text
    })
}
