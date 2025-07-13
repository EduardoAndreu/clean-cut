#!/usr/bin/env python3
"""
VAD-based Audio Analysis for Clean-Cut
Uses Silero VAD for accurate speech vs non-speech detection.
"""

import sys
import json
import numpy as np
from silero_vad import load_silero_vad, get_speech_timestamps, read_audio
from pydub import AudioSegment


def analyze_speech_with_vad(audio_file):
    """
    Use Silero VAD to detect speech segments and provide a single threshold suggestion.
    """
    print(f"🔍 Analyzing audio file: {audio_file}", file=sys.stderr)
    
    # Load Silero VAD model and audio file.
    # VAD model expects 16kHz audio, read_audio handles resampling.
    print("📥 Loading VAD model and audio...", file=sys.stderr)
    model = load_silero_vad()
    wav = read_audio(audio_file)
    audio = AudioSegment.from_wav(audio_file)
    
    # Get speech timestamps from VAD
    print("🎤 Detecting speech segments...", file=sys.stderr)
    speech_timestamps = get_speech_timestamps(
        wav, 
        model,
        min_speech_duration_ms=250,
        min_silence_duration_ms=200,
        return_seconds=True
    )
    
    # Analyze audio levels and separate into speech/silence db lists in one pass
    print("📊 Analyzing audio levels...", file=sys.stderr)
    audio_array = np.array(audio.get_array_of_samples())
    if audio.channels == 2:
        audio_array = audio_array.reshape((-1, 2)).mean(axis=1)

    frame_size = int(audio.frame_rate * 0.02)  # 20ms frames
    speech_dbs = []
    silence_dbs = []

    # Map audio sample width (bytes) to the max value for normalization
    bit_depth_map = {1: 2**7, 2: 2**15, 4: 2**31}
    max_val = bit_depth_map.get(audio.sample_width, 2**15)

    for i in range(0, len(audio_array), frame_size):
        frame = audio_array[i:i + frame_size].astype(np.float64)
        if len(frame) == 0:
            continue

        # Calculate the frame's time to check if it's speech or silence
        frame_time = i / audio.frame_rate
        is_speech = any(seg['start'] <= frame_time < seg['end'] for seg in speech_timestamps)

        # Calculate dB level
        rms = np.sqrt(np.mean(frame**2))
        db_level = 20 * np.log10(rms / max_val) if rms > 0 else -80.0

        # Append to the correct list
        if is_speech:
            speech_dbs.append(db_level)
        else:
            silence_dbs.append(db_level)

    # Calculate the average dB for speech and silence
    avg_speech_db = float(np.mean(speech_dbs)) if speech_dbs else -25.0
    avg_silence_db = float(np.mean(silence_dbs)) if silence_dbs else -50.0

    # Suggest a threshold halfway between the average speech and silence levels
    vad_recommended_threshold = (avg_speech_db + avg_silence_db) / 2

    print(f"✅ Analysis complete: {len(speech_timestamps)} speech segments found", file=sys.stderr)
    print(f"🎯 Recommended threshold: {round(vad_recommended_threshold)}dB", file=sys.stderr)

    # The single, dynamic suggestion for the UI
    suggestions = {
        'vad_recommended': {
            'threshold': round(vad_recommended_threshold),
            'description': f'Midpoint between avg speech ({avg_speech_db:.0f}dB) and silence ({avg_silence_db:.0f}dB).'
        }
    }
    
    # Output structured data for the main application
    output_data = {
        'suggestions': suggestions,
        'analysis_method': 'vad'
    }
    
    # Output JSON for Electron app
    print("JSON_OUTPUT_START")
    print(json.dumps(output_data, indent=2))
    print("JSON_OUTPUT_END")
    
    return output_data


def main():
    if len(sys.argv) < 2:
        print("Usage: python vad_analyzer.py <audio_file>")
        sys.exit(1)
    
    audio_file = sys.argv[1]
    
    try:
        analyze_speech_with_vad(audio_file)
    except Exception as e:
        print(f"❌ Error analyzing audio: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main() 