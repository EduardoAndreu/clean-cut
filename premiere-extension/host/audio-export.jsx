// Clean-Cut Audio Export Module
// This module contains functions for exporting audio from Premiere Pro sequences

/**
 * Exports the active sequence's audio as a WAV file
 * @param {string} outputFolder - Optional output folder (defaults to system temp for backward compatibility)
 * @returns {string} JSON string containing the file path or error message
 */
function exportActiveSequenceAudio(outputFolder) {
  try {
    // Check if there's an active project and sequence
    if (!app.project || !app.project.activeSequence) {
      return JSON.stringify({
        success: false,
        error: 'No active sequence found'
      })
    }

    var activeSequence = app.project.activeSequence
    var timestamp = new Date().getTime()
    var fileName = 'cleancut_audio_' + timestamp + '.wav'

    // Use provided output folder or fallback to system temp for backward compatibility
    var exportPath
    if (outputFolder && outputFolder.length > 0) {
      var lastChar = outputFolder.charAt(outputFolder.length - 1)
      if (lastChar !== '/' && lastChar !== '\\') {
        outputFolder += '/'
      }
      exportPath = outputFolder + fileName
    } else {
      // Fallback to system temp directory for backward compatibility
      var tempFolder = Folder.temp
      exportPath = tempFolder.fsName + '/' + fileName
    }

    var success = activeSequence.exportAsMediaDirect(
      exportPath,
      app.encoder.encodePresets.match('Microsoft AVI'),
      app.encoder.ENCODE_ENTIRE_SEQUENCE
    )

    return JSON.stringify({
      success: success,
      filePath: success ? exportPath : null,
      error: success ? null : 'Failed to export audio',
      outputFolder: outputFolder || 'system temp'
    })
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: 'Export error: ' + error.toString(),
      outputFolder: outputFolder || 'system temp'
    })
  }
}

/**
 * Exports sequence audio using Adobe Media Encoder API for better track control
 * @param {string} outputFolder - Folder path for export (optional)
 * @param {string} selectedTracksJson - JSON string array of selected audio track indices
 * @param {string} selectedRange - Range type: 'entire', 'inout', 'selected'
 * @returns {string} JSON string with operation result
 */
