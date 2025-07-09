#!/usr/bin/env python3
"""
VAD-based Silence Cutter for Clean-Cut
Uses Silero VAD for consistent speech detection in cutting workflow.
"""

import sys
import json
import numpy as np
from pathlib import Path
import torch
import torchaudio
from silero_vad import load_silero_vad, get_speech_timestamps, read_audio
from pydub import AudioSegment


def cut_silences_with_vad(audio_file, min_silence_duration_ms=200, padding_ms=100):
    """
    Use Silero VAD to detect silence segments for cutting.
    """
    print(f"Processing audio file with VAD: {audio_file}", file=sys.stderr)
    
    # Load Silero VAD model
    print("Loading Silero VAD model...", file=sys.stderr)
    model = load_silero_vad()
    
    # Read audio file 
    print("Reading audio file...", file=sys.stderr)
    wav = read_audio(audio_file)
    
    # Also load with pydub for file info
    audio = AudioSegment.from_wav(audio_file)
    duration_s = len(audio) / 1000.0
    
    print(f"Duration: {duration_s:.1f}s", file=sys.stderr)
    print(f"Sample rate: {audio.frame_rate}Hz", file=sys.stderr)
    print(f"Channels: {audio.channels}", file=sys.stderr)
    print()
    
    # Get speech timestamps using VAD
    print("Detecting speech segments with VAD...", file=sys.stderr)
    speech_timestamps = get_speech_timestamps(
        wav, 
        model,
        min_speech_duration_ms=250,    # Minimum speech segment duration
        min_silence_duration_ms=min_silence_duration_ms,   # Minimum silence gap duration  
        return_seconds=True
    )
    
    print(f"Detected {len(speech_timestamps)} speech segments", file=sys.stderr)
    
    # Calculate total duration
    total_duration = len(wav) / 16000  # VAD expects 16kHz
    
    # Generate silence regions (what we want to remove)
    silence_regions = []
    if speech_timestamps:
        # Silence before first speech
        if speech_timestamps[0]['start'] > 0.1:  # Only if > 100ms
            silence_regions.append({
                'start': 0,
                'end': speech_timestamps[0]['start']
            })
        
        # Silence between speech segments  
        for i in range(len(speech_timestamps) - 1):
            gap_start = speech_timestamps[i]['end']
            gap_end = speech_timestamps[i + 1]['start']
            gap_duration = gap_end - gap_start
            if gap_duration > 0.1:  # Only gaps > 100ms
                silence_regions.append({
                    'start': gap_start,
                    'end': gap_end
                })
        
        # Silence after last speech
        if speech_timestamps[-1]['end'] < total_duration - 0.1:  # Only if > 100ms
            silence_regions.append({
                'start': speech_timestamps[-1]['end'],
                'end': total_duration
            })
    
    print(f"Found {len(silence_regions)} silence regions for cutting", file=sys.stderr)
    
    # Apply padding (expand silence regions slightly to avoid cutting speech)
    padding_s = padding_ms / 1000.0
    padded_regions = []
    
    for region in silence_regions:
        padded_start = max(0, region['start'] - padding_s)
        padded_end = min(total_duration, region['end'] + padding_s)
        
        # Only include if still a meaningful duration after padding
        if padded_end - padded_start > 0.1:  # At least 100ms
            padded_regions.append([padded_start, padded_end])
    
    # Merge nearby regions to avoid tiny gaps
    if len(padded_regions) > 1:
        merged_regions = [padded_regions[0]]
        
        for current in padded_regions[1:]:
            last = merged_regions[-1]
            
            # Merge if regions are very close (within 0.5s)
            if current[0] - last[1] < 0.5:
                merged_regions[-1] = [last[0], max(last[1], current[1])]
            else:
                merged_regions.append(current)
        
        padded_regions = merged_regions
    
    print(f"Final regions for cutting: {len(padded_regions)}", file=sys.stderr)
    
    # Calculate total cut duration for stats
    total_cut_duration = sum(region[1] - region[0] for region in padded_regions)
    
    # Display cut regions
    for i, (start, end) in enumerate(padded_regions):
        duration = end - start
        print(f"  Region {i+1}: {start:.2f}s - {end:.2f}s ({duration:.2f}s)", file=sys.stderr)
    
    print(f"Total duration to cut: {total_cut_duration:.1f}s ({total_cut_duration/total_duration*100:.1f}% of audio)", file=sys.stderr)
    
    # Output JSON array for Electron app
    print(json.dumps(padded_regions))
    sys.stdout.flush()
    
    return padded_regions


def main():
    if len(sys.argv) < 5:
        print("Usage: python vad_cutter.py <audio_file> <silence_thresh_db> <min_silence_len_ms> <padding_ms>", file=sys.stderr)
        print("Note: silence_thresh_db is ignored (VAD uses AI), but kept for compatibility", file=sys.stderr)
        sys.exit(1)
    
    audio_file = sys.argv[1]
    silence_thresh_db = float(sys.argv[2])  # Ignored in VAD approach but kept for compatibility
    min_silence_len_ms = int(sys.argv[3])
    padding_ms = int(sys.argv[4])
    
    print(f"VAD-based silence cutting (silence_thresh_db {silence_thresh_db} ignored)", file=sys.stderr)
    
    try:
        cut_silences_with_vad(audio_file, min_silence_len_ms, padding_ms)
    except Exception as e:
        print(f"Error processing audio: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main() 