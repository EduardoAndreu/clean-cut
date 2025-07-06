import { useState } from 'react'
import LandingPage from './components/LandingPage'
import RemoveSilences from './components/RemoveSilences'

function App(): React.JSX.Element {
  const [currentPage, setCurrentPage] = useState<'landing' | 'remove-silences'>('landing')

  const handleRemoveSilences = () => {
    setCurrentPage('remove-silences')
  }

  const handleBackToLanding = () => {
    setCurrentPage('landing')
  }

  return (
    <div className="app">
      {currentPage === 'landing' ? (
        <LandingPage onRemoveSilences={handleRemoveSilences} />
      ) : (
        <div className="relative">
          <button
            onClick={handleBackToLanding}
            className="absolute top-4 left-4 text-gray-600 hover:text-gray-900 font-medium"
          >
            ← Back to Home
          </button>
          <RemoveSilences />
        </div>
      )}
    </div>
  )
}

export default App
