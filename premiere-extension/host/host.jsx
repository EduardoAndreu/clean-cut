// Clean-Cut ExtendScript Host Functions
// This file contains functions that interact with Premiere Pro's API

// Add polyfill for Object.keys (ExtendScript doesn't have it)
if (!Object.keys) {
  Object.keys = function (obj) {
    if (obj !== Object(obj)) {
      throw new TypeError('Object.keys called on a non-object')
    }
    var keys = []
    for (var p in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, p)) {
        keys.push(p)
      }
    }
    return keys
  }
}

/**
 * Helper function to log messages to the Premiere Pro console
 * @param {string} message - Message to log
 */
function logMessage(message) {
  try {
    $.writeln('[Clean-Cut] ' + message)
  } catch (e) {
    // Silent fail if console logging isn't available
  }
}

/**
 * Exports the active sequence's audio as a WAV file
 * @returns {string} JSON string containing the file path or error message
 */
function exportActiveSequenceAudio() {
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
    var tempFolder = Folder.temp
    var outputFile = new File(tempFolder.fsName + '/' + fileName)
    var exportPath = outputFile.fsName

    var success = activeSequence.exportAsMediaDirect(
      exportPath,
      app.encoder.encodePresets.match('Microsoft AVI'),
      app.encoder.ENCODE_ENTIRE_SEQUENCE
    )

    return JSON.stringify({
      success: success,
      filePath: success ? exportPath : null,
      error: success ? null : 'Failed to export audio'
    })
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: 'Export error: ' + error.toString()
    })
  }
}

/**
 * Performs cuts on the timeline based on provided timestamps
 * @param {string} timestampsJSON - JSON string containing array of {start, end} timestamps
 * @returns {string} JSON string with success status and message
 */
function performCuts(timestampsJSON) {
  try {
    // Check if there's an active sequence
    if (!app.project || !app.project.activeSequence) {
      return JSON.stringify({
        success: false,
        error: 'No active sequence found'
      })
    }

    var activeSequence = app.project.activeSequence
    var timestamps

    try {
      timestamps = JSON.parse(timestampsJSON)
    } catch (parseError) {
      return JSON.stringify({
        success: false,
        error: 'Invalid JSON format: ' + parseError.toString()
      })
    }

    if (!timestamps || !timestamps.length) {
      return JSON.stringify({
        success: false,
        error: 'No timestamps provided'
      })
    }

    var cutsPerformed = 0
    var errors = []

    for (var i = 0; i < timestamps.length; i++) {
      var timestamp = timestamps[i]

      if (!timestamp.hasOwnProperty('start') || !timestamp.hasOwnProperty('end')) {
        errors.push('Invalid timestamp object at index ' + i + ': missing start or end')
        continue
      }

      try {
        var startTime = timestamp.start * activeSequence.timebase
        var endTime = timestamp.end * activeSequence.timebase

        activeSequence.razor(startTime)
        activeSequence.razor(endTime)
        cutsPerformed += 2
      } catch (cutError) {
        errors.push('Error cutting at timestamp ' + i + ': ' + cutError.toString())
      }
    }

    var resultMessage = 'Performed ' + cutsPerformed + ' cuts'
    if (errors.length > 0) {
      resultMessage += ' with ' + errors.length + ' errors'
    }

    return JSON.stringify({
      success: errors.length === 0 || cutsPerformed > 0,
      message: resultMessage,
      cutsPerformed: cutsPerformed,
      errors: errors
    })
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: 'Cutting error: ' + error.toString()
    })
  }
}

/**
 * Returns the current status of the Premiere Pro connection
 * @returns {string} JSON string with status information
 */
function getPremiereStatus() {
  try {
    return JSON.stringify({
      status: 'connected',
      version: '1.0',
      premiereVersion: app.version || 'unknown',
      projectName: app.project ? app.project.name : 'no project',
      activeSequence:
        app.project && app.project.activeSequence ? app.project.activeSequence.name : 'none'
    })
  } catch (error) {
    return JSON.stringify({
      status: 'error',
      version: '1.0',
      error: error.toString()
    })
  }
}

/**
 * Returns detailed information about the active sequence
 * @returns {string} JSON string with sequence information
 */
