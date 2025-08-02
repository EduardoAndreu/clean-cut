import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {}

// Clean Cut API for audio processing
const cleanCutAPI = {
  exportAudio: (options: {
    selectedAudioTracks: number[]
    selectedRange: 'entire' | 'inout' | 'selected'
  }) => ipcRenderer.invoke('export-audio', options),
  processSilences: (
    filePath: string,
    silenceThreshold: number,
    minSilenceLen: number,
    padding: number,
    options?: {
      selectedAudioTracks?: number[]
      selectedRange?: 'entire' | 'inout' | 'selected'
    },
    exportMetadata?: {
      timeOffsetSeconds?: number
      selectedRange?: string
    }
  ) =>
    ipcRenderer.invoke('process-silences', {
      filePath,
      silenceThreshold,
      minSilenceLen,
      padding,
      options,
      exportMetadata
    }),
  analyzeAudio: (filePath: string) => ipcRenderer.invoke('analyze-audio', filePath),
  requestSequenceInfo: () => ipcRenderer.invoke('request-sequence-info'),
  getSilenceSession: (sessionId?: string) => ipcRenderer.invoke('get-silence-session', sessionId),
  deleteSilenceSegments: (sessionId?: string, segmentIds?: string[]) =>
    ipcRenderer.invoke('delete-silence-segments', sessionId, segmentIds),
  removeSilenceSegmentsWithGaps: (sessionId?: string, segmentIds?: string[]) =>
    ipcRenderer.invoke('remove-silence-segments-with-gaps', sessionId, segmentIds),
  muteSilenceSegments: (sessionId?: string, segmentIds?: string[]) =>
    ipcRenderer.invoke('mute-silence-segments', sessionId, segmentIds),
  clearSilenceSessions: () => ipcRenderer.invoke('clear-silence-sessions'),
  processFrameDecimation: (inputPath: string, outputPath: string) =>
    ipcRenderer.invoke('process-frame-decimation', { inputPath, outputPath })
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('cleanCutAPI', cleanCutAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.cleanCutAPI = cleanCutAPI
}
