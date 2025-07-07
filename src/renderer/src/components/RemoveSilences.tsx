import { useState, useEffect } from 'react'
import ReturnHomeButton from './ReturnHomeButton'
import PremierConnectionStatus from './PremierConnectionStatus'

function RemoveSilences(): React.JSX.Element {
  const [silenceThreshold, setSilenceThreshold] = useState<number>(-30)
  const [minSilenceLen, setMinSilenceLen] = useState<number>(1000)
  const [silencePadding, setSilencePadding] = useState<number>(100)
  const [status, setStatus] = useState<string>('Waiting for Premiere Pro connection...')
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [results, setResults] = useState<number[][] | null>(null)
  const [premiereConnected, setPremiereConnected] = useState<boolean>(false)
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

    durationSeconds?: number
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

  // Listen for Premiere Pro connection status updates
  useEffect(() => {
    const handlePremiereStatus = (event: any, data: { connected: boolean }) => {
      setPremiereConnected(data.connected)
      if (data.connected) {
        setStatus('Premiere Pro connected! Ready to process.')
        // Automatically fetch sequence info when connected
        handleRefreshSequenceInfo()
      } else {
        setStatus('Premiere Pro disconnected.')
        setSequenceInfo(null)
      }
    }

    // Add IPC listener for Premiere status updates
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.on('premiere-status-update', handlePremiereStatus)
    }

    return () => {
      // Cleanup listener on unmount
      if (window.electron && window.electron.ipcRenderer) {
        window.electron.ipcRenderer.removeAllListeners('premiere-status-update')
      }
    }
  }, [])

  // Listen for sequence info updates from Premiere Pro
  useEffect(() => {
    const handleSequenceInfoUpdate = (event: any, data: string) => {
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

    const handleSelectedClipsInfoUpdate = (event: any, data: string) => {
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
        if (
          selectedClipsInfo?.success &&
          selectedClipsInfo.selectedClips &&
          selectedClipsInfo.selectedClips.length > 0
        ) {
          const clips = selectedClipsInfo.selectedClips
          startTimeSeconds = Math.min(...clips.map((clip) => clip.startTime))
          endTimeSeconds = Math.max(...clips.map((clip) => clip.endTime))
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
      setStatus('Checking for selected clips...')
      try {
        await window.cleanCutAPI.requestSelectedClipsInfo()
        // We'll get the response via IPC and can validate there
      } catch (error) {
        setStatus('Error checking selected clips. Please try again.')
        return
      }
    }

    setIsProcessing(true)
    setStatus('Requesting audio from Premiere Pro...')
    setResults(null)

    try {
      const result = await window.cleanCutAPI.invokeCleanCut(
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
    <div className="min-h-screen bg-white flex items-center justify-center p-8 relative">
      <ReturnHomeButton onReturnHome={() => window.location.reload()} />

      <div className="w-full max-w-lg mx-auto bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <h2 className="text-2xl font-bold text-black text-center mb-6">Remove Silences</h2>

        {/* Connection Status */}
        <PremierConnectionStatus isConnected={premiereConnected} className="mb-4" />

        {/* Active Sequence Info - only show when connected */}
        {premiereConnected && (
          <div className="mb-5">
            <label className="block text-sm font-semibold text-black mb-2">Active Sequence</label>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-black">
                  {sequenceInfo?.success
                    ? sequenceInfo.sequenceName || 'Unknown Sequence'
                    : 'No Active Sequence'}
                </span>
                <button
                  className="px-2 py-1 text-xs font-semibold text-black bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                  onClick={handleRefreshSequenceInfo}
                >
                  Refresh
                </button>
              </div>
              {sequenceInfo?.success ? (
                <div className="text-xs text-gray-500">
                  Project: {sequenceInfo.projectName} | Tracks: {sequenceInfo.videoTracks}V/
                  {sequenceInfo.audioTracks}A
                  {sequenceInfo.frameRate && ` | ${sequenceInfo.frameRate} fps`}
                </div>
              ) : (
                <div className="text-xs text-gray-500">
                  {sequenceInfo?.error || 'Click refresh to get sequence information'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Define Sections */}
        {premiereConnected && sequenceInfo?.success && (
          <div className="mb-5">
            <label className="block text-sm font-semibold text-black mb-2">Define Sections</label>
            <div className="text-xs text-gray-500 mb-3">
              Update the audio sections to be processed by Clean-Cut
            </div>

            {/* Range Selection */}
            <div className="mb-4">
              <div className="flex gap-2 mb-3">
                <button
                  className={`flex-1 px-3 py-2 text-xs font-semibold rounded transition-colors ${
                    selectedRange === 'entire'
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-gray-50 text-gray-700 border border-gray-300 hover:bg-gray-100'
                  }`}
                  onClick={() => handleRangeSelection('entire')}
                >
                  Entire timeline
                </button>
                <button
                  className={`flex-1 px-3 py-2 text-xs font-semibold rounded transition-colors ${
                    selectedRange === 'inout'
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-gray-50 text-gray-700 border border-gray-300 hover:bg-gray-100'
                  }`}
                  onClick={() => handleRangeSelection('inout')}
                >
                  In/Out points
                </button>
                <button
                  className={`flex-1 px-3 py-2 text-xs font-semibold rounded transition-colors ${
                    selectedRange === 'selected'
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-gray-50 text-gray-700 border border-gray-300 hover:bg-gray-100'
                  }`}
                  onClick={() => handleRangeSelection('selected')}
                >
                  Selected clips
                </button>
              </div>

              {/* Range status indicator */}
              {selectedRange === 'inout' && (
                <div className="p-2 bg-gray-50 border border-gray-200 rounded text-[10px] text-gray-600 mb-3">
                  {sequenceInfo?.hasWorkArea && sequenceInfo?.workAreaEnabled
                    ? '📊 Using Work Area range'
                    : sequenceInfo?.hasSequenceInOutPoints
                      ? '🎯 Using Sequence In/Out points'
                      : sequenceInfo?.hasInOutPoints
                        ? '⏺️ Using Legacy In/Out points'
                        : '⚠️ No In/Out points set - using entire timeline'}
                </div>
              )}

              {selectedRange === 'selected' && (
                <div className="p-2 bg-gray-50 border border-gray-200 rounded text-[10px] text-gray-600 mb-3">
                  {selectedClipsInfo?.hasSelectedClips
                    ? `✅ ${selectedClipsInfo.selectedClips?.length || 0} clips selected`
                    : '⚠️ No clips selected - select clips in timeline first'}
                </div>
              )}
            </div>

            {/* Timeline and Audio Tracks */}
            <div>
              {/* Timeline Display */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 bg-gray-300 rounded-sm flex items-center justify-center">
                    <div className="w-3 h-0.5 bg-gray-600"></div>
                  </div>
                  <div className="flex-1">
                    <div className="h-1 bg-gray-300 rounded-sm relative">
                      {/* Timeline bar with gradient to show active range */}
                      {(() => {
                        const rangeInfo = getRangeInfo()
                        const totalDuration = sequenceInfo?.durationSeconds || 1
                        const startPercent =
                          selectedRange === 'entire'
                            ? 0
                            : (rangeInfo.startTimeSeconds / totalDuration) * 100
                        const endPercent =
                          selectedRange === 'entire'
                            ? 100
                            : (rangeInfo.endTimeSeconds / totalDuration) * 100

                        return (
                          <div
                            className={`absolute top-0 bottom-0 rounded-sm transition-all duration-300 ${
                              selectedRange === 'entire'
                                ? 'bg-gradient-to-r from-blue-500 to-blue-400'
                                : selectedRange === 'inout'
                                  ? sequenceInfo?.hasWorkArea
                                    ? 'bg-gradient-to-r from-purple-500 to-purple-400'
                                    : 'bg-gradient-to-r from-orange-500 to-orange-400'
                                  : 'bg-gradient-to-r from-green-500 to-green-400'
                            }`}
                            style={{
                              left: `${Math.max(0, Math.min(startPercent, 100))}%`,
                              right: `${Math.max(0, 100 - Math.min(endPercent, 100))}%`
                            }}
                          ></div>
                        )
                      })()}
                    </div>
                  </div>
                </div>
                {/* Time indicators */}
                <div className="flex justify-between text-[10px] text-gray-500 ml-7">
                  <span>{getRangeInfo().startTime}</span>
                  <span className="text-[9px] text-gray-600">
                    Duration: {formatTime(getRangeInfo().duration)}
                  </span>
                  <span>{getRangeInfo().endTime}</span>
                </div>
              </div>

              {/* Audio Tracks List */}
              <div>
                <div className="text-xs font-semibold text-black mb-2">Audio Tracks</div>
                <div className="flex flex-col gap-1">
                  {Array.from({ length: sequenceInfo.audioTracks || 0 }, (_, i) => {
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
                        <div
                          className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center text-[10px] flex-shrink-0 ${
                            isSelected
                              ? 'bg-orange-500 border-orange-500 text-white'
                              : 'bg-transparent border-gray-300'
                          }`}
                        >
                          {isSelected && '✓'}
                        </div>
                        <span className="text-xs font-semibold text-black min-w-[20px]">
                          A{trackNumber}
                        </span>
                        {/* Static waveform graphic */}
                        <div className="flex-1 h-6 flex items-end gap-px px-2">
                          {/* Generate static waveform bars */}
                          {Array.from({ length: 40 }, (_, barIndex) => {
                            const heights = [
                              4, 8, 12, 16, 20, 14, 10, 6, 8, 18, 22, 16, 12, 8, 4, 6, 10, 14, 18,
                              12, 8, 6, 10, 16, 20, 14, 8, 4, 6, 12, 18, 16, 10, 8, 6, 4, 8, 12, 16,
                              10
                            ]
                            return (
                              <div
                                key={barIndex}
                                className={`w-0.5 rounded-sm transition-colors duration-300 ${
                                  isSelected ? 'bg-blue-500' : 'bg-gray-300'
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
              </div>
            </div>
          </div>
        )}

        {/* Silence Threshold Slider */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-black mb-2">
            Silence Threshold: {silenceThreshold} dB
          </label>
          <input
            type="range"
            min="-60"
            max="0"
            value={silenceThreshold}
            onChange={(e) => setSilenceThreshold(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between mt-1 text-xs text-gray-500">
            <span>-60 dB</span>
            <span>0 dB</span>
          </div>
        </div>

        {/* Minimum Silence Length Slider */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-black mb-2">
            Minimum Silence Length: {minSilenceLen} ms
          </label>
          <input
            type="range"
            min="100"
            max="5000"
            value={minSilenceLen}
            onChange={(e) => setMinSilenceLen(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between mt-1 text-xs text-gray-500">
            <span>100 ms</span>
            <span>5000 ms</span>
          </div>
        </div>

        {/* Silence Padding Slider */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-black mb-2">
            Silence Padding: {silencePadding} ms
          </label>
          <input
            type="range"
            min="0"
            max="1000"
            value={silencePadding}
            onChange={(e) => setSilencePadding(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between mt-1 text-xs text-gray-500">
            <span>0 ms</span>
            <span>1000 ms</span>
          </div>
        </div>

        {/* Process Button */}
        <div className="mb-5">
          <button
            className={`w-full px-6 py-3 text-base font-semibold rounded-lg transition-all duration-300 ${
              isProcessing || !premiereConnected
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-black text-white hover:bg-gray-800 shadow-md hover:shadow-lg'
            }`}
            onClick={handleProcessFromPremiere}
            disabled={isProcessing || !premiereConnected}
          >
            {isProcessing ? 'Processing...' : 'Process Audio'}
          </button>
        </div>

        {/* Status Display */}
        <div className="mb-0">
          <label className="block text-sm font-semibold text-black mb-2">Status</label>
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono min-h-[60px] leading-relaxed">
            {status}
            {results && results.length > 0 && (
              <div className="mt-2">
                <strong>Silence Ranges ({results.length} total):</strong>
                {results.length <= 10 ? (
                  // Show all ranges if 10 or fewer
                  results.map((range, index) => (
                    <div key={index} className="ml-2">
                      {index + 1}. {range[0].toFixed(2)}s - {range[1].toFixed(2)}s (
                      {(range[1] - range[0]).toFixed(2)}s)
                    </div>
                  ))
                ) : (
                  // Show first 5 and last 5 if more than 10
                  <>
                    {results.slice(0, 5).map((range, index) => (
                      <div key={index} className="ml-2">
                        {index + 1}. {range[0].toFixed(2)}s - {range[1].toFixed(2)}s (
                        {(range[1] - range[0]).toFixed(2)}s)
                      </div>
                    ))}
                    <div className="ml-2 italic text-gray-500">
                      ... {results.length - 10} more ranges ...
                    </div>
                    {results.slice(-5).map((range, index) => (
                      <div key={results.length - 5 + index} className="ml-2">
                        {results.length - 5 + index + 1}. {range[0].toFixed(2)}s -{' '}
                        {range[1].toFixed(2)}s ({(range[1] - range[0]).toFixed(2)}s)
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RemoveSilences