function getActiveSequenceInfo() {
  try {
    // Check if there's an active project and sequence
    if (!app.project || !app.project.activeSequence) {
      return JSON.stringify({
        success: false,
        error: 'No active sequence',
        hasActiveSequence: false
      })
    }

    var sequence = app.project.activeSequence
    var timebase = parseFloat(sequence.timebase)

    // Get basic sequence info
    var sequenceInfo = {
      success: true,
      hasActiveSequence: true,
      sequenceName: sequence.name || 'Untitled Sequence',
      projectName: app.project.name || 'Untitled Project',
      frameRate: 'N/A',
      duration: 0,
      durationSeconds: 0,
      durationTime: null,
      endTime: 'N/A',
      // In/Out points (regular methods)
      inPoint: 0,
      outPoint: 0,
      // In/Out points (as time objects)
      inPointTime: null,
      outPointTime: null,
      inPointTicks: null,
      outPointTicks: null,
      // Simple counts for main display
      videoTracks: 0,
      audioTracks: 0,
      // Detailed arrays for details section
      videoTrackInfo: [],
      audioTrackInfo: [],
      selectedClips: []
    }

    // Get frame rate using videoDisplayFormat
    try {
      var videoDisplayFormat = sequence.videoDisplayFormat
      var frameRateMap = {
        100: '24',
        101: '25',
        102: '29.97 Drop',
        103: '29.97 Non-Drop',
        104: '30',
        105: '50',
        106: '59.94 Drop',
        107: '59.94 Non-Drop',
        108: '60',
        109: 'Frames',
        110: '23.976',
        111: '16mm Feet + Frames',
        112: '35mm Feet + Frames',
        113: '48'
      }
      sequenceInfo.frameRate =
        frameRateMap[videoDisplayFormat] || 'Unknown (' + videoDisplayFormat + ')'
    } catch (e) {
      sequenceInfo.frameRate = 'N/A'
    }

    // Get duration information
    try {
      if (sequence.end) {
        // According to documentation, sequence.end is already a string of ticks
        var endTicks = parseFloat(sequence.end)
        // Convert from ticks to seconds using the correct conversion
        // There are 254016000000 ticks per second according to Time object documentation
        var ticksPerSecond = 254016000000
        sequenceInfo.duration = endTicks / ticksPerSecond
        sequenceInfo.durationSeconds = sequenceInfo.duration
        sequenceInfo.endTime = sequenceInfo.duration.toFixed(2) + 's'

        // Create formatted duration time using Time object
        try {
          var durationTimeObj = new Time()
          durationTimeObj.ticks = endTicks.toString()

          // Create frame rate Time object for formatting
          var frameRateTime = new Time()
          frameRateTime.ticks = sequence.timebase.toString()

          // Use the sequence's video display format for consistent formatting
          var displayFormat = sequence.videoDisplayFormat || 103 // Default to 29.97 Non-Drop

          sequenceInfo.durationTime = durationTimeObj.getFormatted(frameRateTime, displayFormat)
        } catch (formatError) {
          sequenceInfo.durationTime = null
        }
      }
    } catch (e) {
      // Use defaults
    }

    // Get in/out points (both regular and as time objects)
    try {
      // Regular in/out points (likely in seconds)
      sequenceInfo.inPoint = parseFloat(sequence.getInPoint()) || 0
      sequenceInfo.outPoint = parseFloat(sequence.getOutPoint()) || sequenceInfo.duration

      // Time objects for more detailed timing information
      try {
        var inPointTime = sequence.getInPointAsTime()
        var outPointTime = sequence.getOutPointAsTime()

        // Convert Time objects to timecode format using getFormatted()
        if (inPointTime && outPointTime) {
          // Create frame rate Time object for formatting
          var frameRateTime = new Time()
          frameRateTime.ticks = sequence.timebase.toString()

          // Use the sequence's video display format for consistent formatting
          var displayFormat = sequence.videoDisplayFormat || 103 // Default to 29.97 Non-Drop

          sequenceInfo.inPointTime = inPointTime.getFormatted(frameRateTime, displayFormat)
          sequenceInfo.outPointTime = outPointTime.getFormatted(frameRateTime, displayFormat)
        } else {
          sequenceInfo.inPointTime = null
          sequenceInfo.outPointTime = null
        }

        // Also get the raw time values if available
        sequenceInfo.inPointTicks = inPointTime && inPointTime.ticks ? inPointTime.ticks : null
        sequenceInfo.outPointTicks = outPointTime && outPointTime.ticks ? outPointTime.ticks : null
      } catch (timeError) {
        // Time objects not available - use null values
        sequenceInfo.inPointTime = null
        sequenceInfo.outPointTime = null
        sequenceInfo.inPointTicks = null
        sequenceInfo.outPointTicks = null
      }
    } catch (e) {
      // Use defaults if methods fail
      sequenceInfo.inPoint = 0
      sequenceInfo.outPoint = sequenceInfo.duration
      sequenceInfo.inPointTime = null
      sequenceInfo.outPointTime = null
      sequenceInfo.inPointTicks = null
      sequenceInfo.outPointTicks = null
    }

    // Get audio track info
    try {
      if (sequence.audioTracks && sequence.audioTracks.numTracks) {
        for (var i = 0; i < sequence.audioTracks.numTracks; i++) {
          var track = sequence.audioTracks[i]
          sequenceInfo.audioTracks += 1
          sequenceInfo.audioTrackInfo.push({
            index: i + 1,
            name: track.name || 'Audio ' + (i + 1),
            enabled: true
          })
        }
      }
    } catch (e) {
      // Use empty array
    }

    // Get video track info
    try {
      if (sequence.videoTracks && sequence.videoTracks.numTracks) {
        for (var i = 0; i < sequence.videoTracks.numTracks; i++) {
          var track = sequence.videoTracks[i]
          sequenceInfo.videoTracks += 1
          sequenceInfo.videoTrackInfo.push({
            index: i + 1,
            name: track.name || 'Video ' + (i + 1),
            enabled: true
          })
        }
      }
    } catch (e) {
      // Use empty array
    }

    // Get selected clips using getSelection() method
    try {
      var selection = sequence.getSelection()
      if (selection && selection.length > 0) {
        for (var i = 0; i < selection.length; i++) {
          var clip = selection[i]
          try {
            var clipInfo = {
              name: clip.name || 'Unknown Clip',
              mediaType: clip.mediaType || 'Unknown',
              start: 0,
              end: 0,
              duration: 0,
              startTime: null,
              endTime: null,
              trackIndex: -1
            }

            // Get timing information if available
            if (clip.start && clip.end) {
              var ticksPerSecond = 254016000000
              clipInfo.start = parseFloat(clip.start.ticks) / ticksPerSecond
              clipInfo.end = parseFloat(clip.end.ticks) / ticksPerSecond
              clipInfo.duration = clipInfo.end - clipInfo.start

              // Create formatted timecode for start and end times
              try {
                var startTimeObj = new Time()
                startTimeObj.ticks = clip.start.ticks
                var endTimeObj = new Time()
                endTimeObj.ticks = clip.end.ticks

                // Create frame rate Time object for formatting
                var frameRateTime = new Time()
                frameRateTime.ticks = sequence.timebase.toString()

                // Use the sequence's video display format for consistent formatting
                var displayFormat = sequence.videoDisplayFormat || 103 // Default to 29.97 Non-Drop

                clipInfo.startTime = startTimeObj.getFormatted(frameRateTime, displayFormat)
                clipInfo.endTime = endTimeObj.getFormatted(frameRateTime, displayFormat)
              } catch (formatError) {
                clipInfo.startTime = null
                clipInfo.endTime = null
              }
            }

            sequenceInfo.selectedClips.push(clipInfo)
          } catch (clipError) {
            // Skip invalid clips
          }
        }
      }
    } catch (e) {
      // Use empty array if selection fails
    }

    return JSON.stringify(sequenceInfo)
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: 'Error getting sequence info: ' + error.toString(),
      hasActiveSequence: false
    })
  }
}

/**
 * Gets information about selected clips in the active sequence
 * @returns {string} JSON string with selected clips information
 */
function getSelectedClipsInfo() {
  try {
    if (!app.project || !app.project.activeSequence) {
      return JSON.stringify({
        success: false,
        error: 'No active sequence',
        hasSelectedClips: false
      })
    }

    var sequence = app.project.activeSequence
    var selectedClips = []
    var selectedClipsFound = 0

    logMessage('Analyzing selected clips across all tracks...')

    // Check video tracks
    for (var v = 0; v < sequence.videoTracks.numTracks; v++) {
      var videoTrack = sequence.videoTracks[v]
      for (var vc = 0; vc < videoTrack.clips.numItems; vc++) {
        var clip = videoTrack.clips[vc]
        if (clip && clip.isSelected()) {
          selectedClipsFound++

          var clipInfo = {
            trackIndex: v + 1,
            clipName: clip.name || 'Unknown Video Clip',
            startTime: parseFloat(clip.start.seconds),
            endTime: parseFloat(clip.end.seconds),
            duration: parseFloat(clip.end.seconds) - parseFloat(clip.start.seconds),
            type: 'video'
          }

          selectedClips.push(clipInfo)
          logMessage(
            'Selected video clip on track ' +
              (v + 1) +
              ': ' +
              clipInfo.startTime +
              's to ' +
              clipInfo.endTime +
              's'
          )
        }
      }
    }

    // Check audio tracks
    for (var a = 0; a < sequence.audioTracks.numTracks; a++) {
      var audioTrack = sequence.audioTracks[a]
      for (var ac = 0; ac < audioTrack.clips.numItems; ac++) {
        var clip = audioTrack.clips[ac]
        if (clip && clip.isSelected()) {
          selectedClipsFound++

          var clipInfo = {
            trackIndex: a + 1,
            clipName: clip.name || 'Unknown Audio Clip',
            startTime: parseFloat(clip.start.seconds),
            endTime: parseFloat(clip.end.seconds),
            duration: parseFloat(clip.end.seconds) - parseFloat(clip.start.seconds),
            type: 'audio'
          }

          selectedClips.push(clipInfo)
          logMessage(
            'Selected audio clip on track ' +
              (a + 1) +
              ': ' +
              clipInfo.startTime +
              's to ' +
              clipInfo.endTime +
              's'
          )
        }
      }
    }

    logMessage('Found ' + selectedClipsFound + ' selected clips total')

    return JSON.stringify({
      success: true,
      selectedClips: selectedClips,
      hasSelectedClips: selectedClipsFound > 0
    })
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: 'Error getting selected clips: ' + error.toString(),
      selectedClips: [],
      hasSelectedClips: false
    })
  }
}

/**
 * Gets the path to the preset file using embedded data
 * @returns {object} Object with path and debug info
 */
function getPresetFilePath() {
  try {
    // Use embedded preset data instead of external file
    var tempPresetPath = createTempPresetFromEmbedded()

    return {
      path: tempPresetPath,
      debug: {
        method: 'embedded',
        fileName: $.fileName,
        tempPresetPath: tempPresetPath,
        success: tempPresetPath !== null
      }
    }
  } catch (e) {
    return {
      path: null,
      debug: {
        error: e.toString(),
        fileName: $.fileName,
        method: 'embedded'
      }
    }
  }
}

/**
 * Gets the time range of selected clips across all tracks
 * @param {object} sequence - The active sequence
 * @returns {object} Object with success, startTime, endTime, and error properties
 */
