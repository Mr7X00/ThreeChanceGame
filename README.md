# Three Chance Game

An online multiplayer guessing duel game for two players competing across separate devices in real time.

---

## Tech Stack

- **Frontend**: HTML5, CSS3, Bootstrap 5, Vanilla JavaScript
- **Backend**: Node.js
- **Server**: Express.js
- **Real-Time Communication**: Socket.IO
- **Iconography**: Bootstrap Icons (SVG) & Custom SVG Assets (Zero emojis)

---

## Project Structure

```
three-chance-game/
├── public/
│   ├── index.html       # Mobile-first responsive UI foundation
│   ├── css/
│   │   └── style.css    # Modern dark gaming theme & custom styling
│   ├── js/
│   │   └── game.js      # Client-side Socket.IO connection & UI handling
│   └── assets/
│       └── logo.svg     # Vector game emblem asset
├── server.js            # Express server & Socket.IO instance
├── package.json         # Project metadata and dependencies
├── .gitignore           # Ignored files and directories
└── README.md            # Documentation and setup instructions
```

---

## Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed (v16 or newer recommended).

### 1. Installation

Install project dependencies:

```bash
npm install
```

### 2. Run Application

Start the Express and Socket.IO server:

```bash
npm start
```

### 3. Open in Browser

Open your browser and navigate to:

```
http://localhost:3000
```

---

## Architecture & Current Phase Scope

This project phase implements the foundation:
- **Server**: Express.js configured to serve static assets from the `public/` directory.
- **Real-Time**: Socket.IO configured with connection and disconnection lifecycle logging.
- **Client Foundation**: Socket.IO client integration displaying real-time live connectivity status and socket ID.
- **Design System**: Responsive, mobile-first gaming interface engineered with dark glassmorphism, responsive player slots, chance indicator previews, and rule cards.
- **Clean Architecture**: Ready for upcoming phases (Room matchmaking, secret number selection, turn-based 3-chance guessing engine, and victory/defeat resolution).
