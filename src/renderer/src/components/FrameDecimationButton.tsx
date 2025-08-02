import React from 'react'
import { Play, Loader2 } from 'lucide-react'
import { Button } from './ui/button'

interface FrameDecimationButtonProps {
  isProcessing: boolean
  onClick: () => void
}

const FrameDecimationButton: React.FC<FrameDecimationButtonProps> = ({
  isProcessing,
  onClick
}) => {
  return (
    <Button onClick={onClick} disabled={isProcessing} className="w-full" size="lg">
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