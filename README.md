# ghost-storage-adapter-openstack

An openstack storage adapter for Ghost blogging platform.

Using patched pkgcloud due to [#673](https://github.com/pkgcloud/pkgcloud/pull/673).

Resizes images and caches it.

## Installation
```sh
npm i traPtitech/ghost-storage-adapter-openstack
mkdir -p ./content/adapters/storage
cp -r ./node_modules/ghost-storage-adapter-openstack ./content/adapters/storage/openstack
```

## Configuration
```json
{
  "storage": {
    "active": "openstack",
    "openstack": {
      "username": "your-username",
      "password": "your-password",
      "authUrl": "your-auth-url (without /v2.0/)",
      "region": "your-region",
      "tenantId": "your-tenant-id",
      "container": "your-container-name",
      "serverUrl": "your-page-domain/content/images",
      "cacheFolder": "absolute-path-to-cache-folder"
    }
  },
  "imageOptimization": {
    "resize": false
  }
}
```
