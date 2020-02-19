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
      const filePath = decodeURIComponent(req.path).replace(/^\//, '') // remove leading slash
      const baseFilePath = filePath.replace(/\.(.+)\.webp$/, '.$1')

      if (!this.cache.isImageExt(baseFilePath) || req.query.original === '1') {
        res.set('Cache-Control', 'public, max-age=864000, immutable')
        this.cache.getDownloadStream(baseFilePath).on('error', err => {
          res.status(404)
          next(err)
        }).pipe(res)
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
        maxAge: 864000,
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
