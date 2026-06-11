# 🎮 EndPlays Quiz — Real-Time Multiplayer Quiz Platform

EndPlays Quiz is a high-fidelity, real-time multiplayer quiz game platform. Host trivia nights, competitive quizzes, or fun team-building games instantly with zero signups required. Created with an immersive, gamified user experience in mind, EndPlays features beautiful glassmorphic aesthetics, adaptive themes, interactive sound effects (SFX), and text-to-speech question narration.

---

## ✨ Features

- **⚡ Real-Time Multiplayer Sync**: Powered by `socket.io` for instantaneous synchronization of players, timers, answers, and leaderboards.
- **🧠 Diverse Question Formats**:
  - **MCQ (Multiple Choice)**: Standard 4-option trivia with randomized answer ordering.
  - **Reorder**: Scrambled item lists where players reorder sequences correctly.
  - **Typed & Fill in the Blank**: Open-ended questions featuring case-insensitive, trimmed, and white-space-normalized validation.
- **📈 Gamified Timing & Scoring**:
  - **Score Decay**: Quicker answers yield higher points (based on exact millisecond reaction times).
  - **Final Round Stakes**: The last question carries double the base points to enable dramatic comebacks.
  - **Live Leaderboard**: Displays scores, response times, ranks, and custom micro-animations.
- **🖼️ Rich Media Integration**:
  - Supports image attachments for any question.
  - Features **client-side HTML5 Canvas compression** (automatically resizes to a maximum of 800px width at 70% quality JPEG) before uploading via websockets, keeping server memory usage lightweight and networking lightning-fast.
- **🔊 Oscillator-Based Audio SFX**: Employs the HTML5 Web Audio API to synthesize retro game sound effects (join chime, answer locked, correct/incorrect tones, countdown tick, and final fanfare) without downloading heavy audio assets.
- **🎙️ Speech Narration**: Integrates the Web Speech API (`SpeechSynthesisUtterance`) to read out questions in real-time as they are typed out on the players' screens.
- **🎨 Premium Visual Experience**:
  - Curated HSL-tailored colors, gradients, and a sleek modern typography system (Fredoka).
  - **12 Custom Vector (SVG) Avatars** generated programmatically.
  - **12 Category-Specific Themes**: Adaptive backgrounds with floating emoji particles (Luffa, Geography, Tech, Sports, etc.).

---

## 🛠️ Tech Stack

### Frontend
- **React (v19)**: Component-driven reactive UI.
- **Socket.io Client**: Real-time websocket communication.
- **Web Audio API**: Client-side sound synthesizer.
- **Web Speech API**: In-browser text-to-speech narration.
- **CSS3 Variables & Keyframe Animations**: Smooth micro-interactions, floating backgrounds, and glassmorphic panels.

### Backend
- **Node.js**: Event-driven runtime.
- **Express**: HTTP server serving dynamically uploaded question images.
- **Socket.io**: Real-time event broadcasting and lobby/room orchestration.
- **CORS**: Configured for local networking and web hosting environments.

---

## 📁 Project Directory Structure

```
Endplays Quiz/
├── client/                      # React frontend application
│   ├── public/                  # Static assets
│   │   ├── favicon.png          # App icon
│   │   ├── index.html           # HTML template & SEO meta tags
│   │   └── manifest.json        # Progressive Web App metadata
│   ├── src/                     # React source files
│   │   └── App.jsx              # Main UI, sound engine, and sockets connection
│   ├── .env.example             # Frontend environment template
│   ├── package.json             # Frontend packages & scripts
│   └── vercel.json              # Vercel SPA rewrite settings
├── Server/                      # Node.js backend server
│   ├── server.js                # Core Socket.io event loop & image endpoint
│   ├── .env.example             # Backend environment template
│   └── package.json             # Server packages & scripts
└── README.md                    # Project documentation
```

---

## 🔌 Socket.io Events & API Protocol

