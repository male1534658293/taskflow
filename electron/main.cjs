const { app, BrowserWindow, globalShortcut, ipcMain, screen, Menu, Tray, nativeImage, shell, Notification, dialog } = require('electron')
const path = require('path')
const http = require('http')

// Auto-updater (only in packaged app)
let autoUpdater = null
try {
  autoUpdater = require('electron-updater').autoUpdater
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null  // suppress logs in production
} catch (e) {
  // electron-updater not available in dev mode
}

let mainWindow = null
let floatWindow = null
let tray = null

// ─── 工作日提醒调度 ───────────────────────────────────────────────────────────
let reminderTimer = null

// 中国法定节假日（与前端共享同一份数据，main 进程独立维护）
const CN_HOLIDAYS = new Set([
  // 2025
  '2025-01-01',
  '2025-01-28','2025-01-29','2025-01-30','2025-01-31',
  '2025-02-01','2025-02-02','2025-02-03','2025-02-04',
  '2025-04-04','2025-04-05','2025-04-06',
  '2025-05-01','2025-05-02','2025-05-03','2025-05-04','2025-05-05',
  '2025-05-31','2025-06-01','2025-06-02',
  '2025-10-01','2025-10-02','2025-10-03','2025-10-04',
  '2025-10-05','2025-10-06','2025-10-07','2025-10-08',
  // 2026
  '2026-01-01','2026-01-02','2026-01-03',
  '2026-02-17','2026-02-18','2026-02-19','2026-02-20',
  '2026-02-21','2026-02-22','2026-02-23','2026-02-24',
  '2026-04-05','2026-04-06','2026-04-07',
  '2026-05-01','2026-05-02','2026-05-03','2026-05-04','2026-05-05',
  '2026-06-20','2026-06-21','2026-06-22',
  '2026-09-25','2026-09-26','2026-09-27',
  '2026-10-01','2026-10-02','2026-10-03','2026-10-04',
  '2026-10-05','2026-10-06','2026-10-07',
])
// 调休补班（法定节假日中须上班的日期）
const CN_WORKDAYS = new Set([
  '2025-01-26','2025-02-08','2025-04-27','2025-05-10','2025-09-28','2025-10-11',
  '2026-01-04','2026-02-15','2026-02-28','2026-04-26','2026-05-09','2026-10-10',
])

function toLocalDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isWorkday(date) {
  const ds = toLocalDateStr(date)
  if (CN_HOLIDAYS.has(ds)) return false  // 法定假日
  if (CN_WORKDAYS.has(ds)) return true   // 调休补班
  const dow = date.getDay()
  return dow !== 0 && dow !== 6          // 普通工作日
}

function scheduleNextReminder(timeStr, todosJson) {
  if (reminderTimer) clearTimeout(reminderTimer)

  const [hour, minute] = timeStr.split(':').map(Number)
  const now = new Date()
  const target = new Date(now)
  target.setHours(hour, minute, 0, 0)

  // 如果今天的时间已过，从明天开始找
  if (target <= now) target.setDate(target.getDate() + 1)

  // 向前最多找 7 天，找到下一个工作日
  for (let i = 0; i < 7; i++) {
    if (isWorkday(target)) break
    target.setDate(target.getDate() + 1)
  }

  const msUntil = target.getTime() - now.getTime()

  reminderTimer = setTimeout(() => {
    fireReminder(todosJson)
    // 触发后自动安排下一次
    scheduleNextReminder(timeStr, todosJson)
  }, msUntil)

  return { nextTime: target.toISOString() }
}

function fireReminder(todosJson) {
  if (!Notification.isSupported()) return
  try {
    const todos = JSON.parse(todosJson || '[]')
    const today = toLocalDateStr(new Date())
    const todayTasks = todos.filter(t => t.status !== 'completed' && t.dueDate === today)
    const overdue = todos.filter(t => t.status !== 'completed' && t.dueDate && t.dueDate < today)
    const total = todos.filter(t => t.status !== 'completed')

    let body = ''
    if (todayTasks.length > 0) {
      body = `今天有 ${todayTasks.length} 个任务待完成`
      if (todayTasks[0]) body += `：${todayTasks[0].title}`
      if (todayTasks.length > 1) body += ` 等`
    } else if (total.length > 0) {
      body = `共有 ${total.length} 个待办任务`
    } else {
      body = '今天没有待办任务，保持好状态！'
    }
    if (overdue.length > 0) body += `（${overdue.length} 个已逾期）`

    const n = new Notification({
      title: '📋 TaskFlow 工作提醒',
      body,
      silent: false,
    })
    n.on('click', () => {
      if (mainWindow) { mainWindow.show(); mainWindow.focus() }
      else createMainWindow()
    })
    n.show()
  } catch (e) {
    console.warn('[Reminder]', e)
  }
}

