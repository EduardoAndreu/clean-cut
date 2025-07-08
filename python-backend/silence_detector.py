import sys
import json
import numpy as np
from pydub import AudioSegment
from pydub.utils import db_to_float


def analyze_audio_levels(audio, frame_size_ms=20):
    """
    Analyze audio levels frame by frame.
    
    Args:
        audio: AudioSegment object
        frame_size_ms: Size of each analysis frame in milliseconds
    
    Returns:
        List of (timestamp_ms, db_level) tuples
    """
    frame_size_samples = int(audio.frame_rate * frame_size_ms / 1000)
    audio_array = np.array(audio.get_array_of_samples())
    
    # Handle stereo audio by converting to mono
    if audio.channels == 2:
        audio_array = audio_array.reshape((-1, 2)).mean(axis=1)
    
    frames_analysis = []
    
    for i in range(0, len(audio_array), frame_size_samples):
        frame = audio_array[i:i + frame_size_samples]
        if len(frame) == 0:
            continue
            
        # Calculate RMS for this frame
        rms = np.sqrt(np.mean(frame.astype(np.float64) ** 2))
        
        # Convert to dB (avoid log(0) by using a minimum value)
        if rms > 0:
            # Normalize based on bit depth
            if audio.sample_width == 1:  # 8-bit
                max_val = 128
            elif audio.sample_width == 2:  # 16-bit
                max_val = 32768
            elif audio.sample_width == 4:  # 32-bit
                max_val = 2147483648
            else:
                max_val = 32768  # default to 16-bit
                
            db_level = 20 * np.log10(rms / max_val)
        else:
            db_level = -80  # Very quiet
        
        timestamp_ms = (i / audio.frame_rate) * 1000
        frames_analysis.append((timestamp_ms, db_level))
    
    return frames_analysis


def group_quiet_regions(frames_analysis, silence_thresh_db, min_quiet_frames=20, quiet_frame_threshold=0.8):
    """
    Group consecutive frames that are below the threshold.
    
    Args:
        frames_analysis: List of (timestamp_ms, db_level) tuples
        silence_thresh_db: dB threshold for silence
        min_quiet_frames: Minimum number of frames to consider a region for cutting
        quiet_frame_threshold: Percentage of frames that must be below threshold (0.0-1.0)
    
    Returns:
        List of (start_ms, end_ms) tuples representing regions to cut
    """
    if not frames_analysis:
        return []
    
    quiet_regions = []
    current_region_start = None
    current_region_frames = []
    
    frame_duration = 20  # ms, should match frame_size_ms from analyze_audio_levels
    
    for timestamp_ms, db_level in frames_analysis:
        is_quiet = db_level < silence_thresh_db
        
        if current_region_start is None:
            # Not currently in a region
            if is_quiet:
                # Start a new potential quiet region
                current_region_start = timestamp_ms
                current_region_frames = [is_quiet]
        else:
            # Currently tracking a region
            current_region_frames.append(is_quiet)
            
            # Check if we should end this region
            region_duration_frames = len(current_region_frames)
            
            # End region if we hit a loud frame and have enough data to analyze
            if not is_quiet and region_duration_frames >= min_quiet_frames:
                # Analyze the completed region
                quiet_frames = sum(current_region_frames)
                quiet_percentage = quiet_frames / len(current_region_frames)
                
                if quiet_percentage >= quiet_frame_threshold:
                    # This region qualifies for cutting
                    region_end = timestamp_ms
                    quiet_regions.append((current_region_start, region_end))
                
                # Reset for next region
                current_region_start = None
                current_region_frames = []
                
            # Also end region if it gets too long without meeting criteria
            elif region_duration_frames > min_quiet_frames * 3:
                quiet_frames = sum(current_region_frames)
                quiet_percentage = quiet_frames / len(current_region_frames)
                
                if quiet_percentage >= quiet_frame_threshold:
                    region_end = timestamp_ms
                    quiet_regions.append((current_region_start, region_end))
                
                current_region_start = None
                current_region_frames = []
    
    # Handle the last region if we ended while tracking one
    if current_region_start is not None and len(current_region_frames) >= min_quiet_frames:
        quiet_frames = sum(current_region_frames)
        quiet_percentage = quiet_frames / len(current_region_frames)
        
        if quiet_percentage >= quiet_frame_threshold:
            # End at the last timestamp + frame duration
            region_end = frames_analysis[-1][0] + frame_duration
            quiet_regions.append((current_region_start, region_end))
    
    return quiet_regions


