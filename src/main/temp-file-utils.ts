import { join, dirname, basename } from 'path'
import { unlink, access, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { app } from 'electron'

// Track active temporary files and directories for cleanup
const activeTempFiles = new Set<string>()
const activeTempDirs = new Set<string>()

/**
 * Generates a unique temporary directory path for audio export
 * Uses Electron's cross-platform temp directory for better compatibility
 * The Premiere Pro extension will create its own filename within this directory
 * @returns Absolute path to temporary directory
 */
export function createTempDirectoryPath(): string {
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substr(2, 9)
  const dirName = `cleancut_audio_${timestamp}_${randomSuffix}`

  // Use Electron's cross-platform temp directory
  const electronTempDir = app.getPath('temp')
  const tempDirPath = join(electronTempDir, dirName)

  // Track this directory for cleanup
  activeTempDirs.add(tempDirPath)

  console.log(`Created temporary directory path (Electron): ${tempDirPath}`)
  return tempDirPath
}

/**
 * Ensures a temporary directory exists
 * @param dirPath - Path to the temporary directory
 */
export async function ensureTempDirectory(dirPath: string): Promise<void> {
  try {
    if (!existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true })
      console.log(`Created temporary directory: ${dirPath}`)
    }
  } catch (error) {
    console.error(`Failed to create temporary directory ${dirPath}:`, error)
    throw error
  }
}

/**
 * Scans for and tracks preset files created by the Premiere Pro extension
 * These files are created in the system temp directory with pattern: clean_cut_preset_*.epr
 */
export async function scanAndTrackPresetFiles(): Promise<string[]> {
  try {
    const { readdir } = await import('fs/promises')
    const electronTempDir = app.getPath('temp')

    // Look for preset files in the temp directory
    const files = await readdir(electronTempDir)
    const presetFiles = files
      .filter((file) => file.startsWith('clean_cut_preset_') && file.endsWith('.epr'))
      .map((file) => join(electronTempDir, file))

    // Track all found preset files
    presetFiles.forEach((filePath) => activeTempFiles.add(filePath))

    if (presetFiles.length > 0) {
      console.log(`Found and tracked ${presetFiles.length} preset files:`, presetFiles)
    }

    return presetFiles
  } catch (error) {
    console.log(`Error scanning for preset files:`, error)
    return []
  }
}

/**
 * Tracks a specific preset file for cleanup
 * @param presetPath - Path to the preset file
 */
export function trackPresetFile(presetPath: string): void {
  activeTempFiles.add(presetPath)
  console.log(`Tracking preset file: ${presetPath}`)
}

/**
 * Cleans up all tracked preset files
 */
export async function cleanupPresetFiles(): Promise<void> {
  const allFiles = Array.from(activeTempFiles)
  const presetFiles = allFiles.filter(
    (file) => basename(file).startsWith('clean_cut_preset_') && file.endsWith('.epr')
  )

  console.log(`Cleaning up ${presetFiles.length} preset files...`)

  await Promise.all(presetFiles.map(cleanupTempFile))

  if (presetFiles.length > 0) {
    console.log('All preset files cleaned up')
  }
}

/**
 * Safely deletes a temporary file and removes it from tracking
 * @param filePath - Path to the temporary file
 */
export async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    // Check if file exists before trying to delete
    await access(filePath)
    await unlink(filePath)
    console.log(`Cleaned up temporary file: ${filePath}`)
  } catch (error) {
    // File might not exist or already deleted - that's ok
    console.log(`Temporary file already cleaned up or doesn't exist: ${filePath}`)
  } finally {
    // Always remove from tracking
    activeTempFiles.delete(filePath)
  }
}

/**
 * Safely deletes a temporary directory and all its contents
 * @param dirPath - Path to the temporary directory
 */
export async function cleanupTempDirectory(dirPath: string): Promise<void> {
  try {
    const { rm } = await import('fs/promises')
    await rm(dirPath, { recursive: true, force: true })
    console.log(`Cleaned up temporary directory: ${dirPath}`)
  } catch (error) {
    // Directory might not exist or already deleted - that's ok
    console.log(`Temporary directory already cleaned up or doesn't exist: ${dirPath}`)
  } finally {
    // Always remove from tracking
    activeTempDirs.delete(dirPath)
  }
}

/**
 * Cleans up all tracked temporary files and directories
 */
export async function cleanupAllTempFiles(): Promise<void> {
  // First, scan for any preset files that might have been created since last scan
  await scanAndTrackPresetFiles()

  const filesToClean = Array.from(activeTempFiles)
  const dirsToClean = Array.from(activeTempDirs)

  console.log(
    `Cleaning up ${filesToClean.length} temporary files and ${dirsToClean.length} temporary directories...`
  )

  // Clean up files first, then directories
  await Promise.all([
    ...filesToClean.map(cleanupTempFile),
    ...dirsToClean.map(cleanupTempDirectory)
  ])

  console.log('All temporary files and directories cleaned up')
}

/**
 * Finds and tracks actual exported files in a temporary directory
 * Call this after the Premiere Pro export to track the created files
 * @param dirPath - Path to the temporary directory
 */
export async function trackExportedFilesInDirectory(dirPath: string): Promise<string[]> {
  try {
    const { readdir } = await import('fs/promises')
    const files = await readdir(dirPath)
    const fullPaths = files.map((file) => join(dirPath, file))

    // Track all files in the directory for cleanup
    fullPaths.forEach((filePath) => activeTempFiles.add(filePath))

    console.log(`Tracking ${fullPaths.length} exported files in ${dirPath}`)
    return fullPaths
  } catch (error) {
    console.log(`No files found in temporary directory ${dirPath}`)
    return []
  }
}

/**
 * Returns the count of active temporary files and directories
 */
export function getActiveTempFileCount(): number {
  return activeTempFiles.size + activeTempDirs.size
}

/**
 * Gets a list of all currently tracked temporary files and directories
 */
export function getActiveTempFiles(): { files: string[]; directories: string[] } {
  return {
    files: Array.from(activeTempFiles),
    directories: Array.from(activeTempDirs)
  }
}

/**
 * Cleans up temp directory containing a specific file
 * This is useful when you have a file path from an export and need to clean up its temp directory
 * @param filePath - Path to a file inside a temp directory
 */
export async function cleanupTempDirectoryContaining(filePath: string): Promise<void> {
  const parentDir = dirname(filePath)
  const dirName = basename(parentDir)

  // Check if this looks like one of our temp directories
  if (dirName && dirName.startsWith('cleancut_audio_')) {
    console.log(`Cleaning up temp directory containing file: ${filePath}`)
    await cleanupTempDirectory(parentDir)
  } else {
    // Fallback to cleaning just the file if it's not in our temp directory
    console.log(`File not in tracked temp directory, cleaning file only: ${filePath}`)
    await cleanupTempFile(filePath)
  }
}

/**
 * Clears the tracking sets without deleting files (for testing purposes)
 */
export function clearTempFileTracking(): void {
  activeTempFiles.clear()
  activeTempDirs.clear()
}
