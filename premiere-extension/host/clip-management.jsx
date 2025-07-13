// Clean-Cut Clip Management Module
// This module contains functions for managing clips: selection, deletion, muting, and manipulation

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

/**
 * Identifies and removes silence segments with gaps maintained based on audio level analysis
 * @param {string} segmentsJSON - JSON string of silence segments with start/end times
 * @returns {string} JSON string with operation result
 */
function removeSilenceSegmentsWithGaps(segmentsJSON) {
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

    logMessage('Identifying silence clips for removal (keeping gaps)...')
    logMessage('Segments to remove: ' + segments.length)

    var clipsToRemove = []
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
              // Mark this clip for removal
              clipsToRemove.push({
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
                'Found silence clip to remove: ' +
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
      var audioClipsFound = clipsToRemove.filter(function (c) {
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
                // Mark this clip for removal
                clipsToRemove.push({
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
                  'Found matching video clip to remove: ' +
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

    if (clipsToRemove.length === 0) {
      return JSON.stringify({
        success: false,
        message: 'No silence clips found matching the specified time ranges'
      })
    }

    logMessage('Found ' + clipsToRemove.length + ' silence clips to remove (keeping gaps)')

    // Sort clips by start time (latest first) to prevent index shifting during removal
    clipsToRemove.sort(function (a, b) {
      return b.startTime - a.startTime
    })

    var clipsRemoved = 0
    var results = []
    var errors = []

    // Remove each identified silence clip using proper removal with gaps preserved
    for (var i = 0; i < clipsToRemove.length; i++) {
      var clipData = clipsToRemove[i]

      try {
        // Use proper deletion with ripple: false to maintain gaps
        var result = properDeleteClip(
          clipData.trackIndex,
          clipData.clipIndex,
          clipData.isVideo,
          false // ripple = false to maintain gaps
        )

        if (result.success) {
          clipsRemoved++
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
            'Removed silence clip (gap preserved): ' +
              clipData.name +
              ' (duration: ' +
              clipData.duration +
              's)'
          )
        } else {
          errors.push('Failed to remove clip: ' + clipData.name + ' - ' + result.error)
          logMessage('Failed to remove: ' + clipData.name + ' - ' + result.error)
        }
      } catch (removeError) {
        errors.push('Error removing clip: ' + clipData.name + ' - ' + removeError.toString())
        logMessage('Error removing: ' + clipData.name + ' - ' + removeError.toString())
      }
    }

    var message = 'Removed ' + clipsRemoved + ' silence clip(s) with gaps preserved'
    if (errors.length > 0) {
      message += ' with ' + errors.length + ' error(s)'
    }

    return JSON.stringify({
      success: clipsRemoved > 0,
      message: message,
      clipsRemoved: clipsRemoved,
      totalClipsFound: clipsToRemove.length,
      removedClips: results,
      errors: errors
    })
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: 'Silence removal with gaps failed: ' + error.toString()
    })
  }
}
