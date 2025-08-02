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

  // Keep ref in sync with state
  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  // Load queue from main process on mount and listen for updates
  useEffect(() => {
    const loadQueue = async (): Promise<void> => {
      try {
        const queueResult = await window.cleanCutAPI.getFrameDecimationQueue()
        if (queueResult.success && queueResult.queue) {
          setQueue(queueResult.queue)
          setCurrentProcessingId(queueResult.currentProcessingId)

          // Extract output folder from first item if not already set
          if (!outputFolder && queueResult.queue.length > 0) {
            const firstItem = queueResult.queue[0]
            const folder = firstItem.outputPath.substring(0, firstItem.outputPath.lastIndexOf('/'))
            setOutputFolder(folder)
          }

          // Check if anything is processing
          const processingItem = queueResult.queue.find((item) => item.status === 'processing')
          setIsProcessing(!!processingItem)
        }
      } catch (error) {
        console.error('Error loading queue from main process:', error)
      }
    }

    loadQueue()

    // Listen for queue updates from main process
    const handleQueueUpdate = (_event: unknown, updatedQueue: QueueItem[]): void => {
      setQueue(updatedQueue)

      // Update processing state
      const processingItem = updatedQueue.find((item) => item.status === 'processing')
      setIsProcessing(!!processingItem)
      setCurrentProcessingId(processingItem?.id || null)
    }

    window.electron.ipcRenderer.on('frame-decimation-queue-updated', handleQueueUpdate)

    return () => {
      window.electron.ipcRenderer.removeAllListeners('frame-decimation-queue-updated')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // Save to main process
      window.cleanCutAPI.saveFrameDecimationQueue(queueItems).catch((error) => {
        console.error('Failed to save queue:', error)
      })
    },
    [outputFolder]
  )

  const updateQueueItemProgress = useCallback((_id: string, _progress: number) => {
    // Update is now handled by main process through IPC events
    // This is kept for compatibility but the actual update happens in main
  }, [])

  const updateQueueItemStatus = useCallback(
    (id: string, status: QueueItem['status'], data?: { stats?: VideoStats; error?: string }) => {
      // Update is now handled by main process
      // This is kept for compatibility but the actual update happens in main
      window.cleanCutAPI.updateFrameDecimationQueueItem(id, { status, ...data }).catch((error) => {
        console.error('Failed to update queue item:', error)
      })
    },
    []
  )

  const processNextInQueue = useCallback(async (): Promise<QueueItem | null> => {
    // Always fetch fresh queue state from main process
    try {
      const queueResult = await window.cleanCutAPI.getFrameDecimationQueue()
      if (!queueResult.success || !queueResult.queue) {
        console.error('Failed to get queue from main process')
        setIsProcessing(false)
        setCurrentProcessingId(null)
        return null
      }

      // Find next pending item from fresh queue state
      const nextItem = queueResult.queue.find((item) => item.status === 'pending')
      if (!nextItem) {
        // Queue complete
        setIsProcessing(false)
        setCurrentProcessingId(null)
        return null
      }

      // Update local state to reflect what we're about to process
      setCurrentProcessingId(nextItem.id)
      setIsProcessing(true)

      // Return the next item to be processed by the parent component
      return nextItem
    } catch (error) {
      console.error('Error getting next queue item:', error)
      setIsProcessing(false)
      setCurrentProcessingId(null)
      return null
    }
  }, [])

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
