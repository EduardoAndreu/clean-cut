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

// Function to update the sequence display
function updateSequenceDisplay(sequenceInfo) {
  const sequenceNameElement = document.getElementById('sequence-name')
  const sequenceDetailsElement = document.getElementById('sequence-details')

  if (sequenceInfo && sequenceInfo.success) {
    sequenceNameElement.textContent = sequenceInfo.sequenceName
    sequenceDetailsElement.textContent = `Project: ${sequenceInfo.projectName || 'Unknown'}`
  } else {
    sequenceNameElement.textContent = 'No active sequence'
    sequenceDetailsElement.textContent = sequenceInfo ? sequenceInfo.error : 'No sequence data'
  }
}

// Function to update the sequence details display
function updateSequenceDetailsDisplay(details) {
  const frameRateEl = document.getElementById('detail-frame-rate')
  const endTimeEl = document.getElementById('detail-end-time')
  const inPointEl = document.getElementById('detail-in-point')
  const outPointEl = document.getElementById('detail-out-point')
  const audioTrackCountEl = document.getElementById('detail-audio-track-count')
  const audioTracksEl = document.getElementById('detail-audio-tracks')
  const selectionEl = document.getElementById('detail-selection')

  if (details && details.success) {
    frameRateEl.textContent = details.frameRate || 'N/A'

    // Display duration with both seconds and timecode format
    if (details.durationSeconds !== undefined) {
      let durationText = `${details.durationSeconds.toFixed(2)}s`
      if (details.durationTime) {
        durationText += ` (${details.durationTime})`
      }
      endTimeEl.textContent = durationText
    } else {
      endTimeEl.textContent = 'N/A'
    }

    // Display in point with both regular and time object values
    if (details.inPoint !== undefined && details.inPoint >= 0) {
      let inPointText = `${details.inPoint.toFixed(2)}s`
      if (details.inPointTime) {
        inPointText += ` (${details.inPointTime})`
      }
      inPointEl.textContent = inPointText
    } else {
      inPointEl.textContent = 'None'
    }

    // Display out point with both regular and time object values
    if (details.outPoint !== undefined && details.outPoint >= 0) {
      let outPointText = `${details.outPoint.toFixed(2)}s`
      if (details.outPointTime) {
        outPointText += ` (${details.outPointTime})`
      }
      outPointEl.textContent = outPointText
    } else {
      outPointEl.textContent = 'None'
    }

    audioTrackCountEl.textContent = details.audioTracks || 0

    // Display audio track details
    if (details.audioTrackInfo && details.audioTrackInfo.length > 0) {
      audioTracksEl.innerHTML = '' // Clear previous entries
      details.audioTrackInfo.forEach((track) => {
        const trackDiv = document.createElement('div')
        trackDiv.textContent = `Track ${track.index}: ${track.name} (${track.muted ? 'Muted' : 'Active'})`
        audioTracksEl.appendChild(trackDiv)
      })
    } else {
      audioTracksEl.textContent = 'None'
    }

    // Display selection details
    if (details.selectedClips && details.selectedClips.length > 0) {
      selectionEl.innerHTML = '' // Clear previous entries
      details.selectedClips.forEach((clip) => {
        const clipDiv = document.createElement('div')
        clipDiv.style.marginBottom = '8px'

        // Create clip name line
        const nameDiv = document.createElement('div')
        nameDiv.textContent = `[${clip.mediaType}] ${clip.name}`
        nameDiv.style.fontWeight = 'bold'
        clipDiv.appendChild(nameDiv)

        // Create start point line
        const startDiv = document.createElement('div')
        let startText = `Start Point: ${clip.start.toFixed(2)}s`
        if (clip.startTime) {
          startText += ` (${clip.startTime})`
        }
        startDiv.textContent = startText
        startDiv.style.marginLeft = '8px'
        startDiv.style.fontSize = '9px'
        clipDiv.appendChild(startDiv)

        // Create end point line
        const endDiv = document.createElement('div')
        let endText = `End Point: ${clip.end.toFixed(2)}s`
        if (clip.endTime) {
          endText += ` (${clip.endTime})`
        }
        endDiv.textContent = endText
        endDiv.style.marginLeft = '8px'
        endDiv.style.fontSize = '9px'
        clipDiv.appendChild(endDiv)

        selectionEl.appendChild(clipDiv)
      })
    } else {
      selectionEl.textContent = 'None'
    }
  } else {
    // Reset to default values if no details are available
    frameRateEl.textContent = 'N/A'
    endTimeEl.textContent = 'N/A'
    inPointEl.textContent = 'N/A'
    outPointEl.textContent = 'N/A'
    audioTrackCountEl.textContent = '0'
    audioTracksEl.textContent = 'None'
    selectionEl.textContent = 'None'
  }
}

