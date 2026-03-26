const { app, BrowserWindow, globalShortcut, ipcMain, screen, shell, Notification, dialog } = require('electron')
const path = require('path')
const http = require('http')
const fs = require('fs')
const os = require('os')

// ─── 自动更新（electron-updater + zip 格式，无需代码签名）──────────────────────
let autoUpdater = null
try {
  autoUpdater = require('electron-updater').autoUpdater
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null
} catch (e) {
  // dev 模式下 electron-updater 不可用
}

let mainWindow = null
let floatWindow = null
let floatClickThrough = false
const UPDATE_OWNER = 'male1534658293'
const UPDATE_REPO = 'taskflow'

// ─── 工作日提醒调度 ───────────────────────────────────────────────────────────
let reminderTimer = null
let downloadedZipPath = null
let updateInfoCache = null
let isDownloadingUpdate = false
let lastUpdateError = null
let updateProgress = 0

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

function getGoogleOAuthConfigPath() {
  return path.join(app.getPath('userData'), 'google-oauth.json')
}

function readGoogleOAuthConfig() {
  try {
    const raw = fs.readFileSync(getGoogleOAuthConfigPath(), 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function resolveGoogleOAuthCredentials(override = {}) {
  const fileConfig = readGoogleOAuthConfig()
  const clientId = override.clientId || fileConfig.clientId || process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || ''
  const clientSecret = override.clientSecret || fileConfig.clientSecret || process.env.GOOGLE_CLIENT_SECRET || process.env.VITE_GOOGLE_CLIENT_SECRET || ''

  let source = 'missing'
  if (override.clientId && override.clientSecret) source = 'request'
  else if (fileConfig.clientId || fileConfig.clientSecret) source = 'userData'
  else if (process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_SECRET || process.env.VITE_GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_SECRET) source = 'env'

  return {
    clientId,
    clientSecret,
    configured: !!(clientId && clientSecret),
    source,
  }
}

function writeGoogleOAuthConfig({ clientId, clientSecret }) {
  const filePath = getGoogleOAuthConfigPath()
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify({ clientId, clientSecret }, null, 2), 'utf8')
}

function clearGoogleOAuthConfig() {
  try {
    fs.unlinkSync(getGoogleOAuthConfigPath())
  } catch {}
}

function buildReleaseUrl(version) {
  return version ? `https://github.com/${UPDATE_OWNER}/${UPDATE_REPO}/releases/tag/v${version}` : `https://github.com/${UPDATE_OWNER}/${UPDATE_REPO}/releases`
}

function sanitizeReleaseNotes(releaseNotes) {
  return typeof releaseNotes === 'string'
    ? releaseNotes.replace(/<[^>]+>/g, '').trim()
    : (Array.isArray(releaseNotes) ? releaseNotes.map(r => r.note).join('\n') : '')
}

function normalizeVersion(version) {
  return String(version || '')
    .trim()
    .replace(/^v/i, '')
}

function compareVersions(a, b) {
  const pa = normalizeVersion(a).split('.').map(v => parseInt(v, 10))
  const pb = normalizeVersion(b).split('.').map(v => parseInt(v, 10))
  const maxLen = Math.max(pa.length, pb.length)
  for (let i = 0; i < maxLen; i++) {
    const av = Number.isFinite(pa[i]) ? pa[i] : 0
    const bv = Number.isFinite(pb[i]) ? pb[i] : 0
    if (av > bv) return 1
    if (av < bv) return -1
  }
  return 0
}

function toValidatedUpdateInfo(info, currentVersion = app.getVersion()) {
  const remoteVersion = normalizeVersion(info?.version)
  const current = normalizeVersion(currentVersion)
  if (!remoteVersion) {
    return { status: 'invalid_remote_version', updateInfo: null }
  }

  const cmp = compareVersions(remoteVersion, current)
  if (cmp <= 0) {
    console.warn('[Updater] ignoring non-newer version', { remoteVersion, currentVersion: current })
    return { status: cmp === 0 ? 'latest' : 'invalid_remote_version', updateInfo: null }
  }

  return {
    status: 'available',
    updateInfo: {
      version: remoteVersion,
      releaseNotes: sanitizeReleaseNotes(info?.releaseNotes),
      releaseUrl: buildReleaseUrl(remoteVersion),
    },
  }
}

function resetUpdateState() {
  updateInfoCache = null
  downloadedZipPath = null
  isDownloadingUpdate = false
  updateProgress = 0
}

function sendUpdateStatus(channel, payload = {}) {
  mainWindow?.webContents.send(channel, payload)
}

function pickDownloadedZipPath(value) {
  if (!value) return null
  if (typeof value === 'string') return value.endsWith('.zip') ? value : null
  if (Array.isArray(value)) return value.find(p => typeof p === 'string' && p.endsWith('.zip')) || value.find(p => typeof p === 'string') || null
  if (typeof value === 'object') {
    if (typeof value.downloadedFile === 'string') return value.downloadedFile
    if (Array.isArray(value.files)) return pickDownloadedZipPath(value.files.map(file => file.url || file.path || file.name).filter(Boolean))
  }
  return null
}

async function refreshGoogleToken({ refreshToken, clientId, clientSecret }) {
  const creds = resolveGoogleOAuthCredentials({ clientId, clientSecret })
  if (!creds.configured) return { success: false, error: 'missing_credentials' }
  if (!refreshToken) return { success: false, error: 'missing_refresh_token' }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        grant_type: 'refresh_token',
      }).toString(),
    })
    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      return {
        success: false,
        error: tokenData.error_description || tokenData.error || 'refresh_failed',
      }
    }

    return { success: true, ...tokenData }
  } catch (e) {
    return { success: false, error: e.message }
  }
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
  floatWindow.setIgnoreMouseEvents(floatClickThrough, { forward: true })

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

