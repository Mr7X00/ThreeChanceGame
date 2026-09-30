/**
 * Three Chance Game - Client Architecture
 * Vanilla JavaScript managing:
 * 1. Socket.IO connection status & diagnostics
 * 2. View navigation (Landing, Create, Join, Room, Game Play, Result)
 * 3. Real-time Multiplayer Room Creation & Joining
 * 4. Independent 3-Chance Selection System
 * 5. Authoritative Result Display (Cases 1-4)
 */

document.addEventListener('DOMContentLoaded', () => {
  // -------------------------------------------------------------
  // 1. Socket.IO Connection Setup & Diagnostics
  // -------------------------------------------------------------
  const connectionDot = document.getElementById('connection-dot');
  const connectionText = document.getElementById('connection-text');
  const socketIdElement = document.getElementById('socket-id');

  const socket = io();

  // Active session state
  let currentGameCode = null;
  let currentRole = null; // 'player1' or 'player2'
  let currentName = '';
  let activeGameData = null;
  let selectedGuesses = []; // Exactly up to 3 numbers (1-6)
  let hasSubmitted = false;

  socket.on('connect', () => {
    console.log(`[Socket.IO Client] Connected with ID: ${socket.id}`);

    if (connectionDot && connectionText) {
      connectionDot.className = 'status-dot online';
      connectionText.textContent = 'Connected (Online)';
    }

    if (socketIdElement) {
      socketIdElement.textContent = socket.id;
    }
  });

  socket.on('disconnect', (reason) => {
    console.warn(`[Socket.IO Client] Disconnected: ${reason}`);

    if (connectionDot && connectionText) {
      connectionDot.className = 'status-dot offline';
      connectionText.textContent = 'Disconnected';
    }

    if (socketIdElement) {
      socketIdElement.textContent = 'Disconnected';
    }

    // If disconnected while in an active game or room
    if (currentGameCode) {
      showDisconnectModal('Connection Lost', 'You have been disconnected from the server. Please return to the home screen.');
    }
  });

  socket.on('connect_error', (error) => {
    console.error(`[Socket.IO Client] Connection Error:`, error.message);

    if (connectionDot && connectionText) {
      connectionDot.className = 'status-dot offline';
      connectionText.textContent = 'Connection Error';
    }
  });

  // -------------------------------------------------------------
  // 2. View Navigation Elements
  // -------------------------------------------------------------
  const landingView = document.getElementById('landing-view');
  const createView = document.getElementById('create-view');
  const joinView = document.getElementById('join-view');
  const roomView = document.getElementById('room-view');
  const gameView = document.getElementById('game-view');
  const resultView = document.getElementById('result-view');

  const btnNavCreate = document.getElementById('btn-nav-create');
  const btnNavJoin = document.getElementById('btn-nav-join');
  const btnCreateBack = document.getElementById('btn-create-back');
  const btnJoinBack = document.getElementById('btn-join-back');
  const btnLeaveRoom = document.getElementById('btn-leave-room');
  const btnGameLeave = document.getElementById('btn-game-leave');
  const btnResultMenu = document.getElementById('btn-result-menu');

  // Create Form Elements
  const createGameForm = document.getElementById('create-game-form');
  const createNameInput = document.getElementById('create-player-name');
  const createAlertError = document.getElementById('create-alert-error');
  const createErrorMsg = document.getElementById('create-error-msg');
  const btnCreateSubmit = document.getElementById('btn-create-submit');
  const createBtnSpinner = document.getElementById('create-btn-spinner');
  const createBtnIcon = document.getElementById('create-btn-icon');
  const createBtnText = document.getElementById('create-btn-text');

  // Join Form Elements
  const joinGameForm = document.getElementById('join-game-form');
  const joinNameInput = document.getElementById('join-player-name');
  const joinCodeInput = document.getElementById('join-game-code');
  const joinAlertError = document.getElementById('join-alert-error');
  const joinErrorMsg = document.getElementById('join-error-msg');
  const btnJoinSubmit = document.getElementById('btn-join-submit');
  const joinBtnSpinner = document.getElementById('join-btn-spinner');
  const joinBtnIcon = document.getElementById('join-btn-icon');
  const joinBtnText = document.getElementById('join-btn-text');

  // Room View Elements
  const displayGameCode = document.getElementById('display-game-code');
  const btnCopyCode = document.getElementById('btn-copy-code');
  const copyIcon = document.getElementById('copy-icon');
  const copyText = document.getElementById('copy-text');
  const roomRoleBadge = document.getElementById('room-role-badge');
  const roomWaitingBanner = document.getElementById('room-waiting-banner');
  const roomReadyBanner = document.getElementById('room-ready-banner');
  const matchupStateBadge = document.getElementById('matchup-state-badge');
  const lobbyP1Name = document.getElementById('lobby-p1-name');
  const lobbyP1RoleText = document.getElementById('lobby-p1-role-text');
  const lobbyP2Box = document.getElementById('lobby-p2-box');
  const lobbyP2Avatar = document.getElementById('lobby-p2-avatar');
  const lobbyP2Name = document.getElementById('lobby-p2-name');
  const lobbyP2StatusTag = document.getElementById('lobby-p2-status-tag');
  const lobbyP2StatusText = document.getElementById('lobby-p2-status-text');
  const lobbyVsBadge = document.getElementById('lobby-vs-badge');
  const roomAlertInfo = document.getElementById('room-alert-info');
  const roomAlertMsg = document.getElementById('room-alert-msg');

  // Game View Elements
  const gameRoomCodeBadge = document.getElementById('game-room-code-badge');
  const gameRoleBadge = document.getElementById('game-role-badge');
  const gameP1Display = document.getElementById('game-p1-display');
  const gameP2Display = document.getElementById('game-p2-display');
  const guessesCountBadge = document.getElementById('guesses-count-badge');
  const slotVal1 = document.getElementById('slot-val-1');
  const slotVal2 = document.getElementById('slot-val-2');
  const slotVal3 = document.getElementById('slot-val-3');
  const numButtons = document.querySelectorAll('.btn-num-choice');
  const btnClearGuesses = document.getElementById('btn-clear-guesses');
  const btnSubmitGuesses = document.getElementById('btn-submit-guesses');
  const submitSpinner = document.getElementById('submit-spinner');
  const submitIcon = document.getElementById('submit-icon');
  const submitText = document.getElementById('submit-text');
  const submissionStatusCard = document.getElementById('submission-status-card');
  const gameAlertInfo = document.getElementById('game-alert-info');
  const gameAlertMsg = document.getElementById('game-alert-msg');

  // Result View Elements
  const resultRoomBadge = document.getElementById('result-room-badge');
  const outcomeIconContainer = document.getElementById('outcome-icon-container');
  const outcomeIcon = document.getElementById('outcome-icon');
  const outcomeHeadline = document.getElementById('outcome-headline');
  const outcomeSubtext = document.getElementById('outcome-subtext');
  const revealedSecretNumber = document.getElementById('revealed-secret-number');
  const resultP1Card = document.getElementById('result-p1-card');
  const resultP1Label = document.getElementById('result-p1-label');
  const resultP1Flow = document.getElementById('result-p1-flow');
  const resultP1StatusLine = document.getElementById('result-p1-status-line');
  const resultP2Card = document.getElementById('result-p2-card');
  const resultP2Label = document.getElementById('result-p2-label');
  const resultP2Flow = document.getElementById('result-p2-flow');
  const resultP2StatusLine = document.getElementById('result-p2-status-line');
  const rematchNotification = document.getElementById('rematch-notification');
  const rematchNotificationMsg = document.getElementById('rematch-notification-msg');
  const btnPlayAgain = document.getElementById('btn-play-again');
  const playAgainSpinner = document.getElementById('play-again-spinner');
  const playAgainIcon = document.getElementById('play-again-icon');
  const playAgainText = document.getElementById('play-again-text');
  const btnLeaveGame = document.getElementById('btn-leave-game');

  // Disconnect & Interrupted Match Modal
  const disconnectModalBackdrop = document.getElementById('disconnect-modal-backdrop');
  const disconnectModalTitle = document.getElementById('disconnect-modal-title');
  const disconnectModalMsg = document.getElementById('disconnect-modal-msg');
  const btnDisconnectHome = document.getElementById('btn-disconnect-home');

  function showDisconnectModal(title, message) {
    setKeypadDisabled(true);
    if (btnClearGuesses) btnClearGuesses.disabled = true;
    if (btnSubmitGuesses) btnSubmitGuesses.disabled = true;
    if (btnPlayAgain) btnPlayAgain.disabled = true;

    if (disconnectModalTitle) disconnectModalTitle.textContent = title;
    if (disconnectModalMsg) disconnectModalMsg.textContent = message;
    if (disconnectModalBackdrop) disconnectModalBackdrop.classList.remove('d-none');
  }

  function hideDisconnectModal() {
    if (disconnectModalBackdrop) disconnectModalBackdrop.classList.add('d-none');
  }

  if (btnDisconnectHome) {
    btnDisconnectHome.addEventListener('click', () => {
      hideDisconnectModal();
      leaveCurrentGame();
    });
  }

  function showView(targetView) {
    [landingView, createView, joinView, roomView, gameView, resultView].forEach((view) => {
      if (view) {
        view.hidden = true;
        view.classList.remove('active');
      }
    });

    if (targetView) {
      targetView.hidden = false;
      targetView.classList.add('active');
    }
  }

  function clearAlerts() {
    if (createAlertError) createAlertError.classList.add('d-none');
    if (joinAlertError) joinAlertError.classList.add('d-none');
    if (roomAlertInfo) roomAlertInfo.classList.add('d-none');
    if (gameAlertInfo) gameAlertInfo.classList.add('d-none');
  }

  // Navigation handlers
  if (btnNavCreate) {
    btnNavCreate.addEventListener('click', () => {
      clearAlerts();
      showView(createView);
      if (createNameInput) createNameInput.focus();
    });
  }

  if (btnNavJoin) {
    btnNavJoin.addEventListener('click', () => {
      clearAlerts();
      showView(joinView);
      if (joinNameInput) joinNameInput.focus();
    });
  }

  if (btnCreateBack) {
    btnCreateBack.addEventListener('click', () => {
      clearAlerts();
      showView(landingView);
    });
  }

  if (btnJoinBack) {
    btnJoinBack.addEventListener('click', () => {
      clearAlerts();
      showView(landingView);
    });
  }

  if (btnLeaveRoom) {
    btnLeaveRoom.addEventListener('click', leaveCurrentGame);
  }

  if (btnGameLeave) {
    btnGameLeave.addEventListener('click', leaveCurrentGame);
  }

  if (btnLeaveGame) {
    btnLeaveGame.addEventListener('click', leaveCurrentGame);
  }

  if (btnPlayAgain) {
    btnPlayAgain.addEventListener('click', () => {
      setLoading(btnPlayAgain, playAgainSpinner, playAgainIcon, playAgainText, true, 'Waiting for opponent...');
      
      socket.emit('play_again', (res) => {
        if (!res || !res.success) {
          setLoading(btnPlayAgain, playAgainSpinner, playAgainIcon, playAgainText, false, 'Play Again');
          alert(res && res.message ? res.message : 'Error requesting rematch.');
        }
      });
    });
  }

  function leaveCurrentGame() {
    hideDisconnectModal();
    socket.emit('leave_game', () => {
      currentGameCode = null;
      currentRole = null;
      activeGameData = null;
      selectedGuesses = [];
      hasSubmitted = false;
      showView(landingView);
    });
  }

  // Auto-uppercase Game Code in Join Input
  if (joinCodeInput) {
    joinCodeInput.addEventListener('input', () => {
      joinCodeInput.value = joinCodeInput.value.toUpperCase();
    });
  }

  // -------------------------------------------------------------
  // 3. CREATE GAME (Player 1)
  // -------------------------------------------------------------
  if (createGameForm) {
    createGameForm.addEventListener('submit', (e) => {
      e.preventDefault();
      clearAlerts();

      const playerName = createNameInput ? createNameInput.value.trim() : '';

      if (!playerName || playerName.length < 2) {
        showError(createAlertError, createErrorMsg, 'Please enter a valid player name (at least 2 characters).');
        if (createNameInput) createNameInput.focus();
        return;
      }

      setLoading(btnCreateSubmit, createBtnSpinner, createBtnIcon, createBtnText, true, 'Creating...');

      socket.emit('create_game', { playerName }, (response) => {
        setLoading(btnCreateSubmit, createBtnSpinner, createBtnIcon, createBtnText, false, 'Create Room');

        if (!response || !response.success) {
          const msg = response && response.message ? response.message : 'Failed to create game room.';
          showError(createAlertError, createErrorMsg, msg);
          return;
        }

        currentGameCode = response.gameCode;
        currentRole = 'player1';
        currentName = playerName;
        activeGameData = response.game;

        setupRoomUI(response.game, currentRole);
        showView(roomView);
      });
    });
  }

  // -------------------------------------------------------------
  // 4. JOIN GAME (Player 2)
  // -------------------------------------------------------------
  if (joinGameForm) {
    joinGameForm.addEventListener('submit', (e) => {
      e.preventDefault();
      clearAlerts();

      const playerName = joinNameInput ? joinNameInput.value.trim() : '';
      const gameCode = joinCodeInput ? joinCodeInput.value.trim().toUpperCase() : '';

      if (!playerName || playerName.length < 2) {
        showError(joinAlertError, joinErrorMsg, 'Please enter a valid player name (at least 2 characters).');
        if (joinNameInput) joinNameInput.focus();
        return;
      }

      if (!gameCode || gameCode.length < 4) {
        showError(joinAlertError, joinErrorMsg, 'Please enter a valid 5-character Game Code.');
        if (joinCodeInput) joinCodeInput.focus();
        return;
      }

      setLoading(btnJoinSubmit, joinBtnSpinner, joinBtnIcon, joinBtnText, true, 'Joining...');

      socket.emit('join_game', { playerName, gameCode }, (response) => {
        setLoading(btnJoinSubmit, joinBtnSpinner, joinBtnIcon, joinBtnText, false, 'Join Room');

        if (!response || !response.success) {
          const msg = response && response.message ? response.message : 'Failed to join game room.';
          showError(joinAlertError, joinErrorMsg, msg);
          return;
        }

        currentGameCode = response.gameCode;
        currentRole = 'player2';
        currentName = playerName;
        activeGameData = response.game;

        setupRoomUI(response.game, currentRole);
        showView(roomView);
      });
    });
  }

  // -------------------------------------------------------------
  // 5. Real-Time Room & Game Event Listeners
  // -------------------------------------------------------------

  /**
   * Received when Player 2 successfully joins.
   */
  socket.on('both_players_ready', (data) => {
    console.log('[Socket.IO Client] Both players ready!', data);
    if (!data || !data.game) return;
    activeGameData = data.game;
    setBothPlayersReadyState(data.game);
  });

  /**
   * Received when Server Initializes match.
   */
  socket.on('game_started', (data) => {
    console.log('[Socket.IO Client] Game Started!', data);
    if (!data || !data.game) return;
    activeGameData = data.game;

    // Snappier transition when restarting from rematch screen
    const isRematch = resultView && !resultView.hidden;
    const delay = isRematch ? 300 : 1000;

    setTimeout(() => {
      initGamePlayUI(data.game);
      showView(gameView);
    }, delay);
  });

  /**
   * Opponent submitted notification (opponent numbers are NEVER revealed)
   */
  socket.on('opponent_submitted', () => {
    console.log('[Socket.IO Client] Opponent submitted guesses');
    if (submissionStatusCard && !submissionStatusCard.classList.contains('d-none')) {
      const subtext = submissionStatusCard.querySelector('.submission-subtext');
      if (subtext) {
        subtext.textContent = 'The other player has submitted their guesses as well.';
      }
    }
  });

  /**
   * Received simultaneously when BOTH players have submitted all three guesses
   * Authoritative server calculation reveals results!
   */
  socket.on('game_result', (result) => {
    console.log('[Socket.IO Client] Final game result received:', result);
    setTimeout(() => {
      displayFinalResult(result);
      showView(resultView);
    }, 600);
  });

  /**
   * Opponent requested rematch
   */
  socket.on('opponent_ready_play_again', (data) => {
    console.log('[Socket.IO Client] Opponent ready for rematch:', data);
    if (rematchNotification && rematchNotificationMsg) {
      rematchNotificationMsg.textContent = (data && data.message)
        ? data.message
        : 'Your opponent is ready to play again! Click Play Again to start.';
      rematchNotification.className = 'alert alert-info d-flex align-items-center gap-2 mb-3';
      rematchNotification.classList.remove('d-none');
    }
  });

  /**
   * Opponent disconnect notification
   */
  socket.on('opponent_disconnected', (data) => {
    console.warn('[Socket.IO Client] Opponent disconnected:', data);
    const msg = data && data.message ? data.message : 'Your opponent disconnected from the game.';

    // If player is in active gameView (during guessing or waiting for opponent)
    if (gameView && !gameView.hidden) {
      showDisconnectModal('Match Interrupted', `${msg} The game has been stopped.`);
      return;
    }

    // If in roomView (lobby)
    if (roomView && !roomView.hidden) {
      if (roomAlertInfo && roomAlertMsg) {
        roomAlertMsg.textContent = msg;
        roomAlertInfo.classList.remove('d-none');
      }
      if (matchupStateBadge) {
        matchupStateBadge.className = 'badge bg-danger-subtle text-danger border border-danger-subtle font-monospace';
        matchupStateBadge.textContent = 'Opponent Left';
      }
      if (roomReadyBanner) roomReadyBanner.classList.add('d-none');
      if (roomWaitingBanner) roomWaitingBanner.classList.add('d-none');
      showDisconnectModal('Opponent Left Room', `${msg} The match cannot proceed.`);
      return;
    }

    // If in resultView
    if (resultView && !resultView.hidden) {
      if (rematchNotification && rematchNotificationMsg) {
        rematchNotificationMsg.textContent = `${msg} Rematch is no longer available.`;
        rematchNotification.className = 'alert alert-warning d-flex align-items-center gap-2 mb-3';
        rematchNotification.classList.remove('d-none');
      }

      if (btnPlayAgain) {
        btnPlayAgain.disabled = true;
        if (playAgainSpinner) playAgainSpinner.classList.add('d-none');
        if (playAgainIcon) playAgainIcon.classList.remove('d-none');
        if (playAgainText) playAgainText.textContent = 'Opponent Left';
      }
    }
  });

  // -------------------------------------------------------------
  // 6. UI Helpers & Room State Synchronizer
  // -------------------------------------------------------------
  function setupRoomUI(game, role) {
    clearAlerts();

    if (displayGameCode) {
      displayGameCode.textContent = game.gameCode;
    }

    if (roomRoleBadge) {
      roomRoleBadge.textContent = role === 'player1' ? 'Role: Host (Player 1)' : 'Role: Guest (Player 2)';
    }

    if (lobbyP1Name) {
      lobbyP1Name.textContent = game.player1 ? game.player1.name : 'Player 1';
    }

    if (role === 'player1') {
      if (lobbyP1RoleText) lobbyP1RoleText.textContent = 'You (Host)';
    } else {
      if (lobbyP1RoleText) lobbyP1RoleText.textContent = 'Host';
    }

    if (game.player2) {
      setBothPlayersReadyState(game);
    } else {
      if (roomWaitingBanner) roomWaitingBanner.classList.remove('d-none');
      if (roomReadyBanner) roomReadyBanner.classList.add('d-none');
      if (matchupStateBadge) {
        matchupStateBadge.className = 'badge bg-warning-subtle text-warning border border-warning-subtle font-monospace';
        matchupStateBadge.textContent = '1 / 2 Connected';
      }

      if (lobbyP2Name) {
        lobbyP2Name.textContent = 'Waiting...';
        lobbyP2Name.className = 'player-name text-secondary';
      }

      if (lobbyP2Avatar) {
        lobbyP2Avatar.innerHTML = '<i class="bi bi-hourglass-split text-warning" aria-hidden="true"></i>';
      }

      if (lobbyP2StatusText) {
        lobbyP2StatusText.textContent = 'Pending';
      }

      if (lobbyP2Box) {
        lobbyP2Box.classList.remove('ready-peer');
      }

      if (lobbyVsBadge) {
        lobbyVsBadge.classList.remove('active-vs');
      }
    }
  }

  function setBothPlayersReadyState(game) {
    if (roomWaitingBanner) roomWaitingBanner.classList.add('d-none');
    if (roomReadyBanner) roomReadyBanner.classList.remove('d-none');

    if (matchupStateBadge) {
      matchupStateBadge.className = 'badge bg-success-subtle text-success border border-success-subtle font-monospace';
      matchupStateBadge.textContent = 'Both Players Ready';
    }

    if (lobbyP1Name && game.player1) {
      lobbyP1Name.textContent = game.player1.name;
    }

    if (lobbyP2Name && game.player2) {
      lobbyP2Name.textContent = game.player2.name;
      lobbyP2Name.className = 'player-name text-light fw-bold';
    }

    if (lobbyP2Avatar) {
      lobbyP2Avatar.innerHTML = '<i class="bi bi-person-fill" style="color: #8b5cf6;" aria-hidden="true"></i>';
    }

    if (lobbyP2StatusTag) {
      const isYou = currentRole === 'player2';
      lobbyP2StatusTag.innerHTML = `<i class="bi bi-check-circle-fill text-success me-1"></i><span class="text-success">${isYou ? 'You (Ready)' : 'Ready'}</span>`;
    }

    if (lobbyP2Box) {
      lobbyP2Box.classList.add('ready-peer');
    }

    if (lobbyVsBadge) {
      lobbyVsBadge.classList.add('active-vs');
    }
  }

  // -------------------------------------------------------------
  // 7. Complete Three-Guess Selection System
  // -------------------------------------------------------------
  function initGamePlayUI(game) {
    clearAlerts();
    selectedGuesses = [];
    hasSubmitted = false;

    if (gameRoomCodeBadge) {
      gameRoomCodeBadge.textContent = `ROOM: ${game.gameCode}`;
    }

    if (gameRoleBadge) {
      gameRoleBadge.textContent = currentRole === 'player1' ? 'Player 1 (Host)' : 'Player 2 (Guest)';
    }

    if (gameP1Display && game.player1) {
      gameP1Display.textContent = game.player1.name + (currentRole === 'player1' ? ' (You)' : '');
    }

    if (gameP2Display && game.player2) {
      gameP2Display.textContent = game.player2.name + (currentRole === 'player2' ? ' (You)' : '');
    }

    renderSlots();
    setKeypadDisabled(false);

    if (btnClearGuesses) btnClearGuesses.disabled = true;
    if (btnSubmitGuesses) btnSubmitGuesses.disabled = true;

    if (submissionStatusCard) submissionStatusCard.classList.add('d-none');
    if (submitSpinner) submitSpinner.classList.add('d-none');
    if (submitIcon) submitIcon.classList.remove('d-none');
    if (submitText) submitText.textContent = 'Submit Guesses';

    if (rematchNotification) rematchNotification.classList.add('d-none');
    if (btnPlayAgain) {
      btnPlayAgain.disabled = false;
      if (playAgainSpinner) playAgainSpinner.classList.add('d-none');
      if (playAgainIcon) playAgainIcon.classList.remove('d-none');
      if (playAgainText) playAgainText.textContent = 'Play Again';
    }
  }

  /**
   * Render Guess 1, Guess 2, Guess 3 slots
   * Shows "[ Select ]" when empty, and highlighted "[ X ]" when filled.
   */
  function renderSlots() {
    const slots = [slotVal1, slotVal2, slotVal3];

    slots.forEach((slot, index) => {
      if (!slot) return;
      if (index < selectedGuesses.length) {
        slot.innerHTML = `<span class="slot-text">[ ${selectedGuesses[index]} ]</span>`;
        slot.className = 'slot-select-box selected';
      } else {
        slot.innerHTML = '<span class="slot-text">[ Select ]</span>';
        slot.className = 'slot-select-box unselected';
      }
    });

    if (guessesCountBadge) {
      guessesCountBadge.textContent = `${selectedGuesses.length} / 3 Selected`;
      if (selectedGuesses.length === 3) {
        guessesCountBadge.className = 'badge bg-success-subtle text-success border border-success-subtle font-monospace';
      } else {
        guessesCountBadge.className = 'badge bg-secondary-subtle text-secondary border border-secondary font-monospace';
      }
    }

    if (btnClearGuesses) {
      btnClearGuesses.disabled = hasSubmitted || selectedGuesses.length === 0;
    }

    if (btnSubmitGuesses) {
      btnSubmitGuesses.disabled = hasSubmitted || selectedGuesses.length !== 3;
    }
  }

  function setKeypadDisabled(disabled) {
    numButtons.forEach((btn) => {
      btn.disabled = disabled;
    });
  }

  /**
   * Handle Number Button Click [1] - [6]
   */
  numButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (hasSubmitted) return;
      if (selectedGuesses.length >= 3) return;

      const num = parseInt(btn.getAttribute('data-number'), 10);
      if (isNaN(num) || num < 1 || num > 6) return;

      selectedGuesses.push(num);
      renderSlots();

      if (selectedGuesses.length === 3) {
        setKeypadDisabled(true);
      }
    });
  });

  /**
   * Handle Clear / Reset Selection
   */
  if (btnClearGuesses) {
    btnClearGuesses.addEventListener('click', () => {
      if (hasSubmitted) return;
      selectedGuesses = [];
      renderSlots();
      setKeypadDisabled(false);
    });
  }

  /**
   * Handle Submit Guesses
   */
  if (btnSubmitGuesses) {
    btnSubmitGuesses.addEventListener('click', () => {
      if (hasSubmitted) return;
      if (selectedGuesses.length !== 3) return;

      hasSubmitted = true;
      setKeypadDisabled(true);
      if (btnClearGuesses) btnClearGuesses.disabled = true;
      if (btnSubmitGuesses) btnSubmitGuesses.disabled = true;

      if (submitSpinner) submitSpinner.classList.remove('d-none');
      if (submitIcon) submitIcon.classList.add('d-none');
      if (submitText) submitText.textContent = 'Submitting...';

      socket.emit('submit_guesses', { guesses: selectedGuesses }, (res) => {
        if (submitSpinner) submitSpinner.classList.add('d-none');
        if (submitIcon) submitIcon.classList.remove('d-none');

        if (res && res.success) {
          if (submitText) submitText.textContent = 'Submitted';

          if (submissionStatusCard) {
            submissionStatusCard.classList.remove('d-none');
            const title = submissionStatusCard.querySelector('.submission-title');
            const subtext = submissionStatusCard.querySelector('.submission-subtext');
            if (title) title.textContent = 'Your guesses have been submitted.';
            if (subtext) subtext.textContent = 'Waiting for the other player...';
          }
        } else {
          hasSubmitted = false;
          setKeypadDisabled(false);
          renderSlots();
          alert(res && res.message ? res.message : 'Error submitting guesses.');
        }
      });
    });
  }

  // -------------------------------------------------------------
  // 8. Display Final Authoritative Match Result (Cases 1-4)
  // -------------------------------------------------------------
  function displayFinalResult(result) {
    clearAlerts();

    // Reset rematch UI state
    if (rematchNotification) {
      rematchNotification.className = 'alert alert-info d-none d-flex align-items-center gap-2 mb-3';
    }
    if (btnPlayAgain) {
      btnPlayAgain.disabled = false;
      if (playAgainSpinner) playAgainSpinner.classList.add('d-none');
      if (playAgainIcon) playAgainIcon.classList.remove('d-none');
      if (playAgainText) playAgainText.textContent = 'Play Again';
    }

    if (resultRoomBadge) {
      resultRoomBadge.textContent = `ROOM: ${result.gameCode}`;
    }

    if (revealedSecretNumber) {
      revealedSecretNumber.textContent = result.secretNumber;
    }

    const isWinner = result.winner === currentRole;
    const isLoser = result.winner && result.winner !== currentRole;

    // Configure Outcome Visuals based on the 4 cases
    if (result.outcome === 'player1_wins') {
      outcomeHeadline.textContent = 'PLAYER 1 WINS';
      outcomeHeadline.className = `outcome-headline ${isWinner ? 'victory-text' : (isLoser ? 'defeat-text' : 'victory-text')}`;
      outcomeIconContainer.className = `outcome-icon-circle ${isWinner ? 'victory' : (isLoser ? 'defeat' : 'victory')}`;
      outcomeIcon.className = isWinner ? 'bi bi-trophy-fill' : (isLoser ? 'bi bi-shield-x' : 'bi bi-trophy-fill');
      outcomeSubtext.textContent = `${result.player1.name} guessed the secret number correctly!`;
    } else if (result.outcome === 'player2_wins') {
      outcomeHeadline.textContent = 'PLAYER 2 WINS';
      outcomeHeadline.className = `outcome-headline ${isWinner ? 'victory-text' : (isLoser ? 'defeat-text' : 'victory-text')}`;
      outcomeIconContainer.className = `outcome-icon-circle ${isWinner ? 'victory' : (isLoser ? 'defeat' : 'victory')}`;
      outcomeIcon.className = isWinner ? 'bi bi-trophy-fill' : (isLoser ? 'bi bi-shield-x' : 'bi bi-trophy-fill');
      outcomeSubtext.textContent = `${result.player2.name} guessed the secret number correctly!`;
    } else if (result.outcome === 'match_draw') {
      outcomeHeadline.textContent = 'MATCH DRAW';
      outcomeHeadline.className = 'outcome-headline draw-text';
      outcomeIconContainer.className = 'outcome-icon-circle draw';
      outcomeIcon.className = 'bi bi-shield-shaded';
      outcomeSubtext.textContent = 'Both players guessed the secret number.';
    } else {
      // match_failed (neither guessed)
      outcomeHeadline.textContent = 'MATCH FAILED';
      outcomeHeadline.className = 'outcome-headline failed-text';
      outcomeIconContainer.className = 'outcome-icon-circle failed';
      outcomeIcon.className = 'bi bi-x-circle-fill';
      outcomeSubtext.textContent = 'Neither player guessed correctly.';
    }

    // Render Player 1 Section: Name, 2 → 4 → 6, Status Line
    const p1Name = result.player1 ? result.player1.name : 'Player 1';
    if (resultP1Label) {
      resultP1Label.textContent = `Player 1 (${p1Name})${currentRole === 'player1' ? ' [You]' : ''}:`;
    }
    if (resultP1Card) {
      if (result.player1 && result.player1.isSuccess) {
        resultP1Card.classList.add('has-won');
      } else {
        resultP1Card.classList.remove('has-won');
      }
    }
    renderGuessFlow(resultP1Flow, result.player1.guesses, result.secretNumber);
    renderStatusLine(resultP1StatusLine, result.player1.isSuccess, result.secretNumber);

    // Render Player 2 Section: Name, 1 → 3 → 5, Status Line
    const p2Name = result.player2 ? result.player2.name : 'Player 2';
    if (resultP2Label) {
      resultP2Label.textContent = `Player 2 (${p2Name})${currentRole === 'player2' ? ' [You]' : ''}:`;
    }
    if (resultP2Card) {
      if (result.player2 && result.player2.isSuccess) {
        resultP2Card.classList.add('has-won');
      } else {
        resultP2Card.classList.remove('has-won');
      }
    }
    renderGuessFlow(resultP2Flow, result.player2.guesses, result.secretNumber);
    renderStatusLine(resultP2StatusLine, result.player2.isSuccess, result.secretNumber);
  }

  function renderGuessFlow(container, guesses, secret) {
    if (!container || !Array.isArray(guesses)) return;
    container.innerHTML = '';

    guesses.forEach((num, idx) => {
      const isMatch = num === secret;
      const numElem = document.createElement('div');
      numElem.className = `flow-num ${isMatch ? 'match' : ''}`;
      numElem.textContent = num;
      container.appendChild(numElem);

      if (idx < guesses.length - 1) {
        const arrow = document.createElement('div');
        arrow.className = 'flow-arrow';
        arrow.innerHTML = '<i class="bi bi-arrow-right" aria-hidden="true"></i>';
        container.appendChild(arrow);
      }
    });
  }

  function renderStatusLine(container, isSuccess, secret) {
    if (!container) return;
    if (isSuccess) {
      container.className = 'guess-status-line correct';
      container.innerHTML = `<i class="bi bi-check-circle-fill" aria-hidden="true"></i><span>Correct guess: ${secret}</span>`;
    } else {
      container.className = 'guess-status-line no-correct';
      container.innerHTML = `<i class="bi bi-x-circle" aria-hidden="true"></i><span>No correct guess</span>`;
    }
  }

  // Copy Game Code to Clipboard
  if (btnCopyCode) {
    btnCopyCode.addEventListener('click', () => {
      if (!currentGameCode) return;

      navigator.clipboard.writeText(currentGameCode).then(() => {
        if (copyIcon && copyText) {
          copyIcon.className = 'bi bi-check2';
          copyText.textContent = 'Copied!';
          btnCopyCode.classList.add('border-success');

          setTimeout(() => {
            copyIcon.className = 'bi bi-clipboard';
            copyText.textContent = 'Copy';
            btnCopyCode.classList.remove('border-success');
          }, 2000);
        }
      }).catch(() => {
        window.prompt('Copy Game Code:', currentGameCode);
      });
    });
  }

  function showError(alertElem, msgElem, message) {
    if (msgElem) msgElem.textContent = message;
    if (alertElem) alertElem.classList.remove('d-none');
  }

  function setLoading(btn, spinner, icon, text, isLoading, label) {
    if (btn) btn.disabled = isLoading;
    if (spinner) {
      if (isLoading) spinner.classList.remove('d-none');
      else spinner.classList.add('d-none');
    }
    if (icon) {
      if (isLoading) icon.classList.add('d-none');
      else icon.classList.remove('d-none');
    }
    if (text) text.textContent = label;
  }
});
