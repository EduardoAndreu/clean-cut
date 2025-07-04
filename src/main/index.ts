import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { spawn } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Handler for file dialog
  ipcMain.handle('show-open-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Audio Files', extensions: ['wav', 'mp3', 'flac', 'aac', 'm4a', 'ogg'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled) {
      return null
    }

    return {
      filePath: result.filePaths[0],
      fileName: result.filePaths[0].split('/').pop() || result.filePaths[0]
    }
  })

  // Handler for running the clean-cut Python script
  ipcMain.handle(
    'run-clean-cut',
    async (_, filePath: string, threshold: number, minSilenceLen: number, padding: number) => {
      return new Promise((resolve, reject) => {
        // Path to the Python script
        const scriptPath = join(__dirname, '../../python-backend/silence_detector.py')

        // Remove temporary fix - now using proper file paths from dialog

        // Log the exact command being executed
        console.log('=== PYTHON EXECUTION DEBUG ===')
        console.log('Script path:', scriptPath)
        console.log('File path received:', filePath)
        console.log('Working directory:', process.cwd())
        console.log(
          'Full command:',
          `python ${scriptPath} ${filePath} ${threshold} ${minSilenceLen} ${padding}`
        )

        // Spawn the Python process with arguments
        const pythonProcess = spawn('python', [
          scriptPath,
          filePath,
          threshold.toString(),
          minSilenceLen.toString(),
          padding.toString()
        ])

        let stdout = ''
        let stderr = ''

        // Listen for stdout data
        pythonProcess.stdout.on('data', (data) => {
          const chunk = data.toString()
          console.log('Python stdout chunk:', chunk)
          stdout += chunk
        })

        // Listen for stderr data
        pythonProcess.stderr.on('data', (data) => {
          const chunk = data.toString()
          console.log('Python stderr chunk:', chunk)
          stderr += chunk
        })

        // Listen for process close
        pythonProcess.on('close', (code) => {
          console.log('Python process closed with code:', code)
          console.log('Full stdout:', stdout)
          console.log('Full stderr:', stderr)

          if (code === 0) {
            try {
              // Parse the JSON output from stdout
              const result = JSON.parse(stdout.trim())
              console.log('Parsed result:', result)
              console.log('Result length:', result.length)
              resolve(result)
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error)
              console.error('JSON parse error:', errorMessage)
              reject(new Error(`Failed to parse JSON output: ${errorMessage}`))
            }
          } else {
            console.error('Python script failed:', stderr)
            reject(new Error(`Python script failed with code ${code}: ${stderr}`))
          }
        })

        // Handle process errors
        pythonProcess.on('error', (error) => {
          reject(new Error(`Failed to start Python process: ${error.message}`))
        })
      })
    }
  )

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
