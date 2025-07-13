import { ElectronAPI } from '@electron-toolkit/preload'

interface CleanCutAPI {
  exportAudio: (options: {
    selectedAudioTracks: number[]
    selectedRange: 'entire' | 'inout' | 'selected'
  }) => Promise<{ success: boolean; message: string; outputPath?: string; error?: string }>
  processSilences: (
    filePath: string,
    silenceThreshold: number,
    minSilenceLen: number,
    padding: number
  ) => Promise<{ success: boolean; message: string; silenceCount?: number; error?: string }>
  analyzeAudio: (filePath: string) => Promise<{ success: boolean; data?: any; error?: string }>
  requestSequenceInfo: () => Promise<{ success: boolean; message: string }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {}
    cleanCutAPI: {
      exportAudio: (options: {
        selectedAudioTracks: number[]
        selectedRange: 'entire' | 'inout' | 'selected'
      }) => Promise<{
        success: boolean
        outputPath?: string
        error?: string
      }>
      processSilences: (
        filePath: string,
        silenceThreshold: number,
        minSilenceLen: number,
        padding: number,
        options?: {
          selectedAudioTracks?: number[]
          selectedRange?: 'entire' | 'inout' | 'selected'
        }
      ) => Promise<{
        success: boolean
        message: string
        silenceCount?: number
        sessionId?: string
        segments?: Array<{
          id: string
          start: number
          end: number
          duration: number
          trackIndices: number[]
          originalRange: [number, number]
          processed: boolean
          deleted: boolean
        }>
        error?: string
      }>
      analyzeAudio: (filePath: string) => Promise<{
        success: boolean
        data?: any
        error?: string
      }>
      requestSequenceInfo: () => Promise<{
        success: boolean
        message: string
      }>
      getSilenceSession: (sessionId?: string) => Promise<{
        success: boolean
        session?: {
          id: string
          timestamp: number
          segments: Array<{
            id: string
            start: number
            end: number
            duration: number
            trackIndices: number[]
            originalRange: [number, number]
            processed: boolean
            deleted: boolean
          }>
          processingParams: any
          totalSegments: number
          deletableSegments: number
        }
        error?: string
      }>
      deleteSilenceSegments: (
        sessionId?: string,
        segmentIds?: string[]
      ) => Promise<{
        success: boolean
        message?: string
        error?: string
        deletedSegments?: number
        sessionId?: string
      }>
      removeSilenceSegmentsWithGaps: (
        sessionId?: string,
        segmentIds?: string[]
      ) => Promise<{
        success: boolean
        message?: string
        error?: string
        removedSegments?: number
        sessionId?: string
      }>
      muteSilenceSegments: (
        sessionId?: string,
        segmentIds?: string[]
      ) => Promise<{
        success: boolean
        message?: string
        error?: string
        mutedSegments?: number
        sessionId?: string
      }>
      clearSilenceSessions: () => Promise<{
        success: boolean
        message: string
      }>
    }
  }
}
