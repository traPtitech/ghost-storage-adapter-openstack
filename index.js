const BaseAdapter = require('ghost-storage-base')
const pkgcloud = require('pkgcloud')
const { join } = require('path')

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
    return new Promise((resolve, reject) => {
      try {
        if (!directory) {
          directory = this.getTargetDir()
        }

        const fileName = this.getUniqueFileName(image, directory)

        const stream = this.client.upload({
          container: this.containerName,
          remote: fileName
        })
        stream.on('error', err => {
          reject(err)
        })
        stream.on('success', file => {
          resolve(`${this.serverUrl}/${fileName}`)
        })
      } catch(e) {
        reject(e)
      }
    })
  }

  serve() {
    return (req, res, next) =>
      this.client.download({
        container: this.containerName,
        remote: req.path
      }).on('error', err => {
        res.status(404)
        next(err)
      }).pipe(res)
  }

  delete(filename, directory) {
    return new Promise(resolve => {
      if (!directory) {
        directory = this.getTargetDir()
      }

      this.client.removeFile(this.containerName, join(directory, filename), err => {
        if (err) {
          resolve(false)
          return
        }
        resolve(true)
      })
    })
  }

  read(options = {}) {
    return new Promise((resolve, reject) => {
      // remove trailing slashes
      let path = (options.path || '').replace(/\/$|\\$/, '')

      // check if path is stored in openstack handled by us
      if (!path.startsWith(this.serverUrl)) {
        reject(new Error(`${path} is not stored in openstack`))
      }
      path = path.substring(this.serverUrl.length)

      this.client.download({
        container: this.containerName,
        remote: path
      }, (err, result) => {
        if (err) {
          reject(err)
          return
        }
        resolve(result)
      })
    })
  }
}

module.exports = OpenstackAdapter