function getSelectedClipsTimeRange(sequence) {
  try {
    var earliestStart = Number.MAX_VALUE
    var latestEnd = 0
    var selectedClipsFound = 0

    logMessage('Analyzing selected clips across all tracks...')

    // Check video tracks
    for (var v = 0; v < sequence.videoTracks.numTracks; v++) {
      var videoTrack = sequence.videoTracks[v]
      for (var vc = 0; vc < videoTrack.clips.numItems; vc++) {
        var clip = videoTrack.clips[vc]
        if (clip && clip.isSelected()) {
          selectedClipsFound++
          var startTime = parseFloat(clip.start.seconds)
          var endTime = parseFloat(clip.end.seconds)

          if (startTime < earliestStart) {
            earliestStart = startTime
          }
          if (endTime > latestEnd) {
            latestEnd = endTime
          }

          logMessage(
            'Selected video clip on track ' + (v + 1) + ': ' + startTime + 's to ' + endTime + 's'
          )
        }
      }
    }

    // Check audio tracks
    for (var a = 0; a < sequence.audioTracks.numTracks; a++) {
      var audioTrack = sequence.audioTracks[a]
      for (var ac = 0; ac < audioTrack.clips.numItems; ac++) {
        var clip = audioTrack.clips[ac]
        if (clip && clip.isSelected()) {
          selectedClipsFound++
          var startTime = parseFloat(clip.start.seconds)
          var endTime = parseFloat(clip.end.seconds)

          if (startTime < earliestStart) {
            earliestStart = startTime
          }
          if (endTime > latestEnd) {
            latestEnd = endTime
          }

          logMessage(
            'Selected audio clip on track ' + (a + 1) + ': ' + startTime + 's to ' + endTime + 's'
          )
        }
      }
    }

    if (selectedClipsFound === 0) {
      return {
        success: false,
        error: 'No clips are currently selected'
      }
    }

    logMessage('Found ' + selectedClipsFound + ' selected clips total')
    logMessage('Combined range: ' + earliestStart + 's to ' + latestEnd + 's')

    return {
      success: true,
      startTime: earliestStart,
      endTime: latestEnd,
      clipCount: selectedClipsFound
    }
  } catch (error) {
    return {
      success: false,
      error: 'Error analyzing selected clips: ' + error.toString()
    }
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

    var outputPath
    if (outputFolder && outputFolder.length > 0) {
      outputPath = outputFolder
      var lastChar = outputPath.charAt(outputPath.length - 1)
      if (lastChar !== '/' && lastChar !== '\\') {
        outputPath += '/'
      }
      outputPath += filename
    } else {
      try {
        var tempDir = Folder.temp.fsName
        outputPath = tempDir + '/' + filename
      } catch (e) {
        outputPath = '~/Desktop/' + filename
      }
    }

    debugInfo.outputPath = outputPath

    // Get preset file
    var presetResult = getPresetFilePath()
    if (!presetResult.path) {
      return JSON.stringify({
        success: false,
        error: 'Preset file not found',
        debug: debugInfo
      })
    }
    var audioPresetPath = presetResult.path
    debugInfo.presetPath = audioPresetPath

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

      if (rangeType === 'inout') {
        workAreaType = 1 // In/Out points
        logMessage('Using In/Out points for export')
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
          } else {
            logMessage('No valid selected clips found, falling back to entire timeline')
            workAreaType = 0 // Fallback to entire sequence
            debugInfo.selectedClipsError = selectedClipsRange.error
          }
        } catch (selectedError) {
          logMessage('Error handling selected clips: ' + selectedError.toString())
          workAreaType = 0 // Fallback to entire sequence
          debugInfo.selectedClipsError = selectedError.toString()
        }
      } else {
        workAreaType = 0 // Entire sequence
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

/**
 * Cuts all tracks at a specified timecode
 * @param {string} timecode - Time in HH:MM:SS:FF format
 * @returns {string} JSON string with operation result
 */
function cutAllTracksAtTime(timecode) {
  try {
    if (!app.project || !app.project.activeSequence) {
      return JSON.stringify({
        success: false,
        error: 'No active sequence'
      })
    }

    var sequence = app.project.activeSequence

    // Parse timecode (HH:MM:SS:FF)
    var parts = timecode.split(':')
    if (parts.length !== 4) {
      return JSON.stringify({
        success: false,
        error: 'Invalid timecode format'
      })
    }

    var hours = parseInt(parts[0])
    var minutes = parseInt(parts[1])
    var seconds = parseInt(parts[2])
    var frames = parseInt(parts[3])

    // Convert to total seconds
    var totalSeconds = hours * 3600 + minutes * 60 + seconds

    // Get frame rate to calculate frame duration
    var frameRate = 25 // Default, will be updated based on sequence
    try {
      var videoDisplayFormat = sequence.videoDisplayFormat
      var frameRateMap = {
        100: 24,
        101: 25,
        102: 29.97,
        103: 29.97,
        104: 30,
        105: 50,
        106: 59.94,
        107: 59.94,
        108: 60,
        110: 23.976,
        113: 48
      }
      frameRate = frameRateMap[videoDisplayFormat] || 25
    } catch (e) {
      frameRate = 25
    }

    // Add frame time to total seconds
    totalSeconds += frames / frameRate

    // Convert to ticks (254016000000 ticks per second)
    var ticksPerSecond = 254016000000
    var cutTimeTicks = Math.round(totalSeconds * ticksPerSecond)

    // Move the playhead to the cut position
    sequence.setPlayerPosition(cutTimeTicks.toString())

    // Enable QE DOM for razor functionality
    try {
      app.enableQE()
      var qeSequence = qe.project.getActiveSequence()

      if (!qeSequence) {
        return JSON.stringify({
          success: false,
          error: 'Could not access QE sequence'
        })
      }

      // Get the current playhead position in QE format
      var currentTimecode = qeSequence.CTI.timecode
      var cutsPerformed = 0

      // Cut all video tracks at the playhead position
      try {
        for (var v = 0; v < qeSequence.numVideoTracks; v++) {
          var videoTrack = qeSequence.getVideoTrackAt(v)
          if (videoTrack) {
            videoTrack.razor(currentTimecode)
            cutsPerformed++
          }
        }
      } catch (videoError) {
        // Continue with audio tracks even if video fails
      }

      // Cut all audio tracks at the playhead position
      try {
        for (var a = 0; a < qeSequence.numAudioTracks; a++) {
          var audioTrack = qeSequence.getAudioTrackAt(a)
          if (audioTrack) {
            audioTrack.razor(currentTimecode)
            cutsPerformed++
          }
        }
      } catch (audioError) {
        // Track any audio errors
      }

      return JSON.stringify({
        success: true,
        message: 'Cut completed at ' + timecode,
        cutsPerformed: cutsPerformed,
        timecode: timecode,
        totalSeconds: totalSeconds.toFixed(3)
      })
    } catch (qeError) {
      // Fallback to standard razor if QE fails
      try {
        sequence.razor(cutTimeTicks.toString())
        return JSON.stringify({
          success: true,
          message: 'Cut completed at ' + timecode + ' (standard razor)',
          cutsPerformed: 1,
          timecode: timecode,
          totalSeconds: totalSeconds.toFixed(3)
        })
      } catch (fallbackError) {
        return JSON.stringify({
          success: false,
          error: 'Cut failed: ' + fallbackError.toString()
        })
      }
    }
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: 'Cut operation error: ' + error.toString()
    })
  }
}

/**
 * Performs a single cut at the specified time in seconds
 * @param {number} timeInSeconds - Time in decimal seconds to cut at
 * @returns {string} JSON string with success status and message
 */
