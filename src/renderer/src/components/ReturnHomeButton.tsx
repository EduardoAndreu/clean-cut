import React from 'react'
import { Button } from './ui/button'
import { Home } from 'lucide-react'

interface ReturnHomeButtonProps {
  onReturnHome: () => void
}

function ReturnHomeButton({ onReturnHome }: ReturnHomeButtonProps): React.JSX.Element {
  return (
    <Button
      onClick={onReturnHome}
      variant="ghost"
      size="icon"
      className="absolute top-4 right-4 text-gray-600 hover:text-gray-900"
    >
      <Home className="w-5 h-5" />
    </Button>
  )
}

export default ReturnHomeButton
