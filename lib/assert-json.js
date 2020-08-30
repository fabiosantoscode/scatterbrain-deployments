
export const assertJSON = object => {
  (function recurse (value, path) {
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      return
    }

    if (typeof value === 'number' && !Number.isNaN(value) && Number.isFinite(value)) {
      return
    }

    if (typeof value === 'object') {
      Object.keys(value).forEach(key => {
        recurse(value, path.concat(key))
      })
      return
    }

    throw new Error(
      `Found a non-JSON value at ${path.join('.')}`
    )
  })(object, ['<passed object>'])

  return object
}
