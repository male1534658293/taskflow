const path = require('path');
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  nativeImage,
  ipcMain,
  screen,
  dialog,
} = require('electron');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let floatingWindow = null;
let tray = null;
let isQuitting = false;
const notifiedByDue = new Map();
const trayReminders = new Map();

function createTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
      <rect x="2" y="2" width="14" height="14" rx="3" fill="black" />
      <path d="M5 9.2l2.2 2.2L13 5.8" stroke="white" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const icon = nativeImage.createFromDataURL(dataUrl).resize({ width: 18, height: 18 });
  icon.setTemplateImage(true);
  return icon;
}

function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function buildTrayMenu() {
  const items = Array.from(trayReminders.values())
    .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0))
    .slice(0, 8);

  const reminderMenu = items.length
    ? items.map(item => ({
        label: `⏰ ${item.title}${item.message ? ` · ${item.message}` : ''}`,
        click: () => showMainWindow(),
      }))
    : [{ label: '暂无提醒', enabled: false }];

  return Menu.buildFromTemplate([
    { label: '打开 Task Flow', click: () => showMainWindow() },
    {
      label: floatingWindow && !floatingWindow.isDestroyed() ? '隐藏今日待办' : '显示今日待办',
      click: () => toggleFloatingWindow(),
    },
    { type: 'separator' },
    ...reminderMenu,
    { type: 'separator' },
    {
      label: '清空提醒列表',
      click: () => {
        trayReminders.clear();
        updateTray();
      },
    },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
}

function updateTray() {
  if (!tray) return;
  tray.setContextMenu(buildTrayMenu());
  const count = trayReminders.size;
  tray.setToolTip(count ? `Task Flow · ${count} 条提醒` : 'Task Flow');
}

function sendSystemReminder(payload = {}) {
  const id = String(payload.id || '');
  const title = String(payload.title || '待办提醒');
  const dueDate = payload.dueDate || '';
  const message = String(payload.message || '');
  if (!id) return;

  const dedupeKey = `${id}::${dueDate}`;
  if (notifiedByDue.has(dedupeKey)) return;
  notifiedByDue.set(dedupeKey, Date.now());

  trayReminders.set(id, { id, title, dueDate, message });
  updateTray();

  if (!Notification.isSupported()) return;
  const notification = new Notification({
    title: `⏰ ${title}`,
    body: message || '请及时处理',
    silent: false,
  });
  notification.on('click', () => showMainWindow());
  notification.show();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    title: 'Task Flow',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 16 },
    backgroundColor: '#1a1a1a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL('http://127.0.0.1:7777');

  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createFloatingWindow() {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.show();
    floatingWindow.focus();
    return;
  }

  // Position in bottom-right corner
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  floatingWindow = new BrowserWindow({
    width: 300,
    height: 50,
    x: width - 320,
    y: height - 70,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    minWidth: 240,
    title: '今日待办',
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-floating.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  floatingWindow.loadURL('http://127.0.0.1:7777/floating.html');

  floatingWindow.on('closed', () => {
    floatingWindow = null;
    updateTray();
    // Notify main window
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('floating:state', false);
    }
  });

  floatingWindow.on('show', () => updateTray());
  floatingWindow.on('hide', () => updateTray());

  // Notify main window
  floatingWindow.webContents.once('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('floating:state', true);
    }
  });
}

function toggleFloatingWindow() {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.close();
    floatingWindow = null;
  } else {
    createFloatingWindow();
  }
  updateTray();
}

async function startEmbeddedServer() {
  process.env.DATA_DIR = path.join(app.getPath('userData'), 'data');
  const { startServer } = require('./server');
  try {
    await startServer();
  } catch (error) {
    if (String(error?.code || '') !== 'EADDRINUSE') throw error;
  }
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.on('click', () => {
    tray.popUpContextMenu();
  });
  updateTray();
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });
}

ipcMain.handle('desktop:notify-reminder', async (_event, payload) => {
  sendSystemReminder(payload);
  return { ok: true };
});

ipcMain.handle('desktop:clear-reminders', async () => {
  trayReminders.clear();
  updateTray();
  return { ok: true };
});

ipcMain.handle('todos:changed', async () => {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.webContents.send('todos:changed');
  }
  return { ok: true };
});

ipcMain.handle('floating:toggle', async () => {
  toggleFloatingWindow();
  return { visible: floatingWindow && !floatingWindow.isDestroyed() };
});

ipcMain.handle('floating:close', async () => {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.close();
    floatingWindow = null;
  }
  updateTray();
  return { ok: true };
});

ipcMain.handle('floating:isVisible', async () => {
  return { visible: Boolean(floatingWindow && !floatingWindow.isDestroyed()) };
});

ipcMain.handle('floating:setOpacity', async (_event, value) => {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    const opacity = Math.max(0.25, Math.min(1, parseFloat(value) || 0.92));
    floatingWindow.setOpacity(opacity);
  }
  return { ok: true };
});

ipcMain.handle('floating:expand', async (_event, expand) => {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
    const [fw] = floatingWindow.getSize();
    if (expand) {
      floatingWindow.setBounds({ x: sw - fw - 20, y: sh - 510, width: fw, height: 490 }, true);
    } else {
      floatingWindow.setBounds({ x: sw - fw - 20, y: sh - 70, width: fw, height: 50 }, true);
    }
  }
  return { ok: true };
});

// ===== AUTO UPDATER =====
function setupAutoUpdater() {
  autoUpdater.autoDownload = false;

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '发现新版本',
      message: `Task Flow ${info.version} 已发布`,
      detail: '是否立即下载更新？',
      buttons: ['立即下载', '稍后提醒'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.downloadUpdate();
        if (mainWindow) mainWindow.webContents.send('update-downloading');
      }
    });
  });

  autoUpdater.on('update-not-available', () => {
    if (mainWindow) mainWindow.webContents.send('update-not-available', app.getVersion());
  });

  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow) mainWindow.webContents.send('update-progress', Math.round(progress.percent));
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '更新已就绪',
      message: '新版本下载完成，重启即可完成更新',
      buttons: ['立即重启', '稍后重启'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('error', (err) => {
    if (mainWindow) mainWindow.webContents.send('update-error', err.message);
  });
}

ipcMain.handle('check-for-updates', async () => {
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.whenReady().then(async () => {
  await startEmbeddedServer();
  createTray();
  createMainWindow();
  setupAutoUpdater();

  // Check for updates 5 seconds after launch (only in packaged app)
  if (app.isPackaged) {
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    else showMainWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
