import sys
import json
import numpy as np
from pydub import AudioSegment
from scipy.ndimage import uniform_filter1d


def calculate_energy_levels(audio, frame_size_ms=200):
    """
    Calculate energy levels using larger frame size for more stable analysis.
    """
    frame_size_samples = int(audio.frame_rate * frame_size_ms / 1000)
    hop_size_samples = frame_size_samples // 2  # 50% overlap (less granular)
    
    audio_array = np.array(audio.get_array_of_samples())
    
    # Handle stereo
    if audio.channels == 2:
        audio_array = audio_array.reshape((-1, 2)).mean(axis=1)
    
    energy_levels = []
    
    for i in range(0, len(audio_array) - frame_size_samples, hop_size_samples):
        frame = audio_array[i:i + frame_size_samples]
        
        # Calculate RMS energy
        energy = np.sqrt(np.mean(frame.astype(np.float64) ** 2))
        
        # Convert to dB with proper normalization
        if energy > 0:
            max_val = 32768 if audio.sample_width == 2 else 128
            db_level = 20 * np.log10(energy / max_val)
        else:
            db_level = -80
            
        timestamp_ms = (i / audio.frame_rate) * 1000
        energy_levels.append((timestamp_ms, db_level))
    
    return energy_levels


def smooth_energy_profile(energy_levels, window_size=5):
    """
    Apply smoothing to energy profile to reduce noise and brief spikes.
    """
    if len(energy_levels) < window_size:
        return energy_levels
    
    timestamps = [e[0] for e in energy_levels]
    db_values = np.array([e[1] for e in energy_levels])
    
    # Apply moving average smoothing
    smoothed_db = uniform_filter1d(db_values, size=window_size, mode='nearest')
    
    return list(zip(timestamps, smoothed_db))


def detect_quiet_regions_adaptive(energy_levels, base_threshold_db, min_region_ms=1000, adaptive=True):
    """
    Detect quiet regions using adaptive thresholding based on content.
    Much more conservative approach for video editing.
    """
    if not energy_levels:
        return []
    
    db_values = np.array([e[1] for e in energy_levels])
    
    # More conservative adaptive threshold
    if adaptive and len(db_values) > 20:
        # Calculate dynamic threshold based on content
        mean_db = np.mean(db_values)
        std_db = np.std(db_values)
        
        # Be more conservative - only cut really quiet sections
        dynamic_threshold = min(base_threshold_db, mean_db - 2.0 * std_db)
        dynamic_threshold = max(dynamic_threshold, base_threshold_db - 15)  # Don't go too low
        
        print(f"Adaptive threshold: {dynamic_threshold:.1f}dB (base: {base_threshold_db}dB, mean: {mean_db:.1f}dB)", file=sys.stderr)
    else:
        dynamic_threshold = base_threshold_db
    
    # Find quiet regions
    quiet_regions = []
    current_start = None
    
    frame_duration_ms = 200 * 0.5  # Based on 50% overlap (200ms frames)
    min_frames = int(min_region_ms / frame_duration_ms)
    
    for i, (timestamp_ms, db_level) in enumerate(energy_levels):
        is_quiet = db_level < dynamic_threshold
        
        if is_quiet and current_start is None:
            current_start = timestamp_ms
        elif not is_quiet and current_start is not None:
            # End of quiet region
            region_duration = timestamp_ms - current_start
            if region_duration >= min_region_ms:
                quiet_regions.append((current_start, timestamp_ms))
            current_start = None
    
    # Handle region that extends to end of audio
    if current_start is not None:
        final_timestamp = energy_levels[-1][0] + frame_duration_ms
        region_duration = final_timestamp - current_start
        if region_duration >= min_region_ms:
            quiet_regions.append((current_start, final_timestamp))
    
    return quiet_regions


