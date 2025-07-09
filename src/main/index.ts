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

// Store pending export requests
const pendingExportRequests = new Map<string, (result: any) => void>()

// Helper function to safely send messages to renderer
function safelyNotifyRenderer(channel: string, data: any) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send(channel, data)
    } catch (error) {
      console.error(`Failed to send message to renderer on channel ${channel}:`, error)
    }
  }
}

// Function to process audio file using VAD-based Python script
async function processAudioFile(filePath: string, params: CleanCutArgs): Promise<number[][]> {
  const { threshold, minSilenceLen, padding } = params
  const scriptPath = join(__dirname, '../../python-backend/vad_cutter.py')

  console.log('=== PYTHON EXECUTION (VAD-Based Approach) ===')
  console.log('Script path:', scriptPath)
  console.log('File path:', filePath)
  console.log('Parameters:', params)

  return new Promise((resolve, reject) => {
    // Use Python from virtual environment
    const pythonPath = join(__dirname, '../../python-backend/.venv/bin/python')
    const pythonProcess = spawn(pythonPath, [
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

  // Cleanup when window is closed
  mainWindow!.on('closed', () => {
    mainWindow = null
    // Close WebSocket connection if it exists
    if (premiereSocket) {
      premiereSocket.close()
      premiereSocket = null
    }
    // Clear any pending processing parameters
    currentProcessingParams = null
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
    try {
      premiereSocket.send(JSON.stringify({ type: 'request_sequence_info' }))
    } catch (error) {
      console.error('Failed to send sequence info request to Premiere Pro:', error)
      throw new Error('Failed to communicate with Premiere Pro')
    }
    console.log('Sent request_sequence_info to Premiere Pro')

    return { success: true, message: 'Sequence info request sent to Premiere Pro' }
  })

  // Handler for requesting selected clips info from Premiere Pro
  ipcMain.handle('request-selected-clips-info', async () => {
    if (!premiereSocket) {
      throw new Error('Premiere Pro is not connected.')
    }

    // Send request to Premiere Pro to get selected clips info
    try {
      premiereSocket.send(JSON.stringify({ type: 'request_selected_clips_info' }))
    } catch (error) {
      console.error('Failed to send selected clips info request to Premiere Pro:', error)
      throw new Error('Failed to communicate with Premiere Pro')
    }
    console.log('Sent request_selected_clips_info to Premiere Pro')

    return { success: true, message: 'Selected clips info request sent to Premiere Pro' }
  })

  // Handler for exporting audio from Premiere Pro (used by AudioAnalysisButton)
  ipcMain.handle(
    'export-audio',
    async (
      _,
      params: {
        exportFolder: string
        options: {
          selectedAudioTracks: number[]
          selectedRange: 'entire' | 'inout' | 'selected'
        }
      }
    ) => {
      if (!premiereSocket) {
        throw new Error('Premiere Pro is not connected.')
      }

      const { exportFolder, options } = params

      // Create a unique request ID for this export
      const requestId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Create a Promise that will be resolved when the WebSocket response arrives
      return new Promise((resolve, reject) => {
        // Store the resolver function
        pendingExportRequests.set(requestId, resolve)

        // Set a timeout to prevent hanging forever
        const timeout = setTimeout(() => {
          pendingExportRequests.delete(requestId)
          reject(new Error('Audio export timeout - no response from Premiere Pro after 30 seconds'))
        }, 30000)

        // Store the timeout with the request so we can clear it
        const originalResolve = resolve
        pendingExportRequests.set(requestId, (result: any) => {
          clearTimeout(timeout)
          pendingExportRequests.delete(requestId)
          originalResolve(result)
        })

        // Send export request to Premiere Pro
        if (!premiereSocket) {
          clearTimeout(timeout)
          pendingExportRequests.delete(requestId)
          reject(new Error('Premiere Pro connection lost during export request'))
          return
        }

        premiereSocket.send(
          JSON.stringify({
            type: 'request_audio_export',
            payload: {
              exportFolder,
              selectedTracks: options.selectedAudioTracks,
              selectedRange: options.selectedRange,
              requestId // Include request ID so we can match the response
            }
          })
        )
        console.log(
          'Sent request_audio_export to Premiere Pro with params:',
          params,
          'requestId:',
          requestId
        )
      })
    }
  )

  // Handler for analyzing audio with VAD (Voice Activity Detection)
  ipcMain.handle('analyze-audio', async (_, filePath: string) => {
    try {
      const pythonPath = join(__dirname, '../../python-backend/.venv/bin/python')
      const scriptPath = join(__dirname, '../../python-backend/vad_analyzer.py')

      console.log('=== VAD AUDIO ANALYSIS ===')
      console.log('Script path:', scriptPath)
      console.log('File path:', filePath)

      return new Promise((resolve, reject) => {
        const pythonProcess = spawn(pythonPath, [scriptPath, filePath])

        let stdout = ''
        let stderr = ''

        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString()
        })

        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString()
        })

        pythonProcess.on('close', (code) => {
          console.log('Audio analysis process closed with code:', code)

          if (code === 0) {
            try {
              // Extract JSON from stdout (between JSON_OUTPUT_START and JSON_OUTPUT_END)
              const startMarker = 'JSON_OUTPUT_START'
              const endMarker = 'JSON_OUTPUT_END'
              const startIndex = stdout.indexOf(startMarker)
              const endIndex = stdout.indexOf(endMarker)

              if (startIndex !== -1 && endIndex !== -1) {
                const jsonData = stdout.substring(startIndex + startMarker.length, endIndex).trim()
                const analysisData = JSON.parse(jsonData)
                console.log('Audio analysis completed successfully')
                resolve({ success: true, data: analysisData })
              } else {
                throw new Error('Could not find JSON output markers in analysis result')
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error)
              console.error('Failed to parse analysis output:', errorMessage)
              reject(new Error(`Failed to parse analysis output: ${errorMessage}`))
            }
          } else {
            console.error('Audio analysis failed:', stderr)
            reject(new Error(`Audio analysis failed: ${stderr}`))
          }
        })

        pythonProcess.on('error', (error) => {
          console.error('Failed to start audio analysis process:', error.message)
          reject(new Error(`Failed to start audio analysis process: ${error.message}`))
        })
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('Audio analysis error:', errorMessage)
      return { success: false, error: errorMessage }
    }
  })

  // Handler for processing silences in an audio file
  ipcMain.handle(
    'process-silences',
    async (
      _,
      params: {
        filePath: string
        silenceThreshold: number
        minSilenceLen: number
        padding: number
      }
    ) => {
      const { filePath, silenceThreshold, minSilenceLen, padding } = params

      try {
        console.log('=== PROCESSING SILENCES ===')
        console.log('File path:', filePath)
        console.log('Parameters:', params)

        // Process the audio file using the existing function
        const silenceRanges = await processAudioFile(filePath, {
          threshold: silenceThreshold,
          minSilenceLen,
          padding
        })

        // Convert to cut format expected by Premiere
        const cutCommands = silenceRanges.map((range: number[]) => ({
          start: range[0],
          end: range[1]
        }))

        // Send cut commands to Premiere
        if (premiereSocket) {
          premiereSocket.send(
            JSON.stringify({
              type: 'request_cuts',
              payload: cutCommands
            })
          )
          console.log('Sent cut requests to Premiere:', cutCommands)
        }

        return {
          success: true,
          message: `Found ${silenceRanges.length} silence ranges. Cuts sent to Premiere Pro.`,
          silenceCount: silenceRanges.length
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('Silence processing error:', errorMessage)
        return { success: false, error: errorMessage }
      }
    }
  )

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
      try {
        premiereSocket.send(
          JSON.stringify({
            type: 'request_audio_path',
            options: options || {}
          })
        )
      } catch (error) {
        console.error('Failed to send message to Premiere Pro:', error)
        throw new Error('Failed to communicate with Premiere Pro')
      }
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
    safelyNotifyRenderer('premiere-status-update', { connected: true })

    ws.on('message', async (message: Buffer) => {
      try {
        const messageString = message.toString()
        console.log('Received message from Premiere:', messageString)
        const parsedMessage = JSON.parse(messageString)

        switch (parsedMessage.type) {
          case 'handshake':
            // Handle initial handshake from Premiere Pro extension
            console.log('Received handshake from Premiere Pro:', parsedMessage.payload)
            // Send handshake acknowledgment back
            if (premiereSocket) {
              try {
                premiereSocket.send(
                  JSON.stringify({
                    type: 'handshake_ack',
                    payload: 'clean-cut-app'
                  })
                )
                console.log('Sent handshake acknowledgment to Premiere Pro')
              } catch (error) {
                console.error('Failed to send handshake acknowledgment:', error)
              }
            }
            break

          case 'sequence_info_response':
            // Forward sequence info to renderer process
            console.log('Received sequence info from Premiere:', parsedMessage.payload)
            safelyNotifyRenderer('sequence-info-update', parsedMessage.payload)
            break

          case 'selected_clips_info_response':
            // Forward selected clips info to renderer process
            console.log('Received selected clips info from Premiere:', parsedMessage.payload)
            safelyNotifyRenderer('selected-clips-info-update', parsedMessage.payload)
            break

          case 'audio_export_response':
            // Handle audio export result and resolve pending export request
            console.log('Received audio export result from Premiere:', parsedMessage.payload)

            // Try to parse the payload if it's a string
            let exportResult = parsedMessage.payload
            if (typeof exportResult === 'string') {
              try {
                exportResult = JSON.parse(exportResult)
              } catch (e) {
                console.error('Failed to parse audio export response payload:', e)
              }
            }

            // Look for a pending request that matches this response
            // Since we don't have the requestId in the response yet, resolve the first pending request
            // TODO: Update Premiere Pro extension to include requestId in response for better matching
            const pendingRequestIds = Array.from(pendingExportRequests.keys())
            if (pendingRequestIds.length > 0) {
              const requestId = pendingRequestIds[0] // Take the first pending request
              const resolver = pendingExportRequests.get(requestId)
              if (resolver) {
                console.log('Resolving export request:', requestId, 'with result:', exportResult)
                resolver(exportResult)
              }
            } else {
              console.log('No pending export requests to resolve')
              // Still forward to renderer for any other listeners
              safelyNotifyRenderer('audio-export-result', exportResult)
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

              const { threshold, minSilenceLen, padding } = currentProcessingParams
              console.log('Using parameters:', currentProcessingParams)

              // Reuse the existing Python processing logic with VAD
              const scriptPath = join(__dirname, '../../python-backend/vad_cutter.py')

              console.log('=== PYTHON EXECUTION FROM WEBSOCKET (VAD-Based) ===')
              console.log('Script path:', scriptPath)
              console.log('File path received:', filePath)

              const pythonPath = join(__dirname, '../../python-backend/.venv/bin/python')
              const pythonProcess = spawn(pythonPath, [
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

          case 'cuts_response':
            // Handle response from Premiere Pro after cutting operations
            console.log('Received cuts response from Premiere:', parsedMessage.payload)
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
      safelyNotifyRenderer('premiere-status-update', { connected: false })
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
