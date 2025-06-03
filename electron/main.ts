import { app, BrowserWindow, ipcMain, dialog, Tray, Menu, globalShortcut } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST
app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal')

let win: BrowserWindow | null
let tray = null
let winShowStatus = true;
function createWindow() {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    return;
  }
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'logo.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
    // 窗口宽度
    width: 1280,
    // 窗口高度
    height: 1080,
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })
  
  win.setMenu(null);

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
  
  // 监听点击关闭按钮
  win.on('close', (e) => {
    e.preventDefault();  // 阻止退出程序
    // win.setSkipTaskbar(true)   // 取消任务栏显示,这个设置了之后好像不能修改为false，这样就永远不再任务栏显示了
    win.hide();    // 隐藏主程序窗口
    winShowStatus = false;
  })
  
  // 创建任务栏图标
  tray = new Tray(path.join(process.env.VITE_PUBLIC, 'logo.ico'))
  // 自定义托盘图标的内容菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      // 点击退出菜单退出程序
      label: '退出', click: function () {
        console.log(123);
        win.destroy()
        app.quit()
      }
    }
  ])
  
  tray.setToolTip('代码片段管理工具-code snippets')  // 设置鼠标指针在托盘图标上悬停时显示的文本
  tray.setContextMenu(contextMenu)  // 设置图标的内容菜单
  
  // 点击托盘图标，显示主窗口
  tray.on("click", () => {
    win.show();
    winShowStatus = true;
  })
  // win.webContents.openDevTools()
}

// 添加文件对话框处理
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'JSON Files', extensions: ['json'] }
    ]
  })
  
  if (!canceled && filePaths.length > 0) {
    const content = await fs.readFile(filePaths[0], 'utf8')
    return content
  }
  
  return null
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('will-quit', () => {
  // 注销快捷键
  globalShortcut.unregister('Alt+-')
  
  // 注销所有快捷键
  globalShortcut.unregisterAll()
})

app.whenReady().then(() => {
  createWindow();
  // Register a 'CommandOrControl+X' shortcut listener.
  const ret = globalShortcut.register('Alt+-', () => {
    winShowStatus ? win.show() :  win.hide();
    winShowStatus = !winShowStatus;
  })
  
  if (!ret) {
    console.log('registration ALT+- failed')
  }
  
  // 检查快捷键是否注册成功
  console.log(globalShortcut.isRegistered('Alt+-'))
})
