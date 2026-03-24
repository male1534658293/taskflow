const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('floatingBridge', {
  isDesktop: true,
  close: () => ipcRenderer.invoke('floating:close'),
  setOpacity: (v) => ipcRenderer.invoke('floating:setOpacity', v),
  expand: (v) => ipcRenderer.invoke('floating:expand', v),
  onTodosChanged: (cb) => ipcRenderer.on('todos:changed', () => cb()),
});
