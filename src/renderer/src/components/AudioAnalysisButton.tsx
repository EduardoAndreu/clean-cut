import { useState } from 'react'
import { Button } from './ui/button'
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

interface AudioAnalysisButtonProps {
  selectedAudioTracks: number[]
  selectedRange: 'entire' | 'inout' | 'selected'
  premiereConnected: boolean
  onAnalysisResult: (result: AudioAnalysisResult | null) => void
  onStatusUpdate: (status: string) => void
  className?: string
}

function AudioAnalysisButton({
  selectedAudioTracks,
  selectedRange,
  premiereConnected,
  onAnalysisResult,
  onStatusUpdate,
  className
}: AudioAnalysisButtonProps): React.JSX.Element {
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)

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
    onAnalysisResult(null) // Clear previous results
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
          onAnalysisResult(analysisResult.data)
          onStatusUpdate('Audio analysis complete! See results in the info panel.')
        } else {
          onStatusUpdate(`Analysis failed: ${analysisResult.error || 'Unknown error'}`)
          onAnalysisResult(null)
        }
      } else if (result.success) {
        onStatusUpdate('Export succeeded but no output path provided')
        onAnalysisResult(null)
      } else {
        onStatusUpdate(`Export failed: ${result.error || 'Unknown error'}`)
        onAnalysisResult(null)
      }
    } catch (error) {
      console.error('Analysis error:', error)
      onStatusUpdate(`Error: ${error}`)
      onAnalysisResult(null)
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
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
  )
}

export default AudioAnalysisButton