function getDistPath(file = 'index.html') {
  return path.join(__dirname, '../dist', file)
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#020817',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })
  mainWindow.loadFile(getDistPath())
  mainWindow.on('closed', () => { mainWindow = null })
}

function createFloatWindow() {
  if (floatWindow) {
    floatWindow.focus()
    return
  }
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize

  // Restore saved position
  const savedX = parseInt(process.env._FLOAT_X || (sw - 360).toString())
  const savedY = parseInt(process.env._FLOAT_Y || '80')

  floatWindow = new BrowserWindow({
    width: 320,
    height: 500,
    x: savedX,
    y: savedY,
    alwaysOnTop: true,
    frame: false,
    resizable: true,
    minWidth: 280,
    maxWidth: 500,
    minHeight: 200,
    maxHeight: 720,
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  floatWindow.loadFile(getDistPath(), { hash: 'float' })

  // Save position on move
  floatWindow.on('moved', () => {
    if (floatWindow) {
      const [x, y] = floatWindow.getPosition()
      process.env._FLOAT_X = x.toString()
      process.env._FLOAT_Y = y.toString()
    }
  })

  floatWindow.on('closed', () => { floatWindow = null })
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'tray.png'))
  icon.setTemplateImage(true)

  tray = new Tray(icon)
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示 TaskFlow', click: () => mainWindow ? mainWindow.show() : createMainWindow() },
    { label: '显示浮窗 (⌘⇧T)', click: () => createFloatWindow() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ])
  tray.setToolTip('TaskFlow')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    if (mainWindow) mainWindow.show()
    else createMainWindow()
  })
}

app.whenReady().then(() => {
  createMainWindow()
  createTray()

  // Auto-update check (3s delay to let main window load)
  if (autoUpdater && app.isPackaged) {
    autoUpdater.autoDownload = false  // 先询问用户，再决定是否下载

    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {})
    }, 3000)

    // 发现新版本 → 通知渲染进程显示浮窗
    autoUpdater.on('update-available', (info) => {
      const releaseNotes = typeof info.releaseNotes === 'string'
        ? info.releaseNotes.replace(/<[^>]+>/g, '').trim()
        : (Array.isArray(info.releaseNotes)
            ? info.releaseNotes.map(r => r.note).join('\n')
            : '')
      mainWindow?.webContents.send('update-available', { version: info.version, releaseNotes })
    })

    // 已是最新版本
    autoUpdater.on('update-not-available', () => {
      // 静默，不打扰用户
    })

    // 下载进度
    autoUpdater.on('download-progress', (progress) => {
      mainWindow?.webContents.send('update-progress', Math.round(progress.percent))
    })

    // 下载完成 → 提示重启安装
    autoUpdater.on('update-downloaded', (info) => {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'TaskFlow 更新已就绪',
        message: `v${info.version} 下载完成`,
        detail: '点击"立即重启"完成安装，或下次启动时自动安装。',
        buttons: ['立即重启', '下次启动时安装'],
        defaultId: 0,
      }).then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall()
      })
    })

    // 检查出错静默处理
    autoUpdater.on('error', () => {})
  }

  // Global shortcut: Cmd+Shift+T to toggle float window
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    if (!floatWindow) {
      createFloatWindow()
    } else if (floatWindow.isVisible()) {
      floatWindow.hide()
    } else {
      floatWindow.show()
      floatWindow.focus()
    }
  })

  app.on('activate', () => {
    if (!mainWindow) createMainWindow()
  })
})

// IPC handlers
ipcMain.on('open-float-window', () => createFloatWindow())

ipcMain.on('close-float-window', () => {
  floatWindow?.close()
})

ipcMain.on('minimize-float-window', () => {
  floatWindow?.minimize()
})

ipcMain.on('hide-float-window', () => {
  floatWindow?.hide()
})

ipcMain.on('float-window-drag', (e, { dx, dy }) => {
  if (floatWindow) {
    const [x, y] = floatWindow.getPosition()
    floatWindow.setPosition(x + dx, y + dy)
  }
})

