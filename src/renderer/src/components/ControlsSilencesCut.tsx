import { useState, useEffect } from 'react'

function Controls(): React.JSX.Element {
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

  const containerStyle: React.CSSProperties = {
    maxWidth: '500px',
    margin: '0 auto',
    padding: '20px',
    backgroundColor: 'var(--ev-c-black-soft)',
    borderRadius: '12px',
    backdropFilter: 'blur(24px)',
    border: '1px solid var(--ev-c-gray-3)'
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--ev-c-text-1)',
    textAlign: 'center',
    marginBottom: '24px'
  }

  const controlGroupStyle: React.CSSProperties = {
    marginBottom: '20px'
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--ev-c-text-1)',
    marginBottom: '8px'
  }

  const connectionStatusStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: premiereConnected ? '#4caf50' : '#f44336',
    marginBottom: '16px'
  }

  const statusIndicatorStyle: React.CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: premiereConnected ? '#4caf50' : '#f44336'
  }

  const sliderStyle: React.CSSProperties = {
    width: '100%',
    height: '6px',
    borderRadius: '3px',
    background: 'var(--ev-c-gray-3)',
    outline: 'none',
    WebkitAppearance: 'none',
    appearance: 'none'
  }

  const sliderRangeStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '4px',
    fontSize: '12px',
    color: 'var(--ev-c-text-2)'
  }

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--ev-button-alt-text)',
    backgroundColor:
      isProcessing || !premiereConnected ? 'var(--ev-c-gray-2)' : 'var(--ev-button-alt-bg)',
    border: '1px solid var(--ev-button-alt-border)',
    borderRadius: '8px',
    cursor: isProcessing || !premiereConnected ? 'not-allowed' : 'pointer',
    transition: 'all 0.3s ease',
    opacity: isProcessing || !premiereConnected ? 0.5 : 1
  }

  const statusStyle: React.CSSProperties = {
    padding: '12px',
    backgroundColor: 'var(--ev-c-black-mute)',
    border: '1px solid var(--ev-c-gray-3)',
    borderRadius: '6px',
    fontSize: '14px',
    color: 'var(--ev-c-text-2)',
    fontFamily:
      'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace',
    minHeight: '60px',
    lineHeight: 1.5
  }

  return (
    <div style={containerStyle}>
      <h2 style={titleStyle}>Clean-Cut for Premiere Pro</h2>

      {/* Connection Status */}
      <div style={connectionStatusStyle}>
        <div style={statusIndicatorStyle}></div>
        <span>Premiere Pro: {premiereConnected ? 'Connected' : 'Disconnected'}</span>
      </div>

      {/* Active Sequence Info - only show when connected */}
      {premiereConnected && (
        <div style={controlGroupStyle}>
          <label style={labelStyle}>Active Sequence</label>
          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--ev-c-black-mute)',
              border: '1px solid var(--ev-c-gray-3)',
              borderRadius: '8px',
              fontSize: '14px',
              color: 'var(--ev-c-text-2)'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--ev-c-text-1)' }}>
                {sequenceInfo?.success
                  ? sequenceInfo.sequenceName || 'Unknown Sequence'
                  : 'No Active Sequence'}
              </span>
              <button
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--ev-button-alt-text)',
                  backgroundColor: 'var(--ev-button-alt-bg)',
                  border: '1px solid var(--ev-button-alt-border)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onClick={handleRefreshSequenceInfo}
              >
                Refresh
              </button>
            </div>
            {sequenceInfo?.success ? (
              <div style={{ fontSize: '12px', color: 'var(--ev-c-text-3)' }}>
                Project: {sequenceInfo.projectName} | Tracks: {sequenceInfo.videoTracks}V/
                {sequenceInfo.audioTracks}A
                {sequenceInfo.frameRate && ` | ${sequenceInfo.frameRate} fps`}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--ev-c-text-3)' }}>
                {sequenceInfo?.error || 'Click refresh to get sequence information'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Define Sections */}
      {premiereConnected && sequenceInfo?.success && (
        <div style={controlGroupStyle}>
          <label style={labelStyle}>Define Sections</label>
          <div style={{ fontSize: '12px', color: 'var(--ev-c-text-3)', marginBottom: '12px' }}>
            Update the audio sections to be processed by Clean-Cut
          </div>

          {/* Range Selection */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color:
                    selectedRange === 'entire' ? 'var(--ev-button-alt-text)' : 'var(--ev-c-text-2)',
                  backgroundColor:
                    selectedRange === 'entire'
                      ? 'var(--ev-button-alt-bg)'
                      : 'var(--ev-c-black-mute)',
                  border: `1px solid ${selectedRange === 'entire' ? 'var(--ev-button-alt-border)' : 'var(--ev-c-gray-3)'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onClick={() => handleRangeSelection('entire')}
              >
                Entire timeline
              </button>
              <button
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color:
                    selectedRange === 'inout' ? 'var(--ev-button-alt-text)' : 'var(--ev-c-text-2)',
                  backgroundColor:
                    selectedRange === 'inout'
                      ? 'var(--ev-button-alt-bg)'
                      : 'var(--ev-c-black-mute)',
                  border: `1px solid ${selectedRange === 'inout' ? 'var(--ev-button-alt-border)' : 'var(--ev-c-gray-3)'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onClick={() => handleRangeSelection('inout')}
              >
                In/Out points
              </button>
              <button
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color:
                    selectedRange === 'selected'
                      ? 'var(--ev-button-alt-text)'
                      : 'var(--ev-c-text-2)',
                  backgroundColor:
                    selectedRange === 'selected'
                      ? 'var(--ev-button-alt-bg)'
                      : 'var(--ev-c-black-mute)',
                  border: `1px solid ${selectedRange === 'selected' ? 'var(--ev-button-alt-border)' : 'var(--ev-c-gray-3)'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onClick={() => handleRangeSelection('selected')}
              >
                Selected clips
              </button>
            </div>

            {/* Range status indicator */}
            {selectedRange === 'inout' && (
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--ev-c-black-mute)',
                  border: '1px solid var(--ev-c-gray-3)',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: 'var(--ev-c-text-3)',
                  marginBottom: '12px'
                }}
              >
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
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--ev-c-black-mute)',
                  border: '1px solid var(--ev-c-gray-3)',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: 'var(--ev-c-text-3)',
                  marginBottom: '12px'
                }}
              >
                {selectedClipsInfo?.hasSelectedClips
                  ? `✅ ${selectedClipsInfo.selectedClips?.length || 0} clips selected`
                  : '⚠️ No clips selected - select clips in timeline first'}
              </div>
            )}
          </div>

          {/* Timeline and Audio Tracks */}
          <div>
            {/* Timeline Display */}
            <div style={{ marginBottom: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px'
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: 'var(--ev-c-gray-3)',
                    borderRadius: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <div
                    style={{
                      width: '12px',
                      height: '2px',
                      backgroundColor: 'var(--ev-c-text-2)'
                    }}
                  ></div>
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      height: '4px',
                      backgroundColor: 'var(--ev-c-gray-3)',
                      borderRadius: '2px',
                      position: 'relative'
                    }}
                  >
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
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: `${Math.max(0, Math.min(startPercent, 100))}%`,
                            right: `${Math.max(0, 100 - Math.min(endPercent, 100))}%`,
                            bottom: 0,
                            background:
                              selectedRange === 'entire'
                                ? 'linear-gradient(90deg, #4a90e2 0%, #7bb3f0 100%)'
                                : selectedRange === 'inout'
                                  ? sequenceInfo?.hasWorkArea
                                    ? 'linear-gradient(90deg, #9c27b0 0%, #e1bee7 100%)' // Purple for work area
                                    : 'linear-gradient(90deg, #ff9800 0%, #ffcc80 100%)' // Orange for in/out
                                  : 'linear-gradient(90deg, #4caf50 0%, #a5d6a7 100%)', // Green for selected
                            borderRadius: '2px',
                            transition: 'all 0.3s ease'
                          }}
                        ></div>
                      )
                    })()}
                  </div>
                </div>
              </div>
              {/* Time indicators */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '10px',
                  color: 'var(--ev-c-text-3)',
                  marginLeft: '28px'
                }}
              >
                <span>{getRangeInfo().startTime}</span>
                <span style={{ fontSize: '9px', color: 'var(--ev-c-text-2)' }}>
                  Duration: {formatTime(getRangeInfo().duration)}
                </span>
                <span>{getRangeInfo().endTime}</span>
              </div>
            </div>

            {/* Audio Tracks List */}
            <div>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--ev-c-text-1)',
                  marginBottom: '8px'
                }}
              >
                Audio Tracks
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {Array.from({ length: sequenceInfo.audioTracks || 0 }, (_, i) => {
                  const trackNumber = i + 1
                  const isSelected = selectedAudioTracks.includes(trackNumber)

                  return (
                    <div
                      key={trackNumber}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px 12px',
                        backgroundColor: 'var(--ev-c-black-mute)',
                        border: '1px solid var(--ev-c-gray-3)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                      }}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedAudioTracks((prev) => prev.filter((t) => t !== trackNumber))
                        } else {
                          setSelectedAudioTracks((prev) => [...prev, trackNumber])
                        }
                      }}
                    >
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          backgroundColor: isSelected ? '#ff6b35' : 'transparent',
                          border: '2px solid var(--ev-c-gray-3)',
                          borderRadius: '3px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          color: 'white',
                          flexShrink: 0
                        }}
                      >
                        {isSelected && '✓'}
                      </div>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--ev-c-text-1)',
                          minWidth: '20px'
                        }}
                      >
                        A{trackNumber}
                      </span>
                      {/* Static waveform graphic */}
                      <div
                        style={{
                          flex: 1,
                          height: '24px',
                          display: 'flex',
                          alignItems: 'end',
                          gap: '1px',
                          padding: '0 8px'
                        }}
                      >
                        {/* Generate static waveform bars */}
                        {Array.from({ length: 40 }, (_, barIndex) => {
                          const heights = [
                            4, 8, 12, 16, 20, 14, 10, 6, 8, 18, 22, 16, 12, 8, 4, 6, 10, 14, 18, 12,
                            8, 6, 10, 16, 20, 14, 8, 4, 6, 12, 18, 16, 10, 8, 6, 4, 8, 12, 16, 10
                          ]
                          return (
                            <div
                              key={barIndex}
                              style={{
                                width: '2px',
                                height: `${heights[barIndex]}px`,
                                backgroundColor: isSelected ? '#4a90e2' : 'var(--ev-c-gray-3)',
                                borderRadius: '1px',
                                opacity: isSelected ? 1 : 0.6,
                                transition: 'all 0.3s ease'
                              }}
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
      <div style={controlGroupStyle}>
        <label style={labelStyle}>Silence Threshold: {silenceThreshold} dB</label>
        <input
          type="range"
          min="-60"
          max="0"
          value={silenceThreshold}
          onChange={(e) => setSilenceThreshold(Number(e.target.value))}
          style={sliderStyle}
        />
        <div style={sliderRangeStyle}>
          <span>-60 dB</span>
          <span>0 dB</span>
        </div>
      </div>

      {/* Minimum Silence Length Slider */}
      <div style={controlGroupStyle}>
        <label style={labelStyle}>Minimum Silence Length: {minSilenceLen} ms</label>
        <input
          type="range"
          min="100"
          max="5000"
          value={minSilenceLen}
          onChange={(e) => setMinSilenceLen(Number(e.target.value))}
          style={sliderStyle}
        />
        <div style={sliderRangeStyle}>
          <span>100 ms</span>
          <span>5000 ms</span>
        </div>
      </div>

      {/* Silence Padding Slider */}
      <div style={controlGroupStyle}>
        <label style={labelStyle}>Silence Padding: {silencePadding} ms</label>
        <input
          type="range"
          min="0"
          max="1000"
          value={silencePadding}
          onChange={(e) => setSilencePadding(Number(e.target.value))}
          style={sliderStyle}
        />
        <div style={sliderRangeStyle}>
          <span>0 ms</span>
          <span>1000 ms</span>
        </div>
      </div>

      {/* Process Button */}
      <div style={controlGroupStyle}>
        <button
          style={buttonStyle}
          onClick={handleProcessFromPremiere}
          disabled={isProcessing || !premiereConnected}
        >
          {isProcessing ? 'Processing...' : 'Process Audio'}
        </button>
      </div>

      {/* Status Display */}
      <div style={controlGroupStyle}>
        <label style={labelStyle}>Status</label>
        <div style={statusStyle}>
          {status}
          {results && results.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <strong>Silence Ranges ({results.length} total):</strong>
              {results.length <= 10 ? (
                // Show all ranges if 10 or fewer
                results.map((range, index) => (
                  <div key={index} style={{ marginLeft: '8px' }}>
                    {index + 1}. {range[0].toFixed(2)}s - {range[1].toFixed(2)}s (
                    {(range[1] - range[0]).toFixed(2)}s)
                  </div>
                ))
              ) : (
                // Show first 5 and last 5 if more than 10
                <>
                  {results.slice(0, 5).map((range, index) => (
                    <div key={index} style={{ marginLeft: '8px' }}>
                      {index + 1}. {range[0].toFixed(2)}s - {range[1].toFixed(2)}s (
                      {(range[1] - range[0]).toFixed(2)}s)
                    </div>
                  ))}
                  <div
                    style={{ marginLeft: '8px', fontStyle: 'italic', color: 'var(--ev-c-text-3)' }}
                  >
                    ... {results.length - 10} more ranges ...
                  </div>
                  {results.slice(-5).map((range, index) => (
                    <div key={results.length - 5 + index} style={{ marginLeft: '8px' }}>
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
  )
}

export default Controls
