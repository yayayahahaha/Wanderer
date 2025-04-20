import fetch from 'node-fetch'

export async function fetchApi(path = '', config = {}) {
  return fetch(encodeURI(path), config)
    .then((res) => {
      if (!res.ok) throw res.text()
      try {
        return res.json()
      } catch (e) {
        console.log(e)
        return res.text()
      }
    })
    .catch((error) => {
      console.log(error)

      return { error }
    })
}