function cutAtTime(timeInSeconds) {
  try {
    if (!app.project || !app.project.activeSequence) {
      return JSON.stringify({
        success: false,
        error: 'No active sequence'
      })
    }

    var sequence = app.project.activeSequence

    // Convert seconds to ticks (254016000000 ticks per second)
    var ticksPerSecond = 254016000000
    var cutTimeTicks = Math.round(timeInSeconds * ticksPerSecond)

    // Move the playhead to the cut position
    sequence.setPlayerPosition(cutTimeTicks.toString())

    // Enable QE DOM for razor functionality (same approach as cutAllTracksAtTime)
    try {
      app.enableQE()
      var qeSequence = qe.project.getActiveSequence()

      if (!qeSequence) {
        return JSON.stringify({
          success: false,
          error: 'Could not access QE sequence'
        })
      }

      // Get the current playhead position in QE format
      var currentTimecode = qeSequence.CTI.timecode
      var cutsPerformed = 0

      // Cut all video tracks at the playhead position
      try {
        for (var v = 0; v < qeSequence.numVideoTracks; v++) {
          var videoTrack = qeSequence.getVideoTrackAt(v)
          if (videoTrack) {
            videoTrack.razor(currentTimecode)
            cutsPerformed++
          }
        }
      } catch (videoError) {
        // Continue with audio tracks even if video fails
      }

      // Cut all audio tracks at the playhead position
      try {
        for (var a = 0; a < qeSequence.numAudioTracks; a++) {
          var audioTrack = qeSequence.getAudioTrackAt(a)
          if (audioTrack) {
            audioTrack.razor(currentTimecode)
            cutsPerformed++
          }
        }
      } catch (audioError) {
        // Track any audio errors
      }

      return JSON.stringify({
        success: true,
        message: 'Cut completed at ' + timeInSeconds.toFixed(3) + 's',
        cutsPerformed: cutsPerformed,
        timeInSeconds: timeInSeconds
      })
    } catch (qeError) {
      return JSON.stringify({
        success: false,
        error: 'QE DOM cutting failed: ' + qeError.toString()
      })
    }
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: 'Cut operation error: ' + error.toString()
    })
  }
}

/**
 * Helper function to find all selected clips across video and audio tracks
 * @returns {Array} Array of selected clip objects with track info
 */
function findSelectedClips() {
  var sequence = app.project.activeSequence
  if (!sequence) return []

  var selectedClips = []

  // Check video tracks
  for (var v = 0; v < sequence.videoTracks.numTracks; v++) {
    var videoTrack = sequence.videoTracks[v]
    for (var vc = 0; vc < videoTrack.clips.numItems; vc++) {
      var clip = videoTrack.clips[vc]
      if (clip && clip.isSelected()) {
        selectedClips.push({
          clip: clip,
          trackIndex: v,
          clipIndex: vc,
          isVideo: true,
          name: clip.name,
          startTime: parseFloat(clip.start.seconds),
          endTime: parseFloat(clip.end.seconds)
        })
      }
    }
  }

  // Check audio tracks
  for (var a = 0; a < sequence.audioTracks.numTracks; a++) {
    var audioTrack = sequence.audioTracks[a]
    for (var ac = 0; ac < audioTrack.clips.numItems; ac++) {
      var clip = audioTrack.clips[ac]
      if (clip && clip.isSelected()) {
        selectedClips.push({
          clip: clip,
          trackIndex: a,
          clipIndex: ac,
          isVideo: false,
          name: clip.name,
          startTime: parseFloat(clip.start.seconds),
          endTime: parseFloat(clip.end.seconds)
        })
      }
    }
  }

  return selectedClips
}

/**
 * Removes selected clips while preserving gaps
 * @returns {string} JSON string with operation result
 */
function removeSelectedClipKeepGap() {
  try {
    var sequence = app.project.activeSequence
    if (!sequence) {
      return JSON.stringify({ success: false, error: 'No active sequence' })
    }

    var selectedClips = findSelectedClips()
    if (selectedClips.length === 0) {
      return JSON.stringify({ success: false, message: 'No selected clips found' })
    }

    // Sort by start time (latest first) to prevent index shifting
    selectedClips.sort(function (a, b) {
      return b.startTime - a.startTime
    })

    var clipsRemoved = 0
    var results = []

    // Remove only the originally selected clips (keep gaps)
    for (var i = 0; i < selectedClips.length; i++) {
      var clipData = selectedClips[i]
      var result = properDeleteClip(
        clipData.trackIndex,
        clipData.clipIndex,
        clipData.isVideo,
        false
      )

      if (result.success) {
        clipsRemoved++
        results.push({
          track: clipData.trackIndex + 1,
          type: clipData.isVideo ? 'video' : 'audio',
          name: clipData.name,
          method: result.method
        })
      }
    }

    return JSON.stringify({
      success: clipsRemoved > 0,
      message: 'Removed ' + clipsRemoved + ' clip(s) with gaps preserved',
      clipsRemoved: clipsRemoved,
      selectedClips: results
    })
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: 'Operation failed: ' + error.toString()
    })
  }
}

/**
 * Removes selected clips with ripple delete
 * @returns {string} JSON string with operation result
 */
function removeSelectedClipRipple() {
  try {
    var sequence = app.project.activeSequence
    if (!sequence) {
      return JSON.stringify({ success: false, error: 'No active sequence' })
    }

    var selectedClips = findSelectedClips()
    if (selectedClips.length === 0) {
      return JSON.stringify({ success: false, message: 'No selected clips found' })
    }

    // Sort by start time (latest first) to prevent index shifting
    selectedClips.sort(function (a, b) {
      return b.startTime - a.startTime
    })

    var clipsRemoved = 0
    var results = []

    // Remove only the originally selected clips with ripple
    for (var i = 0; i < selectedClips.length; i++) {
      var clipData = selectedClips[i]
      var result = properDeleteClip(clipData.trackIndex, clipData.clipIndex, clipData.isVideo, true)

      if (result.success) {
        clipsRemoved++
        results.push({
          track: clipData.trackIndex + 1,
          type: clipData.isVideo ? 'video' : 'audio',
          name: clipData.name,
          method: result.method
        })
      }
    }

    return JSON.stringify({
      success: clipsRemoved > 0,
      message: 'Ripple deleted ' + clipsRemoved + ' selected clip(s)',
      clipsRemoved: clipsRemoved,
      selectedClips: results
    })
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: 'Operation failed: ' + error.toString()
    })
  }
}

/**
 * Identifies and deletes silence segments based on audio level analysis
 * @param {string} segmentsJSON - JSON string of silence segments with start/end times
 * @returns {string} JSON string with operation result
 */
