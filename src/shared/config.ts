/**
 * Shared configuration constants for the Clean-Cut application
 * This file can be imported by both main and renderer processes
 */

// Export location for audio files when processing with Premiere Pro
export const EXPORT_LOCATION = '/Users/ea/Downloads'

// Python backend paths (relative to main process)
export const PYTHON_BACKEND_PATHS = {
  VAD_CUTTER: '../../python-backend/vad_cutter.py',
  VAD_ANALYZER: '../../python-backend/vad_analyzer.py',
  PYTHON_EXECUTABLE: '../../python-backend/.venv/bin/python'
}

// WebSocket configuration
export const WEBSOCKET_CONFIG = {
  PORT: 8085
}
