# ghost-storage-adapter-openstack

An openstack storage adapter for Ghost blogging platform.

## Installation
```sh
npm i traPtitech/ghost-storage-adapter-openstack
mkdir -p ./content/adapters/openstack
cp -r ./node_modules/ghost-storage-adapter-openstack ./content/adapters/openstack
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
