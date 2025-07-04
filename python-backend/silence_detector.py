import sys
import json
from pydub import AudioSegment
from pydub.silence import detect_silence


def main(file_path, silence_thresh_db, min_silence_len_ms, padding_ms):
    """
    Detect silent ranges in an audio file and return them as JSON.
    
    Args:
        file_path: Path to the WAV audio file
        silence_thresh_db: Silence threshold in dB
        min_silence_len_ms: Minimum silence length in milliseconds
        padding_ms: Padding to apply to each side of silence ranges in milliseconds
    """
    # Load the audio file
    audio = AudioSegment.from_wav(file_path)
    
    # Detect silent ranges (returns list of [start_ms, end_ms] pairs)
    silent_ranges = detect_silence(
        audio, 
        min_silence_len=min_silence_len_ms, 
        silence_thresh=silence_thresh_db
    )
    
    # Process ranges: apply padding and filter invalid ranges
    processed_ranges = []
    for start_ms, end_ms in silent_ranges:
        # Apply padding (add to start, subtract from end)
        padded_start = start_ms + padding_ms
        padded_end = end_ms - padding_ms
        
        # Filter out invalid ranges (where end <= start after padding)
        if padded_end > padded_start:
            # Convert to seconds
            start_seconds = padded_start / 1000.0
            end_seconds = padded_end / 1000.0
            processed_ranges.append([start_seconds, end_seconds])
    
    # Convert to JSON and output
    json_output = json.dumps(processed_ranges)
    print(json_output)
    sys.stdout.flush()


if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("Usage: python silence_detector.py <file_path> <silence_thresh_db> <min_silence_len_ms> <padding_ms>", file=sys.stderr)
        sys.exit(1)
    
    file_path = sys.argv[1]
    silence_thresh_db = float(sys.argv[2])
    min_silence_len_ms = int(sys.argv[3])
    padding_ms = int(sys.argv[4])
    
    main(file_path, silence_thresh_db, min_silence_len_ms, padding_ms) 