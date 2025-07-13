#!/usr/bin/env python3
"""
Hybrid VAD and dB-based Silence Cutter for Clean-Cut
Uses Silero VAD for speech detection and a dB threshold for fine-tuning.
"""

import sys
import json
import numpy as np
from silero_vad import load_silero_vad, get_speech_timestamps, read_audio
from pydub import AudioSegment


def cut_silences_with_vad(audio_file, silence_thresh_db=-35, min_silence_duration_ms=200, padding_ms=150):
    """
    Use Silero VAD to find potential silences, then filter them by a dB threshold.
    """
    print(f"🔍 Processing audio file: {audio_file}", file=sys.stderr)
    
    # Load Silero VAD model and audio
    print("📥 Loading VAD model and audio...", file=sys.stderr)
    model = load_silero_vad()
    wav = read_audio(audio_file)
    audio = AudioSegment.from_wav(audio_file)
    
    # Get speech timestamps using VAD as a first pass
    print("🎤 Detecting speech segments...", file=sys.stderr)
    speech_timestamps = get_speech_timestamps(
        wav, 
        model,
        min_speech_duration_ms=250,
        min_silence_duration_ms=min_silence_duration_ms,
        return_seconds=True
    )
    
    # Generate potential silence regions from the gaps between speech
    total_duration = len(wav) / 16000  # VAD expects 16kHz
    potential_silences = []
    if speech_timestamps:
        # Silence before first speech
        if speech_timestamps[0]['start'] > 0:
            potential_silences.append({'start': 0, 'end': speech_timestamps[0]['start']})
        
        # Gaps between speech segments  
        for i in range(len(speech_timestamps) - 1):
            potential_silences.append({
                'start': speech_timestamps[i]['end'], 
                'end': speech_timestamps[i + 1]['start']
            })
        
        # Silence after last speech
        if speech_timestamps[-1]['end'] < total_duration:
            potential_silences.append({'start': speech_timestamps[-1]['end'], 'end': total_duration})
    
    # Filter these regions by the user-defined dB threshold
    print(f"🔍 Filtering regions with {silence_thresh_db}dB threshold...", file=sys.stderr)
    audio_array = np.array(audio.get_array_of_samples())
    if audio.channels == 2:
        audio_array = audio_array.reshape((-1, 2)).mean(axis=1)

    bit_depth_map = {1: 2**7, 2: 2**15, 4: 2**31}
    max_val = bit_depth_map.get(audio.sample_width, 2**15)
    
    silence_regions = []
    for region in potential_silences:
        start_sample = int(region['start'] * audio.frame_rate)
        end_sample = int(region['end'] * audio.frame_rate)
        segment_samples = audio_array[start_sample:end_sample]
        
        if len(segment_samples) == 0:
            continue
            
        rms = np.sqrt(np.mean(np.square(segment_samples.astype(np.float64))))
        db_level = 20 * np.log10(rms / max_val) if rms > 0 else -90.0
        
        if db_level < silence_thresh_db:
            silence_regions.append(region)
    
    # Apply padding to shorten the confirmed silence regions, creating a buffer.
    padding_s = padding_ms / 1000.0
    padded_regions = []
    
    for region in silence_regions:
        padded_start = region['start'] + padding_s
        padded_end = region['end'] - padding_s
        
        if padded_end > padded_start:
            padded_regions.append([padded_start, padded_end])
    
    # Merge nearby regions to avoid tiny cuts
    if len(padded_regions) > 1:
        merged_regions = [padded_regions[0]]
        
        for current in padded_regions[1:]:
            last = merged_regions[-1]
            if current[0] - last[1] < 0.5:
                merged_regions[-1] = [last[0], max(last[1], current[1])]
            else:
                merged_regions.append(current)
        
        padded_regions = merged_regions
    
    print(f"✅ Processing complete: {len(padded_regions)} silence regions found", file=sys.stderr)
    
    print(json.dumps(padded_regions))
    sys.stdout.flush()


def main():
    if len(sys.argv) < 5:
        print("Usage: python vad_cutter.py <audio_file> <silence_thresh_db> <min_silence_len_ms> <padding_ms>", file=sys.stderr)
        sys.exit(1)
    
    audio_file = sys.argv[1]
    silence_thresh_db = float(sys.argv[2])
    min_silence_len_ms = int(sys.argv[3])
    padding_ms = int(sys.argv[4])
    
    print(f"🎯 Using VAD + dB threshold ({silence_thresh_db}dB) for silence cutting", file=sys.stderr)
    
    try:
        cut_silences_with_vad(audio_file, silence_thresh_db, min_silence_len_ms, padding_ms)
    except Exception as e:
        print(f"❌ Error processing audio: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main() 