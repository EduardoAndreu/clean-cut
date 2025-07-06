import React from 'react'
import { Button } from './ui/button'
import PipelineLabel from './PipelineLabel'
import { Scissors, ZoomIn, BookOpen, Mic, RotateCcw, Filter } from 'lucide-react'

interface LandingPageProps {
  onRemoveSilences: () => void
}

function LandingPage({ onRemoveSilences }: LandingPageProps): React.JSX.Element {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="container mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-black mb-4 tracking-tight">Clean-Cut</h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 justify-items-center">
          {/* Remove Silences - Enabled */}
          <div className="relative group">
            <Button onClick={onRemoveSilences} variant="enabled" size="square" className="flex-col">
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
      </div>
    </div>
  )
}

export default LandingPage
