const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// In-Memory Game Store & Helpers
// -------------------------------------------------------------
const games = new Map();
const socketToGame = new Map();

/**
 * Generate a unique 5-character alphanumeric game code.
 * Excludes ambiguous characters (0, O, 1, I).
 */
function generateGameCode() {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 5; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      code += characters.charAt(randomIndex);
    }
  } while (games.has(code));
  return code;
}

/**
 * Generate ONLY ONE random secret number between 1 and 6 inclusive
 * for the entire match.
 */
function generateSecretNumber() {
  if (process.env.TEST_SECRET_NUMBER) {
    const forced = parseInt(process.env.TEST_SECRET_NUMBER, 10);
    if (!isNaN(forced) && forced >= 1 && forced <= 6) return forced;
  }
  return Math.floor(Math.random() * 6) + 1;
}

/**
 * Sanitize game object for client consumption before match conclusion.
 * CRITICAL: Never exposes the secret number or opponent guesses before result calculation.
 */
function getSanitizedGame(game) {
  return {
    gameCode: game.gameCode,
    status: game.status,
    player1: game.player1 ? { name: game.player1.name, isHost: true } : null,
    player2: game.player2 ? { name: game.player2.name, isHost: false } : null,
    guesses: {
      player1Submitted: Boolean(game.guesses.player1 && game.guesses.player1.length === 3),
      player2Submitted: Boolean(game.guesses.player2 && game.guesses.player2.length === 3)
    },
    createdAt: game.createdAt
  };
}

/**
 * Sanitize and validate player name:
 * Strips HTML tags, trims whitespace, verifies length between 2 and 20.
 */
function sanitizePlayerName(rawName) {
  if (typeof rawName !== 'string') return null;
  // Disallow raw HTML / script tag characters
  if (/[<>{}]/.test(rawName)) return null;
  const trimmed = rawName.trim();
  if (trimmed.length < 2 || trimmed.length > 20) return null;
  return trimmed;
}

/**
 * Validate game code format (5 alphanumeric uppercase characters).
 */
function isValidGameCodeFormat(code) {
  if (typeof code !== 'string') return false;
  return /^[A-Z0-9]{5}$/.test(code.trim().toUpperCase());
}

/**
 * Authoritative Server-Side Result Calculation:
 * Evaluates the 4 strict cases after both players submit all three guesses:
 * CASE 1: Player 1 contains secret, Player 2 does NOT -> PLAYER 1 WINS
 * CASE 2: Player 2 contains secret, Player 1 does NOT -> PLAYER 2 WINS
 * CASE 3: Both players contain secret number          -> MATCH DRAW
 * CASE 4: Neither player contains secret number       -> MATCH FAILED (NO ONE WINS)
 */
function calculateGameResult(game) {
  const secret = game.secretNumber;
  const p1Guesses = game.guesses.player1;
  const p2Guesses = game.guesses.player2;

  const p1Success = p1Guesses.includes(secret);
  const p2Success = p2Guesses.includes(secret);

  let outcome = ''; // 'player1_wins' | 'player2_wins' | 'match_draw' | 'match_failed'
  let winner = null; // 'player1' | 'player2' | null
  let outcomeTitle = '';
  let outcomeSubtitle = '';

  if (p1Success && !p2Success) {
    outcome = 'player1_wins';
    winner = 'player1';
    outcomeTitle = 'PLAYER 1 WINS';
    outcomeSubtitle = `${game.player1.name} guessed the secret number correctly!`;
  } else if (p2Success && !p1Success) {
    outcome = 'player2_wins';
    winner = 'player2';
    outcomeTitle = 'PLAYER 2 WINS';
    outcomeSubtitle = `${game.player2.name} guessed the secret number correctly!`;
  } else if (p1Success && p2Success) {
    outcome = 'match_draw';
    winner = null;
    outcomeTitle = 'MATCH DRAW';
    outcomeSubtitle = 'Both players guessed the secret number.';
  } else {
    outcome = 'match_failed';
    winner = null;
    outcomeTitle = 'MATCH FAILED';
    outcomeSubtitle = 'Neither player guessed correctly.';
  }

  return {
    gameCode: game.gameCode,
    secretNumber: secret,
    outcome,
    winner,
    outcomeTitle,
    outcomeSubtitle,
    player1: {
      name: game.player1.name,
      guesses: p1Guesses,
      isSuccess: p1Success,
      correctGuess: p1Success ? secret : null
    },
    player2: {
      name: game.player2.name,
      guesses: p2Guesses,
      isSuccess: p2Success,
      correctGuess: p2Success ? secret : null
    }
  };
}

