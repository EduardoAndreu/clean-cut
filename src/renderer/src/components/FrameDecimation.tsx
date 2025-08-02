import React, { useState, useEffect, useRef } from 'react'
import { FolderOpen } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Alert, AlertDescription } from './ui/alert'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion'
import { ScrollArea } from './ui/scroll-area'
import FrameDecimationButton from './FrameDecimationButton'
import FileDropZone from './FileDropZone'
import ProgressDisplay from './ProgressDisplay'
import QueueDisplay from './QueueDisplay'
import { useFrameDecimationQueue } from '../hooks/useFrameDecimationQueue'

interface VideoStats {
  originalFrames: number
  outputFrames: number
  reductionPercentage: number
}

const FrameDecimation: React.FC = () => {
  const [inputPath, setInputPath] = useState<string>('')
  const [outputPath, setOutputPath] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isEncoding, setIsEncoding] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<VideoStats | null>(null)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  // Use the queue hook
  const {
    queue,
    currentProcessingId,
    outputFolder,
    setOutputFolder,
    addToQueue,
    processNextInQueue,
    updateQueueItemProgress,
    updateQueueItemStatus
  } = useFrameDecimationQueue()

  const processingCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Check for ongoing processing on mount
  useEffect(() => {
    const checkOngoingProcessing = async (): Promise<void> => {
      try {
        const status = await window.cleanCutAPI.getFrameDecimationStatus()
        if (status.isProcessing && status.inputPath && status.outputPath) {
          // Restore state from ongoing process
          setInputPath(status.inputPath)
          setOutputPath(status.outputPath)
          setIsProcessing(true)
          setIsEncoding(false)
          setProgress(status.progress || 0)
          setElapsedTime(status.elapsedTime || 0)
          setStartTime(Date.now() - (status.elapsedTime || 0) * 1000)

          // Start polling for completion
          processingCheckIntervalRef.current = setInterval(async () => {
            const currentStatus = await window.cleanCutAPI.getFrameDecimationStatus()
            if (!currentStatus.isProcessing) {
              clearInterval(processingCheckIntervalRef.current!)
              processingCheckIntervalRef.current = null

              setIsProcessing(false)

              // Process next item if available
              // Will be handled after component finishes mounting
            }
          }, 1000)
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
      }, 100)

      return () => clearInterval(interval)
    }
    return undefined
  }, [startTime, isProcessing])

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (processingCheckIntervalRef.current) {
        clearInterval(processingCheckIntervalRef.current)
        processingCheckIntervalRef.current = null
      }
    }
  }, [])

  // Generate output path for a video
  const generateOutputPath = (inputPath: string, folder?: string): string => {
    const dir = folder || inputPath.substring(0, inputPath.lastIndexOf('/'))
    const filename = inputPath.split('/').pop() || ''
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'))
    const ext = filename.substring(filename.lastIndexOf('.'))
    return `${dir}/${nameWithoutExt}_decimated${ext}`
  }

  // Handle single file selection
  const handleFileSelect = (filePath: string): void => {
    setInputPath(filePath)
    setError('')
    setOutputPath(generateOutputPath(filePath, outputFolder))
  }

  // Handle multiple file selection
  const handleFilesSelect = (filePaths: string[]): void => {
    addToQueue(filePaths)
    setError('')

    // Set first item as current
    if (filePaths.length > 0 && !inputPath) {
      setInputPath(filePaths[0])
      setOutputPath(generateOutputPath(filePaths[0], outputFolder))
    }
  }

  const handleOutputPathSelect = async (): Promise<void> => {
    try {
      const result = await window.electron.ipcRenderer.invoke('dialog:showOpenDialog', {
        properties: ['openDirectory'],
        buttonLabel: 'Select Output Folder'
      })

      if (!result.canceled && result.filePaths.length > 0) {
        const folder = result.filePaths[0]
        setOutputFolder(folder)

        // Update current output path
        if (inputPath) {
          setOutputPath(generateOutputPath(inputPath, folder))
        }
      }
    } catch (err) {
      console.error('Error selecting output folder:', err)
    }
  }

  // Handle progress updates from IPC
  useEffect(() => {
    const handleProgress = (
      _event: unknown,
      data: {
        percentage: number
        current_frame?: number
        time_ms?: number
      }
    ): void => {
      setIsEncoding(false)
      setProgress(data.percentage)

      // Update queue item progress if processing from queue
      if (currentProcessingId) {
        updateQueueItemProgress(currentProcessingId, data.percentage)
      }
    }

    window.electron.ipcRenderer.on('frame-decimation-progress', handleProgress)

    return () => {
      window.electron.ipcRenderer.removeAllListeners('frame-decimation-progress')
    }
  }, [currentProcessingId, updateQueueItemProgress])

  const handleProcessNext = async (): Promise<void> => {
    const nextItem = await processNextInQueue()
    if (!nextItem) return

    // Set current item for display
    setInputPath(nextItem.inputPath)
    setOutputPath(nextItem.outputPath)
    setIsProcessing(true)
    setIsEncoding(true)
    setError('')
    setStartTime(Date.now())
    setProgress(0)

    try {
      const result = await window.cleanCutAPI.processFrameDecimation(
        nextItem.inputPath,
        nextItem.outputPath,
        queue,
        nextItem.id,
        outputFolder
      )

      if (result.success && result.stats) {
        updateQueueItemStatus(nextItem.id, 'completed', { stats: result.stats })
        setResults(result.stats)

        // Process next item after a short delay
        setTimeout(() => {
          handleProcessNext()
        }, 500)
      } else {
        updateQueueItemStatus(nextItem.id, 'error', { error: result.error })
        setError(result.error || 'Failed to process video')

        // Continue with next item despite error
        setTimeout(() => {
          handleProcessNext()
        }, 500)
      }
    } catch (error) {
      console.error('Frame decimation error:', error)
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'

      updateQueueItemStatus(nextItem.id, 'error', { error: errorMessage })
      setError(errorMessage)

      // Continue with next item despite error
      setTimeout(() => {
        handleProcessNext()
      }, 500)
    } finally {
      setIsProcessing(false)
      setIsEncoding(false)
    }
  }

  const handleProcessVideo = async (): Promise<void> => {
    if (isProcessing) return

    if (queue.length > 0) {
      // Process queue
      handleProcessNext()
    } else if (inputPath && outputPath) {
      // Single file mode
      setIsProcessing(true)
      setIsEncoding(true)
      setError('')
      setStartTime(Date.now())
      setProgress(0)

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

  return (
    <div className="w-full bg-background">
      <ScrollArea className="h-[calc(100vh-12rem)] w-full">
        <div className="p-6">
          {/* Description Section */}
          <div className="mb-6">
            <div className="text-xs text-muted-foreground mb-3">
              Reduce frame rate by dropping similar consecutive frames using FFmpeg&apos;s
              mpdecimate filter
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
                      Progress is calculated based on the video duration for accurate estimates
                    </li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* File Drop Area */}
          <FileDropZone
            onFileSelect={handleFileSelect}
            onFilesSelect={handleFilesSelect}
            className="mb-6"
          />

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

          {/* Process Button and Progress */}
          {inputPath && outputPath && (
            <div className="mb-8">
              <div className="space-y-4">
                <FrameDecimationButton
                  isProcessing={isProcessing}
                  isEncoding={isEncoding}
                  onClick={handleProcessVideo}
                  queueLength={queue.length || undefined}
                />

                {/* Progress Display */}
                <ProgressDisplay
                  isProcessing={isProcessing}
                  isEncoding={isEncoding}
                  progress={progress}
                  elapsedTime={elapsedTime}
                  currentFileName={inputPath}
                />
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
          <QueueDisplay queue={queue} />
        </div>
      </ScrollArea>
    </div>
  )
}

export default FrameDecimation
