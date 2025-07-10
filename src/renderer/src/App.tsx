import { useState, useEffect } from 'react'
import LandingPage from './components/LandingPage'
import RemoveSilences from './components/RemoveSilences'
import ReturnHomeButton from './components/ReturnHomeButton'
import PremierConnectionStatus from './components/PremierConnectionStatus'

function App(): React.JSX.Element {
  const [currentPage, setCurrentPage] = useState<'landing' | 'remove-silences'>('landing')
  const [premiereConnected, setPremiereConnected] = useState<boolean>(false)

  // Listen for Premiere Pro connection status updates
  useEffect(() => {
    const handlePremiereStatus = (_event: any, data: { connected: boolean }) => {
      setPremiereConnected(data.connected)
    }

    // Add IPC listener for Premiere status updates
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.on('premiere-status-update', handlePremiereStatus)
    }

    return () => {
      // Cleanup listener on unmount
      if (window.electron && window.electron.ipcRenderer) {
        window.electron.ipcRenderer.removeAllListeners('premiere-status-update')
      }
    }
  }, [])

  const handleRemoveSilences = () => {
    setCurrentPage('remove-silences')
  }

  const handleBackToLanding = () => {
    setCurrentPage('landing')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Main content area */}
      <div className="flex-1">
        {currentPage === 'landing' ? (
          <LandingPage onRemoveSilences={handleRemoveSilences} />
        ) : (
          <div className="min-h-full bg-background text-foreground flex flex-col py-8 px-4">
            {/* Header with page title and return button */}
            <div className="flex justify-between items-center mb-8 px-6">
              <h2 className="text-2xl font-bold text-foreground">
                {currentPage === 'remove-silences' ? 'Remove Silences' : 'Clean-Cut'}
              </h2>
              <ReturnHomeButton onReturnHome={handleBackToLanding} />
            </div>

            {/* Main content */}
            <div className="flex-1">
              <RemoveSilences premiereConnected={premiereConnected} />
            </div>
          </div>
        )}
      </div>

      {/* Global connection status at the bottom - part of document flow */}
      <div className="flex justify-center py-4 bg-background border-t border-border">
        <PremierConnectionStatus isConnected={premiereConnected} />
      </div>
    </div>
  )
}

export default App
