import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { WebSocketServer, WebSocket } from 'ws'
import icon from '../../build/icon.png?asset'
import { PYTHON_BACKEND_PATHS, WEBSOCKET_CONFIG } from '../shared/config'
import {
  createTempDirectoryPath,
  ensureTempDirectory,
  trackExportedFilesInDirectory,
  cleanupTempDirectory,
  cleanupTempDirectoryContaining,
  cleanupAllTempFiles,
  scanAndTrackPresetFiles
} from './temp-file-utils'

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

// Interface for silence segment data
interface SilenceSegment {
  id: string
  start: number
  end: number
  duration: number
  trackIndices: number[]
  originalRange: [number, number]
  processed: boolean
  deleted: boolean
}

// Interface for silence processing session
interface SilenceSession {
  id: string
  timestamp: number
  segments: SilenceSegment[]
  processingParams: CleanCutArgs
  timeOffsetSeconds?: number // Store the time offset for management operations
  selectedRange?: string // Store the selected range type
  sequenceInfo?: any
}

// WebSocket server variables
let premiereSocket: WebSocket | null = null
let mainWindow: BrowserWindow | null = null

// Store pending export requests
const pendingExportRequests = new Map<string, (result: any) => void>()

// Store silence sessions for later reuse
let currentSilenceSession: SilenceSession | null = null
const silenceSessionHistory = new Map<string, SilenceSession>()

// Store frame decimation state
interface FrameDecimationState {
  isProcessing: boolean
  inputPath: string
  outputPath: string
  progress: number
  current: number
  total: number
  startTime: number
  queue?: any[] // Store the queue items
  currentProcessingId?: string | null
  outputFolder?: string
}

let frameDecimationState: FrameDecimationState | null = null

// Queue state management
interface QueueItem {
  id: string
  inputPath: string
  outputPath: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress?: number
  stats?: any
  error?: string
}

let frameDecimationQueue: QueueItem[] = []
let currentProcessingId: string | null = null

// Queue persistence file path
const getQueueFilePath = () => {
  const tempDir = join(app.getAppPath(), '.temp')
  // Ensure .temp directory exists
  fs.mkdir(tempDir, { recursive: true }).catch(() => {})
  return join(tempDir, 'frame-decimation-queue.json')
}

// Save queue to file
const saveQueueToFile = async () => {
  try {
    const queuePath = getQueueFilePath()
    await fs.writeFile(queuePath, JSON.stringify(frameDecimationQueue, null, 2))
  } catch (error) {
    console.error('Failed to save queue to file:', error)
  }
}

// Load queue from file
const loadQueueFromFile = async () => {
  try {
    const queuePath = getQueueFilePath()
    const data = await fs.readFile(queuePath, 'utf-8')
    frameDecimationQueue = JSON.parse(data)
    return frameDecimationQueue
  } catch (error) {
    // File doesn't exist or is invalid, start with empty queue
    frameDecimationQueue = []
    return []
  }
}

// Update queue item
const updateQueueItem = (id: string, updates: Partial<QueueItem>) => {
  frameDecimationQueue = frameDecimationQueue.map((item) =>
    item.id === id ? { ...item, ...updates } : item
  )
  saveQueueToFile()
  // Notify renderer of queue update
  safelyNotifyRenderer('frame-decimation-queue-updated', frameDecimationQueue)
}

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

