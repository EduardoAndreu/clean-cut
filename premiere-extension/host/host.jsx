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

/**
 * Returns detailed information about the active sequence
 * @returns {string} JSON string with sequence information
 */
function getActiveSequenceInfo() {
  try {
    logMessage('Starting getActiveSequenceInfo()')

    if (!app.project) {
      logMessage('No active project found')
      return JSON.stringify({
        success: false,
        error: 'No active project'
      })
    }

    if (!app.project.activeSequence) {
      logMessage('No active sequence found')
      return JSON.stringify({
        success: false,
        error: 'No active sequence'
      })
    }

    var activeSequence = app.project.activeSequence
    logMessage('Found active sequence: ' + (activeSequence.name || 'unnamed'))

    // Get the timeline span from 0 to the end of the last clip
    var latestClipEndTicks = 0
    var timebase
    try {
      timebase = parseFloat(activeSequence.timebase)
      logMessage('Timebase: ' + timebase)
    } catch (e) {
      logMessage('Error getting timebase: ' + e.toString())
      return JSON.stringify({
        success: false,
        error: 'Error getting timebase: ' + e.toString()
      })
    }
    var clipsFound = 0

    logMessage('Starting timeline span calculation - timebase: ' + timebase)

    // Find the latest clip end time across all video tracks
    if (activeSequence.videoTracks) {
      logMessage('Scanning ' + activeSequence.videoTracks.numTracks + ' video tracks')
      for (var v = 0; v < activeSequence.videoTracks.numTracks; v++) {
        var videoTrack = activeSequence.videoTracks[v]
        if (videoTrack.clips && videoTrack.clips.numItems > 0) {
          logMessage('Video track ' + v + ' has ' + videoTrack.clips.numItems + ' clips')
          for (var vc = 0; vc < videoTrack.clips.numItems; vc++) {
            var videoClip = videoTrack.clips[vc]
            if (videoClip && videoClip.end && videoClip.end.ticks !== undefined) {
              var clipEndTicks = parseFloat(videoClip.end.ticks)
              logMessage(
                'Video track ' +
                  v +
                  ' clip ' +
                  vc +
                  ' (' +
                  (videoClip.name || 'unnamed') +
                  ') ends at ticks: ' +
                  clipEndTicks +
                  ' (' +
                  clipEndTicks / timebase +
                  ' seconds)'
              )
              if (clipEndTicks > latestClipEndTicks) {
                latestClipEndTicks = clipEndTicks
                logMessage(
                  'New latest clip end: ' +
                    clipEndTicks +
                    ' ticks (' +
                    clipEndTicks / timebase +
                    ' seconds)'
                )
              }
              clipsFound++
            }
          }
        }
      }
    }

    // Find the latest clip end time across all audio tracks
    if (activeSequence.audioTracks) {
      logMessage('Scanning ' + activeSequence.audioTracks.numTracks + ' audio tracks')
      for (var a = 0; a < activeSequence.audioTracks.numTracks; a++) {
        var audioTrack = activeSequence.audioTracks[a]
        if (audioTrack.clips && audioTrack.clips.numItems > 0) {
          logMessage('Audio track ' + a + ' has ' + audioTrack.clips.numItems + ' clips')
          for (var ac = 0; ac < audioTrack.clips.numItems; ac++) {
            var audioClip = audioTrack.clips[ac]
            if (audioClip && audioClip.end && audioClip.end.ticks !== undefined) {
              var clipEndTicks = parseFloat(audioClip.end.ticks)
              logMessage(
                'Audio track ' +
                  a +
                  ' clip ' +
                  ac +
                  ' (' +
                  (audioClip.name || 'unnamed') +
                  ') ends at ticks: ' +
                  clipEndTicks +
                  ' (' +
                  clipEndTicks / timebase +
                  ' seconds)'
              )
              if (clipEndTicks > latestClipEndTicks) {
                latestClipEndTicks = clipEndTicks
                logMessage(
                  'New latest clip end: ' +
                    clipEndTicks +
                    ' ticks (' +
                    clipEndTicks / timebase +
                    ' seconds)'
                )
              }
              clipsFound++
            }
          }
        }
      }
    }

    var timelineSpanSeconds = latestClipEndTicks / timebase
    logMessage(
      'Found ' +
        clipsFound +
        ' total clips, timeline span: 0 to ' +
        timelineSpanSeconds +
        ' seconds'
    )

    // If no clips found, fallback to sequence end time
    var sequenceEndTicks = latestClipEndTicks
    if (latestClipEndTicks === 0 || clipsFound === 0) {
      sequenceEndTicks = parseFloat(activeSequence.end) || 0
      timelineSpanSeconds = sequenceEndTicks / timebase
      logMessage(
        'No clips found, using sequence end: ' +
          sequenceEndTicks +
          ' ticks (' +
          timelineSpanSeconds +
          ' seconds)'
      )
    } else {
      logMessage(
        'Final timeline span: ' +
          latestClipEndTicks +
          ' ticks = ' +
          timelineSpanSeconds +
          ' seconds'
      )
    }

    // Get sequence in/out points (these are different from work area)
    // Note: getInPoint() and getOutPoint() return seconds, not ticks
    var sequenceInPointSeconds = 0
    var sequenceOutPointSeconds = timelineSpanSeconds
    var hasSequenceInOutPoints = false

    try {
      // Get sequence in/out points (already in seconds)
      sequenceInPointSeconds = parseFloat(activeSequence.getInPoint()) || 0
      sequenceOutPointSeconds = parseFloat(activeSequence.getOutPoint()) || timelineSpanSeconds

      // Check if in/out points are actually set (different from default sequence bounds)
      hasSequenceInOutPoints =
        (sequenceInPointSeconds !== 0 || sequenceOutPointSeconds !== timelineSpanSeconds) &&
        sequenceInPointSeconds !== sequenceOutPointSeconds

      logMessage('Sequence in point: ' + sequenceInPointSeconds + ' seconds')
      logMessage('Sequence out point: ' + sequenceOutPointSeconds + ' seconds')
      logMessage('Has sequence in/out points: ' + hasSequenceInOutPoints)
    } catch (e) {
      logMessage('Error getting sequence in/out points: ' + e.toString())
      sequenceInPointSeconds = 0
      sequenceOutPointSeconds = timelineSpanSeconds
      hasSequenceInOutPoints = false
    }

    // Get work area information
    // Note: getWorkAreaInPoint() and getWorkAreaOutPoint() return seconds, not ticks
    var workAreaEnabled = false
    var workAreaInPointSeconds = 0
    var workAreaOutPointSeconds = timelineSpanSeconds
    var hasWorkArea = false

    try {
      workAreaEnabled = activeSequence.isWorkAreaEnabled()
      if (workAreaEnabled) {
        workAreaInPointSeconds = parseFloat(activeSequence.getWorkAreaInPoint()) || 0
        workAreaOutPointSeconds =
          parseFloat(activeSequence.getWorkAreaOutPoint()) || timelineSpanSeconds
        hasWorkArea = workAreaInPointSeconds !== workAreaOutPointSeconds

        logMessage('Work area enabled: ' + workAreaEnabled)
        logMessage('Work area in point: ' + workAreaInPointSeconds + ' seconds')
        logMessage('Work area out point: ' + workAreaOutPointSeconds + ' seconds')
      }
    } catch (e) {
      logMessage('Error getting work area info: ' + e.toString())
      workAreaEnabled = false
      hasWorkArea = false
    }

    // Get audio track information
    var audioTrackInfo = []
    if (activeSequence.audioTracks) {
      for (var i = 0; i < activeSequence.audioTracks.numTracks; i++) {
        var track = activeSequence.audioTracks[i]
        audioTrackInfo.push({
          index: i + 1,
          name: track.name || 'Audio ' + (i + 1),
          enabled: track.isTargeted !== undefined ? track.isTargeted : true,
          muted: track.isMuted !== undefined ? track.isMuted : false
        })
      }
    }

    // Get frame rate using simpler approach
    var frameRate = 'unknown'
    try {
      // Try the basic framerate property first
      if (activeSequence.framerate && activeSequence.framerate !== 'unknown') {
        frameRate = activeSequence.framerate.toString()
        logMessage('Frame rate from sequence.framerate: ' + frameRate)
      } else {
        // Try videoDisplayFormat method
        var videoDisplayFormat = activeSequence.videoDisplayFormat
        if (videoDisplayFormat === 100) frameRate = '24'
        else if (videoDisplayFormat === 101) frameRate = '25'
        else if (videoDisplayFormat === 102) frameRate = '29.97'
        else if (videoDisplayFormat === 103) frameRate = '29.97'
        else if (videoDisplayFormat === 104) frameRate = '30'
        else if (videoDisplayFormat === 105) frameRate = '50'
        else if (videoDisplayFormat === 106) frameRate = '59.94'
        else if (videoDisplayFormat === 107) frameRate = '59.94'
        else if (videoDisplayFormat === 108) frameRate = '60'
        else if (videoDisplayFormat === 110) frameRate = '23.976'
        else if (videoDisplayFormat === 113) frameRate = '48'
        else frameRate = 'unknown (' + videoDisplayFormat + ')'

        logMessage('Frame rate from videoDisplayFormat: ' + frameRate)
      }
    } catch (e) {
      logMessage('Error getting frame rate: ' + e.toString())
      frameRate = 'unknown'
    }

    var sequenceInfo = {
      success: true,
      sequenceName: activeSequence.name,
      projectName: app.project.name,
      frameRate: frameRate,
      timebase: timebase,
      duration: sequenceEndTicks,
      videoTracks: activeSequence.videoTracks ? activeSequence.videoTracks.numTracks : 0,
      audioTracks: activeSequence.audioTracks ? activeSequence.audioTracks.numTracks : 0,
      audioTrackInfo: audioTrackInfo,

      // Sequence in/out points
      sequenceInPoint: sequenceInPointSeconds,
      sequenceOutPoint: sequenceOutPointSeconds,
      hasSequenceInOutPoints: hasSequenceInOutPoints,

      // Work area information
      workAreaEnabled: workAreaEnabled,
      workAreaInPoint: workAreaInPointSeconds,
      workAreaOutPoint: workAreaOutPointSeconds,
      hasWorkArea: hasWorkArea,

      // For backwards compatibility, use work area if available, otherwise sequence in/out
      inPoint: hasWorkArea ? workAreaInPointSeconds : sequenceInPointSeconds,
      outPoint: hasWorkArea ? workAreaOutPointSeconds : sequenceOutPointSeconds,
      hasInOutPoints: hasWorkArea || hasSequenceInOutPoints,

      // Use timeline span instead of cumulative duration
      durationSeconds: timelineSpanSeconds
    }

    logMessage('Final sequence info: ' + JSON.stringify(sequenceInfo, null, 2))
    return JSON.stringify(sequenceInfo)
  } catch (error) {
    logMessage('Error in getActiveSequenceInfo: ' + error.toString())
    return JSON.stringify({
      success: false,
      error: 'Error getting sequence info: ' + error.toString()
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

    var activeSequence = app.project.activeSequence
    var selectedClips = []
    var timebase = parseFloat(activeSequence.timebase) // Use the same timebase as sequence

    // Get frame rate using simpler approach
    var frameRate = 30 // Default fallback
    try {
      // Try the basic framerate property first
      if (activeSequence.framerate && activeSequence.framerate !== 'unknown') {
        frameRate = parseFloat(activeSequence.framerate)
        logMessage('Frame rate for clips from sequence.framerate: ' + frameRate)
      } else {
        // Try videoDisplayFormat method
        var videoDisplayFormat = activeSequence.videoDisplayFormat
        if (videoDisplayFormat === 100) frameRate = 24
        else if (videoDisplayFormat === 101) frameRate = 25
        else if (videoDisplayFormat === 102) frameRate = 29.97
        else if (videoDisplayFormat === 103) frameRate = 29.97
        else if (videoDisplayFormat === 104) frameRate = 30
        else if (videoDisplayFormat === 105) frameRate = 50
        else if (videoDisplayFormat === 106) frameRate = 59.94
        else if (videoDisplayFormat === 107) frameRate = 59.94
        else if (videoDisplayFormat === 108) frameRate = 60
        else if (videoDisplayFormat === 110) frameRate = 23.976
        else if (videoDisplayFormat === 113) frameRate = 48
        else frameRate = 30

        logMessage('Frame rate for clips from videoDisplayFormat: ' + frameRate)
      }
    } catch (e) {
      logMessage('Could not determine frame rate for clips, using 30fps: ' + e.toString())
    }

    logMessage(
      'Checking for selected clips with timebase: ' + timebase + ', frame rate: ' + frameRate
    )

    // Check audio tracks for selected clips
    if (activeSequence.audioTracks) {
      logMessage(
        'Checking ' + activeSequence.audioTracks.numTracks + ' audio tracks for selected clips'
      )
      for (var i = 0; i < activeSequence.audioTracks.numTracks; i++) {
        var track = activeSequence.audioTracks[i]
        if (track.clips && track.clips.numItems > 0) {
          logMessage('Audio track ' + i + ' has ' + track.clips.numItems + ' clips')
          for (var j = 0; j < track.clips.numItems; j++) {
            var clip = track.clips[j]
            if (clip && clip.isSelected && clip.isSelected()) {
              var startTicks = clip.start && clip.start.ticks ? parseFloat(clip.start.ticks) : 0
              var endTicks = clip.end && clip.end.ticks ? parseFloat(clip.end.ticks) : 0

              // Check if these might be frame numbers instead of ticks
              var startSeconds, endSeconds
              if (startTicks < 100000 && endTicks < 100000) {
                // Likely frame numbers - convert using frame rate
                startSeconds = startTicks / frameRate
                endSeconds = endTicks / frameRate
                logMessage(
                  'Audio clip ' +
                    j +
                    ' - detected frame numbers: ' +
                    startTicks +
                    '-' +
                    endTicks +
                    ' frames -> ' +
                    startSeconds +
                    '-' +
                    endSeconds +
                    ' seconds'
                )
              } else {
                // Use timebase conversion
                startSeconds = startTicks / timebase
                endSeconds = endTicks / timebase
                logMessage(
                  'Audio clip ' +
                    j +
                    ' - using timebase conversion: ' +
                    startTicks +
                    '-' +
                    endTicks +
                    ' ticks -> ' +
                    startSeconds +
                    '-' +
                    endSeconds +
                    ' seconds'
                )
              }

              selectedClips.push({
                trackIndex: i + 1,
                clipName: clip.name || 'Clip ' + j,
                startTime: startSeconds,
                endTime: endSeconds,
                duration: endSeconds - startSeconds,
                type: 'audio'
              })
            }
          }
        }
      }
    }

    // Also check video tracks for selected clips
    if (activeSequence.videoTracks) {
      logMessage(
        'Checking ' + activeSequence.videoTracks.numTracks + ' video tracks for selected clips'
      )
      for (var i = 0; i < activeSequence.videoTracks.numTracks; i++) {
        var track = activeSequence.videoTracks[i]
        if (track.clips && track.clips.numItems > 0) {
          logMessage('Video track ' + i + ' has ' + track.clips.numItems + ' clips')
          for (var j = 0; j < track.clips.numItems; j++) {
            var clip = track.clips[j]
            if (clip && clip.isSelected && clip.isSelected()) {
              var startTicks = clip.start && clip.start.ticks ? parseFloat(clip.start.ticks) : 0
              var endTicks = clip.end && clip.end.ticks ? parseFloat(clip.end.ticks) : 0

              // Check if these might be frame numbers instead of ticks
              var startSeconds, endSeconds
              if (startTicks < 100000 && endTicks < 100000) {
                // Likely frame numbers - convert using frame rate
                startSeconds = startTicks / frameRate
                endSeconds = endTicks / frameRate
                logMessage(
                  'Video clip ' +
                    j +
                    ' - detected frame numbers: ' +
                    startTicks +
                    '-' +
                    endTicks +
                    ' frames -> ' +
                    startSeconds +
                    '-' +
                    endSeconds +
                    ' seconds'
                )
              } else {
                // Use timebase conversion
                startSeconds = startTicks / timebase
                endSeconds = endTicks / timebase
                logMessage(
                  'Video clip ' +
                    j +
                    ' - using timebase conversion: ' +
                    startTicks +
                    '-' +
                    endTicks +
                    ' ticks -> ' +
                    startSeconds +
                    '-' +
                    endSeconds +
                    ' seconds'
                )
              }

              selectedClips.push({
                trackIndex: i + 1,
                clipName: clip.name || 'Clip ' + j,
                startTime: startSeconds,
                endTime: endSeconds,
                duration: endSeconds - startSeconds,
                type: 'video'
              })
            }
          }
        }
      }
    }

    logMessage('Total selected clips found: ' + selectedClips.length)

    return JSON.stringify({
      success: true,
      selectedClips: selectedClips,
      hasSelectedClips: selectedClips.length > 0
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

// Helper function to log messages to the Premiere Pro console
function logMessage(message) {
  try {
    $.writeln('[Clean-Cut] ' + message)
  } catch (e) {
    // Silent fail if console logging isn't available
  }
}