// Function to perform cut at specified time
function performCutAtTime() {
  const cutTimeInput = document.getElementById('cut-time-input')
  const cutButton = document.getElementById('cut-button')
  const cutTime = cutTimeInput.value.trim()

  if (!cutTime) {
    addLogEntry('Please enter a cut time', 'error')
    return
  }

  // Validate timecode format (HH:MM:SS:FF)
  const timecodeRegex = /^([0-9]{2}):([0-9]{2}):([0-9]{2}):([0-9]{2})$/
  if (!timecodeRegex.test(cutTime)) {
    addLogEntry('Invalid timecode format. Use HH:MM:SS:FF (e.g., 00:01:30:15)', 'error')
    return
  }

  // Disable button during operation
  cutButton.disabled = true
  cutButton.textContent = 'Cutting...'

  addLogEntry(`Performing cut at ${cutTime}`, 'info')

  // Call ExtendScript function to perform the cut
  cs.evalScript(`cutAllTracksAtTime('${cutTime}')`, function (result) {
    console.log('Cut operation result:', result)

    try {
      const resultData = JSON.parse(result)
      if (resultData.success) {
        addLogEntry(`Cut completed at ${cutTime}`, 'success')
        cutTimeInput.value = '' // Clear the input
      } else {
        addLogEntry(`Cut failed: ${resultData.error}`, 'error')
      }
    } catch (e) {
      addLogEntry(`Cut operation completed`, 'success')
      cutTimeInput.value = '' // Clear the input
    }

    // Re-enable button
    cutButton.disabled = false
    cutButton.textContent = 'Cut'
  })
}

// Function to refresh sequence info
function refreshSequenceInfo() {
  addLogEntry('Refreshing sequence info...', 'info')

  // Call ExtendScript function to get active sequence info
  cs.evalScript('getActiveSequenceInfo()', function (result) {
    console.log('Raw ExtendScript result:', result)
    console.log('Result type:', typeof result)
    console.log('Result length:', result ? result.length : 'null/undefined')

    // Log the actual content for debugging
    addLogEntry(`Raw result: ${result}`, 'info')

    try {
      const resultData = JSON.parse(result)
      if (resultData.success) {
        addLogEntry(`Sequence refreshed: ${resultData.sequenceName}`, 'success')
        updateSequenceDisplay(resultData)
        updateSequenceDetailsDisplay(resultData)
      } else {
        addLogEntry(`Failed to refresh sequence: ${resultData.error}`, 'error')
        updateSequenceDisplay(null)
        updateSequenceDetailsDisplay(null)
      }
    } catch (e) {
      addLogEntry(`Error parsing sequence info: ${e.message}`, 'error')
      addLogEntry(`Raw result was: "${result}"`, 'error')
      updateSequenceDisplay(null)
      updateSequenceDetailsDisplay(null)
    }
  })
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

      // Automatically get sequence info when connected
      setTimeout(() => {
        refreshSequenceInfo()
      }, 1000) // Small delay to ensure connection is fully established
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

          case 'request_sequence_info':
            console.log('Received request for sequence info')
            addLogEntry('Received sequence info request', 'info')

            // Call ExtendScript function to get active sequence info
            cs.evalScript('getActiveSequenceInfo()', function (result) {
              console.log('Sequence info result:', result)

              try {
                const resultData = JSON.parse(result)
                if (resultData.success) {
                  addLogEntry(`Sequence info retrieved: ${resultData.sequenceName}`, 'success')
                  updateSequenceDisplay(resultData)
                } else {
                  addLogEntry(`Failed to get sequence info: ${resultData.error}`, 'error')
                  updateSequenceDisplay(null)
                }
              } catch (e) {
                addLogEntry('Sequence info retrieved', 'success')
              }

              // Send the sequence info back to the server
              const response = {
                type: 'sequence_info_response',
                payload: result
              }
              ws.send(JSON.stringify(response))
              console.log('Sequence info response sent:', response)
            })
            break

          case 'request_selected_clips_info':
            console.log('Received request for selected clips info')
            addLogEntry('Received selected clips info request', 'info')

            // Call ExtendScript function to get selected clips info
            cs.evalScript('getSelectedClipsInfo()', function (result) {
              console.log('Selected clips info result:', result)

              try {
                const resultData = JSON.parse(result)
                if (resultData.success) {
                  addLogEntry(
                    `Selected clips info retrieved: ${resultData.selectedClips.length} clips`,
                    'success'
                  )
                } else {
                  addLogEntry(`Failed to get selected clips info: ${resultData.error}`, 'error')
                }
              } catch (e) {
                addLogEntry('Selected clips info retrieved', 'success')
              }

              // Send the selected clips info back to the server
              const response = {
                type: 'selected_clips_info_response',
                payload: result
              }
              ws.send(JSON.stringify(response))
              console.log('Selected clips info response sent:', response)
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

  // Initialize sequence display
  updateSequenceDisplay(null)

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