// Helper function to create silence session
function createSilenceSession(
  silenceRanges: number[][],
  params: CleanCutArgs,
  timeOffsetSeconds?: number,
  selectedRange?: string
): SilenceSession {
  const sessionId = `silence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const segments: SilenceSegment[] = silenceRanges.map((range, index) => ({
    id: `segment_${sessionId}_${index}`,
    start: range[0],
    end: range[1],
    duration: range[1] - range[0],
    trackIndices: params.options?.selectedAudioTracks || [],
    originalRange: [range[0], range[1]] as [number, number],
    processed: false,
    deleted: false
  }))

  const session: SilenceSession = {
    id: sessionId,
    timestamp: Date.now(),
    segments,
    processingParams: params,
    timeOffsetSeconds: timeOffsetSeconds || 0,
    selectedRange: selectedRange || 'entire',
    sequenceInfo: null
  }

  return session
}

// Helper function to get silence segments that can be deleted
function getDeletableSilenceSegments(sessionId?: string): SilenceSegment[] {
  const session = sessionId ? silenceSessionHistory.get(sessionId) : currentSilenceSession
  if (!session) return []

  return session.segments.filter((segment) => segment.processed && !segment.deleted)
}

// Helper function to mark segments as deleted
function markSegmentsAsDeleted(sessionId: string, segmentIds: string[]): void {
  const session =
    sessionId === 'current' ? currentSilenceSession : silenceSessionHistory.get(sessionId)
  if (!session) return

  session.segments.forEach((segment) => {
    if (segmentIds.includes(segment.id)) {
      segment.deleted = true
    }
  })
}

// Function to process audio file using VAD-based Python script
async function processAudioFile(filePath: string, params: CleanCutArgs): Promise<number[][]> {
  const { threshold, minSilenceLen, padding } = params
  const scriptPath = join(__dirname, PYTHON_BACKEND_PATHS.VAD_CUTTER)

  console.log('🐍 Starting Python VAD processing')

  return new Promise((resolve, reject) => {
    // Use Python from virtual environment
    const pythonPath = join(__dirname, PYTHON_BACKEND_PATHS.PYTHON_EXECUTABLE)
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
      stdout += data.toString()
    })

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const timestamps = JSON.parse(stdout.trim())
          console.log(`✅ VAD processing completed: ${timestamps.length} silence regions found`)
          resolve(timestamps)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error('❌ Failed to parse Python output:', errorMessage)
          reject(new Error(`Failed to parse Python output: ${errorMessage}`))
        }
      } else {
        console.error('❌ Python VAD processing failed:', stderr)
        reject(new Error(`Python script failed with code ${code}: ${stderr}`))
      }
    })

    pythonProcess.on('error', (error) => {
      console.error('❌ Failed to start Python process:', error.message)
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
    title: 'Clean-Cut',
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

  // Dialog handlers
  ipcMain.handle('dialog:showOpenDialog', async (_, options) => {
    const result = await dialog.showOpenDialog(mainWindow!, options)
    return result
  })

  ipcMain.handle('dialog:showSaveDialog', async (_, options) => {
    const result = await dialog.showSaveDialog(mainWindow!, options)
    return result
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
      console.error('❌ Failed to send sequence info request:', error)
      throw new Error('Failed to communicate with Premiere Pro')
    }

    return { success: true, message: 'Sequence info request sent to Premiere Pro' }
  })

  // Handler for exporting audio from Premiere Pro (used by AudioAnalysisButton)
  ipcMain.handle(
    'export-audio',
    async (
      _,
      options: {
        selectedAudioTracks: number[]
        selectedRange: 'entire' | 'inout' | 'selected'
      }
    ) => {
      if (!premiereSocket) {
        throw new Error('Premiere Pro is not connected.')
      }

      // Generate temporary directory path for export
      const tempExportDir = createTempDirectoryPath()

      try {
        // Ensure the temporary directory exists
        await ensureTempDirectory(tempExportDir)

        // Create a unique request ID for this export
        const requestId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        // Create a Promise that will be resolved when the WebSocket response arrives
        const result = await new Promise((resolve, reject) => {
          // Store the resolver function
          pendingExportRequests.set(requestId, resolve)

          // Set a timeout to prevent hanging forever
          const timeout = setTimeout(() => {
            pendingExportRequests.delete(requestId)
            reject(
              new Error('Audio export timeout - no response from Premiere Pro after 30 seconds')
            )
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
                exportFolder: tempExportDir,
                selectedTracks: options.selectedAudioTracks,
                selectedRange: options.selectedRange,
                requestId // Include request ID so we can match the response
              }
            })
          )
          console.log('📤 Sent audio export request to Premiere Pro')
        })

        // After successful export, track any files created in the directory
        await trackExportedFilesInDirectory(tempExportDir)

        // Also scan for and track any preset files that might have been created
        await scanAndTrackPresetFiles()

        return result
      } catch (error) {
        // Clean up the directory if export failed
        await cleanupTempDirectory(tempExportDir)
        throw error
      }
    }
  )

  // Handler for analyzing audio with VAD (Voice Activity Detection)
  ipcMain.handle('analyze-audio', async (_, filePath: string) => {
    try {
      const pythonPath = join(__dirname, PYTHON_BACKEND_PATHS.PYTHON_EXECUTABLE)
      const scriptPath = join(__dirname, PYTHON_BACKEND_PATHS.VAD_ANALYZER)

      console.log('🔍 Starting audio analysis')

      const result = await new Promise((resolve, reject) => {
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
                console.log('✅ Audio analysis completed')
                resolve({ success: true, data: analysisData })
              } else {
                throw new Error('Could not find JSON output markers in analysis result')
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error)
              console.error('❌ Failed to parse analysis output:', errorMessage)
              reject(new Error(`Failed to parse analysis output: ${errorMessage}`))
            }
          } else {
            console.error('❌ Audio analysis failed:', stderr)
            reject(new Error(`Audio analysis failed: ${stderr}`))
          }
        })

        pythonProcess.on('error', (error) => {
          console.error('❌ Failed to start audio analysis process:', error.message)
          reject(new Error(`Failed to start audio analysis process: ${error.message}`))
        })
      })

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('❌ Audio analysis error:', errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      // Clean up the temporary directory containing the exported file
      await cleanupTempDirectoryContaining(filePath)
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
        options?: {
          selectedAudioTracks?: number[]
          selectedRange?: 'entire' | 'inout' | 'selected'
        }
        exportMetadata?: {
          timeOffsetSeconds?: number
          selectedRange?: string
        }
      }
    ) => {
      const { filePath, silenceThreshold, minSilenceLen, padding, options, exportMetadata } = params

      try {
        console.log('🔄 Processing silences')

        // Process the audio file using the existing function
        const silenceRanges = await processAudioFile(filePath, {
          threshold: silenceThreshold,
          minSilenceLen,
          padding,
          options
        })

        // Create silence session to store the data
        const silenceSession = createSilenceSession(
          silenceRanges,
          {
            threshold: silenceThreshold,
            minSilenceLen,
            padding,
            options
          },
          exportMetadata?.timeOffsetSeconds,
          exportMetadata?.selectedRange
        )

        // Store the session
        currentSilenceSession = silenceSession
        silenceSessionHistory.set(silenceSession.id, silenceSession)

        console.log(`📝 Created silence session: ${silenceSession.segments.length} segments`)

        // Get the time offset from export metadata (defaults to 0 for 'entire' timeline)
        const timeOffsetSeconds = exportMetadata?.timeOffsetSeconds || 0

        if (timeOffsetSeconds > 0) {
          console.log(
            `📍 Applying time offset: ${timeOffsetSeconds}s for ${exportMetadata?.selectedRange || 'unknown'} range`
          )
        }

        // Convert to cut format expected by Premiere, applying offset
        const cutCommands = silenceRanges.map((range: number[]) => ({
          start: range[0] + timeOffsetSeconds,
          end: range[1] + timeOffsetSeconds
        }))

        // Send cut commands to Premiere
        if (premiereSocket) {
          premiereSocket.send(
            JSON.stringify({
              type: 'request_cuts',
              payload: cutCommands,
              sessionId: silenceSession.id
            })
          )
          console.log('📤 Sent cut requests to Premiere Pro')
        }

        return {
          success: true,
          message: `Found ${silenceRanges.length} silence ranges. Cuts sent to Premiere Pro.`,
          silenceCount: silenceRanges.length,
          sessionId: silenceSession.id,
          segments: silenceSession.segments
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('❌ Silence processing error:', errorMessage)
        return { success: false, error: errorMessage }
      } finally {
        // Clean up the temporary directory containing the exported file
        await cleanupTempDirectoryContaining(filePath)
      }
    }
  )

  // Handler for getting current silence session info
  ipcMain.handle('get-silence-session', async (_, sessionId?: string) => {
    const session = sessionId ? silenceSessionHistory.get(sessionId) : currentSilenceSession

    if (!session) {
      return { success: false, error: 'No silence session found' }
    }

    return {
      success: true,
      session: {
        id: session.id,
        timestamp: session.timestamp,
        segments: session.segments,
        processingParams: session.processingParams,
        totalSegments: session.segments.length,
        deletableSegments: getDeletableSilenceSegments(session.id).length
      }
    }
  })

  // Handler for deleting silence segments
  ipcMain.handle(
    'delete-silence-segments',
    async (_, sessionId?: string, segmentIds?: string[]) => {
      if (!premiereSocket) {
        throw new Error('Premiere Pro is not connected.')
      }

      const targetSessionId = sessionId || currentSilenceSession?.id
      if (!targetSessionId) {
        throw new Error('No active silence session found.')
      }

      const session = sessionId ? silenceSessionHistory.get(sessionId) : currentSilenceSession
      if (!session) {
        throw new Error('Silence session not found.')
      }

      // Get deletable segments (processed but not deleted)
      const deletableSegments = getDeletableSilenceSegments(targetSessionId)

      // If no specific segment IDs provided, delete all deletable segments
      const segmentsToDelete = segmentIds
        ? deletableSegments.filter((segment) => segmentIds.includes(segment.id))
        : deletableSegments

      if (segmentsToDelete.length === 0) {
        throw new Error('No deletable silence segments found.')
      }

      // Send delete request to Premiere Pro
      const deleteCommands = segmentsToDelete.map((segment) => ({
        start: segment.start + (session.timeOffsetSeconds || 0),
        end: segment.end + (session.timeOffsetSeconds || 0),
        id: segment.id
      }))

      premiereSocket.send(
        JSON.stringify({
          type: 'request_delete_silences',
          payload: deleteCommands,
          sessionId: targetSessionId
        })
      )

      console.log(`🗑️ Sent ${deleteCommands.length} delete requests to Premiere Pro`)

      // Mark segments as deleted
      markSegmentsAsDeleted(
        targetSessionId,
        segmentsToDelete.map((s) => s.id)
      )

      return {
        success: true,
        message: `Deletion request sent for ${segmentsToDelete.length} silence segments.`,
        deletedSegments: segmentsToDelete.length,
        sessionId: targetSessionId
      }
    }
  )

  // Handler for removing silence segments with gaps
  ipcMain.handle(
    'remove-silence-segments-with-gaps',
    async (_, sessionId?: string, segmentIds?: string[]) => {
      if (!premiereSocket) {
        throw new Error('Premiere Pro is not connected.')
      }

      const targetSessionId = sessionId || currentSilenceSession?.id
      if (!targetSessionId) {
        throw new Error('No active silence session found.')
      }

      const session = sessionId ? silenceSessionHistory.get(sessionId) : currentSilenceSession
      if (!session) {
        throw new Error('Silence session not found.')
      }

      // Get deletable segments (processed but not deleted)
      const removableSegments = getDeletableSilenceSegments(targetSessionId)

      // If no specific segment IDs provided, remove all removable segments
      const segmentsToRemove = segmentIds
        ? removableSegments.filter((segment) => segmentIds.includes(segment.id))
        : removableSegments

      if (segmentsToRemove.length === 0) {
        throw new Error('No removable silence segments found.')
      }

      // Send remove with gaps request to Premiere Pro
      const removeCommands = segmentsToRemove.map((segment) => ({
        start: segment.start + (session.timeOffsetSeconds || 0),
        end: segment.end + (session.timeOffsetSeconds || 0),
        id: segment.id
      }))

      premiereSocket.send(
        JSON.stringify({
          type: 'request_remove_silences_with_gaps',
          payload: removeCommands,
          sessionId: targetSessionId
        })
      )

      console.log(`🕳️ Sent ${removeCommands.length} remove with gaps requests to Premiere Pro`)

      // Mark segments as processed (removed)
      markSegmentsAsDeleted(
        targetSessionId,
        segmentsToRemove.map((s) => s.id)
      )

      return {
        success: true,
        message: `Remove with gaps request sent for ${segmentsToRemove.length} silence segments.`,
        removedSegments: segmentsToRemove.length,
        sessionId: targetSessionId
      }
    }
  )

  // Handler for muting silence segments
  ipcMain.handle('mute-silence-segments', async (_, sessionId?: string, segmentIds?: string[]) => {
    if (!premiereSocket) {
      throw new Error('Premiere Pro is not connected.')
    }

    const targetSessionId = sessionId || currentSilenceSession?.id
    if (!targetSessionId) {
      throw new Error('No active silence session found.')
    }

    const session = sessionId ? silenceSessionHistory.get(sessionId) : currentSilenceSession
    if (!session) {
      throw new Error('Silence session not found.')
    }

    // Get deletable segments (processed but not deleted)
    const mutableSegments = getDeletableSilenceSegments(targetSessionId)

    // If no specific segment IDs provided, mute all mutable segments
    const segmentsToMute = segmentIds
      ? mutableSegments.filter((segment) => segmentIds.includes(segment.id))
      : mutableSegments

    if (segmentsToMute.length === 0) {
      throw new Error('No mutable silence segments found.')
    }

    // Send mute request to Premiere Pro
    const muteCommands = segmentsToMute.map((segment) => ({
      start: segment.start + (session.timeOffsetSeconds || 0),
      end: segment.end + (session.timeOffsetSeconds || 0),
      id: segment.id
    }))

    premiereSocket.send(
      JSON.stringify({
        type: 'request_mute_silences',
        payload: muteCommands,
        sessionId: targetSessionId
      })
    )

    console.log(`🔇 Sent ${muteCommands.length} mute requests to Premiere Pro`)

    // Mark segments as processed (muted)
    markSegmentsAsDeleted(
      targetSessionId,
      segmentsToMute.map((s) => s.id)
    )

    return {
      success: true,
      message: `Mute request sent for ${segmentsToMute.length} silence segments.`,
      mutedSegments: segmentsToMute.length,
      sessionId: targetSessionId
    }
  })

  // Handler for clearing silence sessions
  ipcMain.handle('clear-silence-sessions', async () => {
    currentSilenceSession = null
    silenceSessionHistory.clear()

    return {
      success: true,
      message: 'All silence sessions cleared.'
    }
  })

  // Handler for processing frame decimation
  ipcMain.handle(
    'process-frame-decimation',
    async (
      _,
      { inputPath, outputPath, queue, currentProcessingId: processingId, outputFolder }
    ) => {
      try {
        const pythonPath = join(__dirname, PYTHON_BACKEND_PATHS.PYTHON_EXECUTABLE)
        const scriptPath = join(__dirname, PYTHON_BACKEND_PATHS.FRAME_DECIMATOR)

        console.log('🎬 Starting frame decimation processing')

        // Set current processing ID in main process
        currentProcessingId = processingId || null

        // Update queue item status to processing
        if (currentProcessingId) {
          updateQueueItem(currentProcessingId, { status: 'processing' })
        }

        // Initialize frame decimation state
        frameDecimationState = {
          isProcessing: true,
          inputPath,
          outputPath,
          progress: 0,
          current: 0,
          total: 0,
          startTime: Date.now(),
          queue,
          currentProcessingId: processingId,
          outputFolder
        }

        return new Promise((resolve, reject) => {
          const pythonProcess = spawn(pythonPath, [scriptPath, inputPath, outputPath])

          let stdout = ''
          let stderr = ''

          pythonProcess.stdout.on('data', (data) => {
            const output = data.toString()
            stdout += output

            // Try to parse each line as JSON for progress updates
            const lines = output.split('\n').filter((line) => line.trim())
            for (const line of lines) {
              try {
                const parsed = JSON.parse(line)
                if (parsed.type === 'progress') {
                  console.log('📊 Progress update:', parsed)

                  // Update frame decimation state
                  if (frameDecimationState) {
                    frameDecimationState.current = parsed.current
                    frameDecimationState.total = parsed.total
                    frameDecimationState.progress = parsed.percentage || 0
                  }

                  // Update queue item progress if processing from queue
                  if (currentProcessingId) {
                    updateQueueItem(currentProcessingId, { progress: parsed.percentage || 0 })
                  }

                  // Notify renderer of progress with percentage
                  safelyNotifyRenderer('frame-decimation-progress', {
                    current: parsed.current,
                    total: parsed.total,
                    percentage: parsed.percentage || 0,
                    timeElapsed: parsed.time_elapsed,
                    duration: parsed.duration
                  })
                }
              } catch {
                // Not JSON, ignore
              }
            }
          })

          pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString()
          })

          pythonProcess.on('close', (code) => {
            if (code === 0) {
              try {
                // Find the final result JSON
                const lines = stdout.split('\n').filter((line) => line.trim())
                const resultLine = lines[lines.length - 1]
                const result = JSON.parse(resultLine)

                console.log('✅ Frame decimation completed')

                // Update queue item status to completed
                if (currentProcessingId) {
                  updateQueueItem(currentProcessingId, {
                    status: 'completed',
                    stats: result.stats
                  })
                }

                frameDecimationState = null // Clear state on completion
                currentProcessingId = null
                resolve(result)
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error)
                console.error('❌ Failed to parse frame decimation output:', errorMessage)

                // Update queue item status to error
                if (currentProcessingId) {
                  updateQueueItem(currentProcessingId, {
                    status: 'error',
                    error: `Failed to parse output: ${errorMessage}`
                  })
                }

                frameDecimationState = null // Clear state on error
                currentProcessingId = null
                reject(new Error(`Failed to parse output: ${errorMessage}`))
              }
            } else {
              console.error('❌ Frame decimation failed:', stderr)

              // Update queue item status to error
              if (currentProcessingId) {
                updateQueueItem(currentProcessingId, {
                  status: 'error',
                  error: `Frame decimation failed: ${stderr}`
                })
              }

              frameDecimationState = null // Clear state on error
              currentProcessingId = null
              reject(new Error(`Frame decimation failed: ${stderr}`))
            }
          })

          pythonProcess.on('error', (error) => {
            console.error('❌ Failed to start frame decimation process:', error.message)
            reject(new Error(`Failed to start process: ${error.message}`))
          })
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('❌ Frame decimation error:', errorMessage)
        throw new Error(errorMessage)
      }
    }
  )

  // Handler to check frame decimation status
  ipcMain.handle('get-frame-decimation-status', async () => {
    if (!frameDecimationState) {
      return { isProcessing: false }
    }

    const elapsedTime = Math.floor((Date.now() - frameDecimationState.startTime) / 1000)

    return {
      isProcessing: frameDecimationState.isProcessing,
      inputPath: frameDecimationState.inputPath,
      outputPath: frameDecimationState.outputPath,
      progress: frameDecimationState.progress,
      current: frameDecimationState.current,
      total: frameDecimationState.total,
      elapsedTime,
      queue: frameDecimationState.queue,
      currentProcessingId: frameDecimationState.currentProcessingId,
      outputFolder: frameDecimationState.outputFolder
    }
  })

  // Handler to save queue to file (now managed by main process)
  ipcMain.handle('save-frame-decimation-queue', async (_, queue) => {
    frameDecimationQueue = queue
    await saveQueueToFile()
    console.log('✅ Frame decimation queue saved to file')
    return { success: true }
  })

  // Handler to load queue from file
  ipcMain.handle('load-frame-decimation-queue', async () => {
    const queue = await loadQueueFromFile()
    console.log('✅ Frame decimation queue loaded from file')
    return { success: true, queue }
  })

  // Handler to clear queue file
  ipcMain.handle('clear-frame-decimation-queue', async () => {
    frameDecimationQueue = []
    currentProcessingId = null
    await saveQueueToFile()
    console.log('✅ Frame decimation queue file cleared')
    return { success: true }
  })

  // Handler to update queue item from renderer
  ipcMain.handle('update-frame-decimation-queue-item', async (_, { id, updates }) => {
    updateQueueItem(id, updates)
    return { success: true }
  })

  // Handler to get current queue state
  ipcMain.handle('get-frame-decimation-queue', async () => {
    return { success: true, queue: frameDecimationQueue, currentProcessingId }
  })

  // Create WebSocket server for Premiere Pro communication
  const wss = new WebSocketServer({ port: WEBSOCKET_CONFIG.PORT })

  wss.on('connection', (ws: WebSocket) => {
    console.log('🔗 Premiere Pro connected')
    premiereSocket = ws

    // Notify renderer process that Premiere is connected
    safelyNotifyRenderer('premiere-status-update', { connected: true })

    ws.on('message', async (message: Buffer) => {
      try {
        const messageString = message.toString()
        const parsedMessage = JSON.parse(messageString)

        switch (parsedMessage.type) {
          case 'handshake':
            // Handle initial handshake from Premiere Pro extension
            console.log('🤝 Handshake received from Premiere Pro')

            // Send handshake acknowledgment back
            if (premiereSocket) {
              try {
                premiereSocket.send(
                  JSON.stringify({
                    type: 'handshake_ack',
                    payload: 'clean-cut-app'
                  })
                )
              } catch (error) {
                console.error('❌ Failed to send handshake acknowledgment:', error)
              }
            }
            break

          case 'sequence_info_response':
            // Forward sequence info to renderer process
            console.log('📊 Sequence info received')
            console.log('')
            safelyNotifyRenderer('sequence-info-update', parsedMessage.payload)
            break

          case 'audio_export_response':
            // Handle audio export result and resolve pending export request
            console.log('✅ Audio export completed')

            // Try to parse the payload if it's a string
            let exportResult = parsedMessage.payload
            if (typeof exportResult === 'string') {
              try {
                exportResult = JSON.parse(exportResult)
              } catch (e) {
                console.error('❌ Failed to parse audio export response:', e)
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
                resolver(exportResult)
              }
            } else {
              // Still forward to renderer for any other listeners
              safelyNotifyRenderer('audio-export-result', exportResult)
            }
            break

          case 'cuts_response':
            // Handle response from Premiere Pro after cutting operations
            console.log(`✅ Cuts completed`)

            // Mark silence segments as processed if we have a session
            if (
              parsedMessage.sessionId &&
              currentSilenceSession &&
              currentSilenceSession.id === parsedMessage.sessionId
            ) {
              currentSilenceSession.segments.forEach((segment) => {
                segment.processed = true
              })

              // Notify renderer about the updated session
              safelyNotifyRenderer('silence-session-updated', {
                sessionId: currentSilenceSession.id,
                segments: currentSilenceSession.segments
              })
            }
            break

          case 'delete_silences_response':
            // Handle response from Premiere Pro after silence deletion
            console.log('✅ Silence deletion completed')
            console.log('')

            // Notify renderer about deletion completion
            safelyNotifyRenderer('silence-deletion-completed', {
              sessionId:
                parsedMessage.sessionId ||
                (currentSilenceSession ? currentSilenceSession.id : null),
              result: parsedMessage.payload
            })
            break

          case 'mute_silences_response':
            // Handle response from Premiere Pro after silence muting
            console.log('✅ Silence muting completed')
            console.log('')

            // Notify renderer about muting completion
            safelyNotifyRenderer('silence-muting-completed', {
              sessionId:
                parsedMessage.sessionId ||
                (currentSilenceSession ? currentSilenceSession.id : null),
              result: parsedMessage.payload
            })
            break

          case 'remove_silences_with_gaps_response':
            // Handle response from Premiere Pro after silence removal with gaps
            console.log('✅ Silence removal with gaps completed')
            console.log('')

            // Notify renderer about removal completion
            safelyNotifyRenderer('silence-removal-with-gaps-completed', {
              sessionId:
                parsedMessage.sessionId ||
                (currentSilenceSession ? currentSilenceSession.id : null),
              result: parsedMessage.payload
            })
            break

          default:
            console.log('❓ Unknown message type:', parsedMessage.type)
            break
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('❌ Error parsing WebSocket message:', errorMessage)
      }
    })

    ws.on('close', () => {
      console.log('🔌 Premiere Pro disconnected')
      premiereSocket = null

      // Notify renderer process that Premiere is disconnected
      safelyNotifyRenderer('premiere-status-update', { connected: false })
    })

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error)
    })
  })

  wss.on('error', (error) => {
    console.error('❌ WebSocket server error:', error)
  })
  console.log(`🚀 WebSocket server started on port ${WEBSOCKET_CONFIG.PORT}`)

  // Clear frame decimation queue in development mode
  if (is.dev) {
    const tempDir = join(app.getAppPath(), '.temp')
    const queuePath = join(tempDir, 'frame-decimation-queue.json')
    fs.unlink(queuePath).catch(() => {
      // Ignore error if file doesn't exist
    })
    console.log('🧹 Cleared frame decimation queue (development mode)')
  } else {
    // Load existing queue in production
    loadQueueFromFile().then((queue) => {
      if (queue.length > 0) {
        console.log(`📋 Loaded ${queue.length} items from frame decimation queue`)
      }
    })
  }

  createWindow()

  // Scan for any existing preset files on startup
  scanAndTrackPresetFiles().catch(console.error)

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

// Clean up temporary files when the app is about to quit
app.on('before-quit', async () => {
  await cleanupAllTempFiles()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
