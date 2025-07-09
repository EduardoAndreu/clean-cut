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
    conservative?: { threshold: number; description: string }
    moderate?: { threshold: number; description: string }
    aggressive?: { threshold: number; description: string }
    custom_percentile?: { threshold: number; description: string }
    vad_recommended?: { threshold: number; description: string }
  }
  impact_analysis: Record<string, number>
  analysis_method?: string
  vad_results?: {
    speech_segments: Array<{ start: number; end: number }>
    silence_segments: Array<{ start: number; end: number; duration: number }>
    speech_duration: number
    silence_duration: number
    speech_percentage: number
    confidence: string
  }
  vad_segments_detected?: number
  removable_silence_duration?: number
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
    onThresholdSuggestion(Math.round(threshold))
    onStatusUpdate(`Applied ${description}: ${Math.round(threshold)}dB`)
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
          <h3 className="text-sm font-semibold text-black mb-3">
            {analysisResult?.analysis_method === 'vad' ? 'AI Speech Analysis' : 'Audio Analysis'}
          </h3>

          {!analysisResult ? (
            <div className="text-center py-8">
              <Info className="h-8 w-8 mx-auto text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 mb-2">No analysis results yet</p>
              <p className="text-xs text-gray-500">
                Click "Analyze" to detect speech vs silence using AI
              </p>
            </div>
          ) : (
            <ScrollArea className="h-64 w-full">
              <div className="space-y-3 text-xs">
                {/* VAD Results (if available) */}
                {analysisResult.vad_results && (
                  <div>
                    <h4 className="font-semibold text-black mb-1">Speech Detection</h4>
                    <div className="text-gray-600 space-y-1">
                      <div>Method: AI Voice Activity Detection</div>
                      <div>Speech Segments: {analysisResult.vad_segments_detected}</div>
                      <div>
                        Speech: {analysisResult.vad_results.speech_percentage.toFixed(1)}% of audio
                      </div>
                      <div>
                        Removable Silence:{' '}
                        {analysisResult.removable_silence_duration?.toFixed(1) || '0'}s
                      </div>
                      <div>Confidence: {analysisResult.vad_results.confidence}</div>
                    </div>
                  </div>
                )}

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
                      Range: {Math.round(analysisResult.statistics.min_db)} to{' '}
                      {Math.round(analysisResult.statistics.max_db)} dB
                    </div>
                    <div>Mean: {Math.round(analysisResult.statistics.mean_db)} dB</div>
                    <div>Median: {Math.round(analysisResult.statistics.median_db)} dB</div>
                    <div>Std Dev: {Math.round(analysisResult.statistics.std_db)} dB</div>
                  </div>
                </div>

                {/* Percentiles */}
                <div>
                  <h4 className="font-semibold text-black mb-1">Percentiles</h4>
                  <div className="text-gray-600 space-y-1">
                    <div>10th: {Math.round(analysisResult.statistics.percentiles['10th'])} dB</div>
                    <div>25th: {Math.round(analysisResult.statistics.percentiles['25th'])} dB</div>
                    <div>75th: {Math.round(analysisResult.statistics.percentiles['75th'])} dB</div>
                    <div>90th: {Math.round(analysisResult.statistics.percentiles['90th'])} dB</div>
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
                            {key === 'speech_based'
                              ? 'Speech Based'
                              : key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ')}
                          </div>
                          <div className="text-gray-600 text-xs">{suggestion.description}</div>
                          <div className="font-mono text-xs text-gray-800">
                            {Math.round(suggestion.threshold)} dB
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
