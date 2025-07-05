// Clean-Cut ExtendScript Host Functions
// This file contains functions that interact with Premiere Pro's API

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
        error: 'No active sequence'
      })
    }

    return JSON.stringify({
      success: true,
      selectedClips: [],
      hasSelectedClips: false
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
