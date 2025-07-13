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

interface SilenceSession {
  id: string
  timestamp: number
  segments: SilenceSegment[]
  processingParams: any
  totalSegments: number
  deletableSegments: number
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
  silenceManagement: 'remove' | 'keep' | 'mute' | 'removeWithGaps'

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
  silenceManagement,
  onStatusUpdate,
  onError,
  onSuccess,
  className,
  variant = 'default'
}: RemoveSilencesButtonProps): React.JSX.Element {
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [currentSession, setCurrentSession] = useState<SilenceSession | null>(null)
  const [pendingDeletion, setPendingDeletion] = useState<boolean>(false)

  // Listen for silence session updates to handle deletion timing
  useEffect(() => {
    const handleSilenceSessionUpdate = (_event: any, data: any) => {
      console.log('Silence session updated:', data)

      // If we're pending deletion and segments are now processed, proceed with deletion
      if (pendingDeletion && data.sessionId === currentSession?.id) {
        const processedSegments =
          data.segments?.filter((seg: SilenceSegment) => seg.processed) || []
        console.log('Processed segments:', processedSegments.length)

        if (processedSegments.length > 0) {
          setPendingDeletion(false)
          proceedWithDeletion(data.sessionId)
        }
      }
    }

    // Add IPC listeners
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.on('silence-session-updated', handleSilenceSessionUpdate)
    }

    return () => {
      // Cleanup listeners on unmount
      if (window.electron && window.electron.ipcRenderer) {
        window.electron.ipcRenderer.removeAllListeners('silence-session-updated')
      }
    }
  }, [pendingDeletion, currentSession])

  const proceedWithDeletion = async (sessionId: string) => {
    console.log('Proceeding with post-processing for session:', sessionId)

    if (silenceManagement === 'remove') {
      onStatusUpdate('Deleting silence segments...')

      try {
        const deleteResult = await window.cleanCutAPI.deleteSilenceSegments(sessionId)

        if (deleteResult.success) {
          const successMessage = `Silence processing completed successfully!
Found and removed ${deleteResult.deletedSegments || 'multiple'} silence segments from the timeline.`
          onStatusUpdate(successMessage)
          onSuccess?.(successMessage)
        } else {
          const errorMessage = `Silence processing completed, but deletion failed: ${deleteResult.error || 'Unknown error'}`
          onStatusUpdate(errorMessage)
          onError?.(errorMessage)
        }
      } catch (deleteError) {
        console.error('Deletion error:', deleteError)
        const errorMsg = `Silence processing completed, but deletion failed: ${deleteError}`
        onStatusUpdate(errorMsg)
        onError?.(errorMsg)
      }
    } else if (silenceManagement === 'removeWithGaps') {
      onStatusUpdate('Removing silence segments (keeping gaps)...')

      try {
        const removeResult = await window.cleanCutAPI.removeSilenceSegmentsWithGaps(sessionId)

        if (removeResult.success) {
          const successMessage = `Silence processing completed successfully!
Found and removed ${removeResult.removedSegments || 'multiple'} silence segments from the timeline (gaps preserved).`
          onStatusUpdate(successMessage)
          onSuccess?.(successMessage)
        } else {
          const errorMessage = `Silence processing completed, but removal failed: ${removeResult.error || 'Unknown error'}`
          onStatusUpdate(errorMessage)
          onError?.(errorMessage)
        }
      } catch (removeError) {
        console.error('Removal error:', removeError)
        const errorMsg = `Silence processing completed, but removal failed: ${removeError}`
        onStatusUpdate(errorMsg)
        onError?.(errorMsg)
      }
    } else if (silenceManagement === 'mute') {
      onStatusUpdate('Muting silence segments...')

      try {
        const muteResult = await window.cleanCutAPI.muteSilenceSegments(sessionId)

        if (muteResult.success) {
          const successMessage = `Silence processing completed successfully!
Found and muted ${muteResult.mutedSegments || 'multiple'} silence segments in the timeline.`
          onStatusUpdate(successMessage)
          onSuccess?.(successMessage)
        } else {
          const errorMessage = `Silence processing completed, but muting failed: ${muteResult.error || 'Unknown error'}`
          onStatusUpdate(errorMessage)
          onError?.(errorMessage)
        }
      } catch (muteError) {
        console.error('Muting error:', muteError)
        const errorMsg = `Silence processing completed, but muting failed: ${muteError}`
        onStatusUpdate(errorMsg)
        onError?.(errorMsg)
      }
    }

    // Always clean up at the end
    setIsProcessing(false)
    setCurrentSession(null)
    setPendingDeletion(false)
  }

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
    setPendingDeletion(false)
    onStatusUpdate('Exporting audio from Premiere Pro...')

    try {
      // Step 1: Export audio from Premiere Pro to temporary location (path generated internally)
      const exportResult = await window.cleanCutAPI.exportAudio({
        selectedAudioTracks,
        selectedRange
      })

      if (exportResult.success && exportResult.outputPath) {
        onStatusUpdate('Audio exported. Processing silences...')

        // Step 2: Process the exported audio for silences
        const processResult = await window.cleanCutAPI.processSilences(
          exportResult.outputPath,
          silenceThreshold,
          minSilenceLen,
          padding,
          {
            selectedAudioTracks,
            selectedRange
          }
        )

        if (processResult.success && processResult.sessionId && processResult.segments) {
          // Create session data with type safety
          const sessionData: SilenceSession = {
            id: processResult.sessionId,
            timestamp: Date.now(),
            segments: processResult.segments,
            processingParams: { silenceThreshold, minSilenceLen, padding },
            totalSegments: processResult.segments.length,
            deletableSegments: processResult.segments.filter((seg) => seg.processed).length
          }

          setCurrentSession(sessionData)

          // Handle the action based on user's pre-selected choice
          if (silenceManagement === 'remove') {
            // User wants to remove silences - wait for segments to be processed, then delete
            onStatusUpdate('Silence processing completed! Waiting for timeline cuts to finish...')
            setPendingDeletion(true)
          } else if (silenceManagement === 'removeWithGaps') {
            // User wants to remove silences but keep gaps - wait for segments to be processed, then delete with gaps
            onStatusUpdate('Silence processing completed! Waiting for timeline cuts to finish...')
            setPendingDeletion(true) // We'll reuse this for removeWithGaps workflow
          } else if (silenceManagement === 'mute') {
            // User wants to mute silences - wait for segments to be processed, then mute
            onStatusUpdate('Silence processing completed! Waiting for timeline cuts to finish...')
            setPendingDeletion(true) // We'll reuse this for muting workflow
          } else {
            // User wants to keep silences - just cut without deleting
            const successMessage = `Silence processing completed!
Found ${processResult.silenceCount || 0} silence ranges and cut the timeline at silence boundaries.
Silence segments have been preserved as requested.`
            onStatusUpdate(successMessage)
            onSuccess?.(successMessage)
            setIsProcessing(false)
            setCurrentSession(null)
          }
        } else {
          const errorMessage = `Silence processing failed: ${processResult.error || 'Unknown error'}`
          onStatusUpdate(errorMessage)
          onError?.(errorMessage)
          setIsProcessing(false)
        }
      } else {
        const errorMessage = `Audio export failed: ${exportResult.error || 'Unknown error'}`
        onStatusUpdate(errorMessage)
        onError?.(errorMessage)
        setIsProcessing(false)
      }
    } catch (error) {
      console.error('Processing error:', error)
      const errorMsg = `Error during processing: ${error}`
      onStatusUpdate(errorMsg)
      onError?.(errorMsg)
      setIsProcessing(false)
      setCurrentSession(null)
      setPendingDeletion(false)
    }
  }

  const getButtonText = () => {
    if (isProcessing) {
      if (pendingDeletion) {
        return 'Deleting Silences...'
      }
      return 'Processing...'
    }

    if (silenceManagement === 'remove') {
      return 'Find & Remove Silences'
    } else if (silenceManagement === 'removeWithGaps') {
      return 'Find & Remove Silences (Keep Gaps)'
    } else if (silenceManagement === 'mute') {
      return 'Find & Mute Silences'
    } else {
      return 'Find & Cut at Silences'
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
        {getButtonText()}
      </Button>
    </div>
  )
}

export default RemoveSilencesButton
