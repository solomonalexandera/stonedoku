/**
 * Game Flow - Game initialization, room management, and match flow
 */

/**
 * Create Game Flow manager
 * @param {Object} deps - Dependencies
 * @param {Object} deps.AppState - Application state
 * @param {Object} deps.GameUI - Game UI manager
 * @param {Object} deps.GameHelpers - Game helpers
 * @param {Object} deps.ViewManager - View manager
 * @param {Object} deps.PresenceManager - Presence manager
 * @param {Object} deps.ArchitecturalStateManager - Architectural state manager
 * @param {Object} deps.SudokuGenerator - Sudoku puzzle generator
 * @param {Object} deps.MatchManager - Match manager
 * @param {Object} deps.LobbyManager - Lobby manager
 * @param {Object} deps.ChatManager - Chat manager
 * @param {Object} deps.ProfileManager - Profile manager
 * @param {Object} deps.UI - UI utilities
 * @param {Object} deps.rtdb - RTDB instance
 * @param {Object} deps.rtdbFns - RTDB functions (ref, get, update, onValue, off, onChildAdded)
 * @returns {Object} Game Flow manager instance
 */
export function createGameFlow({
    AppState,
    GameUI,
    GameHelpers,
    ViewManager,
    PresenceManager,
    ArchitecturalStateManager,
    SudokuGenerator,
    MatchManager,
    LobbyManager,
    ChatManager,
    ProfileManager,
    UI,
    rtdb,
    rtdbFns = {}
} = {}) {
    const { ref, get, update, onValue, off, onChildAdded } = rtdbFns;
    
    let countdownInterval = null;
    let rematchListener = null;

    const escapeHtml = UI?.escapeHtml || ((text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    });

    const navigateCell = (direction) => {
        if (!AppState?.selectedCell) {
            GameUI?.selectCell(0, 0);
            return;
        }
        
        let { row, col } = AppState.selectedCell;
        
        switch (direction) {
            case 'ArrowUp':
                row = Math.max(0, row - 1);
                break;
            case 'ArrowDown':
                row = Math.min(8, row + 1);
                break;
            case 'ArrowLeft':
                col = Math.max(0, col - 1);
                break;
            case 'ArrowRight':
                col = Math.min(8, col + 1);
                break;
        }
        
        GameUI?.selectCell(row, col);
    };

    const startSinglePlayerGame = (difficulty, options = null) => {
        // Stop any existing timer from previous game
        GameUI?.stopTimer();
        
        AppState.gameMode = 'single';
        AppState.currentDifficulty = difficulty;
        AppState.playerScore = 0;
        AppState.selectedCell = null;
        AppState.timeLimitSeconds = Number(options?.timeLimitSeconds || 0) || 0;
        AppState.maxMistakes = Number(options?.maxMistakes || AppState.maxMistakes || 3) || 3;
        if (typeof options?.autoCheck === 'boolean') {
            AppState.settings.autoCheck = options.autoCheck;
        }

        const autoToggle = document.getElementById('auto-check');
        if (autoToggle) autoToggle.checked = !!AppState.settings.autoCheck;
        
        GameHelpers?.resetGameState();
        ArchitecturalStateManager?.reset();
        ArchitecturalStateManager?.startIdleWatch();
        
        const { puzzle, solution } = SudokuGenerator.createPuzzle(difficulty);
        AppState.puzzle = puzzle.map(row => [...row]);
        AppState.solution = solution;
        AppState.originalPuzzle = puzzle.map(row => [...row]);
        
        GameUI?.createGrid();
        GameUI?.renderPuzzle(AppState.puzzle);
        
        const difficultyLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
        const currentDiffEl = document.getElementById('current-difficulty');
        if (currentDiffEl) currentDiffEl.textContent = difficultyLabel;
        
        const vsHeader = document.getElementById('game-header-versus');
        if (vsHeader) vsHeader.style.display = 'none';
        const singleHeader = document.getElementById('game-header-single');
        if (singleHeader) singleHeader.style.display = 'flex';
        
        const widgetGameTab = document.getElementById('widget-game-tab');
        if (widgetGameTab) widgetGameTab.style.display = 'none';
        
        GameHelpers?.updateRemainingCounts();
        GameHelpers?.updateProgress();
        GameHelpers?.updateMistakesDisplay();
        
        ViewManager?.show('game');
        GameUI?.startTimer();
        PresenceManager?.updateActivity(`Playing: ${difficultyLabel} Mode`);
    };

    const startVersusGame = async (roomData) => {
        AppState.gameMode = 'versus';
        AppState.playerScore = 0;
        AppState.opponentScore = 0;
        AppState.selectedCell = null;
        
        GameHelpers?.resetGameState();
        ArchitecturalStateManager?.reset();
        ArchitecturalStateManager?.startIdleWatch();
        AppState.isGameOver = false;
        GameUI?.resetLivesDisplay();
        
        const countdownEl = document.getElementById('pregame-countdown');
        const vsText = document.querySelector('.vs-text');
        if (countdownEl) countdownEl.style.display = 'none';
        if (vsText) vsText.style.display = 'block';
        
        const isHost = roomData.host === AppState.currentUser?.uid;
        let matchId;
        const singleHeader = document.getElementById('game-header-single');
        if (singleHeader) singleHeader.style.display = 'none';
        
        if (isHost) {
            const { puzzle, solution } = SudokuGenerator.createPuzzle('medium');
            matchId = await MatchManager.createMatch(
                AppState.currentRoom,
                roomData.players,
                puzzle,
                solution
            );
        } else {
            const roomRef = ref(rtdb, `lobbies/${AppState.currentRoom}`);
            const snapshot = await get(roomRef);
            matchId = snapshot.val()?.matchId;
            
            if (!matchId) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const retrySnapshot = await get(roomRef);
                matchId = retrySnapshot.val()?.matchId;
            }
        }
        
        if (!matchId) {
            alert('Failed to start game. Please try again.');
            ViewManager?.show('lobby');
            return;
        }
        
        AppState.currentMatch = matchId;
        
        const opponentId = Object.keys(roomData.players).find(
            id => id !== AppState.currentUser?.uid
        );
        AppState.currentOpponent = opponentId;
        const opponent = roomData.players[opponentId];
        
        GameUI?.createGrid();
        
        const gameContainer = document.querySelector('.game-container');
        if (gameContainer) gameContainer.classList.add('versus-mode');
        
        const versusHeader = document.getElementById('game-header-versus');
        if (versusHeader) versusHeader.style.display = 'flex';
        
        const playerNameEl = document.getElementById('game-player-name');
        if (playerNameEl) playerNameEl.textContent = roomData.players[AppState.currentUser?.uid]?.name || 'You';
        
        const opponentNameEl = document.getElementById('opponent-name');
        if (opponentNameEl) opponentNameEl.textContent = opponent?.name || 'Opponent';
        
        const playerScoreEl = document.getElementById('player-score');
        if (playerScoreEl) playerScoreEl.textContent = '0';
        
        const opponentScoreEl = document.getElementById('opponent-score');
        if (opponentScoreEl) opponentScoreEl.textContent = '0';
        
        document.querySelectorAll('#player-lives .life-heart').forEach(heart => heart.textContent = '❤️');
        document.querySelectorAll('#opponent-lives .life-heart').forEach(heart => heart.textContent = '❤️');
        
        const widgetGameTab = document.getElementById('widget-game-tab');
        if (widgetGameTab) widgetGameTab.style.display = 'inline-block';
        
        ViewManager?.show('game');
        GameUI?.startTimer();
        PresenceManager?.updateActivity('Playing: Bust the Board');
        
        MatchManager.listenToMatch(matchId, handleMatchUpdate);
        
        try {
            const matchSnapshot = await get(ref(rtdb, `matches/${matchId}`));
            const matchData = matchSnapshot.val();
            if (matchData) {
                handleMatchUpdate(matchData);
            }
        } catch (error) {
            console.error('Error fetching initial match data:', error);
        }
        
        MatchManager.setupMatchHeartbeat(matchId, AppState.currentUser.uid);
        
        if (opponentId) {
            MatchManager.startOpponentPresenceMonitor(matchId, opponentId, () => {
                if (AppState.gameMode === 'versus' && AppState.currentMatch === matchId) {
                    showOpponentDisconnectModal(opponent?.name || 'Opponent');
                }
            });
        }
        
        if (typeof AppState.widgetGameChatUnsub === 'function') AppState.widgetGameChatUnsub();
        AppState.widgetGameChatUnsub = null;
        AppState.widgetGameChatContext = `match:${matchId}`;
        window.ChatWidget?.clearChannel?.('game');
        window.ChatNotifications?.markRead?.('game');
        AppState.widgetGameChatUnsub = ChatManager.listenToGameChat(matchId, (message) => {
            window.ChatWidget?.ingestMessage?.('game', message);
        });
    };

    const handleRoomUpdate = (room) => {
        if (!room) {
            ViewManager?.show('lobby');
            AppState.currentRoom = null;
            return;
        }
        
        const players = room.players || {};
        const playerIds = Object.keys(players);
        const playerCount = playerIds.length;
        
        if (playerCount === 1 && room.status === 'waiting') {
            if (AppState.currentView !== 'waiting') {
                ViewManager?.show('waiting');
            }
            return;
        }
        
        if (playerCount === 2 && room.status === 'waiting') {
            if (AppState.currentView !== 'pregame-lobby') {
                showPregameLobby(room);
            } else {
                updatePregameLobbyUI(room);
            }
            
            const allReady = playerIds.every(id => players[id].ready === true);
            if (allReady) {
                startGameCountdown(room);
            }
            return;
        }
    };

    const showPregameLobby = (room) => {
        ViewManager?.show('pregame-lobby');
        PresenceManager?.updateActivity('In Pre-Game Lobby');
        updatePregameLobbyUI(room);

        const widgetGameTab = document.getElementById('widget-game-tab');
        if (widgetGameTab) widgetGameTab.style.display = 'inline-block';

        if (typeof AppState.widgetGameChatUnsub === 'function') AppState.widgetGameChatUnsub();
        AppState.widgetGameChatUnsub = null;
        AppState.widgetGameChatContext = AppState.currentRoom ? `lobby:${AppState.currentRoom}` : null;
        window.ChatWidget?.clearChannel?.('game');
        window.ChatNotifications?.markRead?.('game');

        if (AppState.currentRoom) {
            const chatRef = ref(rtdb, `lobbies/${AppState.currentRoom}/chat`);
            AppState.widgetGameChatUnsub = onChildAdded(chatRef, (snapshot) => {
                window.ChatWidget?.ingestMessage?.('game', snapshot.val());
            });
        }
    };

    const updatePregameLobbyUI = (room) => {
        const players = room.players || {};
        const playerIds = Object.keys(players);
        const userId = AppState.currentUser?.uid;
        
        const selfPlayer = players[userId];
        const opponentId = playerIds.find(id => id !== userId);
        const opponentPlayer = players[opponentId];
        
        const playerNameEl = document.getElementById('pregame-player-name');
        const opponentNameEl = document.getElementById('pregame-opponent-name');
        if (playerNameEl) playerNameEl.textContent = selfPlayer?.name || 'You';
        if (opponentNameEl) opponentNameEl.textContent = opponentPlayer?.name || 'Opponent';
        
        const selfCard = document.querySelector('.pregame-player.self');
        const opponentCard = document.querySelector('.pregame-player.opponent');
        const selfStatus = document.getElementById('pregame-player-status');
        const opponentStatus = document.getElementById('pregame-opponent-status');
        
        if (selfPlayer?.ready) {
            selfCard?.classList.add('ready');
            if (selfStatus) selfStatus.querySelector('.status-text').textContent = '✓ Ready!';
        } else {
            selfCard?.classList.remove('ready');
            if (selfStatus) selfStatus.querySelector('.status-text').textContent = 'Not Ready';
        }
        
        if (opponentPlayer?.ready) {
            opponentCard?.classList.add('ready');
            if (opponentStatus) opponentStatus.querySelector('.status-text').textContent = '✓ Ready!';
        } else {
            opponentCard?.classList.remove('ready');
            if (opponentStatus) opponentStatus.querySelector('.status-text').textContent = 'Not Ready';
        }
        
        const readyBtn = document.getElementById('ready-btn');
        if (readyBtn) {
            if (selfPlayer?.ready) {
                readyBtn.classList.add('is-ready');
                const readyText = readyBtn.querySelector('.ready-text');
                if (readyText) readyText.textContent = 'Ready!';
            } else {
                readyBtn.classList.remove('is-ready');
                const readyText = readyBtn.querySelector('.ready-text');
                if (readyText) readyText.textContent = 'Ready Up!';
            }
        }
    };

    const startGameCountdown = async (room) => {
        if (countdownInterval) return;
        
        const countdownEl = document.getElementById('pregame-countdown');
        const countdownNum = countdownEl?.querySelector('.countdown-number');
        const vsText = document.querySelector('.vs-text');
        
        if (countdownEl) countdownEl.style.display = 'flex';
        if (vsText) vsText.style.display = 'none';
        
        let count = 3;
        
        countdownInterval = setInterval(async () => {
            if (countdownNum) countdownNum.textContent = count;
            
            if (count === 0) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                await startVersusGame(room);
            }
            count--;
        }, 1000);
    };

    const handleMatchUpdate = async (match) => {
        if (!match) return;
        
        const board = match.board;
        const puzzle = [];
        for (let row = 0; row < 9; row++) {
            puzzle[row] = [];
            for (let col = 0; col < 9; col++) {
                const cellData = board[`${row}_${col}`];
                puzzle[row][col] = cellData?.value || 0;
            }
        }
        
        GameUI?.renderPuzzle(puzzle, board);
        GameUI?.updateScores(match.scores, match.playerIds);
        GameUI?.updateLives(match.mistakes, match.playerIds, match.maxMistakes || 3);
        
        if (match.status === 'finished') {
            await GameUI?.endVersusGame(match);
        }
    };

    const showOpponentDisconnectModal = async (opponentName) => {
        if (!AppState.currentMatch || AppState.gameMode !== 'versus') return;
        
        const matchId = AppState.currentMatch;
        const userId = AppState.currentUser?.uid;
        
        if (!userId) return;
        
        try {
            await MatchManager.handleOpponentDisconnect(matchId, userId);
            await ProfileManager.updateStats(userId, true);
            
            const title = document.getElementById('game-over-title');
            const message = document.getElementById('game-over-message');
            
            if (title) title.textContent = 'Victory!';
            if (message) message.textContent = `${opponentName} disconnected. You win by forfeit!`;
            
            ViewManager?.showModal('game-over-modal');
            
            AppState.currentMatch = null;
            AppState.currentOpponent = null;
            AppState.gameMode = 'lobby';
        } catch (error) {
            console.error('Error handling opponent disconnect:', error);
        }
    };

    const quitGame = () => {
        GameUI?.stopTimer();
        ArchitecturalStateManager?.reset();
    };

    const cleanupAfterMatch = () => {
        if (rematchListener) {
            off(ref(rtdb, `matches/${AppState.lastMatch?.id}/rematch`));
            rematchListener = null;
        }
        
        AppState.currentMatch = null;
        AppState.lastMatch = null;
        AppState.lastOpponentId = null;
        AppState.currentRoom = null;
        AppState.gameMode = 'lobby';
        
        const gameContainer = document.querySelector('.game-container');
        if (gameContainer) gameContainer.classList.remove('versus-mode');
    };

    return {
        navigateCell,
        startSinglePlayerGame,
        startVersusGame,
        handleRoomUpdate,
        showPregameLobby,
        updatePregameLobbyUI,
        startGameCountdown,
        handleMatchUpdate,
        showOpponentDisconnectModal,
        quitGame,
        cleanupAfterMatch,
        escapeHtml
    };
}
