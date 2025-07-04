// Create CSInterface object for communication with Premiere Pro
const cs = new CSInterface()

let ws = null
let reconnectAttempts = 0
const maxReconnectAttempts = 10

// Logging functionality
function addLogEntry(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false })
  const logsContainer = document.getElementById('logs-container')

  const logEntry = document.createElement('div')
  logEntry.className = 'log-entry'

  const timestampSpan = document.createElement('span')
  timestampSpan.className = 'log-timestamp'
  timestampSpan.textContent = `[${timestamp}]`

  const messageSpan = document.createElement('span')
  messageSpan.className = `log-${type}`
  messageSpan.textContent = message

  logEntry.appendChild(timestampSpan)
  logEntry.appendChild(messageSpan)

  logsContainer.appendChild(logEntry)

  // Keep only last 20 log entries
  while (logsContainer.children.length > 20) {
    logsContainer.removeChild(logsContainer.firstChild)
  }

  // Auto-scroll to bottom
  logsContainer.scrollTop = logsContainer.scrollHeight
}

// Function to update the status message and indicator in the UI
function updateStatus(message, connectionState = 'disconnected') {
  const statusIndicator = document.getElementById('status-indicator')
  const statusText = document.getElementById('status-text')
  const reconnectButton = document.getElementById('reconnect-button')

  // Update indicator
  statusIndicator.className = `status-indicator ${connectionState}`

  // Update text
  statusText.textContent = message

  // Update button state
  if (connectionState === 'connected') {
    reconnectButton.textContent = 'Disconnect'
    reconnectButton.disabled = false
  } else if (connectionState === 'connecting') {
    reconnectButton.textContent = 'Connecting...'
    reconnectButton.disabled = true
  } else {
    reconnectButton.textContent = 'Reconnect to Clean-Cut App'
    reconnectButton.disabled = false
  }
}

// Function to reconnect (called by button)
function reconnectToApp() {
  const reconnectButton = document.getElementById('reconnect-button')

  if (ws && ws.readyState === WebSocket.OPEN) {
    // If connected, disconnect
    addLogEntry('Disconnecting from Clean-Cut app...', 'warning')
    ws.close()
    return
  }

  // If disconnected, reconnect
  addLogEntry('Manual reconnection requested', 'info')
  reconnectAttempts = 0 // Reset attempts for manual reconnection
  connect()
}

