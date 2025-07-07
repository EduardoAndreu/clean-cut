import React from 'react'
import { Button } from './ui/button'
import PipelineLabel from './PipelineLabel'
import SettingsButton from './SettingsButton'
import PremierConnectionStatus from './PremierConnectionStatus'
import { Scissors, ZoomIn, BookOpen, Mic, RotateCcw, Filter } from 'lucide-react'
import logoImg from '../assets/logo.png'

interface LandingPageProps {
  onRemoveSilences: () => void
  premiereConnected: boolean
}

function LandingPage({ onRemoveSilences, premiereConnected }: LandingPageProps): React.JSX.Element {
  return (
    <div className="min-h-screen bg-white flex flex-col p-8">
      {/* Main content container */}
      <div className="flex-1 flex items-center justify-center">
        <div className="container mx-auto">
          {/* Header with logo and settings - aligned to grid */}
          <div className="flex justify-between items-center mb-8">
            <img src={logoImg} alt="Clean-Cut Logo" className="h-10 w-auto" />
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
                <Scissors className="w-5 h-5 text-black" />
                Remove Silences
              </Button>
            </div>

            {/* Add Zooms - Disabled */}
            <div className="relative group">
              <Button disabled variant="disabled" size="square" className="flex-col">
                <ZoomIn className="w-5 h-5 text-gray-400" />
                Add Zooms
              </Button>
              <PipelineLabel />
            </div>

            {/* Add Chapters - Disabled */}
            <div className="relative group">
              <Button disabled variant="disabled" size="square" className="flex-col">
                <BookOpen className="w-5 h-5 text-gray-400" />
                Add Chapters
              </Button>
              <PipelineLabel />
            </div>

            {/* Podcasts - Disabled */}
            <div className="relative group">
              <Button disabled variant="disabled" size="square" className="flex-col">
                <Mic className="w-5 h-5 text-gray-400" />
                Podcasts
              </Button>
              <PipelineLabel />
            </div>

            {/* Remove Repetition - Disabled */}
            <div className="relative group">
              <Button disabled variant="disabled" size="square" className="flex-col">
                <RotateCcw className="w-5 h-5 text-gray-400" />
                Remove Repetition
              </Button>
              <PipelineLabel />
            </div>

            {/* Filter Profanity - Disabled */}
            <div className="relative group">
              <Button disabled variant="disabled" size="square" className="flex-col">
                <Filter className="w-5 h-5 text-gray-400" />
                Filter Profanity
              </Button>
              <PipelineLabel />
            </div>
          </div>

          {/* Premiere Pro Connection Status - Centered below grid */}
          <div className="flex justify-center mt-8">
            <PremierConnectionStatus isConnected={premiereConnected} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default LandingPage
