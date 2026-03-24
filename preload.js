const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopBridge', {
  isDesktop: true,
  notifyReminder: (payload) => ipcRenderer.invoke('desktop:notify-reminder', payload),
  clearReminders: () => ipcRenderer.invoke('desktop:clear-reminders'),
  toggleFloating: () => ipcRenderer.invoke('floating:toggle'),
  isFloatingVisible: () => ipcRenderer.invoke('floating:isVisible'),
  onFloatingState: (cb) => ipcRenderer.on('floating:state', (_e, visible) => cb(visible)),
  notifyTodosChanged: () => ipcRenderer.invoke('todos:changed'),
});
