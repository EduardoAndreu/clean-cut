import { ElectronAPI } from '@electron-toolkit/preload'

interface FileDialogResult {
  filePath: string
  fileName: string
}

interface CleanCutAPI {
  invokeCleanCut: (
    filePath: string,
    threshold: number,
    minSilenceLen: number,
    padding: number,
    options?: {
      selectedAudioTracks?: number[]
      selectedRange?: 'entire' | 'inout' | 'selected'
    }
  ) => Promise<number[][]>
  showOpenDialog: () => Promise<FileDialogResult | null>
  requestSequenceInfo: () => Promise<{ success: boolean; message: string }>
  requestSelectedClipsInfo: () => Promise<{ success: boolean; message: string }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    cleanCutAPI: CleanCutAPI
  }
}
