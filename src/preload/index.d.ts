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
  exportAudio: (
    exportFolder: string,
    options: {
      selectedAudioTracks: number[]
      selectedRange: 'entire' | 'inout' | 'selected'
    }
  ) => Promise<{ success: boolean; message: string; outputPath?: string }>
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
