import sys
import json
import numpy as np
from pydub import AudioSegment
import webrtcvad


def resample_for_vad(audio):
    """
    WebRTC VAD requires specific sample rates: 8000, 16000, 32000, or 48000 Hz
    """
    target_rates = [48000, 32000, 16000, 8000]
    current_rate = audio.frame_rate
    
    # If already compatible, return as-is
    if current_rate in target_rates:
        return audio
    
    # Choose the closest higher rate, or highest if none higher
    for rate in target_rates:
        if rate >= current_rate:
            print(f"Resampling from {current_rate}Hz to {rate}Hz for VAD compatibility", file=sys.stderr)
            return audio.set_frame_rate(rate)
    
    # Fallback to 16kHz
    print(f"Resampling from {current_rate}Hz to 16000Hz for VAD compatibility", file=sys.stderr)
    return audio.set_frame_rate(16000)


def vad_analysis(audio, aggressiveness=1, frame_duration_ms=30):
    """
    Use WebRTC VAD to classify speech vs non-speech regions.
    """
    # Ensure mono audio
    if audio.channels > 1:
        audio = audio.set_channels(1)
    
    # Resample if needed
    audio = resample_for_vad(audio)
    
    # Initialize VAD
    vad = webrtcvad.Vad(aggressiveness)  # 0=least aggressive, 3=most aggressive
    
    sample_rate = audio.frame_rate
    frame_duration_samples = int(sample_rate * frame_duration_ms / 1000)
    
    # Get raw audio data
    audio_data = audio.raw_data
    
    # Process in fixed-size frames
    speech_frames = []
    
    for i in range(0, len(audio_data), frame_duration_samples * 2):  # *2 for 16-bit samples
        frame = audio_data[i:i + frame_duration_samples * 2]
        
        # VAD requires exact frame lengths
        if len(frame) < frame_duration_samples * 2:
            # Pad with zeros if needed
            frame += b'\x00' * (frame_duration_samples * 2 - len(frame))
        
        timestamp_ms = (i / 2) / sample_rate * 1000  # /2 because 16-bit = 2 bytes per sample
        
        try:
            is_speech = vad.is_speech(frame, sample_rate)
            speech_frames.append((timestamp_ms, is_speech))
        except Exception as e:
            # If frame processing fails, assume it's non-speech
            speech_frames.append((timestamp_ms, False))
    
    return speech_frames


def find_non_speech_regions(speech_frames, min_silence_ms=500, frame_duration_ms=30):
    """
    Convert VAD frame results into continuous non-speech regions.
    """
    if not speech_frames:
        return []
    
    non_speech_regions = []
    current_start = None
    min_frames = max(1, int(min_silence_ms / frame_duration_ms))
    
    # Group consecutive non-speech frames
    consecutive_non_speech = 0
    
    for timestamp_ms, is_speech in speech_frames:
        if not is_speech:
            if current_start is None:
                current_start = timestamp_ms
                consecutive_non_speech = 1
            else:
                consecutive_non_speech += 1
        else:
            # Speech detected - end current non-speech region if long enough
            if current_start is not None and consecutive_non_speech >= min_frames:
                end_time = timestamp_ms
                non_speech_regions.append((current_start, end_time))
            
            current_start = None
            consecutive_non_speech = 0
    
    # Handle final region if audio ends with non-speech
    if current_start is not None and consecutive_non_speech >= min_frames:
        final_timestamp = speech_frames[-1][0] + frame_duration_ms
        non_speech_regions.append((current_start, final_timestamp))
    
    return non_speech_regions


def main(file_path, silence_thresh_db, min_silence_len_ms, padding_ms, conservative_padding=False):
    """
    VAD-based silence detection using Google's WebRTC VAD.
    Note: silence_thresh_db is ignored in VAD approach (VAD has its own algorithms).
    """
    try:
        # Load audio
        audio = AudioSegment.from_wav(file_path)
        audio_duration_ms = len(audio)
        
        print(f"Analyzing audio: {audio_duration_ms/1000:.1f}s, {audio.frame_rate}Hz, {audio.channels} channels", file=sys.stderr)
        print("Using WebRTC VAD (Voice Activity Detection)", file=sys.stderr)
        print(f"Note: silence_thresh_db ({silence_thresh_db}) is ignored - VAD uses trained models", file=sys.stderr)
        
        # Use VAD to classify speech/non-speech frames
        # Higher aggressiveness = more likely to classify ambiguous audio as non-speech
        aggressiveness = 2  # 0-3, adjust based on your content
        speech_frames = vad_analysis(audio, aggressiveness=aggressiveness, frame_duration_ms=30)
        
        print(f"Analyzed {len(speech_frames)} VAD frames", file=sys.stderr)
        
        # Find non-speech regions
        non_speech_regions = find_non_speech_regions(
            speech_frames, 
            min_silence_ms=min_silence_len_ms, 
            frame_duration_ms=30
        )
        
        print(f"Found {len(non_speech_regions)} non-speech regions", file=sys.stderr)
        
        # Apply padding
        final_regions = []
        for start_ms, end_ms in non_speech_regions:
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
        
    except ImportError:
        print("Error: webrtcvad not installed. Install with: pip install webrtcvad", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("Usage: python silence_detector_vad.py <file_path> <silence_thresh_db> <min_silence_len_ms> <padding_ms>", file=sys.stderr)
        print("VAD-based approach using Google WebRTC VAD (silence_thresh_db is ignored)", file=sys.stderr)
        print("Install requirement: pip install webrtcvad", file=sys.stderr)
        sys.exit(1)
    
    file_path = sys.argv[1]
    silence_thresh_db = float(sys.argv[2])  # Ignored in VAD approach
    min_silence_len_ms = int(sys.argv[3])
    padding_ms = int(sys.argv[4])
    
    main(file_path, silence_thresh_db, min_silence_len_ms, padding_ms) 