// -------------------------------------------------------------
// Socket.IO Real-Time Room & Event Handling
// -------------------------------------------------------------
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  /**
   * CREATE GAME (Player 1)
   */
  socket.on('create_game', (data, callback) => {
    try {
      const rawName = data && data.playerName ? data.playerName : '';
      const playerName = sanitizePlayerName(rawName);

      if (!playerName) {
        if (typeof callback === 'function') {
          return callback({
            success: false,
            message: 'Player name must be between 2 and 20 characters.'
          });
        }
        return;
      }

      // Check if this socket was already hosting or participating in a game
      const existingCode = socketToGame.get(socket.id);
      if (existingCode && games.has(existingCode)) {
        games.delete(existingCode);
        socket.leave(existingCode);
        socketToGame.delete(socket.id);
      }

      const gameCode = generateGameCode();

      const game = {
        gameCode,
        player1: {
          id: socket.id,
          name: playerName,
          isHost: true,
          ready: true
        },
        player2: null,
        status: 'waiting', // 'waiting' -> 'playing' -> 'finished'
        secretNumber: null, // Generated upon game initialization
        guesses: {
          player1: [],
          player2: []
        },
        playAgainReady: {
          player1: false,
          player2: false
        },
        result: null,
        createdAt: Date.now()
      };

      games.set(gameCode, game);
      socketToGame.set(socket.id, gameCode);
      socket.join(gameCode);

      console.log(`[Game Created] Code: ${gameCode} | Host (P1): "${playerName}" (${socket.id})`);

      if (typeof callback === 'function') {
        callback({
          success: true,
          gameCode,
          playerRole: 'player1',
          game: getSanitizedGame(game)
        });
      }
    } catch (err) {
      console.error('[Error in create_game]', err);
      if (typeof callback === 'function') {
        callback({ success: false, message: 'Server error creating game.' });
      }
    }
  });

  /**
   * JOIN GAME (Player 2)
   */
  socket.on('join_game', (data, callback) => {
    try {
      const rawName = data && data.playerName ? data.playerName : '';
      const playerName = sanitizePlayerName(rawName);

      if (!playerName) {
        if (typeof callback === 'function') {
          return callback({
            success: false,
            message: 'Player name must be between 2 and 20 characters.'
          });
        }
        return;
      }

      const rawCode = data && data.gameCode ? String(data.gameCode).trim().toUpperCase() : '';
      if (!rawCode || !isValidGameCodeFormat(rawCode)) {
        if (typeof callback === 'function') {
          return callback({
            success: false,
            message: 'Please enter a valid 5-character Game Code.'
          });
        }
        return;
      }

      // Check if this socket was already in an existing room
      const existingCode = socketToGame.get(socket.id);
      if (existingCode && existingCode !== rawCode && games.has(existingCode)) {
        socket.leave(existingCode);
        socketToGame.delete(socket.id);
      }

      // Check if game exists
      const game = games.get(rawCode);
      if (!game) {
        if (typeof callback === 'function') {
          return callback({
            success: false,
            message: `Game code "${rawCode}" was not found. Please verify with Player 1.`
          });
        }
        return;
      }

      // Prevent a player from joining their own room incorrectly
      if (game.player1 && game.player1.id === socket.id) {
        if (typeof callback === 'function') {
          return callback({
            success: false,
            message: 'You are already registered as Player 1 in this game room.'
          });
        }
        return;
      }

      // Prevent third player from joining a full game
      if (game.player2 !== null) {
        if (typeof callback === 'function') {
          return callback({
            success: false,
            message: 'This game is already full (2 players are already in this room).'
          });
        }
        return;
      }

      if (game.status !== 'waiting') {
        if (typeof callback === 'function') {
          return callback({
            success: false,
            message: 'This match has already started and cannot be joined.'
          });
        }
        return;
      }

      // Register Player 2
      game.player2 = {
        id: socket.id,
        name: playerName,
        isHost: false,
        ready: true
      };

      // GAME INITIALIZATION
      const singleSecretNumber = generateSecretNumber();
      game.secretNumber = singleSecretNumber;
      game.guesses = {
        player1: [],
        player2: []
      };
      game.playAgainReady = {
        player1: false,
        player2: false
      };
      game.status = 'playing';

      games.set(rawCode, game);
      socketToGame.set(socket.id, rawCode);
      socket.join(rawCode);

      console.log(`[Game Initialized] Code: ${rawCode} | P1: "${game.player1.name}" vs P2: "${playerName}" | Secret: [LOCKED = ${singleSecretNumber}]`);

      // Acknowledge Player 2
      if (typeof callback === 'function') {
        callback({
          success: true,
          gameCode: rawCode,
          playerRole: 'player2',
          game: getSanitizedGame(game)
        });
      }

      // Broadcast both_players_ready event to room
      io.to(rawCode).emit('both_players_ready', {
        game: getSanitizedGame(game),
        message: 'Both players are connected and ready!'
      });

      // Notify both players that game has started
      io.to(rawCode).emit('game_started', {
        game: getSanitizedGame(game),
        message: 'Game started! Guess the secret number (1 to 6).'
      });
    } catch (err) {
      console.error('[Error in join_game]', err);
      if (typeof callback === 'function') {
        callback({ success: false, message: 'Server error joining game.' });
      }
    }
  });

  /**
   * SUBMIT GUESSES
   * Both players independently submit exactly three numbers from 1 to 6.
   */
  socket.on('submit_guesses', (data, callback) => {
    try {
      const code = socketToGame.get(socket.id);
      if (!code || !games.has(code)) {
        if (typeof callback === 'function') {
          return callback({ success: false, message: 'Unauthorized: Active game not found.' });
        }
        return;
      }

      const game = games.get(code);

      // Verify game status is currently playing
      if (game.status !== 'playing') {
        if (typeof callback === 'function') {
          return callback({
            success: false,
            message: `Guesses cannot be submitted in "${game.status}" state.`
          });
        }
        return;
      }

      // Determine player role
      let role = null;
      if (game.player1 && game.player1.id === socket.id) role = 'player1';
      else if (game.player2 && game.player2.id === socket.id) role = 'player2';

      if (!role) {
        if (typeof callback === 'function') {
          return callback({ success: false, message: 'Unauthorized: Player not recognized in this game.' });
        }
        return;
      }

      // Validate payload type
      if (!data || typeof data !== 'object' || !Array.isArray(data.guesses)) {
        if (typeof callback === 'function') {
          return callback({
            success: false,
            message: 'Invalid request: guesses must be an array of three numbers.'
          });
        }
        return;
      }

      const rawGuesses = data.guesses;

      // Validate exactly 3 numbers
      if (rawGuesses.length !== 3) {
        if (typeof callback === 'function') {
          return callback({
            success: false,
            message: `You must select exactly three guesses (received ${rawGuesses.length}).`
          });
        }
        return;
      }

      // Validate each guess is an integer from 1 to 6
      const allValid = rawGuesses.every((num) => typeof num === 'number' && Number.isInteger(num) && num >= 1 && num <= 6);
      if (!allValid) {
        if (typeof callback === 'function') {
          return callback({
            success: false,
            message: 'All three guesses must be integers between 1 and 6.'
          });
        }
        return;
      }

      // Prevent duplicate / repeated submission
      if (game.guesses[role] && game.guesses[role].length === 3) {
        if (typeof callback === 'function') {
          return callback({
            success: false,
            message: 'Repeated submission rejected: your guesses have already been submitted.'
          });
        }
        return;
      }

      // Save guesses in server-side game object
      game.guesses[role] = rawGuesses;
      console.log(`[Guesses Stored] Code: ${code} | ${role}: [${rawGuesses.join(', ')}]`);

      // Acknowledge the submitting player
      if (typeof callback === 'function') {
        callback({
          success: true,
          message: 'Your guesses have been submitted. Waiting for the other player...',
          guesses: rawGuesses
        });
      }

      // Notify opponent without revealing numbers
      socket.to(code).emit('opponent_submitted', {
        playerRole: role,
        message: 'The other player has submitted their guesses.'
      });

      // Check if BOTH players have submitted all three guesses
      const p1Done = game.guesses.player1 && game.guesses.player1.length === 3;
      const p2Done = game.guesses.player2 && game.guesses.player2.length === 3;

      if (p1Done && p2Done) {
        const finalResult = calculateGameResult(game);
        game.status = 'finished';
        game.result = finalResult;

        console.log(`===============================================`);
        console.log(`[Final Result Calculated] Code: ${code}`);
        console.log(`Secret Number: ${finalResult.secretNumber}`);
        console.log(`Player 1 (${game.player1.name}): [${game.guesses.player1.join(', ')}] -> ${finalResult.player1.isSuccess ? 'MATCH' : 'MISS'}`);
        console.log(`Player 2 (${game.player2.name}): [${game.guesses.player2.join(', ')}] -> ${finalResult.player2.isSuccess ? 'MATCH' : 'MISS'}`);
        console.log(`Outcome: ${finalResult.outcomeTitle} (${finalResult.outcomeSubtitle})`);
        console.log(`===============================================`);

        // Send final result simultaneously to both players
        io.to(code).emit('game_result', finalResult);
      }
    } catch (err) {
      console.error('[Error in submit_guesses]', err);
      if (typeof callback === 'function') {
        callback({ success: false, message: 'Server error submitting guesses.' });
      }
    }
  });

  /**
   * PLAY AGAIN
   * Requires BOTH players to click Play Again before a new match begins.
   */
  socket.on('play_again', (callback) => {
    try {
      const code = socketToGame.get(socket.id);
      if (!code || !games.has(code)) {
        if (typeof callback === 'function') {
          return callback({ success: false, message: 'Unauthorized: Game not found.' });
        }
        return;
      }

      const game = games.get(code);

      // Verify game is in finished state
      if (game.status !== 'finished') {
        if (typeof callback === 'function') {
          return callback({
            success: false,
            message: 'Cannot request rematch before the current match concludes.'
          });
        }
        return;
      }

      let role = null;
      if (game.player1 && game.player1.id === socket.id) role = 'player1';
      else if (game.player2 && game.player2.id === socket.id) role = 'player2';

      if (!role) {
        if (typeof callback === 'function') {
          return callback({ success: false, message: 'Unauthorized: Player not recognized.' });
        }
        return;
      }

      if (!game.playAgainReady) {
        game.playAgainReady = { player1: false, player2: false };
      }

      // If already ready, acknowledge without duplicating
      if (game.playAgainReady[role]) {
        if (typeof callback === 'function') {
          return callback({
            success: true,
            playerRole: role,
            bothReady: Boolean(game.playAgainReady.player1 && game.playAgainReady.player2),
            message: 'Already waiting for opponent.'
          });
        }
        return;
      }

      game.playAgainReady[role] = true;
      console.log(`[Play Again Requested] Code: ${code} | ${role} is ready.`);

      if (typeof callback === 'function') {
        callback({
          success: true,
          playerRole: role,
          bothReady: Boolean(game.playAgainReady.player1 && game.playAgainReady.player2)
        });
      }

      // Notify opponent with player name
      const readyPlayerName = role === 'player1' ? (game.player1 ? game.player1.name : 'Player 1') : (game.player2 ? game.player2.name : 'Player 2');
      socket.to(code).emit('opponent_ready_play_again', {
        playerRole: role,
        playerName: readyPlayerName,
        message: `${readyPlayerName} is ready to play again! Click Play Again to start.`
      });

      // ONLY start rematch if BOTH players are ready
      if (game.playAgainReady.player1 && game.playAgainReady.player2) {
        console.log(`[Rematch Starting] Code: ${code} | Both players accepted rematch!`);
        const newSecret = generateSecretNumber();
        game.secretNumber = newSecret;
        game.guesses = { player1: [], player2: [] };
        game.playAgainReady = { player1: false, player2: false };
        game.status = 'playing';
        game.result = null;

        io.to(code).emit('game_started', {
          game: getSanitizedGame(game),
          message: 'Rematch started! Guess the secret number (1 to 6).'
        });
      }
    } catch (err) {
      console.error('[Error in play_again]', err);
      if (typeof callback === 'function') {
        callback({ success: false, message: 'Server error processing rematch.' });
      }
    }
  });

  /**
   * LEAVE GAME
   */
  socket.on('leave_game', (callback) => {
    const code = socketToGame.get(socket.id);
    if (code && games.has(code)) {
      const game = games.get(code);
      const isP1 = game.player1 && game.player1.id === socket.id;
      const playerName = isP1 ? (game.player1 ? game.player1.name : 'Player 1') : (game.player2 ? game.player2.name : 'Player 2');
      const phase = game.status;

      socket.leave(code);
      socket.to(code).emit('opponent_disconnected', {
        message: `${playerName} left the game.`,
        playerName,
        phase,
        reason: 'left'
      });
      games.delete(code);
      socketToGame.delete(socket.id);
      console.log(`[Game Cancelled] Room ${code} closed by ${socket.id} (${playerName}, Phase: ${phase})`);
    } else {
      socketToGame.delete(socket.id);
    }
    if (typeof callback === 'function') {
      callback({ success: true });
    }
  });

  /**
   * DISCONNECT
   */
  socket.on('disconnect', (reason) => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id} (Reason: ${reason})`);

    const code = socketToGame.get(socket.id);
    if (code && games.has(code)) {
      const game = games.get(code);
      const isP1 = game.player1 && game.player1.id === socket.id;
      const playerName = isP1 ? (game.player1 ? game.player1.name : 'Player 1') : (game.player2 ? game.player2.name : 'Player 2');
      const phase = game.status;

      socket.to(code).emit('opponent_disconnected', {
        message: `${playerName} disconnected from the game.`,
        playerName,
        phase,
        reason: reason || 'disconnect'
      });
      games.delete(code);
      socketToGame.delete(socket.id);
      console.log(`[Game Terminated] Room ${code} closed due to ${playerName} disconnection (Phase: ${phase}).`);
    } else {
      socketToGame.delete(socket.id);
    }
  });
});

// Fallback route to serve index.html for single-page style navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[Server Error] Port ${PORT} is already in use by another process.`);
    console.error(`Please stop the existing process on port ${PORT} or start with a different port (e.g. PORT=3001 npm start).\n`);
    process.exit(1);
  } else {
    console.error('[Server Error]', err);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` Three Chance Game Server is running!`);
  console.log(` Local URL: http://localhost:${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`===============================================`);
});