function deleteSilenceSegments(segmentsJSON) {
  try {
    var sequence = app.project.activeSequence
    if (!sequence) {
      return JSON.stringify({ success: false, error: 'No active sequence' })
    }

    var segments
    try {
      segments = JSON.parse(segmentsJSON)
    } catch (parseError) {
      return JSON.stringify({
        success: false,
        error: 'Invalid segments JSON: ' + parseError.toString()
      })
    }

    if (!segments || segments.length === 0) {
      return JSON.stringify({
        success: false,
        error: 'No silence segments provided'
      })
    }

    logMessage('Identifying silence clips for deletion...')
    logMessage('Segments to delete: ' + segments.length)

    var clipsToDelete = []
    var tolerance = 0.05 // 50ms tolerance for time matching (tighter than before)

    // Search through all tracks to find clips that match our silence segments
    for (var s = 0; s < segments.length; s++) {
      var segment = segments[s]
      var segmentStart = segment.start
      var segmentEnd = segment.end
      var segmentDuration = segmentEnd - segmentStart

      logMessage(
        'Looking for silence segment: ' +
          segmentStart +
          's to ' +
          segmentEnd +
          's (duration: ' +
          segmentDuration +
          's)'
      )

      // Only process segments that are likely to be silence (longer than 100ms)
      if (segmentDuration < 0.1) {
        logMessage('Skipping very short segment (< 100ms)')
        continue
      }

      // Check audio tracks first (silence detection is primarily audio-based)
      for (var a = 0; a < sequence.audioTracks.numTracks; a++) {
        var audioTrack = sequence.audioTracks[a]

        for (var ac = 0; ac < audioTrack.clips.numItems; ac++) {
          var clip = audioTrack.clips[ac]
          if (clip) {
            var clipStart = parseFloat(clip.start.seconds)
            var clipEnd = parseFloat(clip.end.seconds)
            var clipDuration = clipEnd - clipStart

            // Check if this clip matches our silence segment (within tolerance)
            // Must match start time, end time, AND duration
            if (
              Math.abs(clipStart - segmentStart) < tolerance &&
              Math.abs(clipEnd - segmentEnd) < tolerance &&
              Math.abs(clipDuration - segmentDuration) < tolerance
            ) {
              // Additional check: ensure this is likely a silence segment
              // by checking if it's in the middle of what was originally a longer clip
              var isLikelySilence = true

              // If the clip is very short compared to typical speech, it's likely silence
              if (clipDuration < 0.5) {
                isLikelySilence = true
              }

              if (isLikelySilence) {
                // Mark this clip for deletion
                clipsToDelete.push({
                  clip: clip,
                  trackIndex: a,
                  clipIndex: ac,
                  isVideo: false,
                  name: clip.name || 'Audio Silence',
                  startTime: clipStart,
                  endTime: clipEnd,
                  duration: clipDuration,
                  segmentId: segment.id
                })

                logMessage(
                  'Found silence clip: ' +
                    clip.name +
                    ' (' +
                    clipStart +
                    's to ' +
                    clipEnd +
                    's, duration: ' +
                    clipDuration +
                    's)'
                )
              }
            }
          }
        }
      }

      // Check video tracks for matching clips (only if we found audio clips)
      // This ensures we only delete video segments that correspond to audio silence
      var audioClipsFound = clipsToDelete.filter(function (c) {
        return !c.isVideo
      }).length

      if (audioClipsFound > 0) {
        for (var v = 0; v < sequence.videoTracks.numTracks; v++) {
          var videoTrack = sequence.videoTracks[v]

          for (var vc = 0; vc < videoTrack.clips.numItems; vc++) {
            var clip = videoTrack.clips[vc]
            if (clip) {
              var clipStart = parseFloat(clip.start.seconds)
              var clipEnd = parseFloat(clip.end.seconds)
              var clipDuration = clipEnd - clipStart

              // Check if this clip matches our silence segment (within tolerance)
              if (
                Math.abs(clipStart - segmentStart) < tolerance &&
                Math.abs(clipEnd - segmentEnd) < tolerance &&
                Math.abs(clipDuration - segmentDuration) < tolerance
              ) {
                // Mark this clip for deletion
                clipsToDelete.push({
                  clip: clip,
                  trackIndex: v,
                  clipIndex: vc,
                  isVideo: true,
                  name: clip.name || 'Video Silence',
                  startTime: clipStart,
                  endTime: clipEnd,
                  duration: clipDuration,
                  segmentId: segment.id
                })

                logMessage(
                  'Found matching video clip: ' +
                    clip.name +
                    ' (' +
                    clipStart +
                    's to ' +
                    clipEnd +
                    's, duration: ' +
                    clipDuration +
                    's)'
                )
              }
            }
          }
        }
      }
    }

    if (clipsToDelete.length === 0) {
      return JSON.stringify({
        success: false,
        message: 'No silence clips found matching the specified time ranges'
      })
    }

    logMessage('Found ' + clipsToDelete.length + ' silence clips to delete')

    // Sort clips by start time (latest first) to prevent index shifting during deletion
    clipsToDelete.sort(function (a, b) {
      return b.startTime - a.startTime
    })

    var clipsDeleted = 0
    var results = []
    var errors = []

    // Delete each identified silence clip using proper deletion (not opacity changes)
    for (var i = 0; i < clipsToDelete.length; i++) {
      var clipData = clipsToDelete[i]

      try {
        // Use a more aggressive deletion approach
        var result = properDeleteClip(
          clipData.trackIndex,
          clipData.clipIndex,
          clipData.isVideo,
          true
        )

        if (result.success) {
          clipsDeleted++
          results.push({
            track: clipData.trackIndex + 1,
            type: clipData.isVideo ? 'video' : 'audio',
            name: clipData.name,
            method: result.method,
            segmentId: clipData.segmentId,
            timeRange: clipData.startTime + 's to ' + clipData.endTime + 's',
            duration: clipData.duration + 's'
          })
          logMessage(
            'Deleted silence clip: ' + clipData.name + ' (duration: ' + clipData.duration + 's)'
          )
        } else {
          errors.push('Failed to delete clip: ' + clipData.name + ' - ' + result.error)
          logMessage('Failed to delete: ' + clipData.name + ' - ' + result.error)
        }
      } catch (deleteError) {
        errors.push('Error deleting clip: ' + clipData.name + ' - ' + deleteError.toString())
        logMessage('Error deleting: ' + clipData.name + ' - ' + deleteError.toString())
      }
    }

    var message = 'Deleted ' + clipsDeleted + ' silence clip(s)'
    if (errors.length > 0) {
      message += ' with ' + errors.length + ' error(s)'
    }

    return JSON.stringify({
      success: clipsDeleted > 0,
      message: message,
      clipsDeleted: clipsDeleted,
      totalClipsFound: clipsToDelete.length,
      deletedClips: results,
      errors: errors
    })
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: 'Silence deletion failed: ' + error.toString()
    })
  }
}

/**
 * Properly deletes a clip without falling back to opacity changes
 * @param {number} trackIndex - Index of the track
 * @param {number} clipIndex - Index of the clip in the track
 * @param {boolean} isVideo - Whether this is a video track
 * @param {boolean} ripple - Whether to use ripple delete
 * @returns {object} Result object with success status and method used
 */
function properDeleteClip(trackIndex, clipIndex, isVideo, ripple) {
  var results = {
    success: false,
    error: 'All deletion methods failed',
    methods: []
  }

  // Method 1: Try official trackItem.remove() method (Premiere Pro 13.1+)
  try {
    var sequence = app.project.activeSequence
    if (sequence) {
      var track = isVideo ? sequence.videoTracks[trackIndex] : sequence.audioTracks[trackIndex]

      if (track && clipIndex < track.clips.numItems) {
        var clip = track.clips[clipIndex]

        // Use the official remove method
        var removeResult = clip.remove(ripple, true)

        if (removeResult === 0) {
          results.success = true
          results.method = 'trackItem.remove()'
          results.methods.push('trackItem.remove() - Success')
          return results
        } else {
          results.methods.push('trackItem.remove() - Returned: ' + removeResult)
        }
      }
    }
  } catch (removeError) {
    results.methods.push('trackItem.remove() - Failed: ' + removeError.toString())
  }

  // Method 2: Try QE DOM approach (more reliable than the old fallback)
  try {
    if (app.enableQE() !== false) {
      var qeSequence = qe.project.getActiveSequence()
      var qeTrack = isVideo
        ? qeSequence.getVideoTrackAt(trackIndex)
        : qeSequence.getAudioTrackAt(trackIndex)

      if (qeTrack && qeTrack.numItems > clipIndex) {
        var qeClip = qeTrack.getItemAt(clipIndex)
        if (qeClip) {
          qeClip.remove(ripple, true)
          results.success = true
          results.method = 'QE DOM'
          results.methods.push('QE DOM - Success')
          return results
        }
      }
    }
  } catch (qeError) {
    results.methods.push('QE DOM - Failed: ' + qeError.toString())
  }

  // Method 3: Try selection and delete (last resort)
  try {
    var sequence = app.project.activeSequence
    if (sequence) {
      var track = isVideo ? sequence.videoTracks[trackIndex] : sequence.audioTracks[trackIndex]

      if (track && clipIndex < track.clips.numItems) {
        var clip = track.clips[clipIndex]

        // Select the clip
        clip.isSelected = true

        // Try to delete selected clips
        if (ripple) {
          sequence.deleteSelection() // This should ripple delete
        } else {
          sequence.deleteSelection() // This should delete with gap
        }

        results.success = true
        results.method = 'selection.delete()'
        results.methods.push('Selection delete - Success')
        return results
      }
    }
  } catch (selectionError) {
    results.methods.push('Selection delete - Failed: ' + selectionError.toString())
  }

  // DO NOT fall back to opacity changes - we want actual deletion
  results.error = 'All deletion methods failed: ' + results.methods.join(', ')
  return results
}

