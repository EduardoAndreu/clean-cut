import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Upload, FolderOpen } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Alert, AlertDescription } from './ui/alert'
import { Progress } from './ui/progress'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion'
import { ScrollArea } from './ui/scroll-area'
import FrameDecimationButton from './FrameDecimationButton'

interface VideoStats {
  originalFrames: number
  outputFrames: number
  reductionPercentage: number
}

interface QueueItem {
  id: string
  inputPath: string
  outputPath: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress?: number
  stats?: VideoStats
  error?: string
}

const FrameDecimation: React.FC = () => {
  const [inputPath, setInputPath] = useState<string>('')
  const [outputPath, setOutputPath] = useState<string>('')
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isEncoding, setIsEncoding] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<VideoStats | null>(null)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  
  // Queue state
  const [queue, setQueue] = useState<QueueItem[]>([])
  const queueRef = useRef<QueueItem[]>([])
  const [outputFolder, setOutputFolder] = useState<string>('')
  const [currentProcessingId, setCurrentProcessingId] = useState<string | null>(null)
  
  // Keep ref in sync with state
  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  // Check for ongoing processing on mount
  useEffect(() => {
    const checkOngoingProcessing = async () => {
      try {
        const status = await window.cleanCutAPI.getFrameDecimationStatus()
        if (status.isProcessing && status.inputPath && status.outputPath) {
          // Restore state from ongoing process
          setInputPath(status.inputPath)
          setOutputPath(status.outputPath)
          setIsProcessing(true)
          setIsEncoding(false) // If we're getting progress, we're past encoding
          setProgress(status.progress || 0)
          setElapsedTime(status.elapsedTime || 0)
          setStartTime(Date.now() - (status.elapsedTime || 0) * 1000)
          
          console.log('Restored ongoing frame decimation process:', status)
        }
      } catch (error) {
        console.error('Error checking frame decimation status:', error)
      }
    }
    
    checkOngoingProcessing()
  }, [])

  // Timer for elapsed time
  useEffect(() => {
    if (startTime && isProcessing) {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
      }, 100) // Update every 100ms for smooth counter

      return () => clearInterval(interval)
    }
    return undefined
  }, [startTime, isProcessing])

  // Get filename from path and truncate if needed
  const getDisplayFilename = (path: string) => {
    const filename = path.split('/').pop() || path
    if (filename.length > 25) {
      return filename.substring(0, 25) + '...'
    }
    return filename
  }

  // Generate output path for a video in the selected folder
  const generateOutputPath = (inputPath: string, folder: string): string => {
    const filename = inputPath.split('/').pop() || ''
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'))
    const ext = filename.substring(filename.lastIndexOf('.'))
    return `${folder}/${nameWithoutExt}_decimated${ext}`
  }

  // Handle multiple file selection
  const handleFilesSelect = (filePaths: string[]) => {
    const folder = outputFolder || filePaths[0].substring(0, filePaths[0].lastIndexOf('/'))
    
    if (!outputFolder) {
      setOutputFolder(folder)
    }
    
    // Create queue items
    const queueItems: QueueItem[] = filePaths.map((path, index) => ({
      id: `${Date.now()}-${index}-${Math.random()}`,
      inputPath: path,
      outputPath: generateOutputPath(path, folder),
      status: 'pending' as const
    }))
    
    setQueue(queueItems)
    setError('')
    
    // Set first item as current
    if (queueItems.length > 0) {
      setInputPath(queueItems[0].inputPath)
      setOutputPath(queueItems[0].outputPath)
    }
  }

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
    const validExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v']

    const videoFiles = files.filter((file) => {
      const ext = file.name.toLowerCase().split('.').pop()
      return validExtensions.includes(ext || '')
    })

    if (videoFiles.length === 0) {
      setError('Please drop valid video files')
      return
    }

    // Get file paths
    const filePaths = videoFiles.map(file => (file as any).path).filter(Boolean)
    
    if (filePaths.length === 0) {
      setError('Unable to get file paths. Please use the browse button instead.')
      return
    }

    if (filePaths.length === 1) {
      handleFileSelect(filePaths[0])
    } else {
      handleFilesSelect(filePaths)
    }
  }, [handleFilesSelect])

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
        properties: ['openFile', 'multiSelections'],
        filters: [
          {
            name: 'Video Files',
            extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v']
          },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (!result.canceled && result.filePaths.length > 0) {
        if (result.filePaths.length === 1) {
          handleFileSelect(result.filePaths[0])
        } else {
          handleFilesSelect(result.filePaths)
        }
      }
    } catch (err) {
      console.error('Error selecting file:', err)
      setError('Failed to open file dialog')
    }
  }

  const handleOutputPathSelect = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('dialog:showOpenDialog', {
        properties: ['openDirectory'],
        buttonLabel: 'Select Output Folder'
      })

      if (!result.canceled && result.filePaths.length > 0) {
        const folder = result.filePaths[0]
        setOutputFolder(folder)
        
        // Update output path for current file
        if (inputPath) {
          setOutputPath(generateOutputPath(inputPath, folder))
        }
        
        // Update all queue items with new folder
        setQueue(prevQueue => 
          prevQueue.map(item => ({
            ...item,
            outputPath: generateOutputPath(item.inputPath, folder)
          }))
        )
      }
    } catch (err) {
      console.error('Error selecting output folder:', err)
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
      // Once we receive progress, we're no longer encoding
      setIsEncoding(false)
      const progressValue = data.percentage ?? (data.current / data.total) * 100
      setProgress(progressValue)
      
      // Update queue item progress if processing from queue
      if (currentProcessingId) {
        setQueue(prev => prev.map(item => 
          item.id === currentProcessingId 
            ? { ...item, progress: progressValue }
            : item
        ))
      }
    }

    window.electron.ipcRenderer.on('frame-decimation-progress', handleProgress)

    return () => {
      window.electron.ipcRenderer.removeAllListeners('frame-decimation-progress')
    }
  }, [currentProcessingId])

  const processNextInQueue = async () => {
    // Find next pending item using ref to get latest queue state
    const nextItem = queueRef.current.find(item => item.status === 'pending')
    if (!nextItem) {
      // Queue complete
      setIsProcessing(false)
      setCurrentProcessingId(null)
      return
    }

    // Update queue to mark item as processing
    setQueue(prev => prev.map(item => 
      item.id === nextItem.id 
        ? { ...item, status: 'processing' as const }
        : item
    ))
    
    // Set current item for display
    setInputPath(nextItem.inputPath)
    setOutputPath(nextItem.outputPath)
    setCurrentProcessingId(nextItem.id)
    setIsProcessing(true)
    setIsEncoding(true)
    setError('')
    setStartTime(Date.now())
    setProgress(0)

    try {
      const result = await window.cleanCutAPI.processFrameDecimation(nextItem.inputPath, nextItem.outputPath)

      if (result.success && result.stats) {
        // Update queue with success
        setQueue(prev => prev.map(item => 
          item.id === nextItem.id 
            ? { ...item, status: 'completed' as const, stats: result.stats }
            : item
        ))
        setResults(result.stats)
        
        // Process next item after a short delay
        setTimeout(() => {
          processNextInQueue()
        }, 500)
      } else {
        // Update queue with error
        setQueue(prev => prev.map(item => 
          item.id === nextItem.id 
            ? { ...item, status: 'error' as const, error: result.error }
            : item
        ))
        setError(result.error || 'Failed to process video')
        
        // Continue with next item despite error
        setTimeout(() => {
          processNextInQueue()
        }, 500)
      }
    } catch (error) {
      console.error('Frame decimation error:', error)
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      
      // Update queue with error
      setQueue(prev => prev.map(item => 
        item.id === nextItem.id 
          ? { ...item, status: 'error' as const, error: errorMessage }
          : item
      ))
      setError(errorMessage)
      
      // Continue with next item despite error
      setTimeout(() => {
        processNextInQueue()
      }, 500)
    }
  }

  const handleProcessVideo = async () => {
    if (isProcessing) return

    if (queue.length > 0) {
      // Process queue
      processNextInQueue()
    } else {
      // Single file mode (backward compatibility)
      setIsProcessing(true)
      setIsEncoding(true)
      setError('')
      setStartTime(Date.now())

      try {
        const result = await window.cleanCutAPI.processFrameDecimation(inputPath, outputPath)

        if (result.success && result.stats) {
          setResults(result.stats)
          setIsProcessing(false)
          setIsEncoding(false)
          setProgress(0)
          setStartTime(null)
          setElapsedTime(0)
        } else {
          setError(result.error || 'Failed to process video')
          setIsProcessing(false)
          setIsEncoding(false)
          setProgress(0)
          setStartTime(null)
          setElapsedTime(0)
        }
      } catch (error) {
        console.error('Frame decimation error:', error)
        setError(error instanceof Error ? error.message : 'An unexpected error occurred')
        setIsProcessing(false)
        setIsEncoding(false)
        setProgress(0)
        setStartTime(null)
        setElapsedTime(0)
      }
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
    if (progress > 0 && elapsedTime > 0) {
      const totalTime = (elapsedTime / progress) * 100
      const remaining = totalTime - elapsedTime
      return formatTime(remaining)
    }
    return 'Calculating...'
  }

  return (
    <div className="w-full bg-background">
      <ScrollArea className="h-[calc(100vh-12rem)] w-full">
        <div className="p-6">
          {/* Description Section */}
          <div className="mb-6">
            <div className="text-xs text-muted-foreground mb-3">
              Reduce frame rate by dropping similar consecutive frames using FFmpeg's mpdecimate filter
            </div>
            
            {/* Important Notes Accordion */}
            <Accordion type="single" collapsible className="w-full mb-6">
              <AccordionItem value="important-notes">
                <AccordionTrigger className="text-sm">Important Notes</AccordionTrigger>
                <AccordionContent>
                  <ul className="list-disc list-inside space-y-2 text-xs text-gray-500 dark:text-gray-300">
                    <li>
                      This will take a while to process, depending on your computer specs and the
                      length of your video.
                    </li>
                    <li>
                      The percentage of completion is an estimate based on the number of frames of
                      the original video
                    </li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
          {/* File Drop Area */}
          <div className="mb-6">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? 'border-primary bg-primary/10' : 'border-gray-300 dark:border-gray-500'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleFileInput}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                Drag and drop your video files here
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-300">or click to browse</p>
              <p className="text-xs text-gray-400 dark:text-gray-400 mt-2">
                Supported: MP4, MOV, AVI, MKV, WebM, FLV, WMV, M4V
              </p>
            </div>
          </div>

          {/* Input Path Display */}
          {inputPath && (
            <div className="mb-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Input Video</label>
                <Input value={inputPath} readOnly className="font-mono text-xs" />
              </div>
            </div>
          )}

          {/* Output Path */}
          {inputPath && (
            <div className="mb-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Output Folder</label>
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
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="mb-6">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

          {/* Process Button */}
          {inputPath && outputPath && (
            <div className="mb-8">
              <div className="space-y-4">
                <FrameDecimationButton
                  isProcessing={isProcessing}
                  isEncoding={isEncoding}
                  onClick={handleProcessVideo}
                  queueLength={queue.length || undefined}
                />

                {/* Progress Bar - Show below button when processing */}
                {isProcessing && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>
                        {isEncoding
                          ? `Encoding ${getDisplayFilename(inputPath)}`
                          : `Processing ${getDisplayFilename(inputPath)}`}
                      </span>
                      <span>{isEncoding ? '' : `${Math.round(progress)}%`}</span>
                    </div>
                    <Progress value={isEncoding ? 0 : progress} className="mb-2" />
                    <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 dark:text-gray-500">
                      <div>
                        <span className="font-medium">Time elapsed:</span> {formatTime(elapsedTime)}
                      </div>
                      {!isEncoding && (
                        <div className="text-right">
                          <span className="font-medium">Time remaining:</span>{' '}
                          {estimateTimeRemaining()}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Results */}
          {results && !isProcessing && (
            <div className="mb-8">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
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
              </div>
            </div>
          )}

          {/* Queue Display */}
          {queue.length > 0 && (
            <div className="mb-8">
              <div className="block text-sm font-semibold text-foreground mb-4">
                Queue ({queue.filter(q => q.status === 'completed').length} of {queue.length} completed)
              </div>
              <div className="bg-muted border border-border rounded-lg p-4">
                <div className="space-y-2">
                  {queue.map(item => (
                    <div key={item.id} className="flex items-center gap-2 text-sm">
                      <span className="flex-shrink-0">
                        {item.status === 'completed' && <span className="text-green-600">✓</span>}
                        {item.status === 'processing' && <span className="text-blue-600">⏳</span>}
                        {item.status === 'pending' && <span className="text-gray-400">○</span>}
                        {item.status === 'error' && <span className="text-red-600">✗</span>}
                      </span>
                      
                      <span className="flex-1 truncate text-xs font-mono">
                        {getDisplayFilename(item.inputPath)} → {getDisplayFilename(item.outputPath)}
                      </span>
                      
                      {item.status === 'processing' && item.progress !== undefined && (
                        <span className="text-xs text-gray-500">({Math.round(item.progress)}%)</span>
                      )}
                      
                      {item.status === 'error' && item.error && (
                        <span className="text-xs text-red-500" title={item.error}>Failed</span>
                      )}
                      
                      {item.status === 'completed' && item.stats && (
                        <span className="text-xs text-green-600">
                          -{item.stats.reductionPercentage.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export default FrameDecimation
