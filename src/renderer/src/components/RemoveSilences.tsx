import { useState, useEffect } from 'react'
import { ScrollArea } from './ui/scroll-area'
import { Button } from './ui/button'
import { Slider } from './ui/slider'
import { Checkbox } from './ui/checkbox'
import { ConnectionPrompt } from './ui/connection-prompt'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { Label } from './ui/label'
import ActiveSequence from './ActiveSequence'

interface RemoveSilencesProps {
  premiereConnected: boolean
}

function RemoveSilences({ premiereConnected }: RemoveSilencesProps): React.JSX.Element {
  const [silenceThreshold, setSilenceThreshold] = useState<number>(-30)
  const [minSilenceLen, setMinSilenceLen] = useState<number>(1000)
  const [silencePadding, setSilencePadding] = useState<number>(100)
  const [silenceManagement, setSilenceManagement] = useState<string>('remove')
  const [status, setStatus] = useState<string>('Waiting for Premiere Pro connection...')
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [results, setResults] = useState<number[][] | null>(null)
  const [sequenceInfo, setSequenceInfo] = useState<{
    success: boolean
    sequenceName?: string
    projectName?: string
    frameRate?: string
    timebase?: number
    videoTracks?: number
    audioTracks?: number
    audioTrackInfo?: Array<{
      index: number
      name: string
      enabled: boolean
      muted: boolean
    }>

    // Sequence in/out points
    sequenceInPoint?: number
    sequenceOutPoint?: number
    hasSequenceInOutPoints?: boolean

    // Work area information
    workAreaEnabled?: boolean
    workAreaInPoint?: number
    workAreaOutPoint?: number
    hasWorkArea?: boolean

    // Backwards compatibility fields
    inPoint?: number
    outPoint?: number
    hasInOutPoints?: boolean

    // Duration and timecode fields
    durationSeconds?: number
    durationTime?: string
    inPointTime?: string
    outPointTime?: string

    // Selected clips information
    selectedClips?: Array<{
      name: string
      mediaType: string
      start: number
      end: number
      duration: number
      startTime: string
      endTime: string
      trackIndex: number
    }>

    error?: string
  } | null>(null)
  const [selectedAudioTracks, setSelectedAudioTracks] = useState<number[]>([])
  const [selectedRange, setSelectedRange] = useState<'entire' | 'inout' | 'selected'>('entire')
  const [selectedClipsInfo, setSelectedClipsInfo] = useState<{
    success: boolean
    selectedClips?: Array<{
      trackIndex: number
      clipName: string
      startTime: number
      endTime: number
      duration: number
      type: string
    }>
    hasSelectedClips?: boolean
  } | null>(null)

  // Effect hook for cleanup and side effects
  useEffect(() => {
    // Reset results when parameters change
    setResults(null)
  }, [silenceThreshold, minSilenceLen, silencePadding])

  // Update status when connection changes
  useEffect(() => {
    if (premiereConnected) {
      setStatus('Premiere Pro connected! Ready to process.')
      // Automatically fetch sequence info when connected
      handleRefreshSequenceInfo()
    } else {
      setStatus('Premiere Pro disconnected.')
      setSequenceInfo(null)
    }
  }, [premiereConnected])

  // Listen for sequence info updates from Premiere Pro
  useEffect(() => {
    const handleSequenceInfoUpdate = (_event: any, data: string) => {
      try {
        const sequenceData = JSON.parse(data)
        console.log('Received sequence info:', sequenceData)
        setSequenceInfo(sequenceData)

        // Initialize selected audio tracks when sequence info is received
        if (sequenceData.success && sequenceData.audioTracks) {
          const trackNumbers = Array.from({ length: sequenceData.audioTracks }, (_, i) => i + 1)
          setSelectedAudioTracks(trackNumbers)
        }
      } catch (error) {
        console.error('Error parsing sequence info:', error)
        setSequenceInfo({ success: false, error: 'Failed to parse sequence data' })
      }
    }

    const handleSelectedClipsInfoUpdate = (_event: any, data: string) => {
      try {
        const clipsData = JSON.parse(data)
        console.log('Received selected clips info:', clipsData)
        setSelectedClipsInfo(clipsData)

        if (selectedRange === 'selected') {
          if (!clipsData.success || !clipsData.hasSelectedClips) {
            setStatus(
              'No clips are selected. Please select audio clips in your timeline first, or choose a different range option.'
            )
            setIsProcessing(false)
          }
        }
      } catch (error) {
        console.error('Error parsing selected clips info:', error)
        setSelectedClipsInfo({ success: false, hasSelectedClips: false })
        if (selectedRange === 'selected') {
          setStatus('Error checking selected clips. Please try again.')
          setIsProcessing(false)
        }
      }
    }

    // Add IPC listeners
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.on('sequence-info-update', handleSequenceInfoUpdate)
      window.electron.ipcRenderer.on('selected-clips-info-update', handleSelectedClipsInfoUpdate)
    }

    return () => {
      // Cleanup listeners on unmount
      if (window.electron && window.electron.ipcRenderer) {
        window.electron.ipcRenderer.removeAllListeners('sequence-info-update')
        window.electron.ipcRenderer.removeAllListeners('selected-clips-info-update')
      }
    }
  }, [selectedRange])

  // Handle range selection changes and request fresh data
  const handleRangeSelection = async (range: 'entire' | 'inout' | 'selected') => {
    setSelectedRange(range)

    if (!premiereConnected) {
      return
    }

    try {
      // Always refresh sequence info for in/out points data
      if (range === 'inout' || range === 'entire') {
        await window.cleanCutAPI.requestSequenceInfo()
      }

      // Request selected clips info when switching to selected clips
      if (range === 'selected') {
        await window.cleanCutAPI.requestSelectedClipsInfo()
        // Also refresh sequence info to get updated timeline data
        await window.cleanCutAPI.requestSequenceInfo()
      }
    } catch (error) {
      console.error('Error requesting updated range data:', error)
    }
  }

  const handleRefreshSequenceInfo = async () => {
    if (!premiereConnected) {
      setStatus('Premiere Pro is not connected.')
      return
    }

    try {
      await window.cleanCutAPI.requestSequenceInfo()
      setStatus('Sequence info requested from Premiere Pro...')
    } catch (error) {
      setStatus(`Error requesting sequence info: ${error}`)
      console.error('Error requesting sequence info:', error)
    }
  }

  // Helper function to format time in HH:MM:SS format
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // Helper function to format time in HH:MM:SS:FF format (with frames)
  const formatTimeWithFrames = (seconds: number): string => {
    if (!sequenceInfo?.success) {
      return '00:00:00:00'
    }

    // Extract frame rate number from the frameRate string
    let frameRate = 30 // Default frame rate
    if (sequenceInfo.frameRate) {
      const frameRateStr = sequenceInfo.frameRate.toString()
      if (frameRateStr.includes('29.97')) {
        frameRate = 29.97
      } else if (frameRateStr.includes('24')) {
        frameRate = 24
      } else if (frameRateStr.includes('25')) {
        frameRate = 25
      } else if (frameRateStr.includes('30')) {
        frameRate = 30
      } else if (frameRateStr.includes('50')) {
        frameRate = 50
      } else if (frameRateStr.includes('59.94')) {
        frameRate = 59.94
      } else if (frameRateStr.includes('60')) {
        frameRate = 60
      } else if (frameRateStr.includes('23.976')) {
        frameRate = 23.976
      } else if (frameRateStr.includes('48')) {
        frameRate = 48
      }
    }

    const totalFrames = Math.floor(seconds * frameRate)
    const hours = Math.floor(totalFrames / (frameRate * 3600))
    const minutes = Math.floor((totalFrames % (frameRate * 3600)) / (frameRate * 60))
    const remainingSeconds = Math.floor((totalFrames % (frameRate * 60)) / frameRate)
    const frames = Math.floor(totalFrames % frameRate)

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`
  }

  // Helper function to get the timecode info based on selected range
  const getTimecodeInfo = () => {
    if (!sequenceInfo?.success) {
      return {
        startTimecode: '00:00:00:00',
        endTimecode: '00:00:00:00'
      }
    }

    let startTimecode = '00:00:00:00'
    let endTimecode = '00:00:00:00'

    switch (selectedRange) {
      case 'entire':
        // Start is always 00:00:00:00 for entire timeline
        startTimecode = '00:00:00:00'
        // End is the duration - use formatted time if available from Premiere Pro
        endTimecode =
          sequenceInfo.durationTime || formatTimeWithFrames(sequenceInfo.durationSeconds || 0)
        break

      case 'inout':
        // Priority: Work area > Sequence in/out points > Entire timeline
        if (sequenceInfo.hasWorkArea && sequenceInfo.workAreaEnabled) {
          startTimecode = formatTimeWithFrames(sequenceInfo.workAreaInPoint || 0)
          endTimecode = formatTimeWithFrames(sequenceInfo.workAreaOutPoint || 0)
        } else if (sequenceInfo.hasSequenceInOutPoints) {
          startTimecode = formatTimeWithFrames(sequenceInfo.sequenceInPoint || 0)
          endTimecode = formatTimeWithFrames(sequenceInfo.sequenceOutPoint || 0)
        } else if (sequenceInfo.inPointTime && sequenceInfo.outPointTime) {
          // Use the properly formatted timecode from Premiere Pro if available
          startTimecode = sequenceInfo.inPointTime
          endTimecode = sequenceInfo.outPointTime
        } else if (sequenceInfo.hasInOutPoints && sequenceInfo.timebase) {
          // Backwards compatibility fallback
          const timebase = sequenceInfo.timebase
          startTimecode = formatTimeWithFrames((sequenceInfo.inPoint || 0) / timebase)
          endTimecode = formatTimeWithFrames((sequenceInfo.outPoint || 0) / timebase)
        } else {
          // Fallback to entire timeline
          startTimecode = '00:00:00:00'
          endTimecode =
            sequenceInfo.durationTime || formatTimeWithFrames(sequenceInfo.durationSeconds || 0)
        }
        break

      case 'selected':
        if (sequenceInfo?.selectedClips && sequenceInfo.selectedClips.length > 0) {
          const clips = sequenceInfo.selectedClips
          const startTimeSeconds = Math.min(...clips.map((clip) => clip.start))
          const endTimeSeconds = Math.max(...clips.map((clip) => clip.end))
          startTimecode = formatTimeWithFrames(startTimeSeconds)
          endTimecode = formatTimeWithFrames(endTimeSeconds)
        } else {
          startTimecode = '00:00:00:00'
          endTimecode = '00:00:00:00'
        }
        break
    }

    return {
      startTimecode,
      endTimecode
    }
  }

  // Helper function to get the duration and range info based on selected range
  const getRangeInfo = () => {
    if (!sequenceInfo?.success) {
      return {
        duration: 0,
        startTime: '00:00:00',
        endTime: '00:00:00',
        startTimeSeconds: 0,
        endTimeSeconds: 0
      }
    }

    let duration = 0
    let startTimeSeconds = 0
    let endTimeSeconds = 0

    switch (selectedRange) {
      case 'entire':
        // Timeline span from 0:00:00 to end of last clip (includes gaps)
        duration = sequenceInfo.durationSeconds || 0
        startTimeSeconds = 0
        endTimeSeconds = duration
        console.log('📏 Entire timeline duration (0 to last clip):', duration, 'seconds')
        break

      case 'inout':
        // Priority: Work area > Sequence in/out points > Entire timeline
        if (sequenceInfo.hasWorkArea && sequenceInfo.workAreaEnabled) {
          // Work area points are already in seconds
          startTimeSeconds = sequenceInfo.workAreaInPoint || 0
          endTimeSeconds = sequenceInfo.workAreaOutPoint || 0
          duration = endTimeSeconds - startTimeSeconds
          console.log('📏 Work area duration:', duration, 'seconds (work area enabled)')
        } else if (sequenceInfo.hasSequenceInOutPoints) {
          // Sequence in/out points are already in seconds
          startTimeSeconds = sequenceInfo.sequenceInPoint || 0
          endTimeSeconds = sequenceInfo.sequenceOutPoint || 0
          duration = endTimeSeconds - startTimeSeconds
          console.log('📏 Sequence in/out points duration:', duration, 'seconds')
        } else if (sequenceInfo.hasInOutPoints && sequenceInfo.timebase) {
          // Backwards compatibility fallback (these might be in ticks)
          const timebase = sequenceInfo.timebase
          startTimeSeconds = (sequenceInfo.inPoint || 0) / timebase
          endTimeSeconds = (sequenceInfo.outPoint || 0) / timebase
          duration = endTimeSeconds - startTimeSeconds
          console.log('📏 Legacy in/out points duration:', duration, 'seconds')
        } else {
          // Fallback to entire timeline if no in/out points or work area
          duration = sequenceInfo.durationSeconds || 0
          startTimeSeconds = 0
          endTimeSeconds = duration
          console.log(
            '📏 No in/out points or work area, using entire timeline:',
            duration,
            'seconds'
          )
        }
        break

      case 'selected':
        if (sequenceInfo?.selectedClips && sequenceInfo.selectedClips.length > 0) {
          const clips = sequenceInfo.selectedClips
          startTimeSeconds = Math.min(...clips.map((clip) => clip.start))
          endTimeSeconds = Math.max(...clips.map((clip) => clip.end))
          duration = endTimeSeconds - startTimeSeconds
          console.log('📏 Selected clips duration:', duration, 'seconds', '| clips:', clips.length)
        } else {
          duration = 0
          startTimeSeconds = 0
          endTimeSeconds = 0
          console.log('📏 No selected clips found')
        }
        break
    }

    const result = {
      duration,
      startTime: formatTime(startTimeSeconds),
      endTime: formatTime(endTimeSeconds),
      startTimeSeconds,
      endTimeSeconds
    }

    return result
  }

  const handleProcessFromPremiere = async () => {
    if (!premiereConnected) {
      setStatus(
        'Premiere Pro is not connected. Please ensure the Clean-Cut extension is running in Premiere Pro.'
      )
      return
    }

    // Validate selections
    if (selectedAudioTracks.length === 0) {
      setStatus('Please select at least one audio track to process.')
      return
    }

    // If "Selected clips" is chosen, we should check if clips are actually selected
    if (selectedRange === 'selected') {
      if (!sequenceInfo?.selectedClips || sequenceInfo.selectedClips.length === 0) {
        setStatus(
          'No clips are selected. Please select audio clips in your timeline first, or choose a different range option.'
        )
        return
      }
    }

    setIsProcessing(true)
    setStatus('Requesting audio from Premiere Pro...')
    setResults(null)

    try {
      await window.cleanCutAPI.invokeCleanCut(
        '', // Empty file path for Premiere workflow
        silenceThreshold,
        minSilenceLen,
        silencePadding,
        {
          selectedAudioTracks,
          selectedRange
        }
      )

      const rangeText =
        selectedRange === 'entire'
          ? 'entire timeline'
          : selectedRange === 'inout'
            ? 'in/out points'
            : 'selected clips'
      const tracksText = selectedAudioTracks.map((t) => `A${t}`).join(', ')

      setStatus(`Clean-cut request sent to Premiere Pro! Processing will happen automatically.
Parameters used:
- Range: ${rangeText}
- Audio tracks: ${tracksText}
- Threshold: ${silenceThreshold}dB
- Min silence: ${minSilenceLen}ms  
- Padding: ${silencePadding}ms

Check Premiere Pro for the results.`)
    } catch (error) {
      console.error('Premiere clean cut error:', error)
      setStatus(`Error sending request to Premiere Pro: ${error}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="w-full bg-white">
      <ScrollArea className="h-[calc(100vh-12rem)] w-full">
        <div className="p-6">
          {/* Active Sequence */}
          <ActiveSequence
            sequenceInfo={sequenceInfo}
            premiereConnected={premiereConnected}
            onRefresh={handleRefreshSequenceInfo}
          />

          {/* Define Sections - always show, with different states based on connection */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-black mb-2">Define Sections</label>
            <div className="text-xs text-gray-500 mb-3">
              Update the audio sections to be processed by Clean-Cut
            </div>

            {/* Range Selection */}
            <div className="mb-4">
              <div className="flex gap-2 mb-3">
                <Button
                  variant={
                    !premiereConnected
                      ? 'secondary'
                      : selectedRange === 'entire'
                        ? 'default'
                        : 'outline'
                  }
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => handleRangeSelection('entire')}
                  disabled={!premiereConnected}
                >
                  Entire timeline
                </Button>
                <Button
                  variant={
                    !premiereConnected
                      ? 'secondary'
                      : selectedRange === 'inout'
                        ? 'default'
                        : 'outline'
                  }
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => handleRangeSelection('inout')}
                  disabled={!premiereConnected}
                >
                  In/Out points
                </Button>
                <Button
                  variant={
                    !premiereConnected
                      ? 'secondary'
                      : selectedRange === 'selected'
                        ? 'default'
                        : 'outline'
                  }
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => handleRangeSelection('selected')}
                  disabled={!premiereConnected}
                >
                  Selected clips
                </Button>
              </div>

              {/* Range status indicator */}
              {!premiereConnected ? (
                <ConnectionPrompt action="configure timeline ranges" size="sm" className="mb-6" />
              ) : selectedRange === 'inout' &&
                getTimecodeInfo().startTimecode === '00:00:00:00' &&
                getTimecodeInfo().endTimecode ===
                  (sequenceInfo?.durationTime ||
                    formatTimeWithFrames(sequenceInfo?.durationSeconds || 0)) ? (
                <div className="p-2 bg-gray-50 border border-gray-200 rounded text-[10px] text-gray-600 mb-3">
                  ⚠️ No In/Out points set - using entire timeline
                </div>
              ) : selectedRange === 'selected' &&
                (!sequenceInfo?.selectedClips || sequenceInfo.selectedClips.length === 0) ? (
                <div className="p-2 bg-gray-50 border border-gray-200 rounded text-[10px] text-gray-600 mb-3">
                  ⚠️ No clips selected - select clips in timeline first
                </div>
              ) : null}

              {/* Start and End Points Display */}
              {premiereConnected && sequenceInfo?.success && (
                <div className="text-xs text-gray-600 mb-3">
                  <div>
                    Start point:{' '}
                    <span className="font-mono text-xs">{getTimecodeInfo().startTimecode}</span>
                  </div>
                  <div>
                    End point:{' '}
                    <span className="font-mono text-xs">{getTimecodeInfo().endTimecode}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Audio Tracks */}
            <div className="mb-8">
              <div className="block text-sm font-semibold text-black mb-2">Audio Tracks</div>
              <div className="text-xs text-gray-500 mb-3">Select which audio tracks to process</div>
              {!premiereConnected ? (
                <ConnectionPrompt action="view audio tracks" size="sm" className="mb-6" />
              ) : (
                <div className="flex flex-col gap-1">
                  {Array.from({ length: sequenceInfo?.audioTracks || 0 }, (_, i) => {
                    const trackNumber = i + 1
                    const isSelected = selectedAudioTracks.includes(trackNumber)

                    return (
                      <div
                        key={trackNumber}
                        className="flex items-center gap-3 p-2 bg-gray-50 border border-gray-200 rounded cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedAudioTracks((prev) => prev.filter((t) => t !== trackNumber))
                          } else {
                            setSelectedAudioTracks((prev) => [...prev, trackNumber])
                          }
                        }}
                      >
                        <Checkbox
                          checked={isSelected}
                          onChange={() => {}} // onClick handler on parent handles this
                          className="flex-shrink-0"
                        />
                        <span className="text-xs font-semibold text-black min-w-[20px]">
                          A{trackNumber}
                        </span>
                        {/* Static waveform graphic */}
                        <div className="flex-1 h-4 flex items-end gap-px">
                          {/* Generate static waveform bars */}
                          {Array.from({ length: 80 }, (_, barIndex) => {
                            const heights = [
                              4, 8, 12, 16, 20, 14, 10, 6, 8, 18, 22, 16, 12, 8, 4, 6, 10, 14, 18,
                              12, 8, 6, 4, 8, 12, 16, 20, 14, 10, 6, 8, 18, 22, 16, 12, 8, 4, 6, 10,
                              14, 18, 12, 8, 6, 4, 8, 12, 16, 20, 14, 10, 6, 8, 18, 22, 16, 12, 8,
                              4, 6, 10, 14, 18, 12, 8, 6, 4, 8, 12, 16, 20, 14, 10, 6, 8, 18, 22,
                              16, 12, 8, 4, 6, 10, 14, 18, 12, 8, 6, 4, 8, 12, 16, 20, 14, 10, 6, 8,
                              18, 22, 16, 12, 8, 4, 6, 10, 14, 18, 12, 8, 6, 4, 8, 12, 16, 20, 14,
                              10, 6, 8, 18, 22, 16, 12, 8, 4, 6, 10, 14, 18, 12, 8, 6, 4, 8, 12, 16,
                              20, 14, 10, 6, 8, 18, 22, 16, 12, 8, 4, 6, 10, 14, 18, 12, 8, 6, 4, 8,
                              12, 16, 20, 14, 10, 6, 8, 18, 22, 16, 12, 8, 4, 6, 10, 14, 18, 12, 8,
                              6, 4, 8, 12, 16, 20, 14, 10, 6, 8, 18, 22, 16, 12, 8, 4, 6, 10, 14,
                              18, 12, 8, 6, 4, 8, 12, 16, 20, 14, 10, 6, 8, 18, 22, 16, 12, 8, 4, 6,
                              10, 14, 18, 12, 8, 6, 4, 8, 12, 16, 20, 14, 10, 6, 8, 18, 22, 16, 12,
                              8, 4, 6, 10, 14, 18, 12, 8, 6, 4, 8, 12, 16, 20, 14, 10, 6, 8, 18, 22,
                              16, 12, 8, 4, 6, 10, 14, 18, 12, 8, 6, 4, 8, 12, 16, 20, 14, 10, 6, 8,
                              18, 22, 16, 12, 8, 4, 6, 10, 14, 18, 12, 8, 6, 4, 8, 12, 16, 20, 14,
                              10, 6, 8, 18, 22, 16, 12, 8, 4, 6, 10, 14, 18, 12, 8, 6, 4, 8, 12, 16,
                              20, 14, 10, 6, 8, 18, 22, 16, 12, 8, 4, 6, 10, 14, 18, 12, 8, 6, 4, 8,
                              12, 16, 20, 14, 10, 6, 8, 18, 22, 16, 12, 8, 4, 6, 10, 14, 18, 12, 8,
                              6, 4, 8, 12, 16, 20, 14, 10, 6, 8, 18, 22, 16, 12, 8, 4, 6, 10, 14,
                              18, 12, 8, 6, 4, 8, 12, 16, 20
                            ]
                            return (
                              <div
                                key={barIndex}
                                className={`w-0.5 rounded-sm transition-colors duration-300 ${
                                  isSelected ? 'bg-black' : 'bg-gray-300'
                                }`}
                                style={{ height: `${heights[barIndex]}px` }}
                              />
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Settings */}
          <div className="mb-8">
            <div className="block text-sm font-semibold text-black mb-4">Settings</div>

            {/* Silence Threshold Slider */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-black mb-2">
                Silence Threshold: {silenceThreshold} dB
              </label>
              <Slider
                value={[silenceThreshold]}
                onValueChange={(value) => setSilenceThreshold(value[0])}
                min={-60}
                max={0}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between mt-1 text-xs text-gray-500">
                <span>-60 dB</span>
                <span>0 dB</span>
              </div>
            </div>

            {/* Minimum Silence Length Slider */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-black mb-2">
                Minimum Silence Length: {minSilenceLen} ms
              </label>
              <Slider
                value={[minSilenceLen]}
                onValueChange={(value) => setMinSilenceLen(value[0])}
                min={100}
                max={5000}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between mt-1 text-xs text-gray-500">
                <span>100 ms</span>
                <span>5000 ms</span>
              </div>
            </div>

            {/* Silence Padding Slider */}
            <div className="mb-0">
              <label className="block text-xs font-semibold text-black mb-2">
                Silence Padding: {silencePadding} ms
              </label>
              <Slider
                value={[silencePadding]}
                onValueChange={(value) => setSilencePadding(value[0])}
                min={0}
                max={1000}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between mt-1 text-xs text-gray-500">
                <span>0 ms</span>
                <span>1000 ms</span>
              </div>
            </div>
          </div>

          {/* Silence Management */}
          <div className="mb-5">
            <div className="block text-sm font-semibold text-black mb-4">Silence Management</div>
            <RadioGroup
              value={silenceManagement}
              onValueChange={setSilenceManagement}
              className="space-y-2"
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="remove" id="remove" />
                <Label htmlFor="remove" className="text-xs text-black">
                  Remove silences
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="keep" id="keep" />
                <Label htmlFor="keep" className="text-xs text-black">
                  Keep silences
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="mute" id="mute" />
                <Label htmlFor="mute" className="text-xs text-black">
                  Mute silences
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="keep-spaces" id="keep-spaces" />
                <Label htmlFor="keep-spaces" className="text-xs text-black">
                  Remove silences but keep spaces
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Process Button */}
          <div className="mb-5">
            <Button
              className="w-full px-6 py-3 text-base font-semibold"
              size="lg"
              onClick={handleProcessFromPremiere}
              disabled={isProcessing || !premiereConnected}
              variant={isProcessing || !premiereConnected ? 'secondary' : 'default'}
            >
              {isProcessing ? 'Processing...' : 'Process Audio'}
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

export default RemoveSilences
