#!/usr/bin/env python3
"""
Audio Analysis Tool for Clean-Cut
Analyzes audio levels to help pick optimal silence thresholds.
"""

import sys
import json
import numpy as np
import matplotlib.pyplot as plt
from pydub import AudioSegment
from pathlib import Path


def analyze_audio_levels(audio, frame_size_ms=100):
    """
    Analyze audio levels across the entire file.
    """
    frame_size_samples = int(audio.frame_rate * frame_size_ms / 1000)
    hop_size_samples = frame_size_samples // 2
    
    audio_array = np.array(audio.get_array_of_samples())
    
    # Handle stereo
    if audio.channels == 2:
        audio_array = audio_array.reshape((-1, 2)).mean(axis=1)
    
    db_levels = []
    timestamps = []
    
    for i in range(0, len(audio_array) - frame_size_samples, hop_size_samples):
        frame = audio_array[i:i + frame_size_samples]
        
        # Calculate RMS energy
        rms = np.sqrt(np.mean(frame.astype(np.float64) ** 2))
        
        # Convert to dB
        if rms > 0:
            max_val = 32768 if audio.sample_width == 2 else 128
            db_level = 20 * np.log10(rms / max_val)
        else:
            db_level = -80
            
        timestamp_seconds = (i / audio.frame_rate)
        db_levels.append(db_level)
        timestamps.append(timestamp_seconds)
    
    return timestamps, db_levels


def calculate_statistics(db_levels):
    """
    Calculate useful statistics about the audio levels.
    """
    db_array = np.array(db_levels)
    
    stats = {
        'min_db': np.min(db_array),
        'max_db': np.max(db_array),
        'mean_db': np.mean(db_array),
        'median_db': np.median(db_array),
        'std_db': np.std(db_array),
        'percentiles': {
            '10th': np.percentile(db_array, 10),
            '25th': np.percentile(db_array, 25),
            '75th': np.percentile(db_array, 75),
            '90th': np.percentile(db_array, 90),
            '95th': np.percentile(db_array, 95)
        }
    }
    
    return stats


def suggest_thresholds(stats):
    """
    Suggest good threshold values based on audio content.
    """
    mean_db = stats['mean_db']
    std_db = stats['std_db']
    percentiles = stats['percentiles']
    
    suggestions = {
        'conservative': {
            'threshold': min(-50, percentiles['10th'] - 5),
            'description': 'Very quiet sections only (conservative)'
        },
        'moderate': {
            'threshold': min(-40, mean_db - 1.5 * std_db),
            'description': 'Typical silence detection (moderate)'
        },
        'aggressive': {
            'threshold': min(-30, mean_db - std_db),
            'description': 'Remove more quiet sections (aggressive)'
        },
        'custom_percentile': {
            'threshold': percentiles['25th'],
            'description': 'Bottom 25% of audio levels'
        }
    }
    
    return suggestions


def create_histogram(db_levels, output_path=None):
    """
    Create a histogram showing the distribution of dB levels.
    """
    plt.figure(figsize=(12, 6))
    
    # Create histogram
    plt.subplot(1, 2, 1)
    plt.hist(db_levels, bins=50, alpha=0.7, color='blue', edgecolor='black')
    plt.xlabel('dB Level')
    plt.ylabel('Frequency')
    plt.title('Distribution of Audio Levels')
    plt.grid(True, alpha=0.3)
    
    # Add percentile lines
    percentiles = [10, 25, 50, 75, 90]
    colors = ['red', 'orange', 'green', 'orange', 'red']
    for p, color in zip(percentiles, colors):
        value = np.percentile(db_levels, p)
        plt.axvline(value, color=color, linestyle='--', alpha=0.7, 
                   label=f'{p}th percentile: {value:.1f}dB')
    
    plt.legend()
    
    # Create timeline plot
    plt.subplot(1, 2, 2)
    timestamps = np.arange(len(db_levels)) * 0.05  # Assuming 50ms frames
    plt.plot(timestamps, db_levels, alpha=0.6, linewidth=0.5)
    plt.xlabel('Time (seconds)')
    plt.ylabel('dB Level')
    plt.title('Audio Levels Over Time')
    plt.grid(True, alpha=0.3)
    
    # Add suggested threshold lines
    mean_db = np.mean(db_levels)
    std_db = np.std(db_levels)
    conservative = min(-50, np.percentile(db_levels, 10) - 5)
    moderate = min(-40, mean_db - 1.5 * std_db)
    
    plt.axhline(conservative, color='green', linestyle='--', alpha=0.7, 
               label=f'Conservative: {conservative:.1f}dB')
    plt.axhline(moderate, color='orange', linestyle='--', alpha=0.7,
               label=f'Moderate: {moderate:.1f}dB')
    
    plt.legend()
    plt.tight_layout()
    
    if output_path:
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        print(f"Histogram saved to: {output_path}")
    else:
        plt.show()


