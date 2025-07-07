import { Button } from './ui/button'
import { ConnectionPrompt } from './ui/connection-prompt'
import { RefreshCw } from 'lucide-react'

interface SequenceInfo {
  success: boolean
  sequenceName?: string
  projectName?: string
  frameRate?: string
  error?: string
}

interface ActiveSequenceProps {
  sequenceInfo: SequenceInfo | null
  premiereConnected: boolean
  onRefresh: () => void
  className?: string
}

function ActiveSequence({
  sequenceInfo,
  premiereConnected,
  onRefresh,
  className = ''
}: ActiveSequenceProps): React.JSX.Element {
  return (
    <div className={`mb-8 ${className}`}>
      <label className="block text-sm font-semibold mb-2">Active Sequence</label>
      <div className="text-xs text-gray-500 mb-3">Refresh if you select open a new sequence</div>
      <div className="p-2 bg-gray-50 border rounded-lg">
        <div className="flex justify-between text-xs mb-1">
          <span className="font-semibold text-black">
            {!premiereConnected
              ? 'Premiere Pro Not Connected'
              : sequenceInfo?.success
                ? sequenceInfo.sequenceName || 'Unknown Sequence'
                : 'No Active Sequence'}
          </span>
          <Button
            variant={premiereConnected ? 'outline' : 'secondary'}
            size="icon"
            onClick={onRefresh}
            disabled={!premiereConnected}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        {!premiereConnected ? (
          <ConnectionPrompt action="view sequence information" size="sm" />
        ) : sequenceInfo?.success ? (
          <div className="text-xs text-gray-500">
            Project: {sequenceInfo.projectName} | Frame Rate: {sequenceInfo.frameRate}
          </div>
        ) : (
          <div className="text-xs text-gray-500">
            {sequenceInfo?.error || 'Click refresh to get sequence information'}
          </div>
        )}
      </div>
    </div>
  )
}

export default ActiveSequence
