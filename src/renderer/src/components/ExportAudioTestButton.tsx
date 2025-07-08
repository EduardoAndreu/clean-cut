import { useState, useEffect } from 'react'
import { Button } from './ui/button'

interface SequenceInfo {
  success: boolean
  sequenceName?: string
  projectName?: string
  frameRate?: string
  timebase?: number
  videoTracks?: number
  audioTracks?: number
  audioTrackInfo?: Array<{
    index: number
    name: string
    enabled: boolean
    muted: boolean
  }>
  sequenceInPoint?: number
  sequenceOutPoint?: number
  hasSequenceInOutPoints?: boolean
  workAreaEnabled?: boolean
  workAreaInPoint?: number
  workAreaOutPoint?: number
  hasWorkArea?: boolean
  inPoint?: number
  outPoint?: number
  hasInOutPoints?: boolean
  durationSeconds?: number
  durationTime?: string
  inPointTime?: string
  outPointTime?: string
  selectedClips?: Array<{
    name: string
    mediaType: string
    start: number
    end: number
    duration: number
    startTime: string
    endTime: string
    trackIndex: number
  }>
  error?: string
}

interface ExportAudioTestButtonProps {
  // Processing parameters
  silenceThreshold: number
  minSilenceLen: number
  padding: number
  selectedAudioTracks: number[]
  selectedRange: 'entire' | 'inout' | 'selected'
  sequenceInfo: SequenceInfo | null
  premiereConnected: boolean

  // Callback functions
  onStatusUpdate: (status: string) => void
  onError?: (error: string) => void
  onSuccess?: (message: string) => void

  // Optional customization
  className?: string
  variant?: 'default' | 'secondary' | 'outline'
}

function ExportAudioTestButton({
  selectedAudioTracks,
  selectedRange,
  sequenceInfo,
  premiereConnected,
  onStatusUpdate,
  onError,
  onSuccess,
  className,
  variant = 'outline'
}: ExportAudioTestButtonProps): React.JSX.Element {
  const [isExporting, setIsExporting] = useState<boolean>(false)

  // Hardcoded export location for testing
  const EXPORT_LOCATION = '/Users/ea/Downloads'

  // Listen for audio export results from Premiere Pro
  useEffect(() => {
    const handleAudioExportResult = (_event: any, data: string) => {
      try {
        const exportResult = JSON.parse(data)
        console.log('Received audio export result:', exportResult)

        if (exportResult.success) {
          const successMessage = `Audio exported successfully!
Export location: ${exportResult.outputPath || 'Unknown location'}
${exportResult.message || ''}`
          onStatusUpdate(successMessage)
          onSuccess?.(successMessage)
        } else {
          const errorMessage = `Audio export failed: ${exportResult.error || 'Unknown error'}`
          onStatusUpdate(errorMessage)
          onError?.(errorMessage)
        }
      } catch (error) {
        console.error('Error parsing audio export result:', error)
        const errorMessage = 'Failed to parse audio export response'
        onStatusUpdate(errorMessage)
        onError?.(errorMessage)
      } finally {
        setIsExporting(false)
      }
    }

    // Add IPC listeners
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.on('audio-export-result', handleAudioExportResult)
    }

    return () => {
      // Cleanup listeners on unmount
      if (window.electron && window.electron.ipcRenderer) {
        window.electron.ipcRenderer.removeAllListeners('audio-export-result')
      }
    }
  }, [onStatusUpdate, onError, onSuccess])

  const handleExportAudio = async () => {
    if (!premiereConnected) {
      const errorMsg =
        'Premiere Pro is not connected. Please ensure the Clean-Cut extension is running in Premiere Pro.'
      onStatusUpdate(errorMsg)
      onError?.(errorMsg)
      return
    }

    // Validate selections
    if (selectedAudioTracks.length === 0) {
      const errorMsg = 'Please select at least one audio track to export.'
      onStatusUpdate(errorMsg)
      onError?.(errorMsg)
      return
    }

    // If "Selected clips" is chosen, we should check if clips are actually selected
    if (selectedRange === 'selected') {
      if (!sequenceInfo?.selectedClips || sequenceInfo.selectedClips.length === 0) {
        const errorMsg =
          'No clips are selected. Please select audio clips in your timeline first, or choose a different range option.'
        onStatusUpdate(errorMsg)
        onError?.(errorMsg)
        return
      }
    }

    setIsExporting(true)
    onStatusUpdate('Exporting audio from Premiere Pro...')

    try {
      await window.cleanCutAPI.exportAudio(EXPORT_LOCATION, {
        selectedAudioTracks,
        selectedRange
      })

      const rangeText =
        selectedRange === 'entire'
          ? 'entire timeline'
          : selectedRange === 'inout'
            ? 'in/out points'
            : 'selected clips'
      const tracksText = selectedAudioTracks.map((t) => `A${t}`).join(', ')

      onStatusUpdate(`Export request sent to Premiere Pro!
Parameters:
- Export location: ${EXPORT_LOCATION}
- Range: ${rangeText}
- Audio tracks: ${tracksText}
- Sequence: ${sequenceInfo?.sequenceName || 'Unknown'}

Waiting for export to complete...`)
    } catch (error) {
      console.error('Audio export error:', error)
      const errorMsg = `Error sending export request: ${error}`
      onStatusUpdate(errorMsg)
      onError?.(errorMsg)
      setIsExporting(false)
    }
  }

  return (
    <div className="mb-5">
      <Button
        className={`w-full px-6 py-3 text-base font-semibold ${className || ''}`}
        size="lg"
        onClick={handleExportAudio}
        disabled={isExporting || !premiereConnected}
        variant={isExporting || !premiereConnected ? 'secondary' : variant}
      >
        {isExporting ? 'Exporting...' : 'Export Audio Test'}
      </Button>
    </div>
  )
}

export default ExportAudioTestButton