/**
 * Mutes the selected clips by setting audio volume to -∞ dB and video opacity to 0
 * @returns {string} JSON string with operation result
 */
function muteSelectedClip() {
  try {
    var sequence = app.project.activeSequence
    if (!sequence) {
      return JSON.stringify({
        success: false,
        error: 'No active sequence'
      })
    }

    var clipsMuted = 0
    var selectedClipsInfo = []

    // Helper function to convert dB to internal float value
    function dbToFloat(dbValue) {
      if (dbValue === -Infinity || dbValue <= -100) {
        return 0.0 // Negative infinity = 0.0 (complete silence)
      }
      // Premiere Pro uses an offset of 15 for dB conversion
      return Math.pow(10, (dbValue - 15) / 20)
    }

    // Check video tracks for selected clips
    for (var v = 0; v < sequence.videoTracks.numTracks; v++) {
      var videoTrack = sequence.videoTracks[v]

      for (var vc = 0; vc < videoTrack.clips.numItems; vc++) {
        var clip = videoTrack.clips[vc]

        if (clip && clip.isSelected()) {
          selectedClipsInfo.push({
            track: v + 1,
            type: 'video',
            name: clip.name
          })

          // For video clips, we mute by setting opacity to 0 (visual muting)
          // This keeps the clip functional but invisible
          if (clip.components && clip.components.numItems > 0) {
            try {
              var opacityComponent = clip.components[0] // Usually opacity
              if (
                opacityComponent &&
                opacityComponent.properties &&
                opacityComponent.properties.numItems > 0
              ) {
                opacityComponent.properties[0].setValue(0.0) // 0% opacity
                clipsMuted++
                logMessage('Muted video clip by setting opacity to 0: ' + clip.name)
              }
            } catch (opacityError) {
              logMessage('Could not mute video clip: ' + opacityError.toString())
            }
          }
        }
      }
    }

    // Check audio tracks for selected clips
    for (var a = 0; a < sequence.audioTracks.numTracks; a++) {
      var audioTrack = sequence.audioTracks[a]

      for (var ac = 0; ac < audioTrack.clips.numItems; ac++) {
        var clip = audioTrack.clips[ac]

        if (clip && clip.isSelected()) {
          selectedClipsInfo.push({
            track: a + 1,
            type: 'audio',
            name: clip.name
          })

          // For audio clips, mute by setting volume to -∞ dB (0.0 float)
          if (clip.components && clip.components.numItems > 0) {
            try {
              var volumeFound = false

              // Look for the Volume component specifically
              for (var c = 0; c < clip.components.numItems; c++) {
                var component = clip.components[c]
                if (
                  component &&
                  (component.displayName === 'Volume' ||
                    component.displayName === 'Audio Levels' ||
                    component.displayName === 'Channel Volume')
                ) {
                  if (component.properties && component.properties.numItems > 0) {
                    // Find the Level property (usually index 1, not 0)
                    var levelProperty = component.properties[1] || component.properties[0]
                    if (levelProperty) {
                      // Set to 0.0 which equals -∞ dB (complete silence)
                      levelProperty.setValue(0.0)
                      clipsMuted++
                      logMessage('Muted audio clip by setting volume to -∞ dB: ' + clip.name)
                      volumeFound = true
                      break
                    }
                  }
                }
              }

              // Fallback: If no Volume component found, try first component
              if (!volumeFound && clip.components.numItems > 0) {
                var firstComponent = clip.components[0]
                if (
                  firstComponent &&
                  firstComponent.properties &&
                  firstComponent.properties.numItems > 1
                ) {
                  // Audio clips typically have Level property at index 1
                  var levelProperty = firstComponent.properties[1]
                  if (levelProperty) {
                    levelProperty.setValue(0.0) // -∞ dB
                    clipsMuted++
                    logMessage(
                      'Muted audio clip using first component level property: ' + clip.name
                    )
                    volumeFound = true
                  }
                }
              }

              if (!volumeFound) {
                logMessage('Could not find volume property for audio clip: ' + clip.name)
              }
            } catch (volumeError) {
              logMessage('Could not mute audio clip: ' + volumeError.toString())
            }
          }
        }
      }
    }

    return JSON.stringify({
      success: clipsMuted > 0,
      message:
        clipsMuted > 0
          ? 'Muted audio on ' + clipsMuted + ' selected clip(s)'
          : 'No selected clips found or could not mute any clips',
      clipsMuted: clipsMuted,
      selectedClips: selectedClipsInfo
    })
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: 'Mute operation error: ' + error.toString()
    })
  }
}

/**
 * Identifies and mutes silence segments based on audio level analysis
 * @param {string} segmentsJSON - JSON string of silence segments with start/end times
 * @returns {string} JSON string with operation result
 */
