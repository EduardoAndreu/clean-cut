#!/usr/bin/env python3
"""
Frame Decimator - Uses FFmpeg's mpdecimate filter to reduce frame rate by dropping similar frames
"""
import subprocess
import sys
import json
import os
from pathlib import Path


def get_frame_count(input_path):
    """Get video frame count"""
    try:
        cmd = [
            'ffprobe',
            '-v', 'error',
            '-select_streams', 'v:0',
            '-count_frames',
            '-show_entries', 'stream=nb_read_frames',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            input_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return int(result.stdout.strip())
    except Exception as e:
        print(f"Error getting frame count: {e}", file=sys.stderr)
        return 0


def process_video(input_path, output_path):
    """Process video with mpdecimate filter"""
    # Get original frame count
    original_frames = get_frame_count(input_path)
    
    if original_frames == 0:
        raise Exception("Could not determine video frame count")
    
    # FFmpeg command with mpdecimate
    cmd = [
        'ffmpeg',
        '-i', input_path,
        '-vf', 'mpdecimate,setpts=N/FRAME_RATE/TB',
        '-an',  # Remove audio
        '-y',   # Overwrite output file if exists
        '-progress', 'pipe:2',  # Send progress to stderr
        output_path
    ]
    
    # Progress tracking - we'll use -progress output only
    
    # Run FFmpeg with progress tracking
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True
    )
    
    # Collect progress data
    progress_data = {}
    last_reported_frame = -1
    
    # Read stderr for progress
    for line in process.stderr:
        line = line.strip()
        
        if not line:
            continue
            
        # Skip non-progress lines
        if 'Duration:' in line or 'Stream' in line:
            continue
        
        # Parse -progress output (key=value format)
        if '=' in line and line.count('=') == 1:
            key, value = line.split('=', 1)
            progress_data[key] = value
            
            # When we get 'progress=continue' or 'progress=end', we have a complete update
            if key == 'progress' and 'frame' in progress_data:
                try:
                    current_frame = int(progress_data.get('frame', 0))
                    
                    # Only send update if frame count changed
                    if current_frame != last_reported_frame and current_frame > 0:
                        last_reported_frame = current_frame
                        
                        # Simple progress based on output frames
                        # Since we can't know exact input progress with mpdecimate,
                        # we estimate based on output frames
                        progress_percentage = (current_frame / original_frames) * 100 if original_frames > 0 else 0
                        
                        progress_json = {
                            "type": "progress",
                            "current": current_frame,
                            "total": original_frames,
                            "percentage": min(progress_percentage, 100)
                        }
                        print(json.dumps(progress_json))
                        sys.stdout.flush()
                        
                        # Clear progress_data for next update
                        progress_data = {}
                        
                except (ValueError, KeyError) as e:
                    print(f"Error parsing progress: {e}", file=sys.stderr)
        # Skip any non-progress output
    
    # Wait for process to complete
    return_code = process.wait()
    
    if return_code != 0:
        raise Exception(f"FFmpeg process failed with return code {return_code}")
    
    # Get output frame count
    output_frames = get_frame_count(output_path)
    
    # Calculate statistics
    reduction_percentage = ((original_frames - output_frames) / original_frames * 100) if original_frames > 0 else 0
    
    return {
        "success": True,
        "outputPath": output_path,
        "stats": {
            "originalFrames": original_frames,
            "outputFrames": output_frames,
            "reductionPercentage": round(reduction_percentage, 2)
        }
    }


def main():
    """Main entry point"""
    if len(sys.argv) != 3:
        error_result = {
            "success": False,
            "error": "Usage: frame_decimator.py <input_path> <output_path>"
        }
        print(json.dumps(error_result))
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    # Validate input file exists
    if not os.path.exists(input_path):
        error_result = {
            "success": False,
            "error": f"Input file not found: {input_path}"
        }
        print(json.dumps(error_result))
        sys.exit(1)
    
    # Check if file is a video
    valid_extensions = {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.m4v'}
    if Path(input_path).suffix.lower() not in valid_extensions:
        error_result = {
            "success": False,
            "error": f"Invalid video file format. Supported formats: {', '.join(valid_extensions)}"
        }
        print(json.dumps(error_result))
        sys.exit(1)
    
    # Create output directory if needed
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
    
    try:
        # Process the video
        result = process_video(input_path, output_path)
        print(json.dumps(result))
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == "__main__":
    main()