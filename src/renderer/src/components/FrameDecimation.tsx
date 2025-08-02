import React, { useState, useCallback, useEffect } from 'react'
import { ArrowLeft, Upload, FolderOpen, Film } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Alert, AlertDescription } from './ui/alert'
import { Progress } from './ui/progress'
import FrameDecimationButton from './FrameDecimationButton'

interface VideoStats {
  originalFrames: number
  outputFrames: number
  reductionPercentage: number
}

const FrameDecimation: React.FC = () => {
  const navigate = useNavigate()
  const [inputPath, setInputPath] = useState<string>('')
  const [outputPath, setOutputPath] = useState<string>('')
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<VideoStats | null>(null)
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    
    const videoFile = files.find((file) => {
      const ext = file.name.toLowerCase().split('.').pop()
      return ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'].includes(ext || '')
    })

    if (videoFile) {
      // In Electron, we can get the path from the File object's path property
      const filePath = (videoFile as any).path
      if (filePath) {
        handleFileSelect(filePath)
      } else {
        setError('Unable to get file path. Please use the browse button instead.')
      }
    } else {
      setError('Please drop a valid video file')
    }
  }, [])

  const handleFileSelect = (filePath: string) => {
    setInputPath(filePath)
    setError('')

    // Auto-generate output path
    const dir = filePath.substring(0, filePath.lastIndexOf('/'))
    const filename = filePath.substring(filePath.lastIndexOf('/') + 1)
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'))
    const ext = filename.substring(filename.lastIndexOf('.'))
    setOutputPath(`${dir}/${nameWithoutExt}_decimated${ext}`)
  }

  const handleFileInput = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('dialog:showOpenDialog', {
        properties: ['openFile'],
        filters: [
          {
            name: 'Video Files',
            extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v']
          },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (!result.canceled && result.filePaths.length > 0) {
        handleFileSelect(result.filePaths[0])
      }
    } catch (err) {
      console.error('Error selecting file:', err)
      setError('Failed to open file dialog')
    }
  }

  const handleOutputPathSelect = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('dialog:showSaveDialog', {
        defaultPath: outputPath,
        filters: [{ name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }]
      })

      if (!result.canceled && result.filePath) {
        setOutputPath(result.filePath)
      }
    } catch (err) {
      console.error('Error selecting output path:', err)
    }
  }

  // Handle progress updates from IPC
  useEffect(() => {
    const handleProgress = (
      _event: any,
      data: {
        current: number
        total: number
        percentage?: number
        timeElapsed?: number
        duration?: number
      }
    ) => {
      setProgress(data.percentage ?? (data.current / data.total) * 100)
      if (data.timeElapsed !== undefined) setTimeElapsed(data.timeElapsed)
      if (data.duration !== undefined) setTotalDuration(data.duration)
    }

    window.electron.ipcRenderer.on('frame-decimation-progress', handleProgress)

    return () => {
      window.electron.ipcRenderer.removeAllListeners('frame-decimation-progress')
    }
  }, [])

  const handleProcessVideo = async () => {
    if (isProcessing) return

    setIsProcessing(true)
    setError('') // Clear any previous errors

    try {
      const result = await window.cleanCutAPI.processFrameDecimation(inputPath, outputPath)

      if (result.success && result.stats) {
        setResults(result.stats)
        setIsProcessing(false)
        setProgress(0)
        setTimeElapsed(0)
        setTotalDuration(0)
      } else {
        setError(result.error || 'Failed to process video')
        setIsProcessing(false)
        setProgress(0)
        setTimeElapsed(0)
        setTotalDuration(0)
      }
    } catch (error) {
      console.error('Frame decimation error:', error)
      setError(error instanceof Error ? error.message : 'An unexpected error occurred')
      setIsProcessing(false)
      setProgress(0)
      setTimeElapsed(0)
      setTotalDuration(0)
    }
  }

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const estimateTimeRemaining = () => {
    if (progress > 0 && timeElapsed > 0) {
      const totalTime = (timeElapsed / progress) * 100
      const remaining = totalTime - timeElapsed
      return formatTime(remaining)
    }
    return 'Calculating...'
  }

  return (
    <div className="h-full overflow-auto">
      <div className="container mx-auto p-4 max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Film className="h-5 w-5" />
              Frame Decimation
            </CardTitle>
            <CardDescription>
              Reduce frame rate by dropping similar consecutive frames using FFmpeg's mpdecimate
              filter
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Drop Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? 'border-primary bg-primary/10' : 'border-gray-300 dark:border-gray-700'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleFileInput}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Drag and drop your video file here
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">or click to browse</p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">
                Supported: MP4, MOV, AVI, MKV, WebM, FLV, WMV, M4V
              </p>
            </div>

            {/* Input Path Display */}
            {inputPath && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Input Video</label>
                <Input value={inputPath} readOnly className="font-mono text-xs" />
              </div>
            )}

            {/* Output Path */}
            {inputPath && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Output Path</label>
                <div className="flex gap-2">
                  <Input
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <Button variant="outline" size="icon" onClick={handleOutputPathSelect}>
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Process Button */}
            {inputPath && outputPath && (
              <div className="space-y-4">
                <FrameDecimationButton
                  isProcessing={isProcessing}
                  onClick={handleProcessVideo}
                />

                {/* Progress Bar - Show below button when processing */}
                {isProcessing && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>Processing video...</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="mb-2" />
                    <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 dark:text-gray-500">
                      <div>
                        <span className="font-medium">Time elapsed:</span> {formatTime(timeElapsed)}
                      </div>
                      <div className="text-right">
                        <span className="font-medium">Time remaining:</span> {estimateTimeRemaining()}
                      </div>
                      {totalDuration > 0 && (
                        <>
                          <div>
                            <span className="font-medium">Video duration:</span>{' '}
                            {formatTime(totalDuration)}
                          </div>
                          <div className="text-right">
                            <span className="font-medium">Processing speed:</span>{' '}
                            {timeElapsed > 0 ? `${(timeElapsed / totalDuration).toFixed(2)}x` : '...'}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Results */}
            {results && !isProcessing && (
              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-green-800 dark:text-green-200 mb-3">
                    Processing Complete!
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Original frames:</span>
                      <span className="font-mono">{results.originalFrames.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Output frames:</span>
                      <span className="font-mono">{results.outputFrames.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Reduction:</span>
                      <span className="font-mono text-green-600 dark:text-green-400">
                        {results.reductionPercentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default FrameDecimation
