const fs = require('fs-extra')
const path = require('path')
const sharp = require('sharp')
const concatStream = require('concat-stream')
const glob = require('fast-glob')

const DEFAULT_MAX_WIDTH = 1024

sharp.cache(false)

module.exports = class Cache {
  constructor (cacheFolder, client, containerName) {
    this.folder = cacheFolder
    this.client = client
    this.containerName = containerName
  }

  getOriginal(filePath) {
    return this.download(filePath)
  }

  async ensure(filePath, rawParam) {
    const param = this.parseParam(rawParam)
    if (param.original) {
      throw new Error('ghost-storage-adapter-openstack::cache.ensure cannot be called when original=1')
    }
    if (await this.cacheExists(filePath, param)) {
      return
    }
    await this.createCache(filePath, param)
  }

  async delete(filePath) {
    const files = glob(`${this.folder}/**${filePath}`)
    const filesWebp = glob(`${this.folder}/webp/**${filePath}.webp`)
    const errs = []

    await Promise.all(
      files.concat(filesWebp)
        .map(file =>
          fs.unlink(file).catch(err => errs.push(err))
        )
    )

    if (errs.length > 0) {
      throw errs
    }
  }

  isImageExt(filePath) {
    const ext = path.extname(filePath).toLowerCase()
    if (ext === '.png') return true
    if (ext === '.jpg' || ext === '.jpeg' || ext === '.jpe' || ext === '.jfif') return true
    if (ext === '.webp') return true
    return false
  }

  parseParam(rawParam) {
    const param = {
      original: rawParam.original === '1',
      width: null,
      webp: null
    }
    if (param.original) {
      return param
    }

    param.webp = rawParam.webp === '1'

    if (rawParam.width !== undefined) {
      const width = +rawParam.width
      if (Number.isFinite(width) && width > 0) {
        param.width = width
      }
    }

    return param
  }

  getCachePath(filePath, param, isRawParam = false) {
    if (isRawParam) {
      param = this.parseParam(param)
    }
    if (param.original) {
      throw new Error('ghost-storage-adapter-openstack::cache.getCachePath cannot be called when original=1')
    }
    if (param.webp) {
      if (param.width !== null) {
        return path.resolve(this.folder, 'webp', 'resized', '' + param.width, filePath + '.webp')
      }
      return path.resolve(this.folder, 'webp', filePath + '.webp')
    }
    if (param.width !== null) {
      return path.resolve(this.folder, 'resized', '' + param.width, filePath)
    }
    return path.resolve(this.folder, filePath)
  }

  cacheExists(filePath, param) {
    return fs.pathExists(this.getCachePath(filePath, param))
  }

  createCache(filePath, param) {
    const cachePath = this.getCachePath(filePath, param)
    const ext = path.extname(filePath).toLowerCase()

    return new Promise(async (resolve, reject) => {
      try {
        await fs.ensureDir(path.dirname(cachePath))
      } catch (err) {
        reject(err)
        return
      }

      const fileStream = this.getDownloadStream(filePath)

      const width = param.width === null ? DEFAULT_MAX_WIDTH : param.width
      const webp = param.webp

      const transformer = sharp({ sequentialRead: true })
        .rotate().flip()
        .resize({
          fit: 'contain',
          width,
          withoutEnlargement: true
        }).png({
          adaptiveFiltering: true,
          force: false
        })
      if (webp) {
        transformer.webp({
          nearLossless: ext === '.png'
        })
      }
      transformer.toFile(cachePath, (err, info) => {
        if (err) {
          reject(err)
          return
        }
        resolve(info)
      })

      fileStream.pipe(transformer)
    })
  }

  getDownloadStream(filePath) {
    return this.client.download({
      container: this.containerName,
      remote: filePath
    })
  }

  download(filePath) {
    return new Promise((resolve, reject) => {
      this.client.download({
        container: this.containerName,
        remote: filePath
      }).on('error', err => {
        reject(err)
      }).pipe(concatStream(file => {
        resolve(file)
      }))
    })
  }
}
