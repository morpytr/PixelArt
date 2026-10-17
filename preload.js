const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('pixelAPI', {
  version: '1.0.0'
});