def main():
    if len(sys.argv) < 2:
        print("Usage: python audio_analyzer.py <audio_file> [--plot] [--output-dir]")
        print("  --plot: Generate visual plots")
        print("  --output-dir: Directory to save plots")
        sys.exit(1)
    
    audio_file = sys.argv[1]
    show_plot = '--plot' in sys.argv
    
    # Get output directory
    output_dir = None
    if '--output-dir' in sys.argv:
        idx = sys.argv.index('--output-dir')
        if idx + 1 < len(sys.argv):
            output_dir = sys.argv[idx + 1]
    
    try:
        print(f"Analyzing audio file: {audio_file}")
        
        # Load audio
        audio = AudioSegment.from_wav(audio_file)
        duration_s = len(audio) / 1000.0
        
        print(f"Duration: {duration_s:.1f}s")
        print(f"Sample rate: {audio.frame_rate}Hz")
        print(f"Channels: {audio.channels}")
        print(f"Bit depth: {audio.sample_width * 8}-bit")
        print()
        
        # Analyze levels
        print("Analyzing audio levels...")
        timestamps, db_levels = analyze_audio_levels(audio)
        
        # Calculate statistics
        stats = calculate_statistics(db_levels)
        
        print("=== AUDIO LEVEL STATISTICS ===")
        print(f"Minimum level: {stats['min_db']:.1f} dB")
        print(f"Maximum level: {stats['max_db']:.1f} dB")
        print(f"Mean level: {stats['mean_db']:.1f} dB")
        print(f"Median level: {stats['median_db']:.1f} dB")
        print(f"Standard deviation: {stats['std_db']:.1f} dB")
        print()
        
        print("=== PERCENTILES ===")
        for percentile, value in stats['percentiles'].items():
            print(f"{percentile}: {value:.1f} dB")
        print()
        
        # Generate threshold suggestions
        suggestions = suggest_thresholds(stats)
        
        print("=== SUGGESTED THRESHOLDS ===")
        for name, suggestion in suggestions.items():
            threshold = suggestion['threshold']
            description = suggestion['description']
            print(f"{name.title()}: {threshold:.1f} dB - {description}")
        print()
        
        # Calculate what percentage would be cut at different thresholds
        print("=== THRESHOLD IMPACT ANALYSIS ===")
        test_thresholds = [-60, -50, -40, -30, -20]
        for threshold in test_thresholds:
            percentage = (np.array(db_levels) < threshold).mean() * 100
            print(f"Threshold {threshold} dB: {percentage:.1f}% of audio would be considered 'quiet'")
        print()
        
        # Output JSON for programmatic use
        output_data = {
            'file_info': {
                'duration_seconds': duration_s,
                'sample_rate': audio.frame_rate,
                'channels': audio.channels,
                'bit_depth': audio.sample_width * 8
            },
            'statistics': stats,
            'suggestions': suggestions,
            'impact_analysis': {
                str(t): float((np.array(db_levels) < t).mean() * 100) 
                for t in test_thresholds
            }
        }
        
        # Save JSON output
        if output_dir:
            Path(output_dir).mkdir(parents=True, exist_ok=True)
            json_path = Path(output_dir) / f"{Path(audio_file).stem}_analysis.json"
            with open(json_path, 'w') as f:
                json.dump(output_data, f, indent=2)
            print(f"Analysis data saved to: {json_path}")
        
        # Create plots if requested
        if show_plot:
            plot_path = None
            if output_dir:
                plot_path = Path(output_dir) / f"{Path(audio_file).stem}_analysis.png"
            
            create_histogram(db_levels, plot_path)
        
        # Output JSON to stdout for Electron app
        print("JSON_OUTPUT_START")
        print(json.dumps(output_data))
        print("JSON_OUTPUT_END")
        
    except Exception as e:
        print(f"Error analyzing audio: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main() 