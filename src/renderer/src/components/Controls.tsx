import { useState, useRef } from 'react'

function Controls(): React.JSX.Element {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [silenceThreshold, setSilenceThreshold] = useState<number>(-30)
  const [silencePadding, setSilencePadding] = useState<number>(100)
  const [status, setStatus] = useState<string>('No file selected')
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setStatus(`Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`)
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file && file.type.startsWith('audio/')) {
      setSelectedFile(file)
      setStatus(`Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`)
    } else {
      setStatus('Please select a valid audio file')
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  const handleProcess = async () => {
    if (!selectedFile) {
      setStatus('Please select a file first')
      return
    }

    setIsProcessing(true)
    setStatus('Processing audio file...')

    try {
      // Here you would implement the actual processing logic
      // For now, we'll simulate processing
      await new Promise((resolve) => setTimeout(resolve, 2000))
      setStatus(
        `Processing complete! Silence threshold: ${silenceThreshold}dB, Padding: ${silencePadding}ms`
      )
    } catch (error) {
      setStatus(`Error processing file: ${error}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const openFileDialog = () => {
    fileInputRef.current?.click()
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
        <div
          style={dropzoneStyle}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={openFileDialog}
        >
          <div style={dropzoneContentStyle}>
            {selectedFile ? (
              <div style={fileInfoStyle}>
                <span style={fileNameStyle}>{selectedFile.name}</span>
                <span style={fileSizeStyle}>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            ) : (
              <div style={placeholderStyle}>
                <span>Click to select or drag and drop an audio file</span>
              </div>
            )}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
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
        <div style={statusStyle}>{status}</div>
      </div>
    </div>
  )
}

export default Controls
