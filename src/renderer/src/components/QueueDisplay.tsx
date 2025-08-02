import React from 'react'

interface VideoStats {
  originalFrames: number
  outputFrames: number
  reductionPercentage: number
}

interface QueueItem {
  id: string
  inputPath: string
  outputPath: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress?: number
  stats?: VideoStats
  error?: string
}

interface QueueDisplayProps {
  queue: QueueItem[]
}

const QueueDisplay: React.FC<QueueDisplayProps> = ({ queue }) => {
  if (queue.length === 0) return null

  const getDisplayFilename = (path: string): string => {
    const filename = path.split('/').pop() || path
    if (filename.length > 25) {
      return filename.substring(0, 25) + '...'
    }
    return filename
  }

  const completedCount = queue.filter((q) => q.status === 'completed').length

  return (
    <div className="mb-8">
      <div className="block text-sm font-semibold text-foreground mb-4">
        Queue ({completedCount} of {queue.length} completed)
      </div>
      <div className="bg-muted border border-border rounded-lg p-4">
        <div className="space-y-2">
          {queue.map((item) => (
            <div key={item.id} className="flex items-center gap-2 text-sm">
              <span className="flex-shrink-0">
                {item.status === 'completed' && <span className="text-green-600">✓</span>}
                {item.status === 'processing' && <span className="text-blue-600">●</span>}
                {item.status === 'pending' && <span className="text-gray-400">○</span>}
                {item.status === 'error' && <span className="text-red-600">✗</span>}
              </span>

              <span className="flex-1 truncate text-xs font-mono">
                {getDisplayFilename(item.inputPath)}
              </span>

              {item.status === 'error' && item.error && (
                <span className="text-xs text-red-500" title={item.error}>
                  Failed
                </span>
              )}

              {item.status === 'completed' && item.stats && (
                <span className="text-xs text-green-600">
                  -{item.stats.reductionPercentage.toFixed(1)}%
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default QueueDisplay
