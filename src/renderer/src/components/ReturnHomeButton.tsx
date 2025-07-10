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
      className="text-muted-foreground hover:text-foreground"
    >
      <Home className="w-5 h-5" />
    </Button>
  )
}

export default ReturnHomeButton
