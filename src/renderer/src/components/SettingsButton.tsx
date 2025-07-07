import React, { useState } from 'react'
import { Button } from './ui/button'
import { Settings } from 'lucide-react'

function SettingsButton(): React.JSX.Element {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <div className="absolute top-4 right-4">
      <Button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        variant="ghost"
        size="icon"
        className="text-gray-600 hover:text-gray-900"
      >
        <Settings className="w-5 h-5" />
      </Button>

      {isMenuOpen && (
        <div className="absolute top-12 right-0 bg-white border border-gray-200 rounded-md shadow-lg p-4 min-w-48 z-10">
          <p className="text-sm text-gray-600">Settings menu coming soon...</p>
          <p className="text-xs text-gray-400 mt-2">Configure your preferences here</p>
        </div>
      )}
    </div>
  )
}

export default SettingsButton
