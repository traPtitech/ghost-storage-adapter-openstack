const fs = require('fs-extra')
const path = require('path')

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
    return fs.readFile(this.getCachePath(filePath))
  }

  checkExistence(filePath) {
    try {
      const stats = fs.statSync(this.getCachePath(filePath))
      return (stats.isFile() && stats.size > 0)
    } catch (e) {
      return false
    }
  }

  async download(filePath) {
    const absoluteFilePath = this.getCachePath(filePath)
    await fs.ensureDir(path.dirname(absoluteFilePath))
    return new Promise((resolve, reject) => this.client.download({
      container: this.containerName,
      remote: filePath,
      local: absoluteFilePath
    }, (err, result) => {
      if (err) {
        reject(err)
        return
      }
      resolve(result)
    }))
  }

  delete(filePath) {
    return fs.unlink(this.getCachePath(filePath))
  }

  getCachePath(filePath) {
    return path.resolve(this.folder, filePath)
  }
}