### Player to Server Events (`emit`)
- `join_room`: `{ roomCode, playerName, avatarIndex }` — Adds a player to a lobby.
- `submit_answer`: `{ roomCode, answer, elapsedMs }` — Locks in a player's answer and calculates points using client-to-server latency check.
- `update_avatar`: `{ roomCode, avatarIndex }` — Updates player avatar in the lobby.

### Host to Server Events (`emit`)
- `create_room`: `{ hostName, questions, category, customCategory }` — Initializes a room with a 6-character random room code.
- `upload_image`: `{ roomCode, questionIndex, mimeType, data }` — Sends question-specific base64 image data to the server.
- `start_quiz`: `{ roomCode }` — Transitions the lobby into the live quiz.

### Server to Clients Events (`broadcast` / `emit`)
- `room_created`: `{ roomCode }` — Acknowledges room initialization to host.
- `join_success`: `{ roomCode, playerName, category, customCategory, avatarIndex, themeImageUrl }` — Syncs joining status.
- `player_joined`: `{ players: [...] }` — Broadcasts refreshed lobby rosters.
- `quiz_started`: `{ totalQuestions }` — Triggers client-side quiz introduction screen.
- `new_question`: `{ questionIndex, totalQuestions, text, options, timeLimit, imageUrl, qType }` — Starts question countdown and displays options.
- `timer_update`: `{ timeRemaining }` — Syncs the countdown timer.
- `question_result`: `{ correctAnswer, results: {...}, questionText, correctOrder }` — Displays answer stats and round results.
- `leaderboard_update`: `{ leaderboard, isLast }` — Shows podium rankings.
- `next_question_countdown`: `{ countdown }` — 5-second automatic next-round trigger.
- `quiz_finished`: `{ leaderboard }` — Ends quiz, displays the podium, and cleans up room resources.

---

## ⚙️ Configuration & Environment Setup

Both directories contain `.env.example` templates. Copy these to `.env` files to configure URLs and ports.

### Client Configuration (`client/.env`)
Create `client/.env` file:
```env
# URL of the backend node server (e.g. Render, Heroku or localhost)
# Falls back to standard localhost:3001 if left empty
REACT_APP_SERVER_URL=http://localhost:3001

# URL of the frontend deployment
REACT_APP_CLIENT_URL=http://localhost:3000
```

### Server Configuration (`Server/.env`)
Create `Server/.env` file:
```env
# Port on which the express and socket.io server runs
PORT=3001
```

---

## 🚀 Installation & Local Development

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (recommended version 16+ or LTS).

### 2. Setup Server
```bash
# Navigate to the Server folder
cd Server

# Install dependencies
npm install

# Start the server (runs on port 3001 by default)
npm start
```
The server will output: `EndPlays server on :3001`

### 3. Setup Client
Open a new terminal window:
```bash
# Navigate to the client folder
cd client

# Install dependencies
npm install

# Start the React development server
npm start
```
The client app will launch automatically at `http://localhost:3000`.

---

## 📈 Scoring Formula

Scores are computed securely on the server side using the formula:

$$Points = \text{basePoints} - \left( \text{elapsedMs} \times \frac{\text{basePoints}}{\text{totalTimeLimitMs}} \right)$$

Where:
- $\text{basePoints} = 1000$ (or $2000$ if it is the last question).
- Points are capped at a minimum of $0$.
- Scores are rounded to the nearest decimal place to prevent floating-point inaccuracies.
- Client-submitted reaction times are compared against a server-side timer with a $300\text{ms}$ network buffer for anti-cheat validation.

---

## 🌐 Production Deployments

### Server
- Deploy to platforms like **Render**, **Railway**, or **Heroku**.
- Ensure the `PORT` environment variable is mapped correctly.
- Set `maxHttpBufferSize` limits if hosting larger static files (the application uses `25e6` / 25MB for socket payloads).

### Client
- Deploy to platforms like **Vercel** or **Netlify**.
- Set the `REACT_APP_SERVER_URL` in the hosting environment's variables to point to your live backend server URL.
