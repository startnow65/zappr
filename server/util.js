import requestFn from 'request'
import crypto from 'crypto'

export function jsonHash(json, algo = 'sha256') {
  const hash = crypto.createHash(algo)
  hash.update(new Buffer(JSON.stringify(json)))
  return hash.digest('hex')
}

export function request(...args) {
  return new Promise((resolve, reject) => {
    requestFn(...args, (err, ...rest) => {
      if (err) {
        reject(err)
      } else {
        resolve(rest)
      }
    })
  })
}

export function getBoolean(obj, defaultValue = false) {
  if ((typeof obj) === 'boolean') return obj
  if ((typeof obj) === 'string') return obj === 'true'

  return defaultValue
}
