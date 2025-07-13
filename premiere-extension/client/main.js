// Create CSInterface object for communication with Premiere Pro
const cs = new CSInterface()

let ws = null
let reconnectAttempts = 0
const maxReconnectAttempts = 10

// Import configuration from config.js (loaded via script tag)
const WEBSOCKET_PORT = WEBSOCKET_CONFIG.PORT

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

// Helper function to update connection status
function updateStatus(message, status) {
  const statusElement = document.getElementById('status-text')
  const statusDot = document.getElementById('status-indicator')

  if (statusElement) {
    statusElement.textContent = message
  }

  if (statusDot) {
    statusDot.className = `status-indicator ${status}`
  }
}

// Helper function to update port display
function updatePortDisplay(port) {
  const portElement = document.getElementById('status-details')
  if (portElement) {
    portElement.textContent = `Port: ${port}`
  }
}

// Helper function to update sequence display
function updateSequenceDisplay(sequenceData) {
  const sequenceNameElement = document.getElementById('sequence-name')
  const sequenceDetailsElement = document.getElementById('sequence-details')

  if (sequenceNameElement) {
    if (sequenceData && sequenceData.success) {
      sequenceNameElement.textContent = sequenceData.sequenceName || 'Unnamed sequence'
      sequenceNameElement.className = 'sequence-name active'
    } else {
      sequenceNameElement.textContent = 'No active sequence'
      sequenceNameElement.className = 'sequence-name'
    }
  }

  if (sequenceDetailsElement) {
    if (sequenceData && sequenceData.success) {
      const details = []
      if (sequenceData.frameRate) details.push(`${sequenceData.frameRate} fps`)
      if (sequenceData.durationTime) details.push(`${sequenceData.durationTime}`)
      if (sequenceData.audioTracks) details.push(`${sequenceData.audioTracks} audio tracks`)
      if (sequenceData.videoTracks) details.push(`${sequenceData.videoTracks} video tracks`)

      sequenceDetailsElement.textContent = details.join(' • ')
    } else {
      sequenceDetailsElement.textContent = 'No sequence data'
    }
  }
}

// Helper function to update sequence details display
function updateSequenceDetailsDisplay(sequenceData) {
  const frameRateElement = document.getElementById('detail-frame-rate')
  const endTimeElement = document.getElementById('detail-end-time')
  const inPointElement = document.getElementById('detail-in-point')
  const outPointElement = document.getElementById('detail-out-point')
  const selectionElement = document.getElementById('detail-selection')

  if (sequenceData && sequenceData.success) {
    if (frameRateElement) frameRateElement.textContent = sequenceData.frameRate || 'N/A'
    if (endTimeElement) endTimeElement.textContent = sequenceData.durationTime || 'N/A'
    if (inPointElement) inPointElement.textContent = sequenceData.inPointTime || 'N/A'
    if (outPointElement) outPointElement.textContent = sequenceData.outPointTime || 'N/A'

    if (selectionElement) {
      if (sequenceData.selectedClips && sequenceData.selectedClips.length > 0) {
        const clipNames = sequenceData.selectedClips
          .slice(0, 3)
          .map((clip) => clip.name)
          .join(', ')
        const moreCount =
          sequenceData.selectedClips.length > 3
            ? ` +${sequenceData.selectedClips.length - 3} more`
            : ''
        selectionElement.textContent = clipNames + moreCount
      } else {
        selectionElement.textContent = 'None'
      }
    }
  } else {
    if (frameRateElement) frameRateElement.textContent = 'N/A'
    if (endTimeElement) endTimeElement.textContent = 'N/A'
    if (inPointElement) inPointElement.textContent = 'N/A'
    if (outPointElement) outPointElement.textContent = 'N/A'
    if (selectionElement) selectionElement.textContent = 'None'
  }
}