app.whenReady().then(() => {
  createMainWindow()

  // 自动更新检查（启动 3 秒后）
  if (autoUpdater && app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        lastUpdateError = err?.message || 'check failed'
        sendUpdateStatus('update-error', { message: lastUpdateError })
      })
    }, 3000)

    autoUpdater.on('update-available', (info) => {
      const validated = toValidatedUpdateInfo(info)
      if (validated.status !== 'available') {
        resetUpdateState()
        lastUpdateError = null
        sendUpdateStatus('update-not-available', { version: app.getVersion() })
        return
      }
      updateInfoCache = validated.updateInfo
      downloadedZipPath = null
      isDownloadingUpdate = false
      updateProgress = 0
      lastUpdateError = null
      sendUpdateStatus('update-available', updateInfoCache)
    })

    autoUpdater.on('update-not-available', () => {
      resetUpdateState()
      sendUpdateStatus('update-not-available', { version: app.getVersion() })
    })

    autoUpdater.on('download-progress', (progress) => {
      isDownloadingUpdate = true
      updateProgress = Math.round(progress.percent)
      sendUpdateStatus('update-downloading', { progress: updateProgress })
      sendUpdateStatus('update-progress', { progress: updateProgress })
    })

    // 下载完成 → 保存路径，通知渲染进程
    autoUpdater.on('update-downloaded', (info) => {
      downloadedZipPath = pickDownloadedZipPath(info) || downloadedZipPath
      isDownloadingUpdate = false
      updateProgress = 100
      sendUpdateStatus('update-downloaded', { downloaded: true, zipPathFound: !!downloadedZipPath })
    })

    autoUpdater.on('error', (err) => {
      isDownloadingUpdate = false
      lastUpdateError = err?.message || 'unknown'
      sendUpdateStatus('update-error', {
        message: lastUpdateError,
        releaseUrl: buildReleaseUrl(updateInfoCache?.version),
      })
    })
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

  globalShortcut.register('CommandOrControl+Shift+X', () => {
    if (!floatWindow) return
    floatClickThrough = !floatClickThrough
    floatWindow.setIgnoreMouseEvents(floatClickThrough, { forward: true })
    floatWindow.webContents.send('float-click-through-changed', { enabled: floatClickThrough })
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

ipcMain.on('float-set-click-through', (e, { enabled }) => {
  floatClickThrough = !!enabled
  if (floatWindow) {
    floatWindow.setIgnoreMouseEvents(floatClickThrough, { forward: true })
    floatWindow.webContents.send('float-click-through-changed', { enabled: floatClickThrough })
  }
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

// ─── 自动更新 IPC ─────────────────────────────────────────────────────────────
ipcMain.handle('check-for-updates', async () => {
  if (!autoUpdater || !app.isPackaged) return { status: 'dev', version: app.getVersion() }
  try {
    const result = await autoUpdater.checkForUpdates()
    const validated = toValidatedUpdateInfo(result?.updateInfo, app.getVersion())
    if (validated.status === 'available') {
      updateInfoCache = validated.updateInfo
      lastUpdateError = null
      return {
        status: 'available',
        version: app.getVersion(),
        updateInfo: validated.updateInfo,
      }
    }

    resetUpdateState()
    return {
      status: validated.status === 'invalid_remote_version' ? 'invalid_remote_version' : 'latest',
      version: app.getVersion(),
      updateInfo: null,
    }
  } catch (e) {
    return { status: 'error', error: e.message }
  }
})

ipcMain.handle('get-update-status', () => ({
  available: !!updateInfoCache,
  version: updateInfoCache?.version || null,
  updateInfo: updateInfoCache,
  downloading: isDownloadingUpdate,
  downloaded: !!downloadedZipPath,
  progress: updateProgress,
  error: lastUpdateError,
  releaseUrl: buildReleaseUrl(updateInfoCache?.version),
}))

// 开始下载，保存路径供手动安装用
ipcMain.on('download-update', async () => {
  if (!autoUpdater || !app.isPackaged) {
    sendUpdateStatus('update-error', { message: '当前环境不支持自动更新' })
    return
  }
  if (isDownloadingUpdate) {
    sendUpdateStatus('update-downloading', { progress: updateProgress })
    return
  }

  try {
    lastUpdateError = null
    if (!updateInfoCache) {
      const result = await autoUpdater.checkForUpdates()
      const validated = toValidatedUpdateInfo(result?.updateInfo, app.getVersion())
      if (validated.status !== 'available') {
        resetUpdateState()
        sendUpdateStatus('update-not-available', { version: app.getVersion() })
        return
      }
      updateInfoCache = validated.updateInfo
    }

    isDownloadingUpdate = true
    updateProgress = 0
    sendUpdateStatus('update-downloading', { progress: 0 })

    const paths = await autoUpdater.downloadUpdate()
    downloadedZipPath = pickDownloadedZipPath(paths) || downloadedZipPath

    if (!downloadedZipPath) {
      isDownloadingUpdate = false
      updateProgress = 0
      lastUpdateError = '更新已下载，但未定位到安装包，请从发布页手动下载'
      sendUpdateStatus('update-error', {
        message: lastUpdateError,
        releaseUrl: buildReleaseUrl(updateInfoCache?.version),
      })
    }
  } catch (err) {
    isDownloadingUpdate = false
    lastUpdateError = err?.message || 'download failed'
    sendUpdateStatus('update-error', {
      message: lastUpdateError,
      releaseUrl: buildReleaseUrl(updateInfoCache?.version),
    })
  }
})

// 下载完成后用户点击"立即安装" → 手动解压替换（绕过 ShipIt 代码签名验证）
ipcMain.on('install-update', () => {
  if (!downloadedZipPath) {
    mainWindow?.webContents.send('update-error', `install-update: no zip path (autoUpdater=${!!autoUpdater})`)
    return
  }
  const appPath = app.getPath('exe').split('/Contents/MacOS/')[0]
  const ts = Date.now()
  const tmpDir = `/tmp/taskflow_update_${ts}`
  const logFile = `/tmp/taskflow_install_${ts}.log`
  const script = `#!/bin/bash
exec > "${logFile}" 2>&1
echo "zip: ${downloadedZipPath}"
echo "app: ${appPath}"
sleep 1
unzip -o "${downloadedZipPath}" -d "${tmpDir}"
APP=$(find "${tmpDir}" -maxdepth 1 -name "*.app" | head -1)
echo "found app: $APP"
if [ -n "$APP" ]; then
  rm -rf "${appPath}"
  cp -Rp "$APP" "${appPath}"
  xattr -cr "${appPath}" 2>/dev/null
  open "${appPath}"
fi
rm -rf "${tmpDir}"
`
  const scriptPath = `/tmp/taskflow_install_${ts}.sh`
  require('fs').writeFileSync(scriptPath, script, { mode: 0o755 })
  require('child_process').spawn('/bin/bash', [scriptPath], { detached: true, stdio: 'ignore' }).unref()
  app.quit()
})

ipcMain.handle('get-app-version', () => app.getVersion())

ipcMain.handle('google-oauth-status', () => {
  const creds = resolveGoogleOAuthCredentials()
  return {
    configured: creds.configured,
    source: creds.source,
    clientIdPreview: creds.clientId ? `${creds.clientId.slice(0, 12)}...` : '',
  }
})

ipcMain.handle('google-oauth-save-config', (_, params = {}) => {
  const clientId = (params.clientId || '').trim()
  const clientSecret = (params.clientSecret || '').trim()
  if (!clientId || !clientSecret) {
    return { success: false, error: 'missing_credentials' }
  }

  try {
    writeGoogleOAuthConfig({ clientId, clientSecret })
    const creds = resolveGoogleOAuthCredentials()
    return {
      success: true,
      configured: creds.configured,
      source: creds.source,
      clientIdPreview: creds.clientId ? `${creds.clientId.slice(0, 12)}...` : '',
    }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('google-oauth-clear-config', () => {
  clearGoogleOAuthConfig()
  return { success: true }
})

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
ipcMain.handle('google-oauth-start', (event, params = {}) => {
  return new Promise((resolve) => {
    const { clientId, clientSecret } = params
    const creds = resolveGoogleOAuthCredentials({ clientId, clientSecret })
    if (!creds.configured) {
      resolve({ success: false, error: 'missing_credentials' })
      return
    }

    const server = http.createServer()

    server.on('error', (err) => {
      resolve({ success: false, error: err.message })
    })

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      const redirectUri = `http://127.0.0.1:${port}/callback`

      const params = new URLSearchParams({
        client_id: creds.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email https://www.googleapis.com/auth/calendar.events',
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
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
              client_id: creds.clientId,
              client_secret: creds.clientSecret,
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

ipcMain.handle('google-oauth-refresh', async (_, params) => {
  return refreshGoogleToken(params || {})
})

// ─── iCloud Drive 同步 ────────────────────────────────────────────────────────
const ICLOUD_DIR = path.join(os.homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'TaskFlow')

ipcMain.handle('icloud-save', (_, data) => {
  try {
    if (!fs.existsSync(ICLOUD_DIR)) fs.mkdirSync(ICLOUD_DIR, { recursive: true })
    fs.writeFileSync(path.join(ICLOUD_DIR, 'data.json'), JSON.stringify(data), 'utf8')
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('icloud-load', () => {
  try {
    const filePath = path.join(ICLOUD_DIR, 'data.json')
    if (!fs.existsSync(filePath)) return { success: true, data: null }
    const raw = fs.readFileSync(filePath, 'utf8')
    return { success: true, data: JSON.parse(raw) }
  } catch (e) {
    return { success: false, error: e.message }
  }
})
