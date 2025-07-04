// Create CSInterface object for communication with Premiere Pro
const cs = new CSInterface()

let ws = null
let reconnectAttempts = 0
const maxReconnectAttempts = 10

// Function to update the status message in the UI
function updateStatus(message, isConnected = false) {
  const statusElement = document.getElementById('status')
  statusElement.textContent = `Status: ${message}`
  statusElement.className = isConnected ? 'connected' : 'disconnected'
}

// Main connection function
function connect() {
  try {
    console.log('Attempting to connect to WebSocket server...')
    updateStatus('Connecting...')

    // Create WebSocket connection to localhost:8085
    ws = new WebSocket('ws://localhost:8085')

    // Handle connection open
    ws.onopen = function (event) {
      console.log('WebSocket connection established')
      updateStatus('Connected', true)
      reconnectAttempts = 0

      // Send handshake message to server
      const handshakeMessage = {
        type: 'handshake',
        payload: 'premiere'
      }
      ws.send(JSON.stringify(handshakeMessage))
      console.log('Handshake message sent:', handshakeMessage)
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

            // Call ExtendScript function to export active sequence audio
            cs.evalScript('exportActiveSequenceAudio()', function (result) {
              console.log('Audio export result:', result)

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

            // Call ExtendScript function to perform cuts
            const cutsData = JSON.stringify(message.payload)
            cs.evalScript(`performCuts('${cutsData}')`, function (result) {
              console.log('Cuts result:', result)

              // Send success message back to server
              const response = {
                type: 'cuts_response',
                payload: 'success'
              }
              ws.send(JSON.stringify(response))
              console.log('Cuts response sent:', response)
            })
            break

          default:
            console.log('Unknown message type:', message.type)
            break
        }
      } catch (error) {
        console.error('Error parsing message:', error)
      }
    }

    // Handle connection close
    ws.onclose = function (event) {
      console.log('WebSocket connection closed:', event)
      updateStatus('Disconnected')

      // Attempt to reconnect after delay if not at max attempts
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++
        const delay = Math.min(5000 * reconnectAttempts, 30000) // Exponential backoff, max 30s
        console.log(
          `Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`
        )
        updateStatus(
          `Reconnecting in ${delay / 1000}s... (${reconnectAttempts}/${maxReconnectAttempts})`
        )

        setTimeout(connect, delay)
      } else {
        console.log('Max reconnection attempts reached')
        updateStatus('Connection failed - Max attempts reached')
      }
    }

    // Handle connection errors
    ws.onerror = function (error) {
      console.error('WebSocket error:', error)
      updateStatus('Connection error')
    }
  } catch (error) {
    console.error('Error creating WebSocket connection:', error)
    updateStatus('Connection error')

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
