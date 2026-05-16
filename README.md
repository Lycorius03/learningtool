# LearningTool

> Intelligent Paper Reading & Smart Quiz Practice — AI Powered, Locally Run.

A full-stack web application for academic paper reading with AI-assisted explanation, and adaptive quiz practice using the MFAW (Multi-Factor Adaptive Weighting) algorithm. Built with vanilla HTML/CSS/JS and Node.js. Zero framework dependencies.

---

## Table of Contents

- [What You Need](#what-you-need)
- [Quick Start (30 Seconds)](#quick-start-30-seconds)
- [Full Installation Guide](#full-installation-guide)
  - [Windows](#windows)
  - [macOS](#macos)
  - [Ubuntu / Debian](#ubuntu--debian)
  - [CentOS / RHEL / Fedora](#centos--rhel--fedora)
  - [Arch Linux](#arch-linux)
- [How to Get the Code](#how-to-get-the-code)
- [How to Configure](#how-to-configure)
- [How to Start the Server](#how-to-start-the-server)
- [How to Use the Application](#how-to-use-the-application)
- [CLI Tool Reference](#cli-tool-reference)
- [Docker Deployment](#docker-deployment)
- [Features in Detail](#features-in-detail)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [FAQ / Troubleshooting](#faq--troubleshooting)
- [License](#license)

---

## What You Need

| Software | Minimum Version | Why You Need It |
|---|---|---|
| **Node.js** | 20.0.0 or newer | Runs the web server |
| **npm** | 9.0.0 or newer | Installs dependencies (comes with Node.js) |
| **A web browser** | Chrome / Firefox / Edge (latest) | Opens the app |
| **Docker** (optional) | 24.0.0 or newer | Only if you want containerized deployment |
| **Git** (optional) | Any recent version | Only needed to clone the repository |

> **Don't have Node.js?** See the [Full Installation Guide](#full-installation-guide) below for step-by-step instructions for every operating system.

---

## Quick Start (30 Seconds)

If you already have Node.js 20+ installed:

**Windows:**
```
scripts\start.bat
```

**Linux / macOS:**
```bash
chmod +x scripts/*.sh scripts/learntool
./scripts/start.sh
```

Then open your browser and go to **http://localhost:3000**

---

## Full Installation Guide

These instructions assume you are starting from a completely fresh computer with nothing installed. Follow the section for your operating system.

### Windows

#### Step 1: Install Node.js

1. Open your web browser and go to: **https://nodejs.org**
2. Click the big green button on the left that says **"LTS"** (Long Term Support)
3. This downloads an installer file (e.g., `node-v20.x.x-x64.msi`)
4. Double-click the downloaded file to run the installer
5. Click **Next** through all the steps. Make sure the box that says **"Add to PATH"** is checked
6. Click **Install** and wait for it to finish
7. **Verify the installation:** Open the Start Menu, type `cmd`, and press Enter to open Command Prompt. Type:

```
node -v
```

You should see something like `v20.x.x`. Then type:

```
npm -v
```

You should see something like `10.x.x`. If both commands show version numbers, Node.js is installed correctly.

#### Step 2: Get the Code

See [How to Get the Code](#how-to-get-the-code).

#### Step 3: Configure and Start

Open Command Prompt in the `learningtool` folder, then:

```bat
copy .env.example .env
notepad .env
```

- In Notepad, find the line `DEEPSEEK_API_KEY=sk-your-deepseek-api-key`
- Replace `sk-your-deepseek-api-key` with your actual DeepSeek API key (get one free at https://platform.deepseek.com)
- Find `ADMIN_USERNAME=admin` and `ADMIN_PASSWORD=change_me_to_secure_password` — change the password
- Save and close Notepad

Then:

```bat
npm install
npm start
```

Open **http://localhost:3000** in your browser.

> **Alternative:** Just double-click `scripts\start.bat` in File Explorer. It handles everything automatically.

---

### macOS

#### Step 1: Install Homebrew (if you don't have it)

Open **Terminal** (press Cmd+Space, type "Terminal", press Enter). Paste this and press Enter:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Follow the on-screen instructions. When it finishes, close and reopen Terminal.

#### Step 2: Install Node.js

In Terminal:

```bash
brew install node@20
```

Verify:

```bash
node -v
npm -v
```

Both should show version numbers.

#### Step 3: Get the Code, Configure, Start

```bash
# Get the code (see "How to Get the Code" section)
cd learningtool
cp .env.example .env
nano .env    # Edit the config file — set DEEPSEEK_API_KEY, ADMIN_PASSWORD
npm install
npm start
```

Open **http://localhost:3000** in your browser.

---

### Ubuntu / Debian

#### Step 1: Install Node.js

Open **Terminal** and run:

```bash
# Add the Node.js repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js and npm
sudo apt-get install -y nodejs

# Verify
node -v
npm -v
```

#### Step 2: Get the Code, Configure, Start

```bash
cd learningtool
cp .env.example .env
nano .env      # Edit config — set DEEPSEEK_API_KEY, ADMIN_PASSWORD
npm install
npm start
```

Open **http://localhost:3000** in your browser.

---

### CentOS / RHEL / Fedora

```bash
# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Verify
node -v
npm -v

# Get code, configure, start
cd learningtool
cp .env.example .env
nano .env
npm install
npm start
```

---

### Arch Linux

```bash
# Install Node.js
sudo pacman -S nodejs npm

# Verify
node -v
npm -v

# Get code, configure, start
cd learningtool
cp .env.example .env
nano .env
npm install
npm start
```

---

## How to Get the Code

### Option A: Download ZIP (Easiest)

1. Go to **https://github.com/Lycorius03/learningtool**
2. Click the green **"Code"** button
3. Click **"Download ZIP"**
4. Extract the ZIP file to any folder (e.g., your Desktop)
5. Open a terminal/command prompt in that folder

### Option B: Git Clone

```bash
git clone https://github.com/Lycorius03/learningtool.git
cd learningtool
```

---

## How to Configure

The configuration file is `.env` in the project root. Copy the template first:

```bash
cp .env.example .env
```

Then edit `.env` with any text editor:

| Variable | What It Does | Required? | Example |
|---|---|---|---|
| `DEEPSEEK_API_KEY` | Your DeepSeek API key for AI features | **Yes** | `sk-abc123...` |
| `DEEPSEEK_BASE_URL` | DeepSeek API endpoint | No (default works) | `https://api.deepseek.com` |
| `ADMIN_USERNAME` | Admin login username | **Yes** | `admin` |
| `ADMIN_PASSWORD` | Admin login password | **Yes** | `my-secure-password` |
| `SESSION_SECRET` | Encryption key for login sessions | Recommended | Any random string |
| `PORT` | Which port the server runs on | No (default: 3000) | `8080` |

> **How to get a DeepSeek API key:** Go to https://platform.deepseek.com, sign up, and create an API key from the dashboard. DeepSeek offers free credits for new users.

> **Don't have a DeepSeek key?** You can also use any OpenAI-compatible API. After starting the app, go to Settings → Add Model and configure your own provider (OpenAI, Claude, Gemini, local LLM, etc.).

---

## How to Start the Server

### One-command (recommended)

**Windows:**
```bat
scripts\start.bat
```

**Linux / macOS:**
```bash
./scripts/start.sh
```

### Manual

```bash
npm install    # Only needed first time
npm start      # Or: node server.js
```

### CLI Tool

```bash
# Linux/macOS
./scripts/learntool start
./scripts/learntool start --port 8080 --verbose

# Windows
scripts\learntool.bat start
scripts\learntool.bat start --port 8080 --verbose
```

After starting, open **http://localhost:3000** in your browser. Press **Ctrl+C** in the terminal to stop.

---

## How to Use the Application

### First Visit

When you open http://localhost:3000, you'll see the **Start Page** with the LearningTool logo. Click **Start** to enter.

If you've used it before, you'll see your learning progress (papers read, questions done, days active).

Scroll down on the Start Page to see the features overview and quick start guide.

### Paper Reader

1. Click **Paper Reader** on the home page
2. Drag a PDF, DOCX, TXT, or MD file into the drop zone (or click to select)
3. The paper appears on the left. If you have AI configured, a summary is automatically generated
4. **Select text** in the paper to get AI explanations
5. Press **Tab** to switch focus between the paper and the AI panel
6. Type questions in the chat box at the bottom of the AI panel
7. Your chat history is saved — reopening the same paper restores your conversation

### Smart Quiz

1. Click **Smart Quiz** on the home page
2. Choose a mode: **Sequential** (in order), **Weighted Shuffle** (adaptive), or **Error Book** (review mistakes)
3. Import a quiz file:
   - **JSON files**: Import directly
   - **DOCX / MD / PDF / TXT / JSON files**: Use the **AI Convert** button to auto-generate quiz questions
4. Click **Start Quiz** to begin
5. Select answers with mouse or keyboard (keys 1-4)
6. Use **Prev / Jump to / Next** to navigate between questions
7. **Skip** counts as unanswered (not wrong)
8. **Redo** restarts the session; **Reset Data** clears all progress

### Settings

- **AI Model Management**: Add your own AI provider (OpenAI, DeepSeek, Claude, Gemini, etc.). Test connection to verify.
- **Quiz Algorithm Parameters**: Tune the MFAW algorithm (alpha, beta, gamma, delta, EMA, lambda)
- **Appearance**: Toggle light/dark theme (also available via sun/moon button in top-right corner)
- **Language**: Toggle English/Chinese via the EN/中文 pill in top-left corner
- **Data Management**: Export your data as a JSON backup file. Import to restore.

### Theme Switching

Click the **sun/moon icon** in the top-right corner to toggle between light (classical manuscript) and dark (tech celestial) themes. The transition features animated light beams and meteors.

### Language Switching

Click the **EN/中文** pill in the top-left corner to switch between English and Chinese. All interface text updates automatically.

---

## CLI Tool Reference

The `learntool` command is located at `scripts/learntool` (Linux/macOS) or `scripts/learntool.bat` (Windows).

### Commands

| Command | What It Does |
|---|---|
| `start` | Start the server (this is the default) |
| `stop` | Stop a running server |
| `status` | Check if the server is running |
| `install` | Install npm dependencies |
| `docker-start` | Start via Docker Compose |
| `docker-stop` | Stop Docker containers |
| `docker-build` | Build the Docker image |

### Options

| Option | What It Does |
|---|---|
| `-p, --port <number>` | Set the port (default: 3000) |
| `-d, --dev` | Development mode |
| `-v, --verbose` | Show detailed request logs |
| `--skip-env` | Skip .env file check |
| `-h, --help` | Show help |

### Examples

```bash
# Start on default port 3000
./scripts/learntool start

# Start on port 8080 with verbose logging
./scripts/learntool --port 8080 --verbose

# Check if server is running
./scripts/learntool status

# Stop the server
./scripts/learntool stop
```

### Make It Available Everywhere (Linux/macOS)

Add this line to your `~/.bashrc` or `~/.zshrc`:

```bash
export PATH="$PATH:/path/to/learningtool/scripts"
```

Then you can just type `learntool start` from any directory.

---

## Docker Deployment

### Install Docker First

**Windows:** Download from https://www.docker.com/products/docker-desktop

**macOS:** `brew install --cask docker` (or download from docker.com)

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

**CentOS/RHEL/Fedora:**
```bash
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl start docker
sudo systemctl enable docker
```

### Build and Run

```bash
cd learningtool

# Build the Docker image
docker build -t learntool:latest .

# Start the container (in the background)
docker compose up -d

# Check it's running
docker compose ps

# View logs
docker compose logs -f

# Stop
docker compose down
```

### Port Mapping

The app runs on port 3000 inside the container. Docker maps it to your computer's port 3000 by default.

To use a different port, either:
- Edit `.env` and set `PORT=8080`, then run `docker compose up -d`
- Or run directly: `docker run -p 9090:3000 learntool:latest`

Then open **http://localhost:9090** (or whatever port you chose).

---

## Features in Detail

### Paper Reading
- **Supported formats**: PDF, DOCX, TXT, Markdown, JSON
- **Original document display**: PDFs render natively; text formats display with pagination
- **AI explanation**: Select any text to get instant AI analysis
- **AI chat**: Full conversation with streaming responses
- **Import explanation document**: Upload your own companion notes to view alongside the paper
- **Tab key**: Switch focus between paper and explanation panels
- **Paper library**: Previously imported papers are saved and can be reopened with one click
- **Chat history**: Conversations are persisted and restored when you reopen a paper
- **Auto-summary**: AI automatically generates a detailed paper summary on first import
- **Annotation**: Highlight and annotate text; export as Markdown

### Quiz Practice
- **Three modes**:
  - **Sequential**: Questions in order, ideal for first-pass learning
  - **Weighted Shuffle**: MFAW algorithm adaptively sorts questions based on your performance
  - **Error Book**: Review only questions you got wrong
- **Navigation**: Previous/Next buttons, jump to any question number
- **Skip**: Questions you skip count as unanswered, not wrong
- **Redo**: Restart the current session
- **Reset Data**: Clear all progress for a question set
- **Keyboard support**: Press 1-4 to select answers
- **Multi-set management**: Load multiple question banks, switch between them
- **AI conversion**: Upload DOCX/MD/PDF/TXT/JSON files and AI auto-generates quiz questions
- **Statistics**: Per-session accuracy, time tracking

### AI Engine
- **Bring your own key**: Any OpenAI-compatible API works
- **Built-in presets**: OpenAI, DeepSeek, Anthropic Claude, Google Gemini, Groq, SiliconFlow, Qwen, Zhipu, Ollama, and more
- **Auto URL fill**: Select a provider and the API URL fills automatically
- **Connection test**: Verify your API key works before saving
- **Model discovery**: Automatically fetches available models from your provider
- **Streaming**: AI responses stream in real-time via SSE

### Data & Privacy
- **Everything is local**: All data stored in your browser's localStorage
- **No cloud**: No accounts, no servers, no telemetry
- **Backup**: Export all your data as a JSON file
- **Restore**: Import a backup to recover your progress

---

## Project Structure

```
learningtool/
├── index.html                    # App entry point (SPA shell)
├── server.js                     # Express web server
├── package.json                  # Dependencies list
├── .env.example                  # Configuration template
├── Dockerfile                    # Docker image definition
├── docker-compose.yml            # Docker Compose config
├── README.md                     # This file
├── LICENSE                       # MIT license
├── src/                          # Frontend source code
│   ├── css/                      # Stylesheets
│   │   ├── design-tokens.css     #   Color palette, typography, spacing
│   │   ├── animations.css        #   Keyframe animations
│   │   ├── shell.css             #   Page layout, custom cursor, toggles
│   │   └── components.css        #   Buttons, cards, forms, modals, chat
│   ├── js/                       # JavaScript modules (ES Modules)
│   │   ├── app.js                #   Entry point
│   │   ├── router.js             #   Hash-based SPA router
│   │   ├── state.js              #   Global state management
│   │   ├── modules/              #   Feature modules
│   │   │   ├── paper-reader/     #     Paper reader (core, AI panel, viewer, annotations)
│   │   │   ├── quiz/             #     Quiz engine (core, sequential, weighted, error book)
│   │   │   ├── admin/            #     Admin login entrance
│   │   │   └── settings-core.js  #     Settings page logic
│   │   ├── services/             #   Frontend services
│   │   │   ├── ai-engine.js      #     AI API client
│   │   │   ├── api-keys.js       #     Encrypted key storage
│   │   │   ├── file-parser.js    #     File reading and parsing
│   │   │   └── storage.js        #     localStorage wrapper
│   │   └── utils/                #   Utility functions
│   │       ├── alias-method.js   #     O(1) weighted random sampling
│   │       ├── crypto.js         #     AES-GCM encryption
│   │       ├── mfaw.js           #     MFAW algorithm
│   │       └── toast.js          #     Toast notifications
│   └── views/                    # HTML view templates
│       ├── start.html            #   Landing / welcome page
│       ├── home.html             #   Main navigation
│       ├── reader.html           #   Paper reader layout
│       ├── quiz.html             #   Quiz mode selection + import
│       ├── quiz-session.html     #   Active quiz session
│       ├── template.html         #   Quiz JSON template reference
│       └── settings.html         #   Settings page
├── server/                       # Backend source code
│   ├── routes/                   # API route handlers
│   │   ├── admin.js              #   POST /login, GET /status, POST /logout
│   │   ├── ai.js                 #   POST /generate, /chat, /test-connection, /convert-to-quiz
│   │   └── files.js              #   POST /upload, GET /view/*, POST /export-annotations
│   ├── middleware/               # Express middleware
│   │   └── auth.js               #   Session-based admin authentication
│   └── services/                 # Backend services
│       ├── ai-provider.js        #   AI API wrapper (OpenAI-compatible)
│       ├── doc-parser.js         #   PDF text extraction
│       └── verifier.js           #   AI output verification
├── scripts/                      # Automation scripts
│   ├── start.bat                 #   Windows one-click startup
│   ├── start.sh                  #   Linux/macOS one-click startup
│   ├── learntool                 #   CLI tool (Linux/macOS)
│   ├── learntool.bat             #   CLI tool (Windows)
│   ├── docker-up.sh              #   Docker Compose startup
│   ├── docker-down.sh            #   Docker Compose shutdown
│   ├── docker-build.sh           #   Docker image build
│   ├── package.sh                #   Create tar.gz distribution
│   └── wsl2-test.sh              #   WSL2 compatibility test
└── data/                         # Runtime data (gitignored, created automatically)
    ├── uploads/                  #   Uploaded files
    ├── ai-logs/                  #   AI output logs
    └── logs/                     #   Server logs
```

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | HTML5, CSS3, JavaScript (ES Modules) | Zero framework, zero build step |
| Backend | Node.js + Express.js | REST API + SSE streaming |
| Auth | express-session | Server-side sessions, httpOnly cookies |
| Encryption | Web Crypto API (AES-GCM) | Client-side API key encryption |
| AI | OpenAI-compatible API | Multi-provider support via user configuration |
| Container | Docker + Docker Compose | Single-command deployment |
| Fonts | DM Sans, Playfair Display, DM Mono | Google Fonts |
| Design | CSS custom properties | Light/dark theme via CSS variables |

---

## FAQ / Troubleshooting

### "Port 3000 is already in use"

Something else is using port 3000. Either:
- Stop the other program, or
- Use a different port: `PORT=8080 npm start`

### "npm install fails"

```bash
# Clear cache and retry
npm cache clean --force
rm -rf node_modules package-lock.json
npm install

# If you're in China, use the mirror:
npm config set registry https://registry.npmmirror.com
npm install
```

### "AI features don't work"

1. Make sure you set `DEEPSEEK_API_KEY` in `.env` (not the placeholder value)
2. Or go to Settings → Add Model and add your own API key
3. Click "Test Connection" to verify it works

### "PDF won't display"

Make sure `pdf-parse` is installed:
```bash
npm install pdf-parse
```

### "I see Chinese text when language is set to English"

Click the EN/中文 toggle twice to re-sync. This is a known issue being fixed.

### "How do I reset everything?"

In Settings → Data Management → Clear All Data. Or clear your browser's localStorage for localhost:3000.

### "Can I use this without AI?"

Yes — the paper reader displays documents and the quiz works without AI. AI is only needed for explanations, chat, and quiz generation.

### "Is my data safe?"

All data is stored only in your browser. Nothing is sent to any server except the AI API calls (which go directly to your configured AI provider). There are no analytics, no tracking, no accounts.

---

## License

MIT — see [LICENSE](LICENSE)
