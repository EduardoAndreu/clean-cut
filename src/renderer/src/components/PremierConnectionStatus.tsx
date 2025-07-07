interface PremierConnectionStatusProps {
  isConnected: boolean
  className?: string
}

function PremierConnectionStatus({
  isConnected,
  className = ''
}: PremierConnectionStatusProps): React.JSX.Element {
  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
      <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
        Premiere Pro: {isConnected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  )
}

export default PremierConnectionStatus
