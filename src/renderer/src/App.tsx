import { useState, useEffect } from 'react'
import LandingPage from './components/LandingPage'
import RemoveSilences from './components/RemoveSilences'
import ReturnHomeButton from './components/ReturnHomeButton'

function App(): React.JSX.Element {
  const [currentPage, setCurrentPage] = useState<'landing' | 'remove-silences'>('landing')
  const [premiereConnected, setPremiereConnected] = useState<boolean>(false)

  // Listen for Premiere Pro connection status updates
  useEffect(() => {
    const handlePremiereStatus = (event: any, data: { connected: boolean }) => {
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
    <div className="app">
      {currentPage === 'landing' ? (
        <LandingPage
          onRemoveSilences={handleRemoveSilences}
          premiereConnected={premiereConnected}
        />
      ) : (
        <div className="relative">
          <ReturnHomeButton onReturnHome={handleBackToLanding} />
          <RemoveSilences />
        </div>
      )}
    </div>
  )
}

export default App
