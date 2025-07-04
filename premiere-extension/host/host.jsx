// Clean-Cut ExtendScript Host Functions
// This file contains functions that interact with Premiere Pro's API

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

    // Create a unique filename using timestamp
    var timestamp = new Date().getTime()
    var fileName = 'cleancut_audio_' + timestamp + '.wav'

    // Get system temp folder
    var tempFolder = Folder.temp
    var outputFile = new File(tempFolder.fsName + '/' + fileName)

    // Set up export settings for audio-only WAV
    var exportPath = outputFile.fsName

    // Export the sequence as audio
    // Note: This exports the entire sequence audio
    var success = activeSequence.exportAsMediaDirect(
      exportPath,
      app.encoder.encodePresets.match('Microsoft AVI'), // WAV preset
      app.encoder.ENCODE_ENTIRE_SEQUENCE
    )

    if (success) {
      return JSON.stringify({
        success: true,
        filePath: exportPath
      })
    } else {
      return JSON.stringify({
        success: false,
        error: 'Failed to export audio'
      })
    }
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

    // Parse the JSON input
    try {
      timestamps = JSON.parse(timestampsJSON)
    } catch (parseError) {
      return JSON.stringify({
        success: false,
        error: 'Invalid JSON format: ' + parseError.toString()
      })
    }

    // Validate input
    if (!timestamps || !timestamps.length) {
      return JSON.stringify({
        success: false,
        error: 'No timestamps provided'
      })
    }

    var cutsPerformed = 0
    var errors = []

    // Iterate through timestamps and perform cuts
    for (var i = 0; i < timestamps.length; i++) {
      var timestamp = timestamps[i]

      if (!timestamp.hasOwnProperty('start') || !timestamp.hasOwnProperty('end')) {
        errors.push('Invalid timestamp object at index ' + i + ': missing start or end')
        continue
      }

      try {
        // Convert seconds to ticks (Premiere's internal time unit)
        var startTime = timestamp.start * activeSequence.timebase
        var endTime = timestamp.end * activeSequence.timebase

        // Perform razor cuts at start and end times
        // Cut all tracks at the start time
        activeSequence.razor(startTime)

        // Cut all tracks at the end time
        activeSequence.razor(endTime)

        cutsPerformed += 2 // Two cuts per timestamp (start and end)
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
    var versionInfo = {
      status: 'connected',
      version: '1.0',
      premiereVersion: app.version || 'unknown',
      projectName: app.project ? app.project.name : 'no project',
      activeSequence:
        app.project && app.project.activeSequence ? app.project.activeSequence.name : 'none'
    }

    return JSON.stringify(versionInfo)
  } catch (error) {
    return JSON.stringify({
      status: 'error',
      version: '1.0',
      error: error.toString()
    })
  }
}

// Helper function to log messages to the Premiere Pro console
function logMessage(message) {
  try {
    $.writeln('[Clean-Cut] ' + message)
  } catch (e) {
    // Silent fail if console logging isn't available
  }
}
