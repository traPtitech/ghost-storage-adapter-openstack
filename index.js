const BaseAdapter = require('ghost-storage-base')
const { join } = require('path')
const { createReadStream } = require('fs')
const stream = require('stream')
const { promisify } = require('util')
const Cache = require('./cache')
const { S3Client, HeadObjectCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')

const pipeline = promisify(stream.pipeline)

class S3Adapter extends BaseAdapter {
  constructor(config = {}) {
    super(config)

    this.bucketName = config.bucket
    this.serverUrl = config.serverUrl
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    })
    this.cache = new Cache(config.cacheFolder, this.client, this.containerName)
  }

  async exists(filename, directory) {
    if (!directory) {
      directory = this.getTargetDir()
    }
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: join(directory, filename)
        })
      )
      return true
    } catch (err) {
      return false
    }
  }

  async save(image, directory) {
    if (!directory) {
      directory = this.getTargetDir()
    }

    image.name = image.name.toLowerCase()
    const fileName = await this.getUniqueFileName(image, directory)
    const readStream = createReadStream(image.path)

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: readStream
      })
    )
    return `${this.serverUrl}/${fileName}`
  }

  serve() {
    return async (req, res, next) => {
      const filePath = decodeURIComponent(req.path).replace(/^\//, '') // remove leading slash
      const baseFilePath = filePath.replace(/\.(.+)\.webp$/, '.$1')

      if (!this.cache.isImageExt(baseFilePath) || req.query.original === '1') {
        res.set('Cache-Control', 'public, max-age=864000, immutable')

        const readStream = this.cache.getDownloadStream(baseFilePath)
        try {
          await pipeline(readStream, res)
        } catch (err) {
          res.status(404)
          next(err)
        }
        return
      }

      try {
        await this.cache.ensure(baseFilePath, req.query)
      } catch (err) {
        res.sendStatus(404)
        console.warn("ghost-storage-adapter-openstack: Error occured when serving. ", err)
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

      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: filePath
        })
      )
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

module.exports = S3Adapter
