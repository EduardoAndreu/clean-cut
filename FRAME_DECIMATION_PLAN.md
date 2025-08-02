# Frame Decimation Feature Implementation Plan

## Overview

Add video frame decimation capability to Clean-Cut using FFmpeg's mpdecimate filter to reduce frame rate by dropping similar consecutive frames.

## Implementation Steps

### 1. Python Backend Script

**File**: `python-backend/frame_decimator.py`

```python
# Core functionality:
- Accept input/output video paths
- Validate video file formats
- Execute FFmpeg command: ffmpeg -i input.mp4 -vf mpdecimate,setpts=N/FRAME_RATE/TB -an output.mp4
- Parse FFmpeg progress output
- Return processing statistics
```

### 2. Main Process IPC Handler

**File**: `src/main/index.ts`

```typescript
// Add new IPC handler:
ipcMain.handle('process-frame-decimation', async (event, { inputPath, outputPath }) => {
  // Spawn Python subprocess
  // Handle stdout/stderr
  // Return results
})
```

### 3. Preload API

**Files**: `src/preload/index.ts` and `src/preload/index.d.ts`

```typescript
// Add to electronAPI:
processFrameDecimation: (inputPath: string, outputPath: string) => Promise<FrameDecimationResponse>
```

### 4. UI Components

#### Main Component: `src/renderer/src/components/FrameDecimation.tsx`

- Drag-and-drop area for video files
- Output path selection (text input + folder picker)
- Process button
- Progress indicator
- Results display

#### Button Component: `src/renderer/src/components/FrameDecimationButton.tsx`

- Processing state management
- Error handling
- Success feedback

### 5. Landing Page Integration

**File**: `src/renderer/src/components/LandingPage.tsx`

- Add new feature card with Film icon
- Route to frame decimation component

### 6. Routing

**File**: `src/renderer/src/App.tsx`

- Add route for '/frame-decimation'

## UI Flow

1. User clicks "Frame Decimation" on landing page
2. Drag & drop video file or click to select
3. Optional: Modify output path (defaults to input_decimated.mp4)
4. Click "Process Video"
5. Show progress indicator
6. Display results (frame reduction stats)

## Error Handling

- Invalid video format
- FFmpeg not found
- Write permission errors
- Processing failures

## Future Enhancements (Not in MVP)

- Customizable mpdecimate parameters (hi, lo, frac)
- Preview of decimated video
- Batch processing
- Keep audio option