function muteSilenceSegments(segmentsJSON) {
  try {
    var sequence = app.project.activeSequence
    if (!sequence) {
      return JSON.stringify({ success: false, error: 'No active sequence' })
    }

    var segments
    try {
      segments = JSON.parse(segmentsJSON)
    } catch (parseError) {
      return JSON.stringify({
        success: false,
        error: 'Invalid segments JSON: ' + parseError.toString()
      })
    }

    if (!segments || segments.length === 0) {
      return JSON.stringify({
        success: false,
        error: 'No silence segments provided'
      })
    }

    logMessage('Identifying silence clips for muting...')
    logMessage('Segments to mute: ' + segments.length)

    var clipsToMute = []
    var tolerance = 0.05 // 50ms tolerance for time matching

    // Search through all tracks to find clips that match our silence segments
    for (var s = 0; s < segments.length; s++) {
      var segment = segments[s]
      var segmentStart = segment.start
      var segmentEnd = segment.end
      var segmentDuration = segmentEnd - segmentStart

      logMessage(
        'Looking for silence segment: ' +
          segmentStart +
          's to ' +
          segmentEnd +
          's (duration: ' +
          segmentDuration +
          's)'
      )

      // Only process segments that are likely to be silence (longer than 100ms)
      if (segmentDuration < 0.1) {
        logMessage('Skipping very short segment (< 100ms)')
        continue
      }

      // Check audio tracks first (silence detection is primarily audio-based)
      for (var a = 0; a < sequence.audioTracks.numTracks; a++) {
        var audioTrack = sequence.audioTracks[a]

        for (var ac = 0; ac < audioTrack.clips.numItems; ac++) {
          var clip = audioTrack.clips[ac]
          if (clip) {
            var clipStart = parseFloat(clip.start.seconds)
            var clipEnd = parseFloat(clip.end.seconds)
            var clipDuration = clipEnd - clipStart

            // Check if this clip matches our silence segment (within tolerance)
            if (
              Math.abs(clipStart - segmentStart) < tolerance &&
              Math.abs(clipEnd - segmentEnd) < tolerance &&
              Math.abs(clipDuration - segmentDuration) < tolerance
            ) {
              // Mark this clip for muting
              clipsToMute.push({
                clip: clip,
                trackIndex: a,
                clipIndex: ac,
                isVideo: false,
                name: clip.name || 'Audio Silence',
                startTime: clipStart,
                endTime: clipEnd,
                duration: clipDuration,
                segmentId: segment.id
              })

              logMessage(
                'Found silence clip to mute: ' +
                  clip.name +
                  ' (' +
                  clipStart +
                  's to ' +
                  clipEnd +
                  's, duration: ' +
                  clipDuration +
                  's)'
              )
            }
          }
        }
      }

      // Check video tracks for matching clips (only if we found audio clips)
      var audioClipsFound = clipsToMute.filter(function (c) {
        return !c.isVideo
      }).length

      if (audioClipsFound > 0) {
        for (var v = 0; v < sequence.videoTracks.numTracks; v++) {
          var videoTrack = sequence.videoTracks[v]

          for (var vc = 0; vc < videoTrack.clips.numItems; vc++) {
            var clip = videoTrack.clips[vc]
            if (clip) {
              var clipStart = parseFloat(clip.start.seconds)
              var clipEnd = parseFloat(clip.end.seconds)
              var clipDuration = clipEnd - clipStart

              // Check if this clip matches our silence segment (within tolerance)
              if (
                Math.abs(clipStart - segmentStart) < tolerance &&
                Math.abs(clipEnd - segmentEnd) < tolerance &&
                Math.abs(clipDuration - segmentDuration) < tolerance
              ) {
                // Mark this clip for muting
                clipsToMute.push({
                  clip: clip,
                  trackIndex: v,
                  clipIndex: vc,
                  isVideo: true,
                  name: clip.name || 'Video Silence',
                  startTime: clipStart,
                  endTime: clipEnd,
                  duration: clipDuration,
                  segmentId: segment.id
                })

                logMessage(
                  'Found matching video clip (will be skipped): ' +
                    clip.name +
                    ' (' +
                    clipStart +
                    's to ' +
                    clipEnd +
                    's, duration: ' +
                    clipDuration +
                    's)'
                )
              }
            }
          }
        }
      }
    }

    if (clipsToMute.length === 0) {
      return JSON.stringify({
        success: false,
        message: 'No silence clips found matching the specified time ranges'
      })
    }

    logMessage('Found ' + clipsToMute.length + ' silence clips to mute')

    var clipsMuted = 0
    var results = []
    var errors = []

    // Mute each identified silence clip
    for (var i = 0; i < clipsToMute.length; i++) {
      var clipData = clipsToMute[i]

      try {
        // Select the clip first
        clipData.clip.isSelected = true

        // Apply muting based on clip type
        var muteSuccess = false
        if (clipData.isVideo) {
          // For video clips in silence segments, we don't need to do anything
          // The silence is in the audio tracks, not the video - keep video visible
          muteSuccess = true
          logMessage('Skipped video clip (no muting needed for silence): ' + clipData.name)
        } else {
          // For audio clips, mute by setting volume to -∞ dB (0.0 float)
          if (clipData.clip.components && clipData.clip.components.numItems > 0) {
            try {
              var volumeFound = false

              // Look for the Volume component specifically
              for (var c = 0; c < clipData.clip.components.numItems; c++) {
                var component = clipData.clip.components[c]
                if (
                  component &&
                  (component.displayName === 'Volume' ||
                    component.displayName === 'Audio Levels' ||
                    component.displayName === 'Channel Volume')
                ) {
                  if (component.properties && component.properties.numItems > 0) {
                    // Find the Level property (usually index 1, not 0)
                    var levelProperty = component.properties[1] || component.properties[0]
                    if (levelProperty) {
                      levelProperty.setValue(0.0) // -∞ dB
                      muteSuccess = true
                      volumeFound = true
                      logMessage('Muted audio clip by setting volume to -∞ dB: ' + clipData.name)
                      break
                    }
                  }
                }
              }

              // Fallback: If no Volume component found, try first component
              if (!volumeFound && clipData.clip.components.numItems > 0) {
                var firstComponent = clipData.clip.components[0]
                if (
                  firstComponent &&
                  firstComponent.properties &&
                  firstComponent.properties.numItems > 1
                ) {
                  // Audio clips typically have Level property at index 1
                  var levelProperty = firstComponent.properties[1]
                  if (levelProperty) {
                    levelProperty.setValue(0.0) // -∞ dB
                    muteSuccess = true
                    logMessage(
                      'Muted audio clip using first component level property: ' + clipData.name
                    )
                  }
                }
              }

              if (!muteSuccess) {
                errors.push('Could not find volume property for audio clip: ' + clipData.name)
              }
            } catch (volumeError) {
              errors.push(
                'Could not mute audio clip: ' + clipData.name + ' - ' + volumeError.toString()
              )
            }
          }
        }

        // Deselect the clip
        clipData.clip.isSelected = false

        if (muteSuccess) {
          clipsMuted++
          results.push({
            track: clipData.trackIndex + 1,
            type: clipData.isVideo ? 'video' : 'audio',
            name: clipData.name,
            method: clipData.isVideo ? 'skipped' : 'volume_-inf',
            segmentId: clipData.segmentId,
            timeRange: clipData.startTime + 's to ' + clipData.endTime + 's',
            duration: clipData.duration + 's'
          })
          logMessage(
            'Muted silence clip: ' + clipData.name + ' (duration: ' + clipData.duration + 's)'
          )
        }
      } catch (muteError) {
        errors.push('Error muting clip: ' + clipData.name + ' - ' + muteError.toString())
        logMessage('Error muting: ' + clipData.name + ' - ' + muteError.toString())
      }
    }

    var message = 'Muted ' + clipsMuted + ' silence clip(s)'
    if (errors.length > 0) {
      message += ' with ' + errors.length + ' error(s)'
    }

    return JSON.stringify({
      success: clipsMuted > 0,
      message: message,
      clipsMuted: clipsMuted,
      totalClipsFound: clipsToMute.length,
      mutedClips: results,
      errors: errors
    })
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: 'Silence muting failed: ' + error.toString()
    })
  }
}

// ==== EMBEDDED PRESET DATA ====
// This is the complete XML content of the "Waveform Audio 48kHz 16-bit.epr" preset

