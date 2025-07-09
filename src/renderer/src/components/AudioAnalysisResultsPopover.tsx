import { Info } from 'lucide-react'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

interface AudioAnalysisResult {
  file_info: {
    duration_seconds: number
    sample_rate: number
    channels: number
    bit_depth: number
  }
  statistics: {
    min_db: number
    max_db: number
    mean_db: number
    median_db: number
    std_db: number
    percentiles: {
      '10th': number
      '25th': number
      '75th': number
      '90th': number
      '95th': number
    }
  }
  suggestions: {
    conservative: { threshold: number; description: string }
    moderate: { threshold: number; description: string }
    aggressive: { threshold: number; description: string }
    custom_percentile: { threshold: number; description: string }
  }
  impact_analysis: Record<string, number>
}

interface AudioAnalysisResultsPopoverProps {
  analysisResult: AudioAnalysisResult | null
  onThresholdSuggestion: (threshold: number) => void
  onStatusUpdate: (status: string) => void
  className?: string
}

function AudioAnalysisResultsPopover({
  analysisResult,
  onThresholdSuggestion,
  onStatusUpdate,
  className
}: AudioAnalysisResultsPopoverProps): React.JSX.Element {
  const handleApplyThreshold = (threshold: number, description: string) => {
    onThresholdSuggestion(threshold)
    onStatusUpdate(`Applied ${description}: ${threshold.toFixed(1)}dB`)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={`px-2 py-1 h-7 ${className || ''}`}>
          <Info className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div>
          <h3 className="text-sm font-semibold text-black mb-3">Audio Analysis</h3>

          {!analysisResult ? (
            <div className="text-center py-8">
              <Info className="h-8 w-8 mx-auto text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 mb-2">No analysis results yet</p>
              <p className="text-xs text-gray-500">
                Click "Analyze" to get detailed audio statistics and threshold suggestions
              </p>
            </div>
          ) : (
            <ScrollArea className="h-64 w-full">
              <div className="space-y-3 text-xs">
                {/* File Info */}
                <div>
                  <h4 className="font-semibold text-black mb-1">File Information</h4>
                  <div className="text-gray-600 space-y-1">
                    <div>Duration: {analysisResult.file_info.duration_seconds.toFixed(1)}s</div>
                    <div>Sample Rate: {analysisResult.file_info.sample_rate}Hz</div>
                    <div>Channels: {analysisResult.file_info.channels}</div>
                    <div>Bit Depth: {analysisResult.file_info.bit_depth}-bit</div>
                  </div>
                </div>

                {/* Statistics */}
                <div>
                  <h4 className="font-semibold text-black mb-1">Level Statistics</h4>
                  <div className="text-gray-600 space-y-1">
                    <div>
                      Range: {analysisResult.statistics.min_db.toFixed(1)} to{' '}
                      {analysisResult.statistics.max_db.toFixed(1)} dB
                    </div>
                    <div>Mean: {analysisResult.statistics.mean_db.toFixed(1)} dB</div>
                    <div>Median: {analysisResult.statistics.median_db.toFixed(1)} dB</div>
                    <div>Std Dev: {analysisResult.statistics.std_db.toFixed(1)} dB</div>
                  </div>
                </div>

                {/* Percentiles */}
                <div>
                  <h4 className="font-semibold text-black mb-1">Percentiles</h4>
                  <div className="text-gray-600 space-y-1">
                    <div>10th: {analysisResult.statistics.percentiles['10th'].toFixed(1)} dB</div>
                    <div>25th: {analysisResult.statistics.percentiles['25th'].toFixed(1)} dB</div>
                    <div>75th: {analysisResult.statistics.percentiles['75th'].toFixed(1)} dB</div>
                    <div>90th: {analysisResult.statistics.percentiles['90th'].toFixed(1)} dB</div>
                  </div>
                </div>

                {/* Threshold Suggestions */}
                <div>
                  <h4 className="font-semibold text-black mb-2">Suggested Thresholds</h4>
                  <div className="space-y-2">
                    {Object.entries(analysisResult.suggestions).map(([key, suggestion]) => (
                      <div key={key} className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-black text-xs">
                            {key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ')}
                          </div>
                          <div className="text-gray-600 text-xs">{suggestion.description}</div>
                          <div className="font-mono text-xs text-gray-800">
                            {suggestion.threshold.toFixed(1)} dB
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-2 text-xs px-2 py-1"
                          onClick={() =>
                            handleApplyThreshold(suggestion.threshold, suggestion.description)
                          }
                        >
                          Apply
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Impact Analysis */}
                <div>
                  <h4 className="font-semibold text-black mb-1">Impact Analysis</h4>
                  <div className="text-gray-600 space-y-1">
                    {Object.entries(analysisResult.impact_analysis).map(
                      ([threshold, percentage]) => (
                        <div key={threshold} className="flex justify-between">
                          <span>{threshold} dB:</span>
                          <span>{percentage.toFixed(1)}% would be cut</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default AudioAnalysisResultsPopover
