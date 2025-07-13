// Clean-Cut Timeline Cutting Module
// This module contains functions for performing cuts and razor operations on the timeline

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
