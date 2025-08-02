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


def get_video_duration(input_path):
    """Get video duration in seconds"""
    try:
        cmd = [
            'ffprobe',
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            input_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return float(result.stdout.strip())
    except Exception as e:
        print(f"Error getting duration: {e}", file=sys.stderr)
        return None


def process_video(input_path, output_path):
    """Process video with mpdecimate filter"""
    # Get original frame count and duration
    original_frames = get_frame_count(input_path)
    duration = get_video_duration(input_path)
    
    if original_frames == 0:
        raise Exception("Could not determine video frame count")
    
    if duration is None:
        print("Warning: Could not determine video duration, falling back to frame-based progress", file=sys.stderr)
    
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
    last_reported_progress = -1
    
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
            if key == 'progress':
                try:
                    progress_percentage = 0
                    
                    # Primary: Use time-based progress if available
                    if 'out_time_ms' in progress_data and duration:
                        current_time_ms = int(progress_data.get('out_time_ms', 0))
                        current_time = current_time_ms / 1000000.0  # Convert microseconds to seconds
                        progress_percentage = (current_time / duration) * 100
                    
                    # Fallback: Use frame-based progress
                    elif 'frame' in progress_data:
                        current_frame = int(progress_data.get('frame', 0))
                        # Conservative estimate - cap at 95% until complete
                        progress_percentage = min((current_frame / original_frames) * 100, 95) if original_frames > 0 else 0
                    
                    # Only send update if progress changed significantly (at least 0.5%)
                    if abs(progress_percentage - last_reported_progress) >= 0.5 and progress_percentage > 0:
                        last_reported_progress = progress_percentage
                        
                        progress_json = {
                            "type": "progress",
                            "percentage": min(progress_percentage, 99.9)  # Never report 100% until actually done
                        }
                        
                        # Include additional debug info if available
                        if 'frame' in progress_data:
                            progress_json["current_frame"] = int(progress_data.get('frame', 0))
                        if 'out_time_ms' in progress_data:
                            progress_json["time_ms"] = int(progress_data.get('out_time_ms', 0))
                        
                        print(json.dumps(progress_json))
                        sys.stdout.flush()
                    
                    # Clear progress_data for next update
                    if progress_percentage > 0:  # Only clear if we had valid progress
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