// Main connection function
function connect() {
  try {
    console.log('Attempting to connect to WebSocket server...')
    updateStatus('Connecting to Clean-Cut app...', 'connecting')
    addLogEntry('Attempting to connect to Clean-Cut app...', 'info')

    // Create WebSocket connection to localhost:8085
    ws = new WebSocket('ws://localhost:8085')

    // Handle connection open
    ws.onopen = function (event) {
      console.log('WebSocket connection established')
      updateStatus('Connected to Clean-Cut app', 'connected')
      addLogEntry('Successfully connected to Clean-Cut app', 'success')
      reconnectAttempts = 0

      // Send handshake message to server
      const handshakeMessage = {
        type: 'handshake',
        payload: 'premiere'
      }
      ws.send(JSON.stringify(handshakeMessage))
      console.log('Handshake message sent:', handshakeMessage)
      addLogEntry('Handshake completed', 'success')
    }

    // Handle incoming messages
    ws.onmessage = function (event) {
      try {
        const message = JSON.parse(event.data)
        console.log('Received message:', message)

        // Process message based on type
        switch (message.type) {
          case 'request_audio_path':
            console.log('Received request for audio path')
            addLogEntry('Received audio export request', 'info')

            // Call ExtendScript function to export active sequence audio
            cs.evalScript('exportActiveSequenceAudio()', function (result) {
              console.log('Audio export result:', result)

              try {
                const resultData = JSON.parse(result)
                if (resultData.success) {
                  addLogEntry(`Audio exported: ${resultData.filePath}`, 'success')
                } else {
                  addLogEntry(`Export failed: ${resultData.error}`, 'error')
                }
              } catch (e) {
                addLogEntry(`Audio exported to: ${result}`, 'success')
              }

              // Send the file path back to the server
              const response = {
                type: 'audio_path_response',
                payload: result
              }
              ws.send(JSON.stringify(response))
              console.log('Audio path response sent:', response)
            })
            break

          case 'request_cuts':
            console.log('Received request to perform cuts:', message.payload)
            addLogEntry(`Performing ${message.payload.length} cuts...`, 'info')

            // Call ExtendScript function to perform cuts
            const cutsData = JSON.stringify(message.payload)
            cs.evalScript(`performCuts('${cutsData}')`, function (result) {
              console.log('Cuts result:', result)

              try {
                const resultData = JSON.parse(result)
                if (resultData.success) {
                  addLogEntry(`Successfully performed ${resultData.cutsPerformed} cuts`, 'success')
                } else {
                  addLogEntry(`Cut operation failed: ${resultData.error}`, 'error')
                }
              } catch (e) {
                addLogEntry('Cuts completed', 'success')
              }

              // Send success message back to server
              const response = {
                type: 'cuts_response',
                payload: 'success'
              }
              ws.send(JSON.stringify(response))
              console.log('Cuts response sent:', response)
            })
            break

          case 'error':
            console.log('Received error from server:', message.payload)
            addLogEntry(`Server error: ${message.payload}`, 'error')
            break

          default:
            console.log('Unknown message type:', message.type)
            addLogEntry(`Unknown message type: ${message.type}`, 'warning')
            break
        }
      } catch (error) {
        console.error('Error parsing message:', error)
        addLogEntry(`Message parse error: ${error.message}`, 'error')
      }
    }

    // Handle connection close
    ws.onclose = function (event) {
      console.log('WebSocket connection closed:', event)
      updateStatus('Disconnected from Clean-Cut app', 'disconnected')
      addLogEntry('Connection closed', 'warning')

      // Attempt to reconnect after delay if not at max attempts
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++
        const delay = Math.min(5000 * reconnectAttempts, 30000) // Exponential backoff, max 30s
        console.log(
          `Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`
        )
        updateStatus(
          `Reconnecting in ${delay / 1000}s... (${reconnectAttempts}/${maxReconnectAttempts})`,
          'connecting'
        )
        addLogEntry(
          `Reconnecting in ${delay / 1000}s... (${reconnectAttempts}/${maxReconnectAttempts})`,
          'info'
        )

        setTimeout(connect, delay)
      } else {
        console.log('Max reconnection attempts reached')
        updateStatus('Connection failed - Max attempts reached', 'disconnected')
        addLogEntry('Max reconnection attempts reached', 'error')
      }
    }

    // Handle connection errors
    ws.onerror = function (error) {
      console.error('WebSocket error:', error)
      updateStatus('Connection error', 'disconnected')
      addLogEntry('WebSocket connection error', 'error')
    }
  } catch (error) {
    console.error('Error creating WebSocket connection:', error)
    updateStatus('Connection error', 'disconnected')
    addLogEntry(`Connection error: ${error.message}`, 'error')

    // Retry connection after delay
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++
      setTimeout(connect, 5000)
    }
  }
}

// Start the connection process when the script loads
document.addEventListener('DOMContentLoaded', function () {
  console.log('Clean Cut Premiere Extension loaded')
  addLogEntry('Extension initialized', 'info')

  // Clear the initial log entry and add startup message
  const logsContainer = document.getElementById('logs-container')
  logsContainer.innerHTML = ''
  addLogEntry('Extension loaded and ready', 'success')

  // Start connection
  connect()
})

// Also start immediately in case DOMContentLoaded has already fired
if (document.readyState === 'loading') {
  // DOM is still loading, wait for DOMContentLoaded
} else {
  // DOM is already ready
  console.log('Clean Cut Premiere Extension loaded (immediate)')
  connect()
}
