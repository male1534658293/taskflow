# TaskFlow

个人任务管理桌面应用，基于 Electron + React + Tailwind CSS 构建。

## 功能特点

- **今日视图** — 聚焦当天任务，支持焦点模式
- **收件箱 / 看板 / 甘特图** — 多维度任务管理
- **日历视图** — 含中国法定节假日、周末和调休标注
- **浮窗模式** — 始终置顶，4 档尺寸，番茄钟，迷你日历
- **重复任务** — 每天 / 工作日 / 每周 / 每月 / 每年
- **Google Calendar 同步** — 创建/更新/删除任务自动同步
- **工作日提醒** — 系统通知，自动跳过节假日
- **NLP 自然语言输入** — `明天 p1 #工作 开会`
- **自动更新** — 基于 GitHub Releases

## 安装

从 [Releases](../../releases) 页面下载最新的 `.dmg` 文件，双击安装。

> **首次打开提示"未经验证的开发者"**：右键点击应用 → 打开 → 打开

## 开发

```bash
npm install
npm run electron      # 开发模式（Vite dev server + Electron）
```

## 打包发布

```bash
npm run build         # 构建 Vite 产物
npm run electron:build # 打包为 .dmg（macOS）
```

打包后文件在 `dist/` 目录。

## Google Calendar 同步配置

1. 飞书 → 设置 → 日历 → 第三方日历同步 → 选择 Google 日历 → 开启
2. 在 TaskFlow 设置 → Google 日历同步 → 连接 Google 账户
3. 授权后，任务变动自动同步到你的 Google Calendar

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `N` | 新建任务 |
| `1–5` | 切换视图 |
| `⌘⇧T` | 打开/隐藏浮窗 |
| `Esc` | 关闭弹窗 |

## 技术栈

- React 18 + Vite 5
- Tailwind CSS 3.4（stone/orange 暖色主题）
- Electron 41
- electron-updater（自动更新）
- Google Calendar API（OAuth 2.0 Desktop 流程）