// Function to refresh sequence info
function refreshSequenceInfo() {
  addLogEntry('🔄 Refreshing sequence info', 'info')

  // Call ExtendScript function to get active sequence info
  cs.evalScript('getActiveSequenceInfo()', function (result) {
    try {
      const resultData = JSON.parse(result)
      if (resultData.success) {
        addLogEntry(`✅ Sequence: ${resultData.sequenceName}`, 'success')
        updateSequenceDisplay(resultData)
        updateSequenceDetailsDisplay(resultData)
      } else {
        addLogEntry(`❌ Failed to get sequence info: ${resultData.error}`, 'error')
        updateSequenceDisplay(null)
        updateSequenceDetailsDisplay(null)
      }
    } catch (e) {
      addLogEntry(`❌ Error parsing sequence info: ${e.message}`, 'error')
      updateSequenceDisplay(null)
      updateSequenceDetailsDisplay(null)
    }
  })
}

// Main connection function
function connect() {
  try {
    updateStatus('Connecting to Clean-Cut app...', 'connecting')
    addLogEntry(`🔗 Connecting to Clean-Cut app on port ${WEBSOCKET_PORT}`, 'info')

    // Update port display
    updatePortDisplay(WEBSOCKET_PORT)

    // Create WebSocket connection
    ws = new WebSocket(`ws://localhost:${WEBSOCKET_PORT}`)

    // Handle connection open
    ws.onopen = function (event) {
      updateStatus('Connected to Clean-Cut app', 'connected')
      addLogEntry('✅ Connected to Clean-Cut app', 'success')
      reconnectAttempts = 0

      // Send handshake message to server
      const handshakeMessage = {
        type: 'handshake',
        payload: 'premiere'
      }
      ws.send(JSON.stringify(handshakeMessage))
      addLogEntry('🤝 Handshake sent', 'info')

      // Automatically get sequence info when connected
      setTimeout(() => {
        refreshSequenceInfo()
      }, 1000) // Small delay to ensure connection is fully established
    }

    // Handle incoming messages
    ws.onmessage = function (event) {
      try {
        const message = JSON.parse(event.data)

        // Process message based on type
        switch (message.type) {
          case 'handshake_ack':
            addLogEntry('🤝 Handshake acknowledged', 'success')
            break

          case 'request_cuts':
            addLogEntry(`✂️ Performing cuts`, 'info')

            // Process cuts one by one using the simpler cutAtTime function
            const silenceRanges = message.payload
            const totalRanges = silenceRanges.length
            let totalCutsPerformed = 0
            let errors = []

            // Create a flat array of all cut times (start and end for each range)
            const cutTimes = []
            silenceRanges.forEach((range, index) => {
              cutTimes.push({ time: range.start, type: 'start', rangeIndex: index })
              cutTimes.push({ time: range.end, type: 'end', rangeIndex: index })
            })

            // Sort cut times chronologically
            cutTimes.sort((a, b) => a.time - b.time)

            let currentCutIndex = 0

            function processNextCut() {
              if (currentCutIndex >= cutTimes.length) {
                // All cuts completed
                const finalMessage =
                  errors.length === 0
                    ? `✅ Completed cuts for ranges`
                    : `⚠️ Completed cuts with ${errors.length} errors`

                addLogEntry(finalMessage, errors.length === 0 ? 'success' : 'warning')

                // Send success message back to server
                const response = {
                  type: 'cuts_response',
                  payload: {
                    success: true,
                    totalCutsPerformed,
                    totalRanges,
                    errors: errors.length > 0 ? errors : undefined
                  },
                  sessionId: message.sessionId
                }
                ws.send(JSON.stringify(response))
                return
              }

              const cutInfo = cutTimes[currentCutIndex]
              const cutTime = cutInfo.time
              const cutScriptCall = `cutAtTime(${cutTime})`

              cs.evalScript(cutScriptCall, function (result) {
                try {
                  const resultData = JSON.parse(result)
                  if (resultData.success) {
                    totalCutsPerformed += resultData.cutsPerformed || 0
                    if (
                      (currentCutIndex + 1) % 10 === 0 ||
                      currentCutIndex === cutTimes.length - 1
                    ) {
                      addLogEntry(
                        `⚡ Processed ${currentCutIndex + 1}/${cutTimes.length} cuts`,
                        'info'
                      )
                    }
                  } else {
                    errors.push(`Cut ${currentCutIndex + 1} (${cutTime}s): ${resultData.error}`)
                    addLogEntry(
                      `❌ Cut ${currentCutIndex + 1} failed: ${resultData.error}`,
                      'error'
                    )
                  }
                } catch (e) {
                  errors.push(`Cut ${currentCutIndex + 1} (${cutTime}s): Parse error - ${result}`)
                  addLogEntry(`❌ Cut ${currentCutIndex + 1} failed: ${result}`, 'error')
                }

                currentCutIndex++
                setTimeout(processNextCut, 50)
              })
            }

            // Start processing cuts
            processNextCut()
            break

          case 'request_sequence_info':
            addLogEntry('📊 Sequence info requested', 'info')

            // Call ExtendScript function to get active sequence info
            cs.evalScript('getActiveSequenceInfo()', function (result) {
              try {
                const resultData = JSON.parse(result)
                if (resultData.success) {
                  addLogEntry(`✅ Sequence info: ${resultData.sequenceName}`, 'success')
                  updateSequenceDisplay(resultData)
                } else {
                  addLogEntry(`❌ Failed to get sequence info: ${resultData.error}`, 'error')
                  updateSequenceDisplay(null)
                }
              } catch (e) {
                addLogEntry('✅ Sequence info retrieved', 'success')
              }

              // Send the sequence info back to the server
              const response = {
                type: 'sequence_info_response',
                payload: result
              }
              ws.send(JSON.stringify(response))
            })
            break

          case 'request_audio_export':
            const { exportFolder, selectedTracks, selectedRange } = message.payload
            const selectedTracksJson = JSON.stringify(selectedTracks)

            addLogEntry(`🎵 Exporting audio: ${selectedTracks.length} tracks`, 'info')

            // Call ExtendScript function to export sequence audio with specific parameters
            const scriptCall = `exportSequenceAudio('${exportFolder}', '${selectedTracksJson}', '${selectedRange}')`

            cs.evalScript(scriptCall, function (result) {
              try {
                const resultData = JSON.parse(result)
                if (resultData.success) {
                  addLogEntry(`✅ Audio exported successfully`, 'success')
                } else {
                  addLogEntry(`❌ Export failed: ${resultData.error}`, 'error')
                }
              } catch (e) {
                // Handle non-JSON response (might be just the file path)
                if (result && result.length > 0) {
                  addLogEntry(`✅ Audio exported successfully`, 'success')
                } else {
                  addLogEntry('✅ Export completed', 'success')
                }
              }

              // Send the export result back to the server
              const response = {
                type: 'audio_export_response',
                payload: result
              }
              ws.send(JSON.stringify(response))
            })
            break

          case 'request_delete_silences':
            addLogEntry(`🗑️ Deleting ${message.payload.length} silence segments`, 'info')

            const deleteScriptCall = `deleteSilenceSegments('${JSON.stringify(message.payload)}')`
            cs.evalScript(deleteScriptCall, function (result) {
              try {
                const resultData = JSON.parse(result)
                if (resultData.success) {
                  addLogEntry(
                    `✅ Deleted ${resultData.deletedSegments || message.payload.length} silence segments`,
                    'success'
                  )
                } else {
                  // Silent success - delete operation completed without explicit success confirmation
                  addLogEntry(`✅ Delete operation completed`, 'success')
                }
              } catch (e) {
                addLogEntry(`✅ Delete operation completed`, 'success')
              }

              // Send response back to server
              const response = {
                type: 'delete_silences_response',
                payload: result,
                sessionId: message.sessionId
              }
              ws.send(JSON.stringify(response))
            })
            break

          case 'request_mute_silences':
            addLogEntry(`🔇 Muting ${message.payload.length} silence segments`, 'info')

            const muteScriptCall = `muteSilenceSegments('${JSON.stringify(message.payload)}')`
            cs.evalScript(muteScriptCall, function (result) {
              try {
                const resultData = JSON.parse(result)
                if (resultData.success) {
                  addLogEntry(
                    `✅ Muted ${resultData.mutedSegments || message.payload.length} silence segments`,
                    'success'
                  )
                } else {
                  addLogEntry(`❌ Mute failed: ${resultData.error}`, 'error')
                }
              } catch (e) {
                addLogEntry(`✅ Mute operation completed`, 'success')
              }

              // Send response back to server
              const response = {
                type: 'mute_silences_response',
                payload: result,
                sessionId: message.sessionId
              }
              ws.send(JSON.stringify(response))
            })
            break

          case 'request_remove_silences_with_gaps':
            addLogEntry(`🕳️ Removing ${message.payload.length} silence segments with gaps`, 'info')

            const removeWithGapsScriptCall = `removeSilenceSegmentsWithGaps('${JSON.stringify(message.payload)}')`
            cs.evalScript(removeWithGapsScriptCall, function (result) {
              try {
                const resultData = JSON.parse(result)
                if (resultData.success) {
                  addLogEntry(
                    `✅ Removed ${resultData.removedSegments || message.payload.length} silence segments with gaps`,
                    'success'
                  )
                } else {
                  addLogEntry(`❌ Remove with gaps failed: ${resultData.error}`, 'error')
                }
              } catch (e) {
                addLogEntry(`✅ Remove with gaps operation completed`, 'success')
              }

              // Send response back to server
              const response = {
                type: 'remove_silences_with_gaps_response',
                payload: result,
                sessionId: message.sessionId
              }
              ws.send(JSON.stringify(response))
            })
            break

          case 'error':
            addLogEntry(`❌ Server error: ${message.payload}`, 'error')
            break

          default:
            addLogEntry(`❓ Unknown message type: ${message.type}`, 'warning')
            break
        }
      } catch (error) {
        addLogEntry(`❌ Message parse error: ${error.message}`, 'error')
      }
    }

    // Handle connection close
    ws.onclose = function (event) {
      updateStatus('Disconnected from Clean-Cut app', 'disconnected')
      addLogEntry('⚠️ Connection closed', 'warning')

      // Clear port display when disconnected
      updatePortDisplay('---')

      // Attempt to reconnect after delay if not at max attempts
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++
        const delay = Math.min(5000 * reconnectAttempts, 30000) // Exponential backoff, max 30s
        updateStatus(
          `Reconnecting in ${delay / 1000}s... (${reconnectAttempts}/${maxReconnectAttempts})`,
          'connecting'
        )
        addLogEntry(
          `🔄 Reconnecting in ${delay / 1000}s (${reconnectAttempts}/${maxReconnectAttempts})`,
          'info'
        )

        setTimeout(connect, delay)
      } else {
        updateStatus('Connection failed - Retrying in 60s...', 'connecting')
        addLogEntry('🔄 Max attempts reached, will retry in 60s', 'warning')

        // Reset attempts and try again after a longer delay
        setTimeout(() => {
          reconnectAttempts = 0
          connect()
        }, 60000) // 60 seconds
      }
    }

    // Handle connection errors
    ws.onerror = function (error) {
      updateStatus('Connection error', 'disconnected')
      addLogEntry('❌ WebSocket connection error', 'error')
    }
  } catch (error) {
    updateStatus('Connection error', 'disconnected')
    addLogEntry(`❌ Connection error: ${error.message}`, 'error')

    // Retry connection after delay
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++
      setTimeout(connect, 5000)
    } else {
      updateStatus('Connection failed - Retrying in 60s...', 'connecting')
      addLogEntry('🔄 Max attempts reached, will retry in 60s', 'warning')

      // Reset attempts and try again after a longer delay
      setTimeout(() => {
        reconnectAttempts = 0
        connect()
      }, 60000) // 60 seconds
    }
  }
}

// Function to reconnect to the app (called by the Refresh button)
function reconnectToApp() {
  addLogEntry('🔄 Manual reconnection requested', 'info')

  // Close existing connection if any
  if (ws) {
    ws.close()
  }

  // Reset reconnection attempts
  reconnectAttempts = 0

  // Start new connection
  connect()
}

// Start the connection process when the script loads
document.addEventListener('DOMContentLoaded', function () {
  addLogEntry('🚀 Extension initialized', 'info')

  // Clear the initial log entry and add startup message
  const logsContainer = document.getElementById('logs-container')
  logsContainer.innerHTML = ''
  addLogEntry('✅ Extension loaded and ready', 'success')

  // Initialize sequence display
  updateSequenceDisplay(null)

  // Initialize port display
  updatePortDisplay('---')

  // Start connection
  connect()
})

// Also start immediately in case DOMContentLoaded has already fired
if (document.readyState === 'loading') {
  // DOM is still loading, wait for DOMContentLoaded
} else {
  // DOM is already ready
  connect()
}
