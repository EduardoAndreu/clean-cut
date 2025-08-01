// Clean-Cut Sequence Information Module
// This module handles gathering information about sequences, projects, and clips

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
