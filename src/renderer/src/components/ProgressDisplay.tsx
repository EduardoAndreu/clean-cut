import React from 'react'
import { Progress } from './ui/progress'

interface ProgressDisplayProps {
  isProcessing: boolean
  isEncoding: boolean
  progress: number
  elapsedTime: number
  currentFileName?: string
}

const ProgressDisplay: React.FC<ProgressDisplayProps> = ({
  isProcessing,
  isEncoding,
  progress,
  elapsedTime,
  currentFileName
}) => {
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const estimateTimeRemaining = (): string => {
    if (progress > 0 && elapsedTime > 0) {
      const totalTime = (elapsedTime / progress) * 100
      const remaining = totalTime - elapsedTime
      return formatTime(remaining)
    }
    return 'Calculating...'
  }

  const getDisplayFilename = (path?: string): string => {
    if (!path) return ''
    const filename = path.split('/').pop() || path
    if (filename.length > 25) {
      return filename.substring(0, 25) + '...'
    }
    return filename
  }

  if (!isProcessing) return null

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>
          {isEncoding
            ? `Encoding ${getDisplayFilename(currentFileName)}`
            : `Processing ${getDisplayFilename(currentFileName)}`}
        </span>
        <span>{isEncoding ? '' : `${Math.round(progress)}%`}</span>
      </div>
      <Progress value={isEncoding ? 0 : progress} className="mb-2" />
      <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 dark:text-gray-500">
        <div>
          <span className="font-medium">Time elapsed:</span> {formatTime(elapsedTime)}
        </div>
        {!isEncoding && (
          <div className="text-right">
            <span className="font-medium">Time remaining:</span> {estimateTimeRemaining()}
          </div>
        )}
      </div>
    </div>
  )
}

export default ProgressDisplay
