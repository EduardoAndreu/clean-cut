import { useState, useEffect } from 'react'
import { ScrollArea } from './ui/scroll-area'
import { Button } from './ui/button'
import { Slider } from './ui/slider'
import { Checkbox } from './ui/checkbox'
import { ConnectionPrompt } from './ui/connection-prompt'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { Label } from './ui/label'
import ActiveSequence from './ActiveSequence'
import RemoveSilencesButton from './RemoveSilencesButton'
import AudioAnalysisButton from './AudioAnalysisButton'
import AudioAnalysisResultsDialog from './AudioAnalysisResultsDialog'
import InfoDialog from './ui/info-dialog'

interface RemoveSilencesProps {
  premiereConnected: boolean
}

function RemoveSilences({ premiereConnected }: RemoveSilencesProps): React.JSX.Element {
  const [silenceThreshold, setSilenceThreshold] = useState<number>(-30)
  const [minSilenceLen, setMinSilenceLen] = useState<number>(200)
  const [padding, setPadding] = useState<number>(150)
  const [silenceManagement, setSilenceManagement] = useState<'remove' | 'keep'>('remove')
  const [, setStatus] = useState<string>('Waiting for Premiere Pro connection...')
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
  const [analysisResult, setAnalysisResult] = useState<any>(null)

  // Handle analysis results and auto-apply VAD recommendation
  const handleAnalysisComplete = (result: any) => {
    setAnalysisResult(result)

    // Auto-apply VAD recommendation to slider if available
    if (result?.suggestions?.vad_recommended?.threshold) {
      setSilenceThreshold(result.suggestions.vad_recommended.threshold)
    }
  }

  // Effect hook for cleanup and side effects
  useEffect(() => {
    // Results are handled directly in Premiere Pro
  }, [silenceThreshold, minSilenceLen, padding])

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

    // Add IPC listeners
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.on('sequence-info-update', handleSequenceInfoUpdate)
    }

    return () => {
      // Cleanup listeners on unmount
      if (window.electron && window.electron.ipcRenderer) {
        window.electron.ipcRenderer.removeAllListeners('sequence-info-update')
      }
    }
  }, [])

  // Handle range selection changes and request fresh data
  const handleRangeSelection = async (range: 'entire' | 'inout' | 'selected') => {
    setSelectedRange(range)

    if (!premiereConnected) {
      return
    }

    try {
      // Refresh sequence info for all ranges (includes selected clips data)
      await window.cleanCutAPI.requestSequenceInfo()
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

  return (
    <div className="w-full bg-background">
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
            <label className="block text-sm font-semibold text-foreground mb-2">
              Define Sections
            </label>
            <div className="text-xs text-muted-foreground mb-3">
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
                <div className="p-2 bg-muted border border-border rounded text-[10px] text-muted-foreground mb-3">
                  ⚠️ No In/Out points set - using entire timeline
                </div>
              ) : selectedRange === 'selected' &&
                (!sequenceInfo?.selectedClips || sequenceInfo.selectedClips.length === 0) ? (
                <div className="p-2 bg-muted border border-border rounded text-[10px] text-muted-foreground mb-3">
                  ⚠️ No clips selected - select clips in timeline first
                </div>
              ) : null}

              {/* Start and End Points Display */}
              {premiereConnected && sequenceInfo?.success && (
                <div className="text-xs text-muted-foreground mb-3">
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
              <div className="block text-sm font-semibold text-foreground mb-2">Audio Tracks</div>
              <div className="text-xs text-muted-foreground mb-3">
                Select which audio tracks to process
              </div>
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
                        className="flex items-center gap-3 p-2 bg-muted border border-border rounded cursor-pointer hover:bg-accent transition-colors"
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
                        <span className="text-xs font-semibold text-foreground min-w-[20px]">
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
                                  isSelected ? 'bg-foreground' : 'bg-muted-foreground'
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
            <div className="block text-sm font-semibold text-foreground mb-4">Settings</div>

            {/* Silence Threshold Slider */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-foreground">
                  Silence Threshold: {silenceThreshold} dB
                </label>
                <div className="flex items-center gap-2">
                  <AudioAnalysisButton
                    selectedAudioTracks={selectedAudioTracks}
                    selectedRange={selectedRange}
                    premiereConnected={premiereConnected}
                    onAnalysisResult={handleAnalysisComplete}
                    onThresholdSuggestion={setSilenceThreshold}
                    onStatusUpdate={setStatus}
                    className="flex-shrink-0"
                  />
                  <AudioAnalysisResultsDialog
                    analysisResult={analysisResult}
                    onStatusUpdate={setStatus}
                  />
                </div>
              </div>
              <Slider
                value={[silenceThreshold]}
                onValueChange={(value) => setSilenceThreshold(value[0])}
                min={-60}
                max={0}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span>-60 dB</span>
                <span>0 dB</span>
              </div>
            </div>

            {/* Minimum Silence Length Slider */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-foreground">
                  Minimum Silence Length: {minSilenceLen} ms
                </label>
                <InfoDialog
                  title="Minimum Silence Length"
                  description={
                    <>
                      <p className="mb-3">
                        This is the shortest duration of audio that will be considered a 'silence'
                        and subsequently removed.
                      </p>
                      <ul className="list-disc list-inside space-y-2">
                        <li>
                          <strong>Higher values</strong> (e.g., 400ms) are safer and will only cut
                          long, obvious pauses.
                        </li>
                        <li>
                          <strong>Lower values</strong> (e.g., 100ms) are more aggressive and might
                          remove natural breaths or short hesitations between words.
                        </li>
                      </ul>
                    </>
                  }
                />
              </div>
              <Slider
                value={[minSilenceLen]}
                onValueChange={(value) => setMinSilenceLen(value[0])}
                min={50}
                max={500}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>Aggressive</span>
                <span>Conservative</span>
              </div>
              <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span>50 ms</span>
                <span>500 ms</span>
              </div>
            </div>

            {/* Padding Slider */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-foreground">
                  Padding: {padding} ms
                </label>
                <InfoDialog
                  title="Padding"
                  description={
                    <>
                      <p className="mb-3">
                        Padding adds a safety buffer around your speech to prevent words from being
                        cut off accidentally.
                      </p>
                      <p>
                        It works by leaving a small amount of the original silence at the beginning
                        and end of each cut, ensuring a smoother, more natural transition.
                      </p>
                    </>
                  }
                />
              </div>
              <Slider
                value={[padding]}
                onValueChange={(value) => setPadding(value[0])}
                min={50}
                max={500}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>Aggressive</span>
                <span>Conservative</span>
              </div>
              <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span>50 ms</span>
                <span>500 ms</span>
              </div>
            </div>
          </div>

          {/* Silence Management */}
          <div className="mb-8">
            <div className="block text-sm font-semibold text-foreground mb-4">
              Silence Management
            </div>
            <RadioGroup
              value={silenceManagement}
              onValueChange={(value) => setSilenceManagement(value as 'remove' | 'keep')}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="remove" id="remove" />
                <Label htmlFor="remove" className="text-xs text-foreground">
                  Remove silences
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="keep" id="keep" />
                <Label htmlFor="keep" className="text-xs text-foreground">
                  Keep silences
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Remove Silences Button */}
          <RemoveSilencesButton
            silenceThreshold={silenceThreshold}
            minSilenceLen={minSilenceLen}
            padding={padding}
            selectedAudioTracks={selectedAudioTracks}
            selectedRange={selectedRange}
            sequenceInfo={sequenceInfo}
            premiereConnected={premiereConnected}
            silenceManagement={silenceManagement}
            onStatusUpdate={setStatus}
          />
        </div>
      </ScrollArea>
    </div>
  )
}

export default RemoveSilences
