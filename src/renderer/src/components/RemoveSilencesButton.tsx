import { useState } from 'react'
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

interface RemoveSilencesButtonProps {
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

function RemoveSilencesButton({
  silenceThreshold,
  minSilenceLen,
  padding,
  selectedAudioTracks,
  selectedRange,
  sequenceInfo,
  premiereConnected,
  onStatusUpdate,
  onError,
  onSuccess,
  className,
  variant = 'default'
}: RemoveSilencesButtonProps): React.JSX.Element {
  const [isProcessing, setIsProcessing] = useState<boolean>(false)

  const handleProcessFromPremiere = async () => {
    if (!premiereConnected) {
      const errorMsg =
        'Premiere Pro is not connected. Please ensure the Clean-Cut extension is running in Premiere Pro.'
      onStatusUpdate(errorMsg)
      onError?.(errorMsg)
      return
    }

    // Validate selections
    if (selectedAudioTracks.length === 0) {
      const errorMsg = 'Please select at least one audio track to process.'
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

    setIsProcessing(true)
    onStatusUpdate('Requesting audio from Premiere Pro...')

    try {
      await window.cleanCutAPI.invokeCleanCut(
        '', // Empty file path for Premiere workflow
        silenceThreshold,
        minSilenceLen,
        padding,
        {
          selectedAudioTracks,
          selectedRange
        }
      )

      const rangeText =
        selectedRange === 'entire'
          ? 'entire timeline'
          : selectedRange === 'inout'
            ? 'in/out points'
            : 'selected clips'
      const tracksText = selectedAudioTracks.map((t) => `A${t}`).join(', ')

      const successMessage = `Clean-cut request sent to Premiere Pro! Processing will happen automatically.
Parameters used:
- Range: ${rangeText}
- Audio tracks: ${tracksText}
- Threshold: ${silenceThreshold}dB
- Min silence: ${minSilenceLen}ms  
- Padding: ${padding}ms

Check Premiere Pro for the results.`

      onStatusUpdate(successMessage)
      onSuccess?.(successMessage)
    } catch (error) {
      console.error('Premiere clean cut error:', error)
      const errorMsg = `Error sending request to Premiere Pro: ${error}`
      onStatusUpdate(errorMsg)
      onError?.(errorMsg)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="mb-5">
      <Button
        className={`w-full px-6 py-3 text-base font-semibold ${className || ''}`}
        size="lg"
        onClick={handleProcessFromPremiere}
        disabled={isProcessing || !premiereConnected}
        variant={isProcessing || !premiereConnected ? 'secondary' : variant}
      >
        {isProcessing ? 'Processing...' : 'Remove Silences'}
      </Button>
    </div>
  )
}

export default RemoveSilencesButton
