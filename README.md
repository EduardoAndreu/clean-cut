# Clean-Cut

Intelligent audio editing automation for Adobe Premiere Pro with silence detection, cutting, and other audio processing features.

## Prerequisites

- **Node.js** v22+
- **Python** 3.12+
- **Adobe Premiere Pro** 2025 (2022+ may work)

## Installation

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/clean-cut.git
cd clean-cut
npm install
```

### 2. Python Setup

```bash
cd python-backend
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### 3. Premiere Pro Extension Setup

**macOS:**

```bash
sudo mkdir -p "/Library/Application Support/Adobe/CEP/extensions"
sudo ln -s "/path/to/your/clean-cut/premiere-extension" "/Library/Application Support/Adobe/CEP/extensions/com.cleancut.panel"
```

**Windows:** (untested)

```cmd
mkdir "C:\Program Files (x86)\Common Files\Adobe\CEP\extensions"
mklink /D "C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\com.cleancut.panel" "C:\path\to\your\clean-cut\premiere-extension"
```

### 4. Enable CEP Debugging

**macOS:**

```bash
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
```

**Windows:** (untested)

```cmd
reg add "HKCU\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_DWORD /d 1
```

## Usage

1. Start the app: `npm run dev`
2. Open Premiere Pro with an active sequence
3. Go to **Window > Extensions > Clean-Cut**
4. Configure settings and process audio

## Build

```bash
npm run build:mac    # macOS
npm run build:win    # Windows (untested)
npm run build:linux  # Linux (untested)
```

## Troubleshooting

- **Extension not visible**: Verify symlink/link and restart Premiere Pro
- **Connection issues**: Ensure app is running (port 8085)
- **Processing errors**: Check Python virtual environment is activated

## License

MIT License - see [LICENSE](LICENSE) file.

---

**Note**: Developed and tested on macOS with Premiere Pro 2025. Windows/Linux compatibility not guaranteed.
