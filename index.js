const BaseAdapter = require('ghost-storage-base')
const pkgcloud = require('pkgcloud')
const { join } = require('path')
const { createReadStream } = require('fs')
const stream = require('stream')
const { promisify } = require('util')
const Cache = require('./cache')

const pipeline = promisify(stream.pipeline)

class OpenstackAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config)

    this.containerName = config.container
    this.serverUrl = config.serverUrl
    this.client = pkgcloud.storage.createClient({
      provider: 'openstack',
      username: config.username,
      password: config.password,
      authUrl: config.authUrl,
      region: config.region,
      tenantId: config.tenantId,
      container: config.container
    })
    this.cache = new Cache(config.cacheFolder, this.client, this.containerName)
  }

  exists(filename, directory) {
    return new Promise(resolve => {
      if (!directory) {
        directory = this.getTargetDir()
      }

      this.client.getFile(this.containerName, join(directory, filename), (err, file) => {
        if (err) {
          resolve(false)
          return
        }
        resolve(true)
      })
    })
  }

  async save(image, directory) {
    if (!directory) {
      directory = this.getTargetDir()
    }

    image.name = image.name.toLowerCase()
    const fileName = await this.getUniqueFileName(image, directory)
    const readStream = createReadStream(image.path)

    const writeStream = this.client.upload({
      container: this.containerName,
      remote: fileName
    })

    await pipeline(readStream, writeStream)
    return `${this.serverUrl}/${fileName}`
  }

  serve() {
    return async (req, res, next) => {
      const filePath = decodeURIComponent(req.path).replace(/^\//, '') // remove leading slash
      const baseFilePath = filePath.replace(/\.(.+)\.webp$/, '.$1')

      if (!this.cache.isImageExt(baseFilePath) || req.query.original === '1') {
        res.set('Cache-Control', 'public, max-age=864000, immutable')

        const readStream = this.cache.getDownloadStream(baseFilePath)
        pipeline(readStream, res, err => {
          res.status(404)
          next(err)
        })
        return
      }

      try {
        await this.cache.ensure(baseFilePath, req.query)
      } catch (err) {
        res.sendStatus(404)
        console.warn(err)
        return
      }

      res.sendFile(this.cache.getCachePath(baseFilePath, req.query, true), {
        maxAge: 864000 * 1000,
        immutable: true
      })
    }
  }

  async delete(filename, directory) {
    try {
      if (!directory) {
        directory = this.getTargetDir()
      }

      const filePath = join(directory, filename)
      await this.cache.delete(filePath)

      await new Promise((resolve, reject) => {
        this.client.removeFile(this.containerName, filePath, err => {
          if (err) {
            reject(err)
            return
          }
          resolve()
        })
      })
      return true
    } catch (err) {
      return false
    }
  }

  async read(options = {}) {
    const filePath = decodeURIComponent(options.path || '').replace(/^\//, '') // remove leading slash
    try {
      const file = await this.cache.getOriginal(filePath)
      return file
    } catch (err) {
      return Promise.reject(err)
    }
  }
}

module.exports = OpenstackAdapter
