import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { spawn } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { WebSocketServer, WebSocket } from 'ws'
import icon from '../../resources/icon.png?asset'

// Interface for clean cut arguments
interface CleanCutArgs {
  threshold: number
  minSilenceLen: number
  padding: number
  options?: {
    selectedAudioTracks?: number[]
    selectedRange?: 'entire' | 'inout' | 'selected'
  }
}

// WebSocket server variables
let premiereSocket: WebSocket | null = null
let mainWindow: BrowserWindow | null = null

// Store processing parameters for WebSocket workflow
let currentProcessingParams: CleanCutArgs | null = null

// Function to process audio file using Python script
async function processAudioFile(filePath: string, params: CleanCutArgs): Promise<number[][]> {
  const { threshold, minSilenceLen, padding } = params
  const scriptPath = join(__dirname, '../../python-backend/silence_detector.py')

  console.log('=== PYTHON EXECUTION ===')
  console.log('Script path:', scriptPath)
  console.log('File path:', filePath)
  console.log('Parameters:', params)

  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python', [
      scriptPath,
      filePath,
      threshold.toString(),
      minSilenceLen.toString(),
      padding.toString()
    ])

    let stdout = ''
    let stderr = ''

    pythonProcess.stdout.on('data', (data) => {
      const chunk = data.toString()
      console.log('Python stdout chunk:', chunk)
      stdout += chunk
    })

    pythonProcess.stderr.on('data', (data) => {
      const chunk = data.toString()
      console.log('Python stderr chunk:', chunk)
      stderr += chunk
    })

    pythonProcess.on('close', (code) => {
      console.log('Python process closed with code:', code)
      console.log('Full stdout:', stdout)
      console.log('Full stderr:', stderr)

      if (code === 0) {
        try {
          const timestamps = JSON.parse(stdout.trim())
          console.log('Parsed timestamps:', timestamps)
          console.log('Timestamps length:', timestamps.length)
          resolve(timestamps)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error('JSON parse error:', errorMessage)
          reject(new Error(`Failed to parse Python output: ${errorMessage}`))
        }
      } else {
        reject(new Error(`Python script failed with code ${code}: ${stderr}`))
      }
    })

    pythonProcess.on('error', (error) => {
      console.error('Failed to start Python process:', error.message)
      reject(new Error(`Failed to start Python process: ${error.message}`))
    })
  })
}

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 450,
    height: 900,
    minWidth: 450,
    minHeight: 600,
    maxWidth: 900,
    maxHeight: 900,
    show: false,
    autoHideMenuBar: true,
    icon: icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow!.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow!.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow!.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow!.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Force dock icon for development (macOS only)
  if (process.platform === 'darwin') {
    app.dock?.setIcon(icon)
  }

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

  // Handler for requesting sequence info from Premiere Pro
  ipcMain.handle('request-sequence-info', async () => {
    if (!premiereSocket) {
      throw new Error('Premiere Pro is not connected.')
    }

    // Send request to Premiere Pro to get sequence info
    premiereSocket.send(JSON.stringify({ type: 'request_sequence_info' }))
    console.log('Sent request_sequence_info to Premiere Pro')

    return { success: true, message: 'Sequence info request sent to Premiere Pro' }
  })

  // Handler for requesting selected clips info from Premiere Pro
  ipcMain.handle('request-selected-clips-info', async () => {
    if (!premiereSocket) {
      throw new Error('Premiere Pro is not connected.')
    }

    // Send request to Premiere Pro to get selected clips info
    premiereSocket.send(JSON.stringify({ type: 'request_selected_clips_info' }))
    console.log('Sent request_selected_clips_info to Premiere Pro')

    return { success: true, message: 'Selected clips info request sent to Premiere Pro' }
  })

  // Handler for running the clean-cut Python script (supports both file and Premiere Pro workflow)
  ipcMain.handle(
    'run-clean-cut',
    async (
      _,
      params: CleanCutArgs & {
        filePath: string
        options?: {
          selectedAudioTracks?: number[]
          selectedRange?: 'entire' | 'inout' | 'selected'
        }
      }
    ) => {
      const { filePath, threshold, minSilenceLen, padding, options } = params

      // If filePath is provided (file mode), process directly
      if (filePath && filePath.trim() !== '') {
        console.log('Processing file directly:', filePath)
        return processAudioFile(filePath, { threshold, minSilenceLen, padding })
      }

      // If no filePath (Premiere mode), use WebSocket workflow
      if (!premiereSocket) {
        throw new Error('Premiere Pro is not connected.')
      }

      // Store processing parameters for when audio path response comes back
      currentProcessingParams = { threshold, minSilenceLen, padding, options }
      console.log('Stored processing parameters for Premiere workflow:', currentProcessingParams)

      // Send request to Premiere Pro to get the audio path with processing options
      premiereSocket.send(
        JSON.stringify({
          type: 'request_audio_path',
          options: options || {}
        })
      )
      console.log('Sent request_audio_path to Premiere Pro with options:', options)

      // Return success - the actual processing will happen via WebSocket events
      return { success: true, message: 'Clean cut request sent to Premiere Pro' }
    }
  )

  // Create WebSocket server for Premiere Pro communication
  const wss = new WebSocketServer({ port: 8085 })

  wss.on('connection', (ws: WebSocket) => {
    console.log('Premiere Pro connected via WebSocket')
    premiereSocket = ws

    // Notify renderer process that Premiere is connected
    if (mainWindow) {
      mainWindow.webContents.send('premiere-status-update', { connected: true })
    }

    ws.on('message', async (message: Buffer) => {
      try {
        const messageString = message.toString()
        console.log('Received message from Premiere:', messageString)
        const parsedMessage = JSON.parse(messageString)

        switch (parsedMessage.type) {
          case 'sequence_info_response':
            // Forward sequence info to renderer process
            console.log('Received sequence info from Premiere:', parsedMessage.payload)
            if (mainWindow) {
              mainWindow.webContents.send('sequence-info-update', parsedMessage.payload)
            }
            break

          case 'selected_clips_info_response':
            // Forward selected clips info to renderer process
            console.log('Received selected clips info from Premiere:', parsedMessage.payload)
            if (mainWindow) {
              mainWindow.webContents.send('selected-clips-info-update', parsedMessage.payload)
            }
            break

          case 'audio_path_response':
            // Extract file path from the message payload
            const filePath = parsedMessage.payload
            console.log('Processing audio file:', filePath)

            try {
              // Use stored parameters from the IPC request
              if (!currentProcessingParams) {
                throw new Error('No processing parameters stored')
              }

              const { threshold, minSilenceLen, padding, options } = currentProcessingParams
              console.log('Using parameters:', currentProcessingParams)

              // Reuse the existing Python processing logic
              const scriptPath = join(__dirname, '../../python-backend/silence_detector.py')

              console.log('=== PYTHON EXECUTION FROM WEBSOCKET ===')
              console.log('Script path:', scriptPath)
              console.log('File path received:', filePath)

              const pythonProcess = spawn('python', [
                scriptPath,
                filePath,
                threshold.toString(),
                minSilenceLen.toString(),
                padding.toString()
              ])

              let stdout = ''
              let stderr = ''

              pythonProcess.stdout.on('data', (data) => {
                const chunk = data.toString()
                console.log('Python stdout chunk:', chunk)
                stdout += chunk
              })

              pythonProcess.stderr.on('data', (data) => {
                const chunk = data.toString()
                console.log('Python stderr chunk:', chunk)
                stderr += chunk
              })

              pythonProcess.on('close', (code) => {
                console.log('Python process closed with code:', code)
                console.log('Full stdout:', stdout)
                console.log('Full stderr:', stderr)

                if (code === 0) {
                  try {
                    // Parse the JSON output from stdout
                    const timestamps = JSON.parse(stdout.trim())
                    console.log('Parsed timestamps:', timestamps)
                    console.log('Timestamps length:', timestamps.length)

                    // Send timestamps back to Premiere
                    if (premiereSocket) {
                      premiereSocket.send(
                        JSON.stringify({
                          type: 'request_cuts',
                          payload: timestamps
                        })
                      )
                      console.log('Sent cut requests to Premiere')
                    }

                    // Clear stored parameters after successful processing
                    currentProcessingParams = null
                  } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error)
                    console.error('JSON parse error:', errorMessage)

                    // Send error back to Premiere
                    if (premiereSocket) {
                      premiereSocket.send(
                        JSON.stringify({
                          type: 'error',
                          payload: `Failed to parse Python output: ${errorMessage}`
                        })
                      )
                    }

                    // Clear stored parameters after error
                    currentProcessingParams = null
                  }
                } else {
                  console.error('Python script failed:', stderr)

                  // Send error back to Premiere
                  if (premiereSocket) {
                    premiereSocket.send(
                      JSON.stringify({
                        type: 'error',
                        payload: `Python script failed with code ${code}: ${stderr}`
                      })
                    )
                  }

                  // Clear stored parameters after error
                  currentProcessingParams = null
                }
              })

              pythonProcess.on('error', (error) => {
                console.error('Failed to start Python process:', error.message)

                // Send error back to Premiere
                if (premiereSocket) {
                  premiereSocket.send(
                    JSON.stringify({
                      type: 'error',
                      payload: `Failed to start Python process: ${error.message}`
                    })
                  )
                }

                // Clear stored parameters after error
                currentProcessingParams = null
              })
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error)
              console.error('Error processing audio file:', errorMessage)

              // Send error back to Premiere
              if (premiereSocket) {
                premiereSocket.send(
                  JSON.stringify({
                    type: 'error',
                    payload: `Error processing audio file: ${errorMessage}`
                  })
                )
              }

              // Clear stored parameters after error
              currentProcessingParams = null
            }
            break

          default:
            console.log('Unknown message type:', parsedMessage.type)
            break
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('Error parsing WebSocket message:', errorMessage)
      }
    })

    ws.on('close', () => {
      console.log('Premiere Pro disconnected from WebSocket')
      premiereSocket = null

      // Notify renderer process that Premiere is disconnected
      if (mainWindow) {
        mainWindow.webContents.send('premiere-status-update', { connected: false })
      }
    })

    ws.on('error', (error) => {
      console.error('WebSocket error:', error)
    })
  })

  wss.on('error', (error) => {
    console.error('WebSocket server error:', error)
  })

  console.log('WebSocket server started on port 8085')

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