var EMBEDDED_PRESET_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<PremiereData Version="3">' +
  '	<StandardFilters Version="1">' +
  '		<DeinterlaceState>false</DeinterlaceState>' +
  '		<CropType>0</CropType>' +
  '		<CropRect>0,0,0,0</CropRect>' +
  '		<CropState>false</CropState>' +
  '	</StandardFilters>' +
  '	<DoEmulation>true</DoEmulation>' +
  '	<DoVideo>false</DoVideo>' +
  '	<DoAudio>true</DoAudio>' +
  '	<PresetID>f9d77413-d97c-457b-9640-72e9844e2cde</PresetID>' +
  '	<PostProcParamContainer ObjectRef="21"/>' +
  '	<FilterParamContainer ObjectRef="14"/>' +
  '	<ExportParamContainer ObjectRef="1"/>' +
  '	<ExporterFileType>1463899717</ExporterFileType>' +
  '	<ExporterClassID>1061109567</ExporterClassID>' +
  '	<ExporterName></ExporterName>' +
  '	<PresetName>($$$/AME/EncoderHost/Presets/f9d77413-d97c-457b-9640-72e9844e2cde/PresetName=WAV 48 kHz 16-bit)</PresetName>' +
  '	<FolderDisplayPath>System Presets/Audio Only</FolderDisplayPath>' +
  '	<ExporterParamContainer ObjectID="1" ClassID="5c20a4a5-5e7c-4032-85b8-26ad4531fe7b" Version="1">' +
  '		<ContainedParamsVersion>1</ContainedParamsVersion>' +
  '		<ParamContainerItems Version="1">' +
  '			<ParamContainerItem Index="0" ObjectRef="2"/>' +
  '		</ParamContainerItems>' +
  '	</ExporterParamContainer>' +
  '	<ExporterParam ObjectID="2" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamTargetBitrate>0</ParamTargetBitrate>' +
  '		<ParamTargetID>0</ParamTargetID>' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ExporterChildParams ObjectRef="3"/>' +
  '		<ParamName></ParamName>' +
  '		<ParamIdentifier>0</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>false</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>0</ParamOrdinalValue>' +
  '		<ParamType>10</ParamType>' +
  '		<ParamValue>0</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParamContainer ObjectID="3" ClassID="5c20a4a5-5e7c-4032-85b8-26ad4531fe7b" Version="1">' +
  '		<ContainedParamsVersion>1</ContainedParamsVersion>' +
  '		<ParamContainerItems Version="1">' +
  '			<ParamContainerItem Index="0" ObjectRef="4"/>' +
  '		</ParamContainerItems>' +
  '	</ExporterParamContainer>' +
  '	<ExporterParam ObjectID="4" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ExporterChildParams ObjectRef="5"/>' +
  '		<ParamIdentifier>ADBEAudioTabGroup</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>false</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>0</ParamOrdinalValue>' +
  '		<ParamType>8</ParamType>' +
  '		<ParamValue>0</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParamContainer ObjectID="5" ClassID="5c20a4a5-5e7c-4032-85b8-26ad4531fe7b" Version="1">' +
  '		<ContainedParamsVersion>1</ContainedParamsVersion>' +
  '		<ParamContainerItems Version="1">' +
  '			<ParamContainerItem Index="0" ObjectRef="6"/>' +
  '			<ParamContainerItem Index="1" ObjectRef="9"/>' +
  '		</ParamContainerItems>' +
  '	</ExporterParamContainer>' +
  '	<ExporterParam ObjectID="6" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ExporterChildParams ObjectRef="7"/>' +
  '		<ParamIdentifier>ADBEAudioCodecGroup</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>false</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>0</ParamOrdinalValue>' +
  '		<ParamType>8</ParamType>' +
  '		<ParamValue>0</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParamContainer ObjectID="7" ClassID="5c20a4a5-5e7c-4032-85b8-26ad4531fe7b" Version="1">' +
  '		<ContainedParamsVersion>1</ContainedParamsVersion>' +
  '		<ParamContainerItems Version="1">' +
  '			<ParamContainerItem Index="0" ObjectRef="8"/>' +
  '		</ParamContainerItems>' +
  '	</ExporterParamContainer>' +
  '	<ExporterParam ObjectID="8" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ParamIdentifier>ADBEAudioCodec</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>true</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>0</ParamOrdinalValue>' +
  '		<ParamType>2</ParamType>' +
  '		<ParamValue>0</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParam ObjectID="9" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ExporterChildParams ObjectRef="10"/>' +
  '		<ParamIdentifier>ADBEBasicAudioGroup</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>false</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>1</ParamOrdinalValue>' +
  '		<ParamType>8</ParamType>' +
  '		<ParamValue>0</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParamContainer ObjectID="10" ClassID="5c20a4a5-5e7c-4032-85b8-26ad4531fe7b" Version="1">' +
  '		<ContainedParamsVersion>1</ContainedParamsVersion>' +
  '		<ParamContainerItems Version="1">' +
  '			<ParamContainerItem Index="0" ObjectRef="11"/>' +
  '			<ParamContainerItem Index="1" ObjectRef="12"/>' +
  '			<ParamContainerItem Index="2" ObjectRef="13"/>' +
  '		</ParamContainerItems>' +
  '	</ExporterParamContainer>' +
  '	<ExporterParam ObjectID="11" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ParamIdentifier>ADBEAudioRatePerSecond</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>true</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>0</ParamOrdinalValue>' +
  '		<ParamType>2</ParamType>' +
  '		<ParamValue>48000</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParam ObjectID="12" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ParamIdentifier>ADBEAudioNumChannels</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>true</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>1</ParamOrdinalValue>' +
  '		<ParamType>2</ParamType>' +
  '		<ParamValue>2</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParam ObjectID="13" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ParamIdentifier>ADBEAudioSampleType</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>true</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>2</ParamOrdinalValue>' +
  '		<ParamType>2</ParamType>' +
  '		<ParamValue>1</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParamContainer ObjectID="14" ClassID="5c20a4a5-5e7c-4032-85b8-26ad4531fe7b" Version="1">' +
  '		<ContainedParamsVersion>1</ContainedParamsVersion>' +
  '		<ParamContainerItems Version="1">' +
  '			<ParamContainerItem Index="0" ObjectRef="15"/>' +
  '		</ParamContainerItems>' +
  '	</ExporterParamContainer>' +
  '	<ExporterParam ObjectID="15" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamTargetBitrate>0</ParamTargetBitrate>' +
  '		<ParamTargetID>0</ParamTargetID>' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ExporterChildParams ObjectRef="16"/>' +
  '		<ParamName>Filters</ParamName>' +
  '		<ParamIdentifier>FiltersParamsMultiGroup</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>false</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>0</ParamOrdinalValue>' +
  '		<ParamType>10</ParamType>' +
  '		<ParamValue>0</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParamContainer ObjectID="16" ClassID="5c20a4a5-5e7c-4032-85b8-26ad4531fe7b" Version="1">' +
  '		<ContainedParamsVersion>1</ContainedParamsVersion>' +
  '		<ParamContainerItems Version="1">' +
  '			<ParamContainerItem Index="0" ObjectRef="17"/>' +
  '		</ParamContainerItems>' +
  '	</ExporterParamContainer>' +
  '	<ExporterParam ObjectID="17" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ExporterChildParams ObjectRef="18"/>' +
  '		<ParamIdentifier>GuasianBlurFilterGroup</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>true</ParamIsDisabled>' +
  '		<ParamIsIndependant>false</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>0</ParamOrdinalValue>' +
  '		<ParamType>8</ParamType>' +
  '		<ParamValue>0</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParamContainer ObjectID="18" ClassID="5c20a4a5-5e7c-4032-85b8-26ad4531fe7b" Version="1">' +
  '		<ContainedParamsVersion>1</ContainedParamsVersion>' +
  '		<ParamContainerItems Version="1">' +
  '			<ParamContainerItem Index="0" ObjectRef="19"/>' +
  '			<ParamContainerItem Index="1" ObjectRef="20"/>' +
  '		</ParamContainerItems>' +
  '	</ExporterParamContainer>' +
  '	<ExporterParam ObjectID="19" ClassID="018cf63d-c58d-4d39-97df-36b6b2d6ef88" Version="1">' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ParamIdentifier>GuasianBlurFilterGroup_Blurriness</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>false</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>0</ParamOrdinalValue>' +
  '		<ParamType>3</ParamType>' +
  '		<ParamValue>0.</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParam ObjectID="20" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ParamIdentifier>GuasianBlurFilterGroup_BlurDimension</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>false</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>1</ParamOrdinalValue>' +
  '		<ParamType>2</ParamType>' +
  '		<ParamValue>0</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParamContainer ObjectID="21" ClassID="5c20a4a5-5e7c-4032-85b8-26ad4531fe7b" Version="1">' +
  '		<ContainedParamsVersion>1</ContainedParamsVersion>' +
  '		<ParamContainerItems Version="1">' +
  '			<ParamContainerItem Index="0" ObjectRef="22"/>' +
  '		</ParamContainerItems>' +
  '	</ExporterParamContainer>' +
  '	<ExporterParam ObjectID="22" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamTargetBitrate>0</ParamTargetBitrate>' +
  '		<ParamTargetID>0</ParamTargetID>' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ParamName>Others</ParamName>' +
  '		<ParamIdentifier>PostEncodeHostMultiGroup</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>false</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>0</ParamOrdinalValue>' +
  '		<ParamType>10</ParamType>' +
  '		<ParamValue>0</ParamValue>' +
  '	</ExporterParam>' +
  '</PremiereData>'

/**
 * Creates a temporary preset file from the embedded XML data
 * @returns {string} Path to temporary preset file or null if failed
 */
function createTempPresetFromEmbedded() {
  try {
    // Generate unique temporary filename
    var timestamp = new Date().getTime()
    var tempFileName = 'clean_cut_preset_' + timestamp + '.epr'
    var tempFilePath = Folder.temp.fsName + '/' + tempFileName

    // Write the XML content to temporary file
    var tempFile = new File(tempFilePath)
    tempFile.open('w')
    tempFile.write(EMBEDDED_PRESET_XML)
    tempFile.close()

    if (tempFile.exists) {
      return tempFilePath
    } else {
      return null
    }
  } catch (e) {
    return null
  }
}
