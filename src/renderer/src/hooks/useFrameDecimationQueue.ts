import { useState, useEffect, useRef, useCallback } from 'react'

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

interface UseFrameDecimationQueueReturn {
  queue: QueueItem[]
  currentProcessingId: string | null
  isProcessing: boolean
  outputFolder: string
  setOutputFolder: (folder: string) => void
  addToQueue: (filePaths: string[]) => void
  processNextInQueue: () => Promise<QueueItem | null>
  updateQueueItemProgress: (id: string, progress: number) => void
  updateQueueItemStatus: (
    id: string,
    status: QueueItem['status'],
    data?: { stats?: VideoStats; error?: string }
  ) => void
  clearQueue: () => void
}

export const useFrameDecimationQueue = (): UseFrameDecimationQueueReturn => {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [currentProcessingId, setCurrentProcessingId] = useState<string | null>(null)
  const [outputFolder, setOutputFolder] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const queueRef = useRef<QueueItem[]>([])
  const processingCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Keep ref in sync with state and save to file
  useEffect(() => {
    queueRef.current = queue

    // Save queue to file whenever it changes
    if (queue.length > 0) {
      window.cleanCutAPI.saveFrameDecimationQueue(queue).catch((error) => {
        console.error('Failed to save queue to file:', error)
      })
    }
  }, [queue])

  // Load queue from storage on mount
  useEffect(() => {
    const loadQueue = async (): Promise<void> => {
      try {
        const queueResult = await window.cleanCutAPI.loadFrameDecimationQueue()
        if (queueResult.success && queueResult.queue && queueResult.queue.length > 0) {
          setQueue(queueResult.queue)

          // Extract output folder from first item if not already set
          if (!outputFolder && queueResult.queue.length > 0) {
            const firstItem = queueResult.queue[0]
            const folder = firstItem.outputPath.substring(0, firstItem.outputPath.lastIndexOf('/'))
            setOutputFolder(folder)
          }
        }
      } catch (error) {
        console.error('Error loading queue from file:', error)
      }
    }

    loadQueue()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (processingCheckIntervalRef.current) {
        clearInterval(processingCheckIntervalRef.current)
        processingCheckIntervalRef.current = null
      }
    }
  }, [])

  const generateOutputPath = (inputPath: string, folder: string): string => {
    const filename = inputPath.split('/').pop() || ''
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'))
    const ext = filename.substring(filename.lastIndexOf('.'))
    return `${folder}/${nameWithoutExt}_decimated${ext}`
  }

  const addToQueue = useCallback(
    (filePaths: string[]) => {
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
    },
    [outputFolder]
  )

  const updateQueueItemProgress = useCallback((id: string, progress: number) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, progress } : item)))
  }, [])

  const updateQueueItemStatus = useCallback(
    (id: string, status: QueueItem['status'], data?: { stats?: VideoStats; error?: string }) => {
      setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, status, ...data } : item)))
    },
    []
  )

  const processNextInQueue = useCallback(async (): Promise<QueueItem | null> => {
    // Find next pending item using ref to get latest queue state
    const nextItem = queueRef.current.find((item) => item.status === 'pending')
    if (!nextItem) {
      // Queue complete
      setIsProcessing(false)
      setCurrentProcessingId(null)

      // Clear the queue file since processing is complete
      window.cleanCutAPI.clearFrameDecimationQueue().catch((error) => {
        console.error('Failed to clear queue file:', error)
      })

      return null
    }

    // Update queue to mark item as processing
    updateQueueItemStatus(nextItem.id, 'processing')
    setCurrentProcessingId(nextItem.id)
    setIsProcessing(true)

    // Return the next item to be processed by the parent component
    return nextItem
  }, [updateQueueItemStatus])

  const clearQueue = useCallback(() => {
    setQueue([])
    setCurrentProcessingId(null)
    setIsProcessing(false)

    // Clear the queue file
    window.cleanCutAPI.clearFrameDecimationQueue().catch((error) => {
      console.error('Failed to clear queue file:', error)
    })
  }, [])

  return {
    queue,
    currentProcessingId,
    isProcessing,
    outputFolder,
    setOutputFolder,
    addToQueue,
    processNextInQueue,
    updateQueueItemProgress,
    updateQueueItemStatus,
    clearQueue
  }
}
