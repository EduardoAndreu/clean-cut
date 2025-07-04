import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {}

// Clean Cut API for audio processing
const cleanCutAPI = {
  invokeCleanCut: (filePath: string, threshold: number, minSilenceLen: number, padding: number) =>
    ipcRenderer.invoke('run-clean-cut', { filePath, threshold, minSilenceLen, padding }),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog')
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
