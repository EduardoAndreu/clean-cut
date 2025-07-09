import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {}

// Clean Cut API for audio processing
const cleanCutAPI = {
  invokeCleanCut: (
    filePath: string,
    threshold: number,
    minSilenceLen: number,
    padding: number,
    options?: {
      selectedAudioTracks?: number[]
      selectedRange?: 'entire' | 'inout' | 'selected'
    }
  ) =>
    ipcRenderer.invoke('run-clean-cut', { filePath, threshold, minSilenceLen, padding, options }),
  exportAudio: (
    exportFolder: string,
    options: {
      selectedAudioTracks: number[]
      selectedRange: 'entire' | 'inout' | 'selected'
    }
  ) => ipcRenderer.invoke('export-audio', { exportFolder, options }),
  processSilences: (
    filePath: string,
    silenceThreshold: number,
    minSilenceLen: number,
    padding: number
  ) =>
    ipcRenderer.invoke('process-silences', { filePath, silenceThreshold, minSilenceLen, padding }),
  analyzeAudio: (filePath: string) => ipcRenderer.invoke('analyze-audio', filePath),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  requestSequenceInfo: () => ipcRenderer.invoke('request-sequence-info'),
  requestSelectedClipsInfo: () => ipcRenderer.invoke('request-selected-clips-info')
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
