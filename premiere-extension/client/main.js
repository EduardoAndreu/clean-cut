// Create CSInterface object for communication with Premiere Pro
const cs = new CSInterface()

let ws = null
let reconnectAttempts = 0
const maxReconnectAttempts = 10
const WEBSOCKET_PORT = 8085

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

// Function to update the port display
function updatePortDisplay(port) {
  const statusDetails = document.getElementById('status-details')
  if (statusDetails) {
    statusDetails.textContent = `Port: ${port}`
  }
}

// Function to populate audio track checkboxes
function populateAudioTrackCheckboxes(sequenceDetails) {
  const checkboxContainer = document.getElementById('audio-track-checkboxes')

  if (
    !sequenceDetails ||
    !sequenceDetails.audioTrackInfo ||
    sequenceDetails.audioTrackInfo.length === 0
  ) {
    checkboxContainer.innerHTML =
      '<div class="no-tracks-message">No audio tracks detected. Please refresh sequence info.</div>'
    return
  }

  // Clear existing content
  checkboxContainer.innerHTML = ''

  // Create checkboxes for each audio track
  sequenceDetails.audioTrackInfo.forEach((track, index) => {
    const trackItem = document.createElement('div')
    trackItem.className = 'track-checkbox-item'

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.id = `track-${track.index}`
    checkbox.value = track.index
    checkbox.checked = true // Default to checked

    const label = document.createElement('label')
    label.htmlFor = `track-${track.index}`
    label.className = `track-checkbox-label ${track.muted ? 'track-muted' : ''}`
    label.textContent = `Track ${track.index}: ${track.name} ${track.muted ? '(Muted)' : ''}`

    trackItem.appendChild(checkbox)
    trackItem.appendChild(label)
    checkboxContainer.appendChild(trackItem)
  })
}

// Function to select all audio tracks
function selectAllTracks() {
  const checkboxes = document.querySelectorAll('#audio-track-checkboxes input[type="checkbox"]')
  checkboxes.forEach((checkbox) => {
    checkbox.checked = true
  })
}

// Function to deselect all audio tracks
function deselectAllTracks() {
  const checkboxes = document.querySelectorAll('#audio-track-checkboxes input[type="checkbox"]')
  checkboxes.forEach((checkbox) => {
    checkbox.checked = false
  })
}

// Function to get selected audio track indices
function getSelectedAudioTracks() {
  const checkboxes = document.querySelectorAll(
    '#audio-track-checkboxes input[type="checkbox"]:checked'
  )
  return Array.from(checkboxes).map((checkbox) => parseInt(checkbox.value))
}

// Variable to store selected range
let selectedRange = 'entire'

// Function to handle range selection
function selectRange(range) {
  selectedRange = range

  // Update button states
  const buttons = document.querySelectorAll('.range-button')
  buttons.forEach((button) => {
    button.classList.remove('active')
  })

  // Set active button
  const activeButton = document.getElementById(`range-${range}`)
  if (activeButton) {
    activeButton.classList.add('active')
  }

  addLogEntry(`Range selected: ${range}`, 'info')
}

