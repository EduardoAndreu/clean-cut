import { useState } from 'react'
import { Button } from './ui/button'
import { Loader2 } from 'lucide-react'
import { EXPORT_LOCATION } from '../../../shared/config'

interface AudioAnalysisResult {
  suggestions: {
    vad_recommended?: { threshold: number; description: string }
  }
  analysis_method?: string
}

interface AudioAnalysisButtonProps {
  selectedAudioTracks: number[]
  selectedRange: 'entire' | 'inout' | 'selected'
  premiereConnected: boolean
  onAnalysisResult: (result: AudioAnalysisResult | null) => void
  onThresholdSuggestion: (threshold: number) => void
  onStatusUpdate: (status: string) => void
  className?: string
}

function AudioAnalysisButton({
  selectedAudioTracks,
  selectedRange,
  premiereConnected,
  onAnalysisResult,
  onThresholdSuggestion,
  onStatusUpdate,
  className
}: AudioAnalysisButtonProps): React.JSX.Element {
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)

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
          const recommendedThreshold = analysisResult.data.suggestions?.vad_recommended?.threshold
          onAnalysisResult(analysisResult.data)

          if (recommendedThreshold !== undefined) {
            onThresholdSuggestion(Math.round(recommendedThreshold))
            onStatusUpdate(
              `Analysis complete. New threshold set to ${Math.round(recommendedThreshold)}dB.`
            )
          } else {
            onStatusUpdate('Audio analysis complete! No threshold suggestion found.')
          }
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
