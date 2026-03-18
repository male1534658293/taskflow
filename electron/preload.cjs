const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  openFloatWindow: () => ipcRenderer.send('open-float-window'),
  closeFloatWindow: () => ipcRenderer.send('close-float-window'),
  minimizeFloatWindow: () => ipcRenderer.send('minimize-float-window'),
  hideFloatWindow: () => ipcRenderer.send('hide-float-window'),
  dragFloatWindow: (dx, dy) => ipcRenderer.send('float-window-drag', { dx, dy }),
  setFloatOpacity: (opacity) => ipcRenderer.send('float-set-opacity', { opacity }),
  setFloatAlwaysOnTop: (onTop) => ipcRenderer.send('float-set-always-on-top', { onTop }),
  resizeFloatWindow: (w, h) => ipcRenderer.send('float-resize', { w, h }),
  startGoogleOAuth: (params) => ipcRenderer.invoke('google-oauth-start', params),
  setReminder: (time, todosJson) => ipcRenderer.invoke('reminder-set', { time, todosJson }),
  clearReminder: () => ipcRenderer.send('reminder-clear'),
  updateReminderTodos: (todosJson) => ipcRenderer.send('reminder-update-todos', { todosJson }),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', cb),
  onUpdateDownloading: (cb) => ipcRenderer.on('update-downloading', cb),
  onUpdateProgress: (cb) => ipcRenderer.on('update-progress', cb),
  onUpdateError: (cb) => ipcRenderer.on('update-error', cb),
})