// Function to get selected range
function getSelectedRange() {
  return selectedRange
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

      // Populate audio track checkboxes for export section
      populateAudioTrackCheckboxes(details)
    } else {
      audioTracksEl.textContent = 'None'
      // Clear checkboxes if no tracks
      populateAudioTrackCheckboxes(null)
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

// Function to perform audio export to specified folder
function performAudioExport() {
  const exportFolderInput = document.getElementById('export-folder-input')
  const exportButton = document.getElementById('export-button')
  const exportFolder = exportFolderInput.value.trim()

  // Get selected audio tracks
  const selectedTracks = getSelectedAudioTracks()

  if (selectedTracks.length === 0) {
    addLogEntry('No audio tracks selected for export', 'error')
    return
  }

  // Get selected range
  const selectedRange = getSelectedRange()

  // Disable button during operation
  exportButton.disabled = true
  exportButton.textContent = 'Exporting...'

  addLogEntry(
    `Starting audio export for ${selectedTracks.length} track(s): ${selectedTracks.join(', ')}`,
    'info'
  )
  addLogEntry(`Export range: ${selectedRange}`, 'info')

  // Call ExtendScript function to perform the export with selected tracks and range
  const selectedTracksJson = JSON.stringify(selectedTracks)
  addLogEntry(`Calling ExtendScript with selected tracks: ${selectedTracksJson}`, 'info')

  const scriptCall = `exportSequenceAudio('${exportFolder}', '${selectedTracksJson}', '${selectedRange}')`
  addLogEntry(`ExtendScript call: ${scriptCall}`, 'info')

  cs.evalScript(scriptCall, function (result) {
    console.log('Export operation result:', result)

    try {
      const resultData = JSON.parse(result)
      if (resultData.success) {
        addLogEntry(`Audio exported: ${resultData.outputPath}`, 'success')
        if (resultData.presetUsed) {
          addLogEntry(`Preset used: ${resultData.presetUsed}`, 'info')
        }
        // Display debug information if available
        if (resultData.debug) {
          addLogEntry(`Debug info: ${JSON.stringify(resultData.debug, null, 2)}`, 'info')
        }
        // Keep the folder path for next time, but don't clear it
      } else {
        addLogEntry(`Export failed: ${resultData.error}`, 'error')
        // Display debug information if available
        if (resultData.debug) {
          addLogEntry(`Debug info: ${JSON.stringify(resultData.debug, null, 2)}`, 'info')
        }
      }
    } catch (e) {
      // Handle non-JSON response (might be just the file path)
      if (result && result.length > 0) {
        addLogEntry(`Audio exported to: ${result}`, 'success')
      } else {
        addLogEntry('Export operation completed', 'success')
      }
    }

    // Re-enable button
    exportButton.disabled = false
    exportButton.textContent = 'Export Audio'
  })
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

// Function to perform silence management on selected clip
function performSilenceManagement() {
  const actionSelect = document.getElementById('silence-action-select')
  const processButton = document.getElementById('silence-process-button')

  if (!actionSelect.value) {
    addLogEntry('No action selected', 'error')
    return
  }

  const selectedAction = actionSelect.value
  processButton.disabled = true
  processButton.textContent = 'Processing...'

  addLogEntry(`Starting silence management: ${selectedAction}`, 'info')

  // Call the appropriate ExtendScript function based on the selected action
  let scriptCall = ''
  switch (selectedAction) {
    case 'remove-keep-gap':
      scriptCall = 'removeSelectedClipKeepGap()'
      break
    case 'remove-ripple':
      scriptCall = 'removeSelectedClipRipple()'
      break
    case 'mute':
      scriptCall = 'muteSelectedClip()'
      break
    default:
      addLogEntry('Invalid action selected', 'error')
      processButton.disabled = false
      processButton.textContent = 'Process'
      return
  }

  cs.evalScript(scriptCall, function (result) {
    // Log the raw result for debugging
    console.log('Raw ExtendScript result:', result)
    console.log('Result type:', typeof result)
    console.log('Result length:', result ? result.length : 'null/undefined')
    addLogEntry(`Raw ExtendScript result: ${result}`, 'info')

    try {
      const resultData = JSON.parse(result)
      console.log('Parsed silence management result:', resultData)

      if (resultData.success) {
        addLogEntry(`${resultData.message}`, 'success')
      } else {
        // Handle both 'error' and 'message' fields for failed operations
        const errorMessage = resultData.error || resultData.message || 'Unknown error'
        addLogEntry(`Operation failed: ${errorMessage}`, 'error')
      }
    } catch (error) {
      addLogEntry(`Parse error: ${error.message}`, 'error')
      addLogEntry(`Raw result was: "${result}"`, 'error')
      console.error('Error parsing silence management result:', error)
    }

    // Re-enable button
    processButton.disabled = false
    processButton.textContent = 'Process'

    // Refresh sequence info to update display
    refreshSequenceInfo()
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
    addLogEntry(`Attempting to connect to Clean-Cut app on port ${WEBSOCKET_PORT}...`, 'info')

    // Update port display
    updatePortDisplay(WEBSOCKET_PORT)

    // Create WebSocket connection
    ws = new WebSocket(`ws://localhost:${WEBSOCKET_PORT}`)

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
      addLogEntry('Handshake sent to server', 'info')

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
          case 'handshake_ack':
            console.log('Received handshake acknowledgment from server:', message.payload)
            addLogEntry('Handshake acknowledged by server', 'success')
            break

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

            console.log(
              `Processing ${cutTimes.length} individual cuts for ${totalRanges} silence ranges`
            )

            let currentCutIndex = 0

            function processNextCut() {
              if (currentCutIndex >= cutTimes.length) {
                // All cuts completed
                const finalMessage =
                  errors.length === 0
                    ? `Successfully performed ${totalCutsPerformed} cuts for ${totalRanges} silence ranges`
                    : `Completed with ${totalCutsPerformed} cuts performed and ${errors.length} errors`

                addLogEntry(finalMessage, errors.length === 0 ? 'success' : 'warning')

                if (errors.length > 0) {
                  console.log('Cut errors:', errors)
                }

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
                console.log('Cuts response sent:', response)
                return
              }

              const cutInfo = cutTimes[currentCutIndex]
              const cutTime = cutInfo.time

              console.log(
                `Processing cut ${currentCutIndex + 1}/${cutTimes.length}: ${cutTime}s (${cutInfo.type} of range ${cutInfo.rangeIndex + 1})`
              )

              const cutScriptCall = `cutAtTime(${cutTime})`

              cs.evalScript(cutScriptCall, function (result) {
                console.log(`Cut ${currentCutIndex + 1} result:`, result)

                try {
                  const resultData = JSON.parse(result)
                  if (resultData.success) {
                    totalCutsPerformed += resultData.cutsPerformed || 0
                    if (
                      (currentCutIndex + 1) % 10 === 0 ||
                      currentCutIndex === cutTimes.length - 1
                    ) {
                      addLogEntry(
                        `Processed ${currentCutIndex + 1}/${cutTimes.length} cuts...`,
                        'info'
                      )
                    }
                  } else {
                    errors.push(`Cut ${currentCutIndex + 1} (${cutTime}s): ${resultData.error}`)
                    addLogEntry(`Cut ${currentCutIndex + 1} failed: ${resultData.error}`, 'error')
                  }
                } catch (e) {
                  errors.push(`Cut ${currentCutIndex + 1} (${cutTime}s): Parse error - ${result}`)
                  addLogEntry(`Cut ${currentCutIndex + 1} failed: ${result}`, 'error')
                }

                currentCutIndex++

                // Process next cut with a small delay to avoid overwhelming Premiere
                setTimeout(processNextCut, 50)
              })
            }

            // Start processing cuts
            processNextCut()
            break

          case 'request_delete_silences':
            // Handle silence deletion request
            addLogEntry(
              `Received delete silences request for ${message.payload.length} segments`,
              'info'
            )

            // Convert silence segments to clip selection and deletion
            const deleteResult = cs.evalScript(
              `deleteSilenceSegments('${JSON.stringify(message.payload)}')`
            )
            addLogEntry(`Delete silences result: ${deleteResult}`, 'info')

            // Send response back to confirm deletion
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'delete_silences_response',
                  payload: deleteResult,
                  sessionId: message.sessionId
                })
              )
            }
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

          case 'request_audio_export':
            console.log('Received request for audio export:', message.payload)
            addLogEntry('Received audio export request', 'info')

            const { exportFolder, selectedTracks, selectedRange } = message.payload
            const selectedTracksJson = JSON.stringify(selectedTracks)

            addLogEntry(
              `Exporting audio: ${selectedTracks.length} tracks, range: ${selectedRange}`,
              'info'
            )

            // Call ExtendScript function to export sequence audio with specific parameters
            const scriptCall = `exportSequenceAudio('${exportFolder}', '${selectedTracksJson}', '${selectedRange}')`
            addLogEntry(`ExtendScript call: ${scriptCall}`, 'info')

            cs.evalScript(scriptCall, function (result) {
              console.log('Audio export result:', result)

              try {
                const resultData = JSON.parse(result)
                if (resultData.success) {
                  addLogEntry(`Audio exported: ${resultData.outputPath}`, 'success')
                  if (resultData.presetUsed) {
                    addLogEntry(`Preset used: ${resultData.presetUsed}`, 'info')
                  }
                } else {
                  addLogEntry(`Export failed: ${resultData.error}`, 'error')
                }
              } catch (e) {
                // Handle non-JSON response (might be just the file path)
                if (result && result.length > 0) {
                  addLogEntry(`Audio exported to: ${result}`, 'success')
                } else {
                  addLogEntry('Export operation completed', 'success')
                }
              }

              // Send the export result back to the server
              const response = {
                type: 'audio_export_response',
                payload: result
              }
              ws.send(JSON.stringify(response))
              console.log('Audio export response sent:', response)
            })
            break

          case 'request_audio_export_and_process':
            console.log('Received request for audio export and process:', message.payload)
            addLogEntry('Received audio export and process request', 'info')

            const {
              exportFolder: exportFolderProcess,
              selectedTracks: selectedTracksProcess,
              selectedRange: selectedRangeProcess
            } = message.payload
            const selectedTracksJsonProcess = JSON.stringify(selectedTracksProcess)

            addLogEntry(
              `Exporting audio for processing: ${selectedTracksProcess.length} tracks, range: ${selectedRangeProcess}`,
              'info'
            )

            // Call ExtendScript function to export sequence audio with specific parameters
            const scriptCallProcess = `exportSequenceAudio('${exportFolderProcess}', '${selectedTracksJsonProcess}', '${selectedRangeProcess}')`
            addLogEntry(`ExtendScript call: ${scriptCallProcess}`, 'info')

            cs.evalScript(scriptCallProcess, function (result) {
              console.log('Audio export result for processing:', result)

              try {
                const resultData = JSON.parse(result)
                if (resultData.success) {
                  addLogEntry(`Audio exported for processing: ${resultData.outputPath}`, 'success')
                  if (resultData.presetUsed) {
                    addLogEntry(`Preset used: ${resultData.presetUsed}`, 'info')
                  }
                } else {
                  addLogEntry(`Export failed: ${resultData.error}`, 'error')
                }
              } catch (e) {
                // Handle non-JSON response (might be just the file path)
                if (result && result.length > 0) {
                  addLogEntry(`Audio exported for processing to: ${result}`, 'success')
                } else {
                  addLogEntry('Export operation completed', 'success')
                }
              }

              // Send the export result back to the server for processing
              const response = {
                type: 'audio_export_and_process_response',
                payload: result
              }
              ws.send(JSON.stringify(response))
              console.log('Audio export and process response sent:', response)
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

      // Clear port display when disconnected
      updatePortDisplay('---')

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

  // Initialize port display
  updatePortDisplay('---')

  // Initialize audio track checkboxes
  populateAudioTrackCheckboxes(null)

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
