import { useState } from 'react'
import LandingPage from './components/LandingPage'
import RemoveSilences from './components/RemoveSilences'
import ReturnHomeButton from './components/ReturnHomeButton'

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
          <ReturnHomeButton onReturnHome={handleBackToLanding} />
          <RemoveSilences />
        </div>
      )}
    </div>
  )
}

export default App