def apply_padding_to_regions(quiet_regions, padding_ms, audio_duration_ms, merge_nearby=True):
    """
    Apply padding to quiet regions and optionally merge nearby regions.
    
    Args:
        quiet_regions: List of (start_ms, end_ms) tuples
        padding_ms: Padding to apply (positive = expand regions)
        audio_duration_ms: Total audio duration
        merge_nearby: Whether to merge regions that overlap after padding
    
    Returns:
        List of (start_ms, end_ms) tuples with padding applied
    """
    if not quiet_regions:
        return []
    
    # Apply padding
    padded_regions = []
    for start_ms, end_ms in quiet_regions:
        padded_start = max(0, start_ms - padding_ms)
        padded_end = min(audio_duration_ms, end_ms + padding_ms)
        
        if padded_end > padded_start:
            padded_regions.append((padded_start, padded_end))
    
    if not merge_nearby or len(padded_regions) <= 1:
        return padded_regions
    
    # Merge overlapping or adjacent regions
    padded_regions.sort()  # Sort by start time
    merged_regions = [padded_regions[0]]
    
    for current_start, current_end in padded_regions[1:]:
        last_start, last_end = merged_regions[-1]
        
        # Merge if regions overlap or are very close (within 100ms)
        if current_start <= last_end + 100:
            # Extend the last region
            merged_regions[-1] = (last_start, max(last_end, current_end))
        else:
            # Add as separate region
            merged_regions.append((current_start, current_end))
    
    return merged_regions


def main(file_path, silence_thresh_db, min_silence_len_ms, padding_ms, conservative_padding=False):
    """
    Detect quiet regions in an audio file using frame-by-frame analysis.
    
    Args:
        file_path: Path to the WAV audio file
        silence_thresh_db: dB threshold for quiet audio (e.g., -54)
        min_silence_len_ms: Minimum length for quiet regions (converted to frame count)
        padding_ms: Padding to apply around detected regions
        conservative_padding: Not used in new implementation (kept for compatibility)
    
    Returns:
        JSON array of [start_seconds, end_seconds] pairs representing quiet regions to cut
    """
    try:
        # Load the audio file
        audio = AudioSegment.from_wav(file_path)
        audio_duration_ms = len(audio)
        
        print(f"Analyzing audio: {audio_duration_ms/1000:.1f}s, {audio.frame_rate}Hz, {audio.channels} channels", file=sys.stderr)
        
        # Analyze audio levels frame by frame
        frame_size_ms = 20  # 20ms frames
        frames_analysis = analyze_audio_levels(audio, frame_size_ms)
        
        print(f"Analyzed {len(frames_analysis)} frames", file=sys.stderr)
        
        # Convert min_silence_len_ms to number of frames
        min_quiet_frames = max(1, int(min_silence_len_ms / frame_size_ms))
        
        print(f"Looking for regions with {min_quiet_frames}+ quiet frames below {silence_thresh_db}dB", file=sys.stderr)
        
        # Group quiet regions
        quiet_regions = group_quiet_regions(
            frames_analysis, 
            silence_thresh_db, 
            min_quiet_frames=min_quiet_frames,
            quiet_frame_threshold=0.8  # 80% of frames must be below threshold
        )
        
        print(f"Found {len(quiet_regions)} initial quiet regions", file=sys.stderr)
        
        # Apply padding and merge nearby regions
        final_regions = apply_padding_to_regions(
            quiet_regions, 
            padding_ms, 
            audio_duration_ms, 
            merge_nearby=True
        )
        
        print(f"After padding and merging: {len(final_regions)} regions", file=sys.stderr)
        
        # Convert to seconds for output
        output_regions = []
        for start_ms, end_ms in final_regions:
            start_seconds = start_ms / 1000.0
            end_seconds = end_ms / 1000.0
            output_regions.append([start_seconds, end_seconds])
            print(f"  Region: {start_seconds:.3f}s - {end_seconds:.3f}s ({end_seconds-start_seconds:.3f}s)", file=sys.stderr)
        
        # Convert to JSON and output
        json_output = json.dumps(output_regions)
        print(json_output)
        sys.stdout.flush()
        
    except Exception as e:
        print(f"Error processing audio: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 5 or len(sys.argv) > 6:
        print("Usage: python silence_detector.py <file_path> <silence_thresh_db> <min_silence_len_ms> <padding_ms> [conservative_padding]", file=sys.stderr)
        print("  New implementation uses frame-by-frame analysis with intelligent grouping", file=sys.stderr)
        print("  conservative_padding: ignored in new implementation (kept for compatibility)", file=sys.stderr)
        sys.exit(1)
    
    file_path = sys.argv[1]
    silence_thresh_db = float(sys.argv[2])
    min_silence_len_ms = int(sys.argv[3])
    padding_ms = int(sys.argv[4])
    
    # Conservative padding parameter (ignored in new implementation)
    conservative_padding = False
    if len(sys.argv) == 6:
        conservative_padding = sys.argv[5].lower() in ('true', '1', 'yes', 'on')
    
    main(file_path, silence_thresh_db, min_silence_len_ms, padding_ms, conservative_padding) 