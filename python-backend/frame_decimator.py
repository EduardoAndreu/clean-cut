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
    """Get basic video information using ffprobe"""
    try:
        cmd = [
            'ffprobe',
            '-v', 'error',
            '-select_streams', 'v:0',
            '-count_frames',
            '-show_entries', 'stream=nb_read_frames,r_frame_rate',
            '-of', 'json',
            input_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        
        if data['streams']:
            stream = data['streams'][0]
            frame_count = int(stream.get('nb_read_frames', 0))
            
            # Parse frame rate (can be in format like "30/1" or "29.97")
            frame_rate_str = stream.get('r_frame_rate', '0/1')
            if '/' in frame_rate_str:
                num, den = map(int, frame_rate_str.split('/'))
                frame_rate = num / den if den != 0 else 0
            else:
                frame_rate = float(frame_rate_str)
            
            return frame_count, frame_rate
    except Exception as e:
        print(f"Error getting video info: {e}", file=sys.stderr)
        return 0, 0


def process_video(input_path, output_path):
    """Process video with mpdecimate filter"""
    # Get original video info
    original_frames, frame_rate = get_video_info(input_path)
    
    # FFmpeg command with mpdecimate
    cmd = [
        'ffmpeg',
        '-i', input_path,
        '-vf', 'mpdecimate,setpts=N/FRAME_RATE/TB',
        '-an',  # Remove audio
        '-y',   # Overwrite output file if exists
        output_path
    ]
    
    # Progress tracking regex
    progress_regex = re.compile(r'frame=\s*(\d+)')
    
    # Run FFmpeg with progress tracking
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True
    )
    
    last_frame = 0
    for line in process.stdout:
        # Output line for debugging
        print(line.strip(), file=sys.stderr)
        
        # Extract frame number for progress
        match = progress_regex.search(line)
        if match:
            current_frame = int(match.group(1))
            if current_frame > last_frame:
                last_frame = current_frame
                # Send progress update
                progress_data = {
                    "type": "progress",
                    "current": current_frame,
                    "total": original_frames
                }
                print(json.dumps(progress_data))
                sys.stdout.flush()
    
    # Wait for process to complete
    return_code = process.wait()
    
    if return_code != 0:
        raise Exception(f"FFmpeg process failed with return code {return_code}")
    
    # Get output video info
    output_frames, _ = get_video_info(output_path)
    
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