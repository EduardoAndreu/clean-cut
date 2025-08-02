import React from 'react'
import { Button } from './ui/button'
import PipelineLabel from './PipelineLabel'
import SettingsButton from './SettingsButton'
import ThemeLogo from './ThemeLogo'
import { Scissors, ZoomIn, BookOpen, Mic, RotateCcw, Film } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface LandingPageProps {
  onRemoveSilences: () => void
}

function LandingPage({ onRemoveSilences }: LandingPageProps): React.JSX.Element {
  const navigate = useNavigate()

  return (
    <div className="min-h-full bg-background text-foreground flex flex-col p-8">
      {/* Main content container */}
      <div className="flex-1 flex items-center justify-center">
        <div className="container mx-auto">
          {/* Header with logo and settings - aligned to grid */}
          <div className="flex justify-between items-center mb-8">
            <ThemeLogo />
            <SettingsButton />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 justify-items-center">
            {/* Remove Silences - Enabled */}
            <div className="relative group">
              <Button
                onClick={onRemoveSilences}
                variant="enabled"
                size="square"
                className="flex-col"
              >
                <Scissors className="w-5 h-5 text-current" />
                Remove Silences
              </Button>
            </div>

            {/* Frame Decimation - Enabled */}
            <div className="relative group">
              <Button
                onClick={() => navigate('/frame-decimation')}
                variant="enabled"
                size="square"
                className="flex-col"
              >
                <Film className="w-5 h-5 text-current" />
                Frame Decimation
              </Button>
            </div>

            {/* Add Zooms - Disabled */}
            <div className="relative group">
              <Button disabled variant="disabled" size="square" className="flex-col">
                <ZoomIn className="w-5 h-5 text-current" />
                Add Zooms
              </Button>
              <PipelineLabel />
            </div>

            {/* Add Chapters - Disabled */}
            <div className="relative group">
              <Button disabled variant="disabled" size="square" className="flex-col">
                <BookOpen className="w-5 h-5 text-current" />
                Add Chapters
              </Button>
              <PipelineLabel />
            </div>

            {/* Podcasts - Disabled */}
            <div className="relative group">
              <Button disabled variant="disabled" size="square" className="flex-col">
                <Mic className="w-5 h-5 text-current" />
                Podcasts
              </Button>
              <PipelineLabel />
            </div>

            {/* Remove Repetition - Disabled */}
            <div className="relative group">
              <Button disabled variant="disabled" size="square" className="flex-col">
                <RotateCcw className="w-5 h-5 text-current" />
                Remove Repetition
              </Button>
              <PipelineLabel />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LandingPage
