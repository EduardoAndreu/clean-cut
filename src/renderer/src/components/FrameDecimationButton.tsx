import React, { useState, useEffect } from 'react'
import { Play, Loader2 } from 'lucide-react'
import { Button } from './ui/button'

interface FrameDecimationButtonProps {
  inputPath: string
  outputPath: string
  onProcessing: (isProcessing: boolean) => void
  onComplete: (stats: {
    originalFrames: number
    outputFrames: number
    reductionPercentage: number
  }) => void
  onError: (error: string) => void
  onProgress?: (
    current: number,
    total: number,
    percentage?: number,
    timeElapsed?: number,
    duration?: number
  ) => void
}

const FrameDecimationButton: React.FC<FrameDecimationButtonProps> = ({
  inputPath,
  outputPath,
  onProcessing,
  onComplete,
  onError,
  onProgress
}) => {
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    // Listen for progress updates from main process
    const handleProgress = (
      _event: any,
      data: {
        current: number
        total: number
        percentage?: number
        timeElapsed?: number
        duration?: number
      }
    ) => {
      if (onProgress) {
        // If we have percentage, use it directly, otherwise calculate from frames
        const progress = data.percentage ?? (data.current / data.total) * 100
        onProgress(data.current, data.total, progress, data.timeElapsed, data.duration)
      }
    }

    window.electron.ipcRenderer.on('frame-decimation-progress', handleProgress)

    return () => {
      window.electron.ipcRenderer.removeAllListeners('frame-decimation-progress')
    }
  }, [onProgress])

  const handleProcessVideo = async () => {
    if (isProcessing) return

    setIsProcessing(true)
    onProcessing(true)
    onError('') // Clear any previous errors

    try {
      const result = await window.cleanCutAPI.processFrameDecimation(inputPath, outputPath)

      if (result.success && result.stats) {
        // Processing is actually complete - the backend has finished
        onComplete(result.stats)
        setIsProcessing(false)
        onProcessing(false)
      } else {
        onError(result.error || 'Failed to process video')
        setIsProcessing(false)
        onProcessing(false)
      }
    } catch (error) {
      console.error('Frame decimation error:', error)
      onError(error instanceof Error ? error.message : 'An unexpected error occurred')
      // Only set processing to false on error
      setIsProcessing(false)
      onProcessing(false)
    }
    // Don't use finally - the parent component will set processing to false when complete
  }

  return (
    <Button onClick={handleProcessVideo} disabled={isProcessing} className="w-full" size="lg">
      {isProcessing ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing Video...
        </>
      ) : (
        <>
          <Play className="mr-2 h-4 w-4" />
          Process Video
        </>
      )}
    </Button>
  )
}

export default FrameDecimationButton
