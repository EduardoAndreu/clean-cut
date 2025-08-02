import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import LandingPage from './components/LandingPage'
import RemoveSilences from './components/RemoveSilences'
import FrameDecimation from './components/FrameDecimation'
import ReturnHomeButton from './components/ReturnHomeButton'
import PremierConnectionStatus from './components/PremierConnectionStatus'

function AppContent(): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
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
    navigate('/remove-silences')
  }

  const handleBackToLanding = () => {
    navigate('/')
  }

  const isLandingPage = location.pathname === '/'

  return (
    <div className="min-h-screen flex flex-col">
      {/* Main content area */}
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage onRemoveSilences={handleRemoveSilences} />} />
          <Route
            path="/remove-silences"
            element={
              <div className="min-h-full bg-background text-foreground flex flex-col py-8 px-4">
                {/* Header with page title and return button */}
                <div className="flex justify-between items-center mb-8 px-6">
                  <h2 className="text-2xl font-bold text-foreground">Remove Silences</h2>
                  <ReturnHomeButton onReturnHome={handleBackToLanding} />
                </div>

                {/* Main content */}
                <div className="flex-1">
                  <RemoveSilences premiereConnected={premiereConnected} />
                </div>
              </div>
            }
          />
          <Route path="/frame-decimation" element={<FrameDecimation />} />
        </Routes>
      </div>

      {/* Global connection status at the bottom - only show on landing and remove-silences pages */}
      {(isLandingPage || location.pathname === '/remove-silences') && (
        <div className="flex justify-center py-4 bg-background border-t border-border">
          <PremierConnectionStatus isConnected={premiereConnected} />
        </div>
      )}
    </div>
  )
}

function App(): React.JSX.Element {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App