ipcMain.on('float-set-opacity', (e, { opacity }) => {
  floatWindow?.setOpacity(Math.max(0.1, Math.min(1, opacity)))
})

ipcMain.on('float-set-always-on-top', (e, { onTop }) => {
  floatWindow?.setAlwaysOnTop(onTop)
})

ipcMain.on('float-resize', (e, { w, h }) => {
  floatWindow?.setSize(w, h)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (reminderTimer) clearTimeout(reminderTimer)
})

// ─── 更新下载 IPC ────────────────────────────────────────────────────────────
ipcMain.on('download-update', () => {
  if (autoUpdater) {
    mainWindow?.webContents.send('update-downloading')
    autoUpdater.downloadUpdate().catch(() => {})
  }
})

// ─── 自动更新 IPC ─────────────────────────────────────────────────────────────
ipcMain.handle('check-for-updates', async () => {
  if (!autoUpdater || !app.isPackaged) {
    return { status: 'dev', version: app.getVersion() }
  }
  try {
    const result = await autoUpdater.checkForUpdates()
    return { status: 'checked', version: app.getVersion(), updateInfo: result?.updateInfo || null }
  } catch (e) {
    return { status: 'error', error: e.message }
  }
})

ipcMain.handle('get-app-version', () => app.getVersion())

// ─── 提醒 IPC ────────────────────────────────────────────────────────────────
let currentTodosJson = '[]'

ipcMain.handle('reminder-set', (e, { time, todosJson }) => {
  currentTodosJson = todosJson || '[]'
  const result = scheduleNextReminder(time, currentTodosJson)
  return result
})

ipcMain.on('reminder-clear', () => {
  if (reminderTimer) { clearTimeout(reminderTimer); reminderTimer = null }
})

ipcMain.on('reminder-update-todos', (e, { todosJson }) => {
  currentTodosJson = todosJson || '[]'
})

// ─── Google OAuth loopback flow ──────────────────────────────────────────────
// Desktop app type: Google auto-allows http://127.0.0.1 on any port
ipcMain.handle('google-oauth-start', (event, { clientId, clientSecret }) => {
  return new Promise((resolve) => {
    const server = http.createServer()

    server.on('error', (err) => {
      resolve({ success: false, error: err.message })
    })

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      const redirectUri = `http://127.0.0.1:${port}/callback`

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email',
        access_type: 'offline',
        prompt: 'consent',
      })

      shell.openExternal(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)

      // Timeout after 5 minutes
      const timer = setTimeout(() => {
        server.close()
        resolve({ success: false, error: 'timeout' })
      }, 5 * 60 * 1000)

      server.once('request', async (req, res) => {
        clearTimeout(timer)

        const url = new URL(req.url, `http://127.0.0.1:${port}`)
        const code = url.searchParams.get('code')
        const oauthError = url.searchParams.get('error')

        const page = (ok) => `<!DOCTYPE html><html><head><meta charset="UTF-8">
          <style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#e2e8f0}</style>
          </head><body><div style="text-align:center">
          ${ok
            ? '<div style="font-size:56px">✅</div><h2 style="color:#4ade80;margin:12px 0">授权成功！</h2><p style="color:#94a3b8">请返回 TaskFlow 应用</p>'
            : '<div style="font-size:56px">❌</div><h2 style="color:#f87171;margin:12px 0">授权失败</h2><p style="color:#94a3b8">请返回应用重试</p>'
          }</div><script>setTimeout(()=>window.close(),2000)</script></body></html>`

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(page(!!code))
        server.close()

        if (!code) {
          resolve({ success: false, error: oauthError || 'access_denied' })
          return
        }

        // Exchange authorization code for tokens
        try {
          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: redirectUri,
              grant_type: 'authorization_code',
            }).toString(),
          })
          const tokenData = await tokenRes.json()

          if (tokenData.access_token) {
            // Fetch user email
            try {
              const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
              })
              const userData = await userRes.json()
              resolve({ success: true, ...tokenData, email: userData.email || '' })
            } catch {
              resolve({ success: true, ...tokenData, email: '' })
            }
          } else {
            resolve({
              success: false,
              error: tokenData.error_description || tokenData.error || '授权码换取 token 失败',
            })
          }
        } catch (e) {
          resolve({ success: false, error: e.message })
        }
      })
    })
  })
})