def merge_nearby_regions(regions, merge_gap_ms=2000):
    """
    Aggressively merge regions that are close together for cleaner video editing.
    """
    if len(regions) <= 1:
        return regions
    
    merged = [regions[0]]
    
    for start, end in regions[1:]:
        last_start, last_end = merged[-1]
        
        # Much more aggressive merging - if regions are within 2 seconds, merge them
        if start - last_end <= merge_gap_ms:
            merged[-1] = (last_start, end)
        else:
            merged.append((start, end))
    
    return merged


def main(file_path, silence_thresh_db, min_silence_len_ms, padding_ms, conservative_padding=False):
    """
    Energy-based silence detection with smoothing and adaptive thresholding.
    Designed for video editing workflows where you want clean, logical cuts.
    """
    try:
        # Load audio
        audio = AudioSegment.from_wav(file_path)
        audio_duration_ms = len(audio)
        
        print(f"Analyzing audio: {audio_duration_ms/1000:.1f}s, {audio.frame_rate}Hz, {audio.channels} channels", file=sys.stderr)
        
        # Calculate energy levels with larger frames (200ms) for stability
        energy_levels = calculate_energy_levels(audio, frame_size_ms=200)
        print(f"Calculated {len(energy_levels)} energy measurements", file=sys.stderr)
        
        # Smooth the energy profile to reduce noise
        smoothed_levels = smooth_energy_profile(energy_levels, window_size=3)
        print("Applied smoothing to energy profile", file=sys.stderr)
        
        # Detect quiet regions with much more conservative settings
        min_region_duration = max(min_silence_len_ms, 1000)  # At least 1 second
        quiet_regions = detect_quiet_regions_adaptive(
            smoothed_levels, 
            silence_thresh_db, 
            min_region_ms=min_region_duration,
            adaptive=True
        )
        print(f"Found {len(quiet_regions)} initial quiet regions", file=sys.stderr)
        
        # Very aggressive merging - combine regions within 2 seconds
        merged_regions = merge_nearby_regions(quiet_regions, merge_gap_ms=2000)
        print(f"After aggressive merging: {len(merged_regions)} regions", file=sys.stderr)
        
        # Filter out very short regions (less than 0.5 seconds after merging)
        filtered_regions = [(start, end) for start, end in merged_regions if end - start >= 500]
        print(f"After filtering short regions: {len(filtered_regions)} regions", file=sys.stderr)
        
        # Apply padding to filtered regions
        final_regions = []
        for start_ms, end_ms in filtered_regions:
            # Expand regions (padding extends the cuts)
            padded_start = max(0, start_ms - padding_ms)
            padded_end = min(audio_duration_ms, end_ms + padding_ms)
            
            if padded_end > padded_start:
                final_regions.append((padded_start, padded_end))
        
        print(f"Final regions for cutting: {len(final_regions)}", file=sys.stderr)
        
        # Convert to seconds and output
        output_regions = []
        total_duration_cut = 0
        for start_ms, end_ms in final_regions:
            start_seconds = start_ms / 1000.0
            end_seconds = end_ms / 1000.0
            duration = end_seconds - start_seconds
            total_duration_cut += duration
            output_regions.append([start_seconds, end_seconds])
            print(f"  Region: {start_seconds:.2f}s - {end_seconds:.2f}s ({duration:.2f}s)", file=sys.stderr)
        
        print(f"Total duration to cut: {total_duration_cut:.1f}s ({total_duration_cut/audio_duration_ms*1000:.1f}% of audio)", file=sys.stderr)
        
        # Output JSON
        json_output = json.dumps(output_regions)
        print(json_output)
        sys.stdout.flush()
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("Usage: python silence_detector_energy.py <file_path> <silence_thresh_db> <min_silence_len_ms> <padding_ms>", file=sys.stderr)
        print("Energy-based approach with smoothing and adaptive thresholding", file=sys.stderr)
        sys.exit(1)
    
    file_path = sys.argv[1]
    silence_thresh_db = float(sys.argv[2])
    min_silence_len_ms = int(sys.argv[3])
    padding_ms = int(sys.argv[4])
    
    main(file_path, silence_thresh_db, min_silence_len_ms, padding_ms) 