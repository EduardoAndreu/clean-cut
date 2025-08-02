import React from 'react'
import { Play, Loader2 } from 'lucide-react'
import { Button } from './ui/button'

interface FrameDecimationButtonProps {
  isProcessing: boolean
  isEncoding?: boolean
  onClick: () => void
  queueLength?: number
}

const FrameDecimationButton: React.FC<FrameDecimationButtonProps> = ({
  isProcessing,
  isEncoding,
  onClick,
  queueLength
}) => {
  const buttonText =
    queueLength && queueLength > 1 ? `Process ${queueLength} Videos` : 'Process Video'

  return (
    <Button onClick={onClick} disabled={isProcessing} className="w-full" size="lg">
      {isProcessing ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {isEncoding ? 'Encoding...' : 'Processing Video...'}
        </>
      ) : (
        <>
          <Play className="mr-2 h-4 w-4" />
          {buttonText}
        </>
      )}
    </Button>
  )
}

export default FrameDecimationButton
