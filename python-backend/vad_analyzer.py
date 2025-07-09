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
    
    # Generate practical threshold suggestions based on VAD analysis
    # These are more for UI compatibility - the real detection is done by VAD
    suggestions = {
        'vad_recommended': {
            'threshold': -35,  # Arbitrary - VAD does the real work
            'description': 'AI-powered speech detection (recommended)'
        },
        'conservative': {
            'threshold': -45,
            'description': 'Conservative - keeps more borderline speech'
        },
        'moderate': {
            'threshold': -40, 
            'description': 'Moderate - balanced speech/silence removal'
        },
        'aggressive': {
            'threshold': -35,
            'description': 'Aggressive - removes more quiet speech sections'
        }
    }
    
    print("=== SUGGESTED APPROACH ===")
    print("VAD Recommended: Use AI speech detection (most accurate)")
    print("This analysis detected speech vs non-speech areas directly")
    print("Energy thresholds are less reliable than AI detection")
    print()
    
    # Create mock impact analysis for UI compatibility
    impact_analysis = {
        '-60': 0,  # VAD is much more precise than energy thresholds
        '-50': silence_duration/total_duration * 20,  # Conservative estimate
        '-40': silence_duration/total_duration * 60,  # Moderate estimate  
        '-30': silence_duration/total_duration * 100,  # Would cut all detected silences
        '-20': min(95, silence_duration/total_duration * 100 + 10)  # Aggressive
    }
    
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
            'min_db': -60,  # Mock values for UI compatibility
            'max_db': -5,
            'mean_db': -35,
            'median_db': -40,
            'std_db': 10,
            'percentiles': {
                '10th': -55,
                '25th': -50,
                '75th': -30,
                '90th': -20,
                '95th': -15
            }
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