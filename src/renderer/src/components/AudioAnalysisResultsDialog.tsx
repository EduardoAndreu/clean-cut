import { Info } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'

interface AudioAnalysisResult {
  suggestions: {
    vad_recommended?: { threshold: number; description: string }
  }
  analysis_method?: string
}

interface AudioAnalysisResultsDialogProps {
  analysisResult: AudioAnalysisResult | null
  onStatusUpdate: (status: string) => void
  className?: string
}

function AudioAnalysisResultsDialog({
  analysisResult,
  onStatusUpdate,
  className
}: AudioAnalysisResultsDialogProps): React.JSX.Element {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-4 w-4 shrink-0 text-muted-foreground hover:text-foreground ${className || ''}`}
        >
          <Info className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[350px]">
        <DialogHeader>
          <DialogTitle>
            {analysisResult?.analysis_method === 'vad' ? 'AI Speech Analysis' : 'Audio Analysis'}
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {!analysisResult ? (
            <div className="text-center py-8">
              <Info className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-2">No analysis results yet</p>
              <p className="text-xs text-muted-foreground">
                Click "Analyze" to detect speech vs silence using AI
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground mb-2 text-center">
                Recommended 'Silence Threshold':
              </h4>
              {(() => {
                const recommended = analysisResult.suggestions?.vad_recommended
                if (recommended) {
                  return (
                    <div className="p-4 bg-muted border border-border rounded-lg text-center">
                      <div className="font-medium text-foreground text-xl mb-2">
                        {Math.round(recommended.threshold)}
                        <span className="text-xl ml-1">dB</span>
                      </div>
                      <div className="text-muted-foreground text-xs">{recommended.description}</div>
                    </div>
                  )
                }
                return <p className="text-sm text-muted-foreground">No suggestion available.</p>
              })()}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AudioAnalysisResultsDialog
