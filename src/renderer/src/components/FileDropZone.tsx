import React, { useCallback, useState } from 'react'
import { Upload } from 'lucide-react'

interface FileDropZoneProps {
  onFilesSelect: (filePaths: string[]) => void
  onFileSelect: (filePath: string) => void
  acceptedExtensions?: string[]
  className?: string
}

const FileDropZone: React.FC<FileDropZoneProps> = ({
  onFilesSelect,
  onFileSelect,
  acceptedExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'],
  className = ''
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState('')

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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)

      const videoFiles = files.filter((file) => {
        const ext = file.name.toLowerCase().split('.').pop()
        return acceptedExtensions.includes(ext || '')
      })

      if (videoFiles.length === 0) {
        setError('Please drop valid video files')
        setTimeout(() => setError(''), 3000)
        return
      }

      // Get file paths
      const filePaths = videoFiles
        .map((file) => (file as unknown as { path: string }).path)
        .filter(Boolean)

      if (filePaths.length === 0) {
        setError('Unable to get file paths. Please use the browse button instead.')
        setTimeout(() => setError(''), 3000)
        return
      }

      if (filePaths.length === 1) {
        onFileSelect(filePaths[0])
      } else {
        onFilesSelect(filePaths)
      }
    },
    [acceptedExtensions, onFileSelect, onFilesSelect]
  )

  const handleFileInput = async (): Promise<void> => {
    try {
      const result = await window.electron.ipcRenderer.invoke('dialog:showOpenDialog', {
        properties: ['openFile', 'multiSelections'],
        filters: [
          {
            name: 'Video Files',
            extensions: acceptedExtensions
          },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (!result.canceled && result.filePaths.length > 0) {
        if (result.filePaths.length === 1) {
          onFileSelect(result.filePaths[0])
        } else {
          onFilesSelect(result.filePaths)
        }
      }
    } catch (err) {
      console.error('Error selecting file:', err)
      setError('Failed to open file dialog')
      setTimeout(() => setError(''), 3000)
    }
  }

  return (
    <div className={className}>
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
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
          Supported: {acceptedExtensions.map((ext) => ext.toUpperCase()).join(', ')}
        </p>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>
    </div>
  )
}

export default FileDropZone
