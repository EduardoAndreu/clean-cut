import { useState } from 'react'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { Loader2 } from 'lucide-react'

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

interface AudioAnalysisButtonProps {
  selectedAudioTracks: number[]
  selectedRange: 'entire' | 'inout' | 'selected'
  sequenceInfo: any
  premiereConnected: boolean
  onThresholdSuggestion: (threshold: number) => void
  onStatusUpdate: (status: string) => void
  className?: string
}

function AudioAnalysisButton({
  selectedAudioTracks,
  selectedRange,
  sequenceInfo,
  premiereConnected,
  onThresholdSuggestion,
  onStatusUpdate,
  className
}: AudioAnalysisButtonProps): React.JSX.Element {
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [analysisResult, setAnalysisResult] = useState<AudioAnalysisResult | null>(null)
  const [showResults, setShowResults] = useState<boolean>(false)

  // Hardcoded export location for analysis
  const EXPORT_LOCATION = '/Users/ea/Downloads'

  const handleAnalyzeAudio = async () => {
    if (!premiereConnected) {
      onStatusUpdate('Premiere Pro is not connected.')
      return
    }

    if (selectedAudioTracks.length === 0) {
      onStatusUpdate('Please select at least one audio track to analyze.')
      return
    }

    setIsAnalyzing(true)
    setShowResults(false)
    onStatusUpdate('Exporting audio for analysis...')

    try {
      // First, export audio from Premiere Pro
      const result = await window.cleanCutAPI.exportAudio(EXPORT_LOCATION, {
        selectedAudioTracks,
        selectedRange
      })

      if (result.success && result.outputPath) {
        onStatusUpdate('Audio exported. Analyzing levels...')

        // Then analyze the exported audio
        const analysisResult = await window.cleanCutAPI.analyzeAudio(result.outputPath)

        if (analysisResult.success) {
          setAnalysisResult(analysisResult.data)
          setShowResults(true)
          onStatusUpdate('Audio analysis complete! See results below.')
        } else {
          onStatusUpdate(`Analysis failed: ${analysisResult.error || 'Unknown error'}`)
        }
      } else if (result.success) {
        onStatusUpdate('Export succeeded but no output path provided')
      } else {
        onStatusUpdate(`Export failed: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Analysis error:', error)
      onStatusUpdate(`Error: ${error}`)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleApplyThreshold = (threshold: number, description: string) => {
    onThresholdSuggestion(threshold)
    onStatusUpdate(`Applied ${description}: ${threshold.toFixed(1)}dB`)
  }

  return (
    <>
      <Button
        className={`px-3 py-1 text-xs font-medium ${className || ''}`}
        size="sm"
        onClick={handleAnalyzeAudio}
        disabled={isAnalyzing || !premiereConnected}
        variant={isAnalyzing || !premiereConnected ? 'secondary' : 'outline'}
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Analyzing...
          </>
        ) : (
          'Analyze'
        )}
      </Button>

      {showResults && analysisResult && (
        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-black mb-3">Audio Analysis Results</h3>

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
                  {Object.entries(analysisResult.impact_analysis).map(([threshold, percentage]) => (
                    <div key={threshold} className="flex justify-between">
                      <span>{threshold} dB:</span>
                      <span>{percentage.toFixed(1)}% would be cut</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      )}
    </>
  )
}

export default AudioAnalysisButton
