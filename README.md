# ghost-storage-adapter-openstack

An openstack storage adapter for Ghost blogging platform.

Using patched pkgcloud due to [#673](https://github.com/pkgcloud/pkgcloud/pull/673).

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
      "username": "",
      "password": "",
      "authUrl": "",
      "region": "",
      "tenantId": "",
      "container": "",
      "serverUrl": ""
    }
  }
}
```
