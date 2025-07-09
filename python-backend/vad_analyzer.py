#!/usr/bin/env python3
"""
VAD-based Audio Analysis for Clean-Cut
Uses Silero VAD for accurate speech vs non-speech detection.
"""

import sys
import json
import numpy as np
from pathlib import Path
import torch
import torchaudio
from silero_vad import load_silero_vad, get_speech_timestamps, read_audio
from pydub import AudioSegment


def analyze_speech_with_vad(audio_file):
    """
    Use Silero VAD to detect speech segments and provide threshold suggestions.
    """
    print(f"Analyzing audio file with VAD: {audio_file}")
    
    # Load Silero VAD model
    print("Loading Silero VAD model...")
    model = load_silero_vad()
    
    # Read audio file 
    print("Reading audio file...")
    wav = read_audio(audio_file)
    
    # Also load with pydub for file info
    audio = AudioSegment.from_wav(audio_file)
    duration_s = len(audio) / 1000.0
    
    print(f"Duration: {duration_s:.1f}s")
    print(f"Sample rate: {audio.frame_rate}Hz")
    print(f"Channels: {audio.channels}")
    print(f"Bit depth: {audio.sample_width * 8}-bit")
    print()
    
    # Get speech timestamps using VAD
    print("Detecting speech segments with VAD...")
    speech_timestamps = get_speech_timestamps(
        wav, 
        model,
        min_speech_duration_ms=250,    # Minimum speech segment duration
        min_silence_duration_ms=200,   # Minimum silence gap duration  
        return_seconds=True
    )
    
    print(f"Detected {len(speech_timestamps)} speech segments")
    
    # Calculate duration statistics
    total_duration = len(wav) / 16000  # VAD expects 16kHz
    
    speech_duration = sum(
        segment['end'] - segment['start'] 
        for segment in speech_timestamps
    )
    silence_duration = total_duration - speech_duration
    
    # Analyze silence gaps (what we want to remove)
    silence_segments = []
    if speech_timestamps:
        # Silence before first speech
        if speech_timestamps[0]['start'] > 0.1:  # Only if > 100ms
            silence_segments.append({
                'start': 0,
                'end': speech_timestamps[0]['start'],
                'duration': speech_timestamps[0]['start']
            })
        
        # Silence between speech segments  
        for i in range(len(speech_timestamps) - 1):
            gap_start = speech_timestamps[i]['end']
            gap_end = speech_timestamps[i + 1]['start']
            gap_duration = gap_end - gap_start
            if gap_duration > 0.1:  # Only gaps > 100ms
                silence_segments.append({
                    'start': gap_start,
                    'end': gap_end,
                    'duration': gap_duration
                })
        
        # Silence after last speech
        if speech_timestamps[-1]['end'] < total_duration - 0.1:  # Only if > 100ms
            silence_segments.append({
                'start': speech_timestamps[-1]['end'],
                'end': total_duration,
                'duration': total_duration - speech_timestamps[-1]['end']
            })
    
    # Calculate average gap sizes for threshold suggestions
    if silence_segments:
        gap_durations = [seg['duration'] for seg in silence_segments]
        avg_gap = np.mean(gap_durations)
        median_gap = np.median(gap_durations)
        min_gap = min(gap_durations)
        max_gap = max(gap_durations)
    else:
        avg_gap = median_gap = min_gap = max_gap = 0
    
    print("=== VAD ANALYSIS RESULTS ===")
    print(f"Total duration: {total_duration:.1f}s")
    print(f"Speech duration: {speech_duration:.1f}s ({speech_duration/total_duration*100:.1f}%)")
    print(f"Silence duration: {silence_duration:.1f}s ({silence_duration/total_duration*100:.1f}%)")
    print(f"Speech segments: {len(speech_timestamps)}")
    print(f"Silence gaps: {len(silence_segments)}")
    if silence_segments:
        print(f"Average gap: {avg_gap:.1f}s")
        print(f"Gap range: {min_gap:.1f}s to {max_gap:.1f}s")
    print()
    
    # Analyze actual audio levels for meaningful threshold suggestions
    print("Analyzing audio levels for threshold suggestions...")
    
    # Convert audio to numpy array for level analysis
    audio_array = np.array(audio.get_array_of_samples())
    if audio.channels == 2:
        audio_array = audio_array.reshape((-1, 2)).mean(axis=1)  # Convert stereo to mono
    
    # Calculate RMS levels in dB for frames
    frame_size = int(audio.frame_rate * 0.02)  # 20ms frames
    db_levels = []
    
    for i in range(0, len(audio_array), frame_size):
        frame = audio_array[i:i + frame_size].astype(np.float64)
        if len(frame) > 0:
            rms = np.sqrt(np.mean(frame ** 2))
            if rms > 0:
                # Normalize based on bit depth
                if audio.sample_width == 1:
                    max_val = 128
                elif audio.sample_width == 2:
                    max_val = 32768
                elif audio.sample_width == 4:
                    max_val = 2147483648
                else:
                    max_val = 32768
                    
                db_level = 20 * np.log10(rms / max_val)
                db_levels.append(db_level)
            else:
                db_levels.append(-80)  # Very quiet
    
    db_levels = np.array(db_levels)
    
    # Calculate statistics
    min_db = float(np.min(db_levels))
    max_db = float(np.max(db_levels))
    mean_db = float(np.mean(db_levels))
    median_db = float(np.median(db_levels))
    std_db = float(np.std(db_levels))
    
    # Calculate percentiles
    percentiles = {
        '10th': float(np.percentile(db_levels, 10)),
        '25th': float(np.percentile(db_levels, 25)),
        '75th': float(np.percentile(db_levels, 75)),
        '90th': float(np.percentile(db_levels, 90)),
        '95th': float(np.percentile(db_levels, 95))
    }
    
    print(f"Audio level analysis:")
    print(f"  Range: {min_db:.1f} to {max_db:.1f} dB")
    print(f"  Mean: {mean_db:.1f} dB, Median: {median_db:.1f} dB")
    print(f"  25th percentile: {percentiles['25th']:.1f} dB")
    print(f"  75th percentile: {percentiles['75th']:.1f} dB")
    
    # Generate intelligent threshold suggestions based on actual audio levels
    # Speech typically ranges from 25th to 75th percentile
    speech_floor = percentiles['25th']  # Bottom of speech range
    speech_range = percentiles['75th'] - percentiles['25th']
    
    suggestions = {
        'vad_recommended': {
            'threshold': -35,  # VAD uses AI detection, threshold is just for UI
            'description': 'AI-powered speech detection (recommended)'
        },
        'conservative': {
            'threshold': round(speech_floor - speech_range * 0.3),  # Well below speech
            'description': 'Conservative - keeps more borderline speech'
        },
        'moderate': {
            'threshold': round(speech_floor - speech_range * 0.1),  # Just below speech floor
            'description': 'Moderate - balanced speech/silence removal'
        },
        'aggressive': {
            'threshold': round(speech_floor + speech_range * 0.2),  # Into speech range
            'description': 'Aggressive - removes more quiet speech sections'
        }
    }
    
    print("=== SUGGESTED APPROACH ===")
    print("VAD Recommended: Use AI speech detection (most accurate)")
    print("This analysis detected speech vs non-speech areas directly")
    print("Energy thresholds are less reliable than AI detection")
    print()
    
    # Create impact analysis based on actual audio levels
    silence_percentage = (silence_duration / total_duration) * 100
    
    # Calculate how much would be cut at different thresholds
    impact_analysis = {}
    test_thresholds = [-60, -50, -40, -30, -20]
    
    for threshold in test_thresholds:
        # Estimate percentage that would be cut based on audio level distribution
        frames_below_threshold = np.sum(db_levels < threshold)
        percentage_below = (frames_below_threshold / len(db_levels)) * 100
        
        # Combine with VAD-detected silence for more accurate estimate
        estimated_cut = min(95, percentage_below * 0.7 + silence_percentage * 0.3)
        impact_analysis[str(threshold)] = round(estimated_cut, 1)
    
    # Output structured data for the main application
    output_data = {
        'file_info': {
            'duration_seconds': duration_s,
            'sample_rate': audio.frame_rate,
            'channels': audio.channels,
            'bit_depth': audio.sample_width * 8
        },
        'vad_results': {
            'speech_segments': speech_timestamps,
            'silence_segments': silence_segments,
            'speech_duration': speech_duration,
            'silence_duration': silence_duration,
            'speech_percentage': (speech_duration / total_duration) * 100,
            'confidence': 'high'
        },
        'statistics': {
            'min_db': min_db,
            'max_db': max_db,
            'mean_db': mean_db,
            'median_db': median_db,
            'std_db': std_db,
            'percentiles': percentiles
        },
        'suggestions': suggestions,
        'impact_analysis': impact_analysis,
        'analysis_method': 'vad',
        'vad_segments_detected': len(speech_timestamps),
        'removable_silence_duration': silence_duration
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
        print(f"Error analyzing audio: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main() 