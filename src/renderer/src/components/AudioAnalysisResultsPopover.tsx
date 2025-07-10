import { Info } from 'lucide-react'
import { Button } from './ui/button'
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
          <h3 className="text-sm font-semibold text-foreground mb-3">
            {analysisResult?.analysis_method === 'vad' ? 'AI Speech Analysis' : 'Audio Analysis'}
          </h3>

          {!analysisResult ? (
            <div className="text-center py-8">
              <Info className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-2">No analysis results yet</p>
              <p className="text-xs text-muted-foreground">
                Click "Analyze" to detect speech vs silence using AI
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              {/* Threshold Suggestions - Only Section */}
              <div>
                <h4 className="font-semibold text-foreground mb-2">Suggested Thresholds</h4>
                <div className="space-y-2">
                  {Object.entries(analysisResult.suggestions).map(([key, suggestion]) => (
                    <div key={key} className="p-2 bg-muted border border-border rounded">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground text-xs">
                          {key === 'vad_recommended'
                            ? 'VAD Recommended'
                            : key === 'speech_based'
                              ? 'Speech Based'
                              : key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ')}
                          : {Math.round(suggestion.threshold)} dB
                        </span>
                        <Button
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() =>
                            handleApplyThreshold(suggestion.threshold, suggestion.description)
                          }
                        >
                          Apply
                        </Button>
                      </div>
                      <div className="text-muted-foreground text-xs">{suggestion.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default AudioAnalysisResultsPopover
