const BaseAdapter = require('ghost-storage-base')
const pkgcloud = require('pkgcloud')
const { join } = require('path')
const { createReadStream } = require('fs')
const Cache = require('./cache')

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

  save(image, directory) {
    return new Promise(async (resolve, reject) => {
      try {
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
        writeStream.on('error', err => {
          reject(err)
        })
        writeStream.on('success', file => {
          resolve(`${this.serverUrl}/${fileName}`)
        })
        readStream.pipe(writeStream)
        readStream.on('error', err => {
          writeStream.destroy(err)
        })
      } catch(e) {
        reject(e)
      }
    })
  }

  serve() {
    return async (req, res, next) => {
      res.set('Cache-Control', 'public, max-age=864000')

      const filePath = decodeURIComponent(req.path).replace(/^\//, '') // remove leading slash
      const isCached = this.cache.checkExistence(filePath)
      if (isCached) {
        this.cache.readStream(filePath).on('error', err => {
          res.status(404)
          next(err)
        }).pipe(res)
        return
      }

      try {
        const [readStream, writeStream] = await Promise.all([
          this.cache.downloadStream(filePath),
          this.cache.writeStream(filePath)
        ])
        const toWriteStream = readStream.on('error', err => {
          res.status(404)
          next(err)
        })
        toWriteStream.pipe(res)
        toWriteStream.pipe(writeStream)
      } catch (err) {
        res.status(404)
        next(err)
      }
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
    const isCached = this.cache.checkExistence(filePath)
    if (!isCached) {
      try {
        await this.cache.download(filePath)
      } catch (err) {
        return Promise.reject(err)
      }
    }
    return this.cache.read(filePath)
  }
}

module.exports = OpenstackAdapter
