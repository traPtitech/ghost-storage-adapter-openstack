const fs = require('fs')
const path = require('path')
const { promisify } = require('util')

const readFile = promisify(fs.readFile)
const unlink = promisify(fs.unlink)

module.exports = class Cache {
  constructor (cacheFolder, client, containerName) {
    this.folder = cacheFolder
    this.client = client
    this.containerName = containerName
  }

  // only use when file exists
  getStream(filePath) {
    return fs.createReadStream(this.getCachePath(filePath))
  }

  get(filePath) {
    return readFile(this.getCachePath(filePath))
  }

  checkExistence(filePath) {
    try {
      const stats = fs.statSync(this.getCachePath(filePath))
      return (stats.isFile() && stats.size > 0)
    } catch (e) {
      return false
    }
  }

  download(filePath) {
    return new Promise((resolve, reject) => this.client.download({
      container: this.containerName,
      remote: filePath,
      local: this.getCachePath(filePath)
    }, (err, result) => {
      if (err) {
        reject(err)
        return
      }
      resolve(result)
    }))
  }

  delete(filePath) {
    return unlink(this.getCachePath(filePath))
  }

  getCachePath(filePath) {
    return path.resolve(this.folder, filePath)
  }
}