function exportSequenceAudio(outputFolder, selectedTracksJson, selectedRange) {
  try {
    var debugInfo = {
      method: 'QE_DOM',
      outputFolder: outputFolder,
      selectedTracksJson: selectedTracksJson,
      selectedTracksType: typeof selectedTracksJson,
      selectedTracksLength: selectedTracksJson ? selectedTracksJson.length : 'null',
      selectedRange: selectedRange || 'entire'
    }

    logMessage('=== EXPORT SEQUENCE AUDIO VIA QE DOM ===')
    logMessage('Output folder: ' + outputFolder)
    logMessage('Selected tracks JSON: ' + selectedTracksJson)
    logMessage('Selected range: ' + (selectedRange || 'entire'))

    if (!app.project || !app.project.activeSequence) {
      return JSON.stringify({
        success: false,
        error: 'No active sequence',
        debug: debugInfo
      })
    }

    var sequence = app.project.activeSequence
    var selectedTracks = []

    // Parse selected tracks if provided
    if (selectedTracksJson && selectedTracksJson.length > 0) {
      try {
        selectedTracks = JSON.parse(selectedTracksJson)
        logMessage('Selected tracks for export: ' + selectedTracks.join(', '))
        debugInfo.selectedTracksParsed = selectedTracks
      } catch (parseError) {
        debugInfo.parseError = parseError.toString()
        return JSON.stringify({
          success: false,
          error: 'Invalid selected tracks format: ' + parseError.toString(),
          debug: debugInfo
        })
      }
    } else {
      logMessage('No specific tracks selected, exporting all audio tracks')
      debugInfo.selectedTracksParsed = 'none - exporting all'
    }

    // Generate unique filename and output path
    var timestamp = new Date().getTime()
    var sequenceName = sequence.name.replace(/[^a-zA-Z0-9]/g, '_')
    var filename = sequenceName + '_audio_' + timestamp + '.wav'

    // Output folder is now required - no fallback to system temp
    if (!outputFolder || outputFolder.length === 0) {
      return JSON.stringify({
        success: false,
        error: 'Output folder is required - no fallback to system temp directory',
        debug: debugInfo
      })
    }

    var outputPath = outputFolder
    var lastChar = outputPath.charAt(outputPath.length - 1)
    if (lastChar !== '/' && lastChar !== '\\') {
      outputPath += '/'
    }
    outputPath += filename

    debugInfo.outputPath = outputPath

    // Get preset file - use the same output folder for consistency
    var presetResult = getPresetFilePath(outputFolder)
    if (!presetResult.path) {
      return JSON.stringify({
        success: false,
        error: 'Preset file not found',
        debug: debugInfo
      })
    }
    var audioPresetPath = presetResult.path
    debugInfo.presetPath = audioPresetPath
    debugInfo.presetDebug = presetResult.debug

    // Enable QE DOM for better track control
    app.enableQE()
    var qeSequence = qe.project.getActiveSequence()

    if (!qeSequence) {
      return JSON.stringify({
        success: false,
        error: 'QE sequence not available',
        debug: debugInfo
      })
    }

    logMessage('Using QE DOM for track control')
    debugInfo.qeAvailable = true
    debugInfo.totalQETracks = qeSequence.numAudioTracks

    // Store original track states
    var originalStates = []
    for (var i = 0; i < qeSequence.numAudioTracks; i++) {
      var qeTrack = qeSequence.getAudioTrackAt(i)
      if (qeTrack) {
        var originalState = {
          index: i,
          trackNumber: i + 1,
          muted: false,
          solo: false
        }

        // Get original states
        try {
          if (typeof qeTrack.isMuted === 'function') {
            originalState.muted = qeTrack.isMuted()
          }
          if (typeof qeTrack.isSolo === 'function') {
            originalState.solo = qeTrack.isSolo()
          }
        } catch (stateError) {
          logMessage(
            'Error getting original state for track ' + (i + 1) + ': ' + stateError.toString()
          )
        }

        originalStates.push(originalState)
        logMessage(
          'Track ' +
            (i + 1) +
            ' original state - muted: ' +
            originalState.muted +
            ', solo: ' +
            originalState.solo
        )
      }
    }

    try {
      // Apply selective track control using QE DOM
      if (selectedTracks.length > 0) {
        logMessage('Applying selective track control using QE DOM...')

        for (var j = 0; j < qeSequence.numAudioTracks; j++) {
          var qeTrack = qeSequence.getAudioTrackAt(j)
          var trackNumber = j + 1
          var shouldExport = selectedTracks.indexOf(trackNumber) !== -1

          if (qeTrack) {
            try {
              // Use solo approach for cleaner selective export
              if (typeof qeTrack.setSolo === 'function') {
                qeTrack.setSolo(shouldExport)
                logMessage('Track ' + trackNumber + ' solo set to: ' + shouldExport)
              } else if (typeof qeTrack.setMute === 'function') {
                // Fallback to mute approach - mute non-selected tracks
                qeTrack.setMute(!shouldExport)
                logMessage('Track ' + trackNumber + ' muted: ' + !shouldExport)
              }
            } catch (trackControlError) {
              logMessage(
                'Error controlling track ' + trackNumber + ': ' + trackControlError.toString()
              )
            }
          }
        }

        debugInfo.trackControlMethod = 'QE DOM solo/mute'
        debugInfo.tracksProcessed = qeSequence.numAudioTracks
      }

      // Handle different range types
      var workAreaType = 0 // Default: entire sequence
      var rangeType = selectedRange || 'entire'
      var originalInPoint = null
      var originalOutPoint = null
      var tempInOutSet = false
      var timeOffsetSeconds = 0 // Track the time offset for cut commands

      if (rangeType === 'inout') {
        workAreaType = 1 // In/Out points
        logMessage('Using In/Out points for export')

        // Calculate time offset for in/out points
        try {
          var rawInPoint = sequence.getInPoint()
          var inPointSeconds = parseFloat(rawInPoint) || 0

          // sequence.getInPoint() returns seconds, not ticks!
          timeOffsetSeconds = inPointSeconds

          // Add debugging info to the response
          debugInfo.rawInPoint = rawInPoint
          debugInfo.inPointSeconds = inPointSeconds
          debugInfo.sequenceTimebase = sequence.timebase
          debugInfo.calculatedOffset = timeOffsetSeconds
          debugInfo.inPointCalculation = 'InPoint already in seconds: ' + inPointSeconds

          logMessage('Raw in point value: "' + rawInPoint + '"')
          logMessage('In point seconds: ' + inPointSeconds)
          logMessage('Sequence timebase: ' + sequence.timebase)
          logMessage('In/Out point time offset: ' + timeOffsetSeconds + ' seconds')
          debugInfo.timeOffsetSeconds = timeOffsetSeconds
        } catch (offsetError) {
          logMessage('Error calculating in/out offset: ' + offsetError.toString())
          debugInfo.offsetError = offsetError.toString()
          timeOffsetSeconds = 0
        }
      } else if (rangeType === 'selected') {
        // For selected clips, we need to get their time range and set temporary in/out points
        logMessage('Getting selected clips range...')

        try {
          // Store original in/out points
          originalInPoint = sequence.getInPoint()
          originalOutPoint = sequence.getOutPoint()

          // Get selected clips and find their time range
          var selectedClipsRange = getSelectedClipsTimeRange(sequence)

          if (selectedClipsRange.success) {
            logMessage(
              'Selected clips range: ' +
                selectedClipsRange.startTime +
                ' to ' +
                selectedClipsRange.endTime +
                ' seconds'
            )

            // Set time offset to the start of selected clips
            timeOffsetSeconds = selectedClipsRange.startTime
            logMessage('Selected clips time offset: ' + timeOffsetSeconds + ' seconds')

            // Convert to ticks (254016000000 ticks per second)
            var ticksPerSecond = 254016000000
            var startTicks = Math.round(selectedClipsRange.startTime * ticksPerSecond)
            var endTicks = Math.round(selectedClipsRange.endTime * ticksPerSecond)

            // Set temporary in/out points
            sequence.setInPoint(startTicks.toString())
            sequence.setOutPoint(endTicks.toString())
            tempInOutSet = true

            workAreaType = 1 // Use in/out points method
            logMessage('Set temporary in/out points for selected clips export')

            debugInfo.selectedClipsStart = selectedClipsRange.startTime
            debugInfo.selectedClipsEnd = selectedClipsRange.endTime
            debugInfo.tempInOutSet = true
            debugInfo.timeOffsetSeconds = timeOffsetSeconds
          } else {
            logMessage('No valid selected clips found, falling back to entire timeline')
            workAreaType = 0 // Fallback to entire sequence
            timeOffsetSeconds = 0
            debugInfo.selectedClipsError = selectedClipsRange.error
          }
        } catch (selectedError) {
          logMessage('Error handling selected clips: ' + selectedError.toString())
          workAreaType = 0 // Fallback to entire sequence
          timeOffsetSeconds = 0
          debugInfo.selectedClipsError = selectedError.toString()
        }
      } else {
        workAreaType = 0 // Entire sequence
        timeOffsetSeconds = 0 // No offset for entire timeline
        logMessage('Using entire timeline for export')
      }

      debugInfo.workAreaType = workAreaType
      debugInfo.rangeType = rangeType

      // Export using standard sequence with QE-modified states
      logMessage('Starting export with QE DOM controlled track states...')
      var exportResult = sequence.exportAsMediaDirect(outputPath, audioPresetPath, workAreaType)

      // Restore original in/out points if we set temporary ones
      if (tempInOutSet) {
        try {
          logMessage('Restoring original in/out points...')
          if (originalInPoint !== null) {
            sequence.setInPoint(originalInPoint.toString())
          }
          if (originalOutPoint !== null) {
            sequence.setOutPoint(originalOutPoint.toString())
          }
          logMessage('Original in/out points restored')
        } catch (restoreError) {
          logMessage('Error restoring in/out points: ' + restoreError.toString())
          debugInfo.restoreInOutError = restoreError.toString()
        }
      }

      if (!exportResult) {
        throw new Error('Export failed - exportAsMediaDirect returned false')
      }

      debugInfo.exportMethod = 'exportAsMediaDirect with QE DOM'
      debugInfo.exportResult = exportResult
    } finally {
      // Always restore original track states
      try {
        logMessage('Restoring original track states...')

        for (var k = 0; k < originalStates.length; k++) {
          var stateInfo = originalStates[k]
          var qeTrack = qeSequence.getAudioTrackAt(stateInfo.index)

          if (qeTrack) {
            try {
              // Restore solo state
              if (typeof qeTrack.setSolo === 'function') {
                qeTrack.setSolo(stateInfo.solo)
                logMessage(
                  'Restored track ' + stateInfo.trackNumber + ' solo to: ' + stateInfo.solo
                )
              }

              // Restore mute state
              if (typeof qeTrack.setMute === 'function') {
                qeTrack.setMute(stateInfo.muted)
                logMessage(
                  'Restored track ' + stateInfo.trackNumber + ' mute to: ' + stateInfo.muted
                )
              }
            } catch (restoreError) {
              logMessage(
                'Error restoring track ' + stateInfo.trackNumber + ': ' + restoreError.toString()
              )
            }
          }
        }

        logMessage('Restored original states for ' + originalStates.length + ' tracks')
      } catch (restoreError) {
        logMessage('Error during track state restoration: ' + restoreError.toString())
        debugInfo.restoreError = restoreError.toString()
      }
    }

    var exportMessage = 'Audio export completed successfully'
    if (selectedTracks.length > 0) {
      exportMessage += ' for tracks: ' + selectedTracks.join(', ')
    }

    var rangeDescription = ''
    if (selectedRange === 'inout') {
      rangeDescription = ' (In/Out points)'
    } else if (selectedRange === 'selected') {
      rangeDescription = ' (Selected clips)'
    } else {
      rangeDescription = ' (Entire timeline)'
    }

    exportMessage += rangeDescription + ' using QE DOM'

    debugInfo.success = true

    return JSON.stringify({
      success: true,
      outputPath: outputPath,
      presetUsed: audioPresetPath,
      message: exportMessage,
      selectedTracks: selectedTracks,
      timeOffsetSeconds: timeOffsetSeconds,
      debug: debugInfo
    })
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: 'QE DOM export error: ' + error.toString(),
      debug: debugInfo
    })
  }
}
