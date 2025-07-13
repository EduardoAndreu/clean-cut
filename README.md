# Clean-Cut

An intelligent audio editing tool that automatically detects and removes silence from Adobe Premiere Pro timelines using advanced Voice Activity Detection (VAD) technology.

Clean-Cut combines the power of Silero VAD with Premiere Pro's timeline editing capabilities to streamline your audio editing workflow.

## Features

- 🎤 **Advanced VAD Technology**: Uses Silero VAD for accurate speech vs silence detection
- ⚡ **Real-time Processing**: Live feedback during audio analysis and cutting
- 🎯 **Intelligent Thresholds**: AI-powered silence detection with manual fine-tuning
- 📊 **Flexible Range Selection**: Process entire sequences, in/out points, or selected clips
- 🔄 **Seamless Integration**: Direct integration with Premiere Pro timeline
- 🌓 **Modern UI**: Clean, responsive interface with dark/light mode support

## Prerequisites

- **macOS** (Windows support not tested)
- **Node.js** (v16 or higher)
- **Python** (3.8 or higher)
- **Adobe Premiere Pro** (2022 or later recommended)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/clean-cut.git
cd clean-cut
```

### 2. Install Node.js Dependencies

```bash
npm install
```

### 3. Set Up Python Backend

Navigate to the Python backend directory and set up a virtual environment:

```bash
cd python-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

### 4. Set Up Premiere Pro Extension

The Premiere Pro extension needs to be linked to Adobe's CEP extensions directory.

**Create the symlink** (replace the source path with your actual project path):

```bash
# Create the Adobe CEP extensions directory if it doesn't exist
sudo mkdir -p "/Library/Application Support/Adobe/CEP/extensions"

# Create a symlink to the premiere-extension folder
sudo ln -s "/path/to/your/clean-cut/premiere-extension" "/Library/Application Support/Adobe/CEP/extensions/com.cleancut.panel"
```

**Example** (replace with your actual path):

```bash
sudo ln -s "/Users/yourname/Documents/clean-cut/premiere-extension" "/Library/Application Support/Adobe/CEP/extensions/com.cleancut.panel"
```

### 5. Enable CEP Debugging (Required)

Premiere Pro extensions require debugging to be enabled:

```bash
# Enable CEP debugging
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
```

**Note**: The version number (11) might vary depending on your Premiere Pro version. Try different versions if needed:

- Premiere Pro 2024: `com.adobe.CSXS.12`
- Premiere Pro 2023: `com.adobe.CSXS.11`
- Premiere Pro 2022: `com.adobe.CSXS.10`

## Usage

### 1. Start the Application

```bash
npm run dev
```

This will start the Electron app in development mode.

### 2. Launch Premiere Pro

Open Adobe Premiere Pro and create or open a project with an active sequence.

### 3. Open the Clean-Cut Panel

In Premiere Pro, go to:
**Window > Extensions > Clean-Cut**

### 4. Connect and Process

1. The Clean-Cut extension panel should automatically connect to the main app
2. In the main app, click "Remove Silences" to access the processing interface
3. Configure your settings:
   - **Silence Threshold**: dB level for silence detection
   - **Minimum Silence Length**: Shortest silence to detect (ms)
   - **Padding**: Buffer around cuts (ms)
   - **Audio Tracks**: Select which tracks to process
   - **Range**: Choose entire sequence, in/out points, or selected clips
4. Click "Analyze Audio" to get VAD-based threshold recommendations
5. Click "Remove Silences" to process the timeline

## Building for Distribution

### Development Build

```bash
npm run dev
```

### Production Build

```bash
# For macOS
npm run build:mac

# For Linux (untested)
npm run build:linux
```

**Note**: Windows builds are not tested as the developer doesn't have access to a Windows machine.

## Architecture

Clean-Cut uses a three-tier architecture:

- **Electron App**: Main application with React UI and WebSocket server
- **Python Backend**: Silero VAD-based audio analysis engine
- **Premiere Pro Extension**: CEP extension for timeline integration

Communication flows through WebSocket connections and IPC for seamless integration.

## Troubleshooting

### Extension Not Appearing

- Verify the symlink was created correctly
- Check that CEP debugging is enabled
- Restart Premiere Pro after making changes
- Check Console for error messages

### Connection Issues

- Ensure the main app is running before opening the extension
- Check that WebSocket port (default: 8085) is not blocked
- Verify Python virtual environment is activated

### Audio Processing Errors

- Ensure audio tracks are present in the sequence
- Check that Python dependencies are installed correctly
- Verify the sequence has audio content to analyze

## Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Silero VAD**: For providing the excellent voice activity detection model
- **Adobe**: For the CEP (Common Extensibility Platform) framework
- **Electron**: For enabling cross-platform desktop applications

---

**Note**: This application is developed and tested on macOS. Windows compatibility is not guaranteed as the developer doesn't have access to a Windows machine for testing.
