#!/usr/bin/env python3
"""
Frame Decimator - Uses FFmpeg's mpdecimate filter to reduce frame rate by dropping similar frames
"""
import subprocess
import sys
import json
import os
import re
from pathlib import Path


def get_video_info(input_path):
    """Get all video information in one ffprobe call"""
    try:
        cmd = [
            'ffprobe',
            '-v', 'error',
            '-select_streams', 'v:0',
            '-count_frames',
            '-show_entries', 'stream=nb_read_frames,r_frame_rate:format=duration',
            '-of', 'json',
            input_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        
        frame_count = 0
        frame_rate = 0
        duration = 0
        
        if data.get('streams') and data['streams']:
            stream = data['streams'][0]
            frame_count = int(stream.get('nb_read_frames', 0))
            
            # Parse frame rate (can be in format like "30/1" or "29.97")
            frame_rate_str = stream.get('r_frame_rate', '0/1')
            if '/' in frame_rate_str:
                num, den = map(int, frame_rate_str.split('/'))
                frame_rate = num / den if den != 0 else 0
            else:
                frame_rate = float(frame_rate_str)
        
        if data.get('format'):
            duration = float(data['format'].get('duration', 0))
            
        return frame_count, frame_rate, duration
    except Exception as e:
        print(f"Error getting video info: {e}", file=sys.stderr)
        return 0, 0, 0


def process_video(input_path, output_path):
    """Process video with mpdecimate filter"""
    # Get all video info in one call
    original_frames, frame_rate, duration = get_video_info(input_path)
    
    print(f"Video info: {original_frames} frames, {frame_rate} fps, {duration}s duration", file=sys.stderr)
    
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
            
        # Debug first few lines
        if 'Duration:' in line or 'Stream' in line:
            print(f"FFmpeg: {line}", file=sys.stderr)
        
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
                        
                        # Get time if available
                        current_time = 0
                        if 'out_time_ms' in progress_data:
                            time_ms = int(progress_data['out_time_ms'])
                            current_time = time_ms / 1000000.0  # Convert to seconds
                        elif 'out_time' in progress_data:
                            # Parse time format HH:MM:SS.ffffff
                            time_str = progress_data['out_time']
                            if ':' in time_str:
                                parts = time_str.split(':')
                                if len(parts) == 3:
                                    hours = int(parts[0])
                                    minutes = int(parts[1])
                                    seconds = float(parts[2])
                                    current_time = hours * 3600 + minutes * 60 + seconds
                        
                        # Since mpdecimate drops frames, we need to estimate input progress
                        # Use the output time to estimate how much of the input we've processed
                        if duration > 0:
                            input_progress = (current_time / duration) * original_frames
                            progress_percentage = (current_time / duration) * 100
                        else:
                            # Fallback to frame-based calculation
                            input_progress = current_frame
                            progress_percentage = (current_frame / original_frames) * 100
                        
                        progress_json = {
                            "type": "progress",
                            "current": int(input_progress),
                            "total": original_frames,
                            "percentage": min(progress_percentage, 100),
                            "time_elapsed": current_time,
                            "duration": duration,
                            "output_frames": current_frame
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
    
    # Get output video info
    output_frames, _, _ = get_video_info(output_path)
    
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