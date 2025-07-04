import { useState, useEffect } from 'react'

function Controls(): React.JSX.Element {
  const [selectedFile, setSelectedFile] = useState<{ filePath: string; fileName: string } | null>(
    null
  )
  const [silenceThreshold, setSilenceThreshold] = useState<number>(-30)
  const [minSilenceLen, setMinSilenceLen] = useState<number>(1000)
  const [silencePadding, setSilencePadding] = useState<number>(100)
  const [status, setStatus] = useState<string>('No file selected')
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [results, setResults] = useState<number[][] | null>(null)

  // Effect hook for cleanup and side effects
  useEffect(() => {
    // Reset results when file changes
    if (selectedFile) {
      setResults(null)
      setStatus(`Selected: ${selectedFile.fileName}`)
    }
  }, [selectedFile])

  const handleFileSelect = async () => {
    try {
      const result = await window.cleanCutAPI.showOpenDialog()
      if (result) {
        setSelectedFile(result)
      }
    } catch (error) {
      setStatus(`Error selecting file: ${error}`)
    }
  }

  const handleProcess = async () => {
    if (!selectedFile) {
      setStatus('Please select a file first')
      return
    }

    setIsProcessing(true)
    setStatus('Processing audio file...')
    setResults(null)

    try {
      // Now we have the actual file path from the dialog
      const result = await window.cleanCutAPI.invokeCleanCut(
        selectedFile.filePath,
        silenceThreshold,
        minSilenceLen,
        silencePadding
      )

      // Enhanced logging for debugging
      console.log('Python script result:', result)
      console.log('Result type:', typeof result)
      console.log('Result length:', result.length)
      console.log('First few ranges:', result.slice(0, 5))

      setResults(result)
      setStatus(`Processing complete! Found ${result.length} silence ranges.
Parameters used:
- File: ${selectedFile.fileName}
- Threshold: ${silenceThreshold}dB
- Min silence: ${minSilenceLen}ms  
- Padding: ${silencePadding}ms

Raw result length: ${result.length}
Total silence duration: ${result.reduce((sum, range) => sum + (range[1] - range[0]), 0).toFixed(2)}s`)
    } catch (error) {
      console.error('Clean cut error:', error)
      setStatus(`Error processing file: ${error}

Debug info:
- File: ${selectedFile.fileName}
- Parameters: threshold=${silenceThreshold}dB, minLen=${minSilenceLen}ms, padding=${silencePadding}ms`)
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

  const dropzoneStyle: React.CSSProperties = {
    border: '2px dashed var(--ev-c-gray-2)',
    borderRadius: '8px',
    padding: '20px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    backgroundColor: 'var(--ev-c-black-mute)'
  }

  const dropzoneContentStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px'
  }

  const fileInfoStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px'
  }

  const fileNameStyle: React.CSSProperties = {
    fontWeight: 600,
    color: 'var(--ev-c-text-1)'
  }

  const fileSizeStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--ev-c-text-2)'
  }

  const placeholderStyle: React.CSSProperties = {
    color: 'var(--ev-c-text-2)',
    fontSize: '14px'
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
    backgroundColor: isProcessing ? 'var(--ev-c-gray-2)' : 'var(--ev-button-alt-bg)',
    border: '1px solid var(--ev-button-alt-border)',
    borderRadius: '8px',
    cursor: !selectedFile || isProcessing ? 'not-allowed' : 'pointer',
    transition: 'all 0.3s ease',
    opacity: !selectedFile || isProcessing ? 0.5 : 1
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
      <h2 style={titleStyle}>Audio Processing Controls</h2>

      {/* File Selection */}
      <div style={controlGroupStyle}>
        <label style={labelStyle}>Select Audio File</label>
        <div style={dropzoneStyle} onClick={handleFileSelect}>
          <div style={dropzoneContentStyle}>
            {selectedFile ? (
              <div style={fileInfoStyle}>
                <span style={fileNameStyle}>{selectedFile.fileName}</span>
                <span style={fileSizeStyle}>Path: {selectedFile.filePath}</span>
              </div>
            ) : (
              <div style={placeholderStyle}>
                <span>Click to select an audio file</span>
              </div>
            )}
          </div>
        </div>
      </div>

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
          onClick={handleProcess}
          disabled={!selectedFile || isProcessing}
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
