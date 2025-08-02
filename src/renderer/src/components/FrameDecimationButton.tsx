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
  onProgress?: (current: number, total: number) => void
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
    const handleProgress = (_event: any, data: { current: number; total: number }) => {
      if (onProgress) {
        onProgress(data.current, data.total)
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
        onComplete(result.stats)
      } else {
        onError(result.error || 'Failed to process video')
      }
    } catch (error) {
      console.error('Frame decimation error:', error)
      onError(error instanceof Error ? error.message : 'An unexpected error occurred')
    } finally {
      setIsProcessing(false)
      onProcessing(false)
    }
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
