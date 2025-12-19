// ===========================================
// Firebase Imports
// ===========================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getAuth, 
    signInAnonymously, 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    getDatabase, 
    ref, 
    set, 
    get,
    push,
    update,
    remove,
    onValue,
    onChildAdded,
    onChildChanged,
    onChildRemoved,
    onDisconnect,
    serverTimestamp,
    runTransaction
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    arrayUnion,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ===========================================
// Firebase Configuration
// ===========================================
const firebaseConfig = {
    apiKey: "AIzaSyExample-replace-with-your-key",
    authDomain: "stonedoku-c0898.firebaseapp.com",
    projectId: "stonedoku-c0898",
    storageBucket: "stonedoku-c0898.firebasestorage.app",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456",
    databaseURL: "https://stonedoku-c0898-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const rtdb = getDatabase(firebaseApp);
const firestore = getFirestore(firebaseApp);

// ===========================================
// Application State
// ===========================================
const AppState = {
    currentUser: null,
    currentView: 'auth',
    gameMode: null, // 'single' or 'versus'
    currentMatch: null,
    currentRoom: null,
    selectedCell: null,
    puzzle: null,
    solution: null,
    playerScore: 0,
    opponentScore: 0,
    gameTimer: null,
    gameSeconds: 0,
    soundEnabled: true,
    listeners: [],
    onlinePlayers: {}
};

// ===========================================
// Audio Manager (Web Audio API)
// ===========================================
const AudioManager = {
    context: null,
    
    init() {
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    },
    
    playTone(frequency, duration, type = 'sine') {
        if (!this.context || !AppState.soundEnabled) return;
        
        const oscillator = this.context.createOscillator();
        const gainNode = this.context.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.context.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.3, this.context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);
        
        oscillator.start(this.context.currentTime);
        oscillator.stop(this.context.currentTime + duration);
    },
    
    playCellFill() {
        this.playTone(800, 0.1, 'sine');
    },
    
    playError() {
        this.playTone(200, 0.3, 'square');
    },
    
    playCorrect() {
        this.playTone(600, 0.15, 'sine');
        setTimeout(() => this.playTone(800, 0.15, 'sine'), 100);
    },
    
    playVictory() {
        [523, 659, 784, 1047].forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.2, 'sine'), i * 150);
        });
    },
    
    playDefeat() {
        [400, 350, 300, 250].forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.25, 'sawtooth'), i * 200);
        });
    }
};

// ===========================================
// Sudoku Generator
// ===========================================
const SudokuGenerator = {
    // Check if placing num at (row, col) is valid
    isValid(grid, row, col, num) {
        // Check row
        for (let x = 0; x < 9; x++) {
            if (grid[row][x] === num) return false;
        }
        
        // Check column
        for (let x = 0; x < 9; x++) {
            if (grid[x][col] === num) return false;
        }
        
        // Check 3x3 box
        const startRow = row - (row % 3);
        const startCol = col - (col % 3);
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (grid[startRow + i][startCol + j] === num) return false;
            }
        }
        
        return true;
    },
    
    // Solve the grid using backtracking
    solve(grid) {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (grid[row][col] === 0) {
                    const nums = this.shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
                    for (const num of nums) {
                        if (this.isValid(grid, row, col, num)) {
                            grid[row][col] = num;
                            if (this.solve(grid)) return true;
                            grid[row][col] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    },
    
    // Shuffle array (Fisher-Yates)
    shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },
    
    // Generate a complete valid Sudoku grid
    generateComplete() {
        const grid = Array(9).fill(null).map(() => Array(9).fill(0));
        this.solve(grid);
        return grid;
    },
    
    // Create puzzle by removing cells based on difficulty
    createPuzzle(difficulty = 'medium') {
        const solution = this.generateComplete();
        const puzzle = solution.map(row => [...row]);
        
        const cellsToRemove = {
            easy: 35,
            medium: 45,
            hard: 55
        };
        
        const removeCount = cellsToRemove[difficulty] || 45;
        let removed = 0;
        const positions = [];
        
        // Create list of all positions
        for (let i = 0; i < 81; i++) {
            positions.push(i);
        }
        
        // Shuffle positions
        const shuffledPositions = this.shuffleArray(positions);
        
        for (const pos of shuffledPositions) {
            if (removed >= removeCount) break;
            
            const row = Math.floor(pos / 9);
            const col = pos % 9;
            
            if (puzzle[row][col] !== 0) {
                puzzle[row][col] = 0;
                removed++;
            }
        }
        
        return { puzzle, solution };
    }
};

// ===========================================
// Profanity Filter (Basic)
// ===========================================
const ProfanityFilter = {
    badWords: ['badword1', 'badword2'], // Add actual words as needed
    
    filter(text) {
        let filtered = text;
        for (const word of this.badWords) {
            const regex = new RegExp(word, 'gi');
            filtered = filtered.replace(regex, '*'.repeat(word.length));
        }
        return filtered;
    }
};

// ===========================================
// View Manager
// ===========================================
const ViewManager = {
    views: ['auth', 'lobby', 'waiting', 'game'],
    
    show(viewName) {
        this.views.forEach(view => {
            const element = document.getElementById(`${view}-view`);
            if (element) {
                element.style.display = view === viewName ? 'block' : 'none';
            }
        });
        AppState.currentView = viewName;
    },
    
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'flex';
    },
    
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    }
};

// ===========================================
// Presence System
// ===========================================
const PresenceSystem = {
    presenceRef: null,
    connectedRef: null,
    
    async init(userId, displayName) {
        this.presenceRef = ref(rtdb, `presence/${userId}`);
        this.connectedRef = ref(rtdb, '.info/connected');
        
        // Set up presence on connect/disconnect
        onValue(this.connectedRef, async (snapshot) => {
            if (snapshot.val() === true) {
                // We're connected
                await set(this.presenceRef, {
                    status: 'online',
                    displayName: displayName,
                    last_changed: serverTimestamp(),
                    current_activity: 'In Lobby'
                });
                
                // Set offline on disconnect
                onDisconnect(this.presenceRef).set({
                    status: 'offline',
                    displayName: displayName,
                    last_changed: serverTimestamp(),
                    current_activity: null
                });
            }
        });
    },
    
    async updateActivity(activity) {
        if (this.presenceRef && AppState.currentUser) {
            await update(this.presenceRef, {
                current_activity: activity,
                last_changed: serverTimestamp()
            });
        }
    },
    
    async setStatus(status) {
        if (this.presenceRef && AppState.currentUser) {
            await update(this.presenceRef, {
                status: status,
                last_changed: serverTimestamp()
            });
        }
    },
    
    listenToOnlinePlayers(callback) {
        const presenceListRef = ref(rtdb, 'presence');
        const listener = onValue(presenceListRef, (snapshot) => {
            const players = {};
            snapshot.forEach((child) => {
                if (child.key !== AppState.currentUser?.uid) {
                    players[child.key] = child.val();
                }
            });
            callback(players);
        });
        AppState.listeners.push({ ref: presenceListRef, callback: listener });
    },
    
    async cleanup() {
        if (this.presenceRef) {
            await remove(this.presenceRef);
        }
    }
};

// ===========================================
// User Profile Manager
// ===========================================
const ProfileManager = {
    async createOrUpdateProfile(userId, data) {
        const profileRef = doc(firestore, 'users', userId);
        const existing = await getDoc(profileRef);
        
        if (!existing.exists()) {
            // Create new profile
            await setDoc(profileRef, {
                userId: userId,
                displayName: data.displayName || `Player_${userId.substring(0, 6)}`,
                memberSince: Timestamp.now(),
                badges: [],
                stats: {
                    wins: 0,
                    losses: 0
                }
            });
        }
        
        return await getDoc(profileRef);
    },
    
    async getProfile(userId) {
        const profileRef = doc(firestore, 'users', userId);
        return await getDoc(profileRef);
    },
    
    async updateStats(userId, won) {
        const profileRef = doc(firestore, 'users', userId);
        const profile = await getDoc(profileRef);
        
        if (profile.exists()) {
            const stats = profile.data().stats || { wins: 0, losses: 0 };
            if (won) {
                stats.wins++;
            } else {
                stats.losses++;
            }
            
            await updateDoc(profileRef, { stats });
            
            // Check for badge achievements
            await this.checkBadges(userId, stats);
        }
    },
    
    async checkBadges(userId, stats) {
        const badges = [];
        
        // Veteran badge: 10+ games
        if (stats.wins + stats.losses >= 10) {
            badges.push('veteran');
        }
        
        // Winner badge: 5+ wins
        if (stats.wins >= 5) {
            badges.push('winner');
        }
        
        if (badges.length > 0) {
            const profileRef = doc(firestore, 'users', userId);
            await updateDoc(profileRef, {
                badges: arrayUnion(...badges)
            });
        }
    },
    
    async addBadge(userId, badge) {
        const profileRef = doc(firestore, 'users', userId);
        await updateDoc(profileRef, {
            badges: arrayUnion(badge)
        });
    }
};

// ===========================================
// Lobby/Room Manager
// ===========================================
const LobbyManager = {
    generateRoomCode() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    },
    
    async createRoom(userId, displayName) {
        let code = this.generateRoomCode();
        let attempts = 0;
        
        // Ensure unique code
        while (attempts < 10) {
            const roomRef = ref(rtdb, `lobbies/${code}`);
            const snapshot = await get(roomRef);
            
            if (!snapshot.exists()) {
                await set(roomRef, {
                    code: code,
                    host: userId,
                    hostName: displayName,
                    players: {
                        [userId]: {
                            name: displayName,
                            ready: true,
                            joinedAt: serverTimestamp()
                        }
                    },
                    status: 'waiting',
                    createdAt: serverTimestamp()
                });
                
                return code;
            }
            
            code = this.generateRoomCode();
            attempts++;
        }
        
        throw new Error('Could not generate unique room code');
    },
    
    async joinRoom(code, userId, displayName) {
        const roomRef = ref(rtdb, `lobbies/${code}`);
        const snapshot = await get(roomRef);
        
        if (!snapshot.exists()) {
            throw new Error('Room not found');
        }
        
        const room = snapshot.val();
        if (room.status !== 'waiting') {
            throw new Error('Game already started');
        }
        
        const playerCount = Object.keys(room.players || {}).length;
        if (playerCount >= 2) {
            throw new Error('Room is full');
        }
        
        // Add player to room
        await update(ref(rtdb, `lobbies/${code}/players`), {
            [userId]: {
                name: displayName,
                ready: true,
                joinedAt: serverTimestamp()
            }
        });
        
        return room;
    },
    
    async leaveRoom(code, userId) {
        const roomRef = ref(rtdb, `lobbies/${code}`);
        const snapshot = await get(roomRef);
        
        if (snapshot.exists()) {
            const room = snapshot.val();
            
            // If host leaves, delete room
            if (room.host === userId) {
                await remove(roomRef);
            } else {
                // Remove player from room
                await remove(ref(rtdb, `lobbies/${code}/players/${userId}`));
            }
        }
    },
    
    listenToRoom(code, callback) {
        const roomRef = ref(rtdb, `lobbies/${code}`);
        const listener = onValue(roomRef, (snapshot) => {
            callback(snapshot.val());
        });
        AppState.listeners.push({ ref: roomRef, callback: listener });
        return listener;
    }
};

// ===========================================
// Match Manager (1v1 Gameplay)
// ===========================================
const MatchManager = {
    async createMatch(roomCode, players, puzzle, solution) {
        const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const playerIds = Object.keys(players);
        
        // Create board state (flatten for easier updates)
        const boardState = {};
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const cellId = `${row}_${col}`;
                boardState[cellId] = {
                    value: puzzle[row][col],
                    given: puzzle[row][col] !== 0,
                    filledBy: null
                };
            }
        }
        
        const matchData = {
            id: matchId,
            roomCode: roomCode,
            players: players,
            playerIds: playerIds,
            scores: {
                [playerIds[0]]: 0,
                [playerIds[1]]: 0
            },
            board: boardState,
            solution: solution.flat(), // Store flat solution for validation
            status: 'active',
            startedAt: serverTimestamp(),
            winner: null
        };
        
        await set(ref(rtdb, `matches/${matchId}`), matchData);
        
        // Update room status
        await update(ref(rtdb, `lobbies/${roomCode}`), {
            status: 'playing',
            matchId: matchId
        });
        
        return matchId;
    },
    
    async makeMove(matchId, userId, row, col, value) {
        const cellRef = ref(rtdb, `matches/${matchId}/board/${row}_${col}`);
        const matchRef = ref(rtdb, `matches/${matchId}`);
        
        // Use transaction for atomic update
        const result = await runTransaction(cellRef, (currentData) => {
            if (currentData === null) return null;
            
            // Cell already filled
            if (currentData.given || currentData.filledBy !== null) {
                return; // Abort transaction
            }
            
            // Fill the cell
            return {
                ...currentData,
                value: value,
                filledBy: userId
            };
        });
        
        if (result.committed) {
            // Get match data to check solution
            const matchSnapshot = await get(matchRef);
            const match = matchSnapshot.val();
            
            const cellIndex = row * 9 + col;
            const isCorrect = match.solution[cellIndex] === value;
            
            // Update score
            const newScore = (match.scores[userId] || 0) + (isCorrect ? 1 : -1);
            await update(ref(rtdb, `matches/${matchId}/scores`), {
                [userId]: Math.max(0, newScore)
            });
            
            // Check win condition
            await this.checkWinCondition(matchId);
            
            return { success: true, correct: isCorrect };
        }
        
        return { success: false, reason: 'Cell already filled' };
    },
    
    async checkWinCondition(matchId) {
        const matchRef = ref(rtdb, `matches/${matchId}`);
        const snapshot = await get(matchRef);
        const match = snapshot.val();
        
        if (!match || match.status !== 'active') return;
        
        // Check if board is complete
        const board = match.board;
        let filledCells = 0;
        
        for (const cellId in board) {
            if (board[cellId].value !== 0) {
                filledCells++;
            }
        }
        
        const totalCells = 81;
        const winThreshold = Math.ceil(totalCells / 2);
        
        // Check if any player reached win threshold
        for (const playerId of match.playerIds) {
            if (match.scores[playerId] >= winThreshold) {
                await update(matchRef, {
                    status: 'finished',
                    winner: playerId,
                    finishedAt: serverTimestamp()
                });
                return;
            }
        }
        
        // Check if board is full
        if (filledCells === totalCells) {
            const scores = match.scores;
            const playerIds = match.playerIds;
            const winner = scores[playerIds[0]] > scores[playerIds[1]] ? playerIds[0] : 
                          scores[playerIds[1]] > scores[playerIds[0]] ? playerIds[1] : 'tie';
            
            await update(matchRef, {
                status: 'finished',
                winner: winner,
                finishedAt: serverTimestamp()
            });
        }
    },
    
    listenToMatch(matchId, callback) {
        const matchRef = ref(rtdb, `matches/${matchId}`);
        const listener = onValue(matchRef, (snapshot) => {
            callback(snapshot.val());
        });
        AppState.listeners.push({ ref: matchRef, callback: listener });
        return listener;
    },
    
    async endMatch(matchId) {
        await update(ref(rtdb, `matches/${matchId}`), {
            status: 'finished',
            finishedAt: serverTimestamp()
        });
    }
};

// ===========================================
// Chat Manager
// ===========================================
const ChatManager = {
    async sendGlobalMessage(userId, displayName, text) {
        const filteredText = ProfanityFilter.filter(text);
        const chatRef = ref(rtdb, 'globalChat');
        
        await push(chatRef, {
            userId: userId,
            displayName: displayName,
            text: filteredText,
            timestamp: serverTimestamp()
        });
    },
    
    listenToGlobalChat(callback) {
        const chatRef = ref(rtdb, 'globalChat');
        
        // Only get last 50 messages
        const listener = onChildAdded(chatRef, (snapshot) => {
            callback(snapshot.val());
        });
        
        AppState.listeners.push({ ref: chatRef, callback: listener });
        return listener;
    },
    
    async sendGameMessage(matchId, userId, displayName, text) {
        const filteredText = ProfanityFilter.filter(text);
        const chatRef = ref(rtdb, `matches/${matchId}/chat`);
        
        await push(chatRef, {
            userId: userId,
            displayName: displayName,
            text: filteredText,
            timestamp: serverTimestamp()
        });
    },
    
    listenToGameChat(matchId, callback) {
        const chatRef = ref(rtdb, `matches/${matchId}/chat`);
        const listener = onChildAdded(chatRef, (snapshot) => {
            callback(snapshot.val());
        });
        AppState.listeners.push({ ref: chatRef, callback: listener });
        return listener;
    }
};

// ===========================================
// Challenge System
// ===========================================
const ChallengeSystem = {
    async sendChallenge(fromUserId, fromName, toUserId) {
        const notificationRef = ref(rtdb, `notifications/${toUserId}/${fromUserId}`);
        
        await set(notificationRef, {
            type: 'challenge',
            from: fromUserId,
            fromName: fromName,
            timestamp: serverTimestamp(),
            status: 'pending'
        });
    },
    
    listenToNotifications(userId, callback) {
        const notificationsRef = ref(rtdb, `notifications/${userId}`);
        const listener = onChildAdded(notificationsRef, (snapshot) => {
            callback(snapshot.key, snapshot.val());
        });
        AppState.listeners.push({ ref: notificationsRef, callback: listener });
        return listener;
    },
    
    async acceptChallenge(userId, challengerId) {
        // Create a room for both players
        const code = await LobbyManager.createRoom(challengerId, 'Challenger');
        
        // Update notification
        await update(ref(rtdb, `notifications/${userId}/${challengerId}`), {
            status: 'accepted',
            roomCode: code
        });
        
        return code;
    },
    
    async declineChallenge(userId, challengerId) {
        await remove(ref(rtdb, `notifications/${userId}/${challengerId}`));
    }
};

// ===========================================
// UI Helpers
// ===========================================
const UI = {
    updatePlayersList(players) {
        const container = document.getElementById('players-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        for (const [id, player] of Object.entries(players)) {
            if (player.status === 'online') {
                const item = document.createElement('div');
                item.className = 'player-item';
                item.dataset.userId = id;
                item.innerHTML = `
                    <div class="player-item-info">
                        <span class="player-item-status status-dot ${player.status}"></span>
                        <span class="player-item-name">${this.escapeHtml(player.displayName || 'Anonymous')}</span>
                    </div>
                    <span class="player-item-activity">${this.escapeHtml(player.current_activity || '')}</span>
                `;
                item.addEventListener('click', () => this.showPlayerProfile(id));
                container.appendChild(item);
            }
        }
        
        // Update online count
        const onlineCount = Object.values(players).filter(p => p.status === 'online').length;
        const countEl = document.getElementById('online-count');
        if (countEl) countEl.textContent = onlineCount;
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    async showPlayerProfile(userId) {
        const profile = await ProfileManager.getProfile(userId);
        if (!profile.exists()) return;
        
        const data = profile.data();
        
        document.getElementById('profile-name').textContent = data.displayName || 'Anonymous';
        document.getElementById('profile-member-since').textContent = 
            `Member since: ${data.memberSince?.toDate?.()?.toLocaleDateString() || 'Unknown'}`;
        document.getElementById('profile-wins').textContent = data.stats?.wins || 0;
        document.getElementById('profile-losses').textContent = data.stats?.losses || 0;
        
        // Show badges
        const badgesContainer = document.getElementById('profile-badges');
        badgesContainer.innerHTML = '';
        (data.badges || []).forEach(badge => {
            const badgeEl = document.createElement('span');
            badgeEl.className = `badge ${badge}`;
            badgeEl.textContent = badge;
            badgesContainer.appendChild(badgeEl);
        });
        
        // Set up challenge button
        document.getElementById('challenge-player').onclick = async () => {
            await ChallengeSystem.sendChallenge(
                AppState.currentUser.uid,
                AppState.currentUser.displayName || 'Player',
                userId
            );
            ViewManager.hideModal('profile-modal');
            alert('Challenge sent!');
        };
        
        ViewManager.showModal('profile-modal');
    },
    
    addChatMessage(containerId, sender, text, timestamp) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const messageEl = document.createElement('div');
        messageEl.className = 'chat-message';
        
        const time = timestamp ? new Date(timestamp).toLocaleTimeString() : '';
        
        messageEl.innerHTML = `
            <span class="chat-message-sender">${this.escapeHtml(sender)}</span>
            <span class="chat-message-text">${this.escapeHtml(text)}</span>
            <span class="chat-message-time">${time}</span>
        `;
        
        container.appendChild(messageEl);
        container.scrollTop = container.scrollHeight;
    },
    
    updateStats(stats) {
        document.getElementById('stat-wins').textContent = stats.wins || 0;
        document.getElementById('stat-losses').textContent = stats.losses || 0;
        
        const total = (stats.wins || 0) + (stats.losses || 0);
        const winrate = total > 0 ? Math.round((stats.wins / total) * 100) : 0;
        document.getElementById('stat-winrate').textContent = `${winrate}%`;
    },
    
    updateBadges(badges) {
        const container = document.getElementById('badges-list');
        if (!container) return;
        
        container.innerHTML = '';
        (badges || []).forEach(badge => {
            const badgeEl = document.createElement('span');
            badgeEl.className = `badge ${badge}`;
            badgeEl.textContent = badge;
            container.appendChild(badgeEl);
        });
    },
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
};

// ===========================================
// Game UI
// ===========================================
const GameUI = {
    createGrid() {
        const grid = document.getElementById('sudoku-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const cell = document.createElement('div');
                cell.className = 'sudoku-cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                cell.addEventListener('click', () => this.selectCell(row, col));
                
                grid.appendChild(cell);
            }
        }
    },
    
    renderPuzzle(puzzle, board = null) {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const cell = document.querySelector(
                    `.sudoku-cell[data-row="${row}"][data-col="${col}"]`
                );
                
                if (!cell) continue;
                
                cell.classList.remove('given', 'selected', 'error', 'correct', 
                                      'player-fill', 'opponent-fill');
                
                let value, isGiven, filledBy;
                
                if (board) {
                    // 1v1 mode - use board state from RTDB
                    const cellData = board[`${row}_${col}`];
                    value = cellData?.value || 0;
                    isGiven = cellData?.given || false;
                    filledBy = cellData?.filledBy;
                } else {
                    // Single player mode
                    value = puzzle[row][col];
                    isGiven = AppState.puzzle[row][col] !== 0 && 
                             AppState.puzzle[row][col] === value;
                }
                
                cell.textContent = value !== 0 ? value : '';
                
                if (isGiven) {
                    cell.classList.add('given');
                } else if (filledBy) {
                    if (filledBy === AppState.currentUser?.uid) {
                        cell.classList.add('player-fill');
                    } else {
                        cell.classList.add('opponent-fill');
                    }
                }
            }
        }
    },
    
    selectCell(row, col) {
        // Remove previous selection
        document.querySelectorAll('.sudoku-cell.selected').forEach(c => {
            c.classList.remove('selected');
        });
        
        const cell = document.querySelector(
            `.sudoku-cell[data-row="${row}"][data-col="${col}"]`
        );
        
        if (cell && !cell.classList.contains('given')) {
            cell.classList.add('selected');
            AppState.selectedCell = { row, col };
        }
    },
    
    async inputNumber(num) {
        if (!AppState.selectedCell) return;
        
        const { row, col } = AppState.selectedCell;
        const cell = document.querySelector(
            `.sudoku-cell[data-row="${row}"][data-col="${col}"]`
        );
        
        if (!cell || cell.classList.contains('given')) return;
        
        // Resume audio context on user interaction
        if (AudioManager.context?.state === 'suspended') {
            AudioManager.context.resume();
        }
        
        if (AppState.gameMode === 'versus' && AppState.currentMatch) {
            // 1v1 mode - use transaction
            const result = await MatchManager.makeMove(
                AppState.currentMatch,
                AppState.currentUser.uid,
                row, col, num
            );
            
            if (result.success) {
                if (result.correct) {
                    AudioManager.playCorrect();
                    cell.classList.add('correct');
                } else {
                    AudioManager.playError();
                    cell.classList.add('error');
                }
                setTimeout(() => {
                    cell.classList.remove('correct', 'error');
                }, 500);
            } else {
                // Cell was already filled by opponent
                AudioManager.playError();
            }
        } else {
            // Single player mode
            if (num === 0) {
                cell.textContent = '';
                AppState.puzzle[row][col] = 0;
            } else {
                cell.textContent = num;
                AppState.puzzle[row][col] = num;
                
                // Check if correct
                if (num === AppState.solution[row][col]) {
                    AudioManager.playCorrect();
                    cell.classList.add('correct');
                    AppState.playerScore++;
                    document.getElementById('player-score').textContent = AppState.playerScore;
                } else {
                    AudioManager.playError();
                    cell.classList.add('error');
                }
                
                setTimeout(() => {
                    cell.classList.remove('correct', 'error');
                }, 500);
                
                // Check if puzzle is complete
                this.checkSinglePlayerComplete();
            }
        }
        
        AudioManager.playCellFill();
    },
    
    checkSinglePlayerComplete() {
        if (!AppState.puzzle || !AppState.solution) return;
        
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (AppState.puzzle[row][col] !== AppState.solution[row][col]) {
                    return;
                }
            }
        }
        
        // Puzzle complete!
        this.endSinglePlayerGame(true);
    },
    
    startTimer() {
        AppState.gameSeconds = 0;
        const timerEl = document.getElementById('game-timer');
        
        AppState.gameTimer = setInterval(() => {
            AppState.gameSeconds++;
            if (timerEl) {
                timerEl.textContent = UI.formatTime(AppState.gameSeconds);
            }
        }, 1000);
    },
    
    stopTimer() {
        if (AppState.gameTimer) {
            clearInterval(AppState.gameTimer);
            AppState.gameTimer = null;
        }
    },
    
    endSinglePlayerGame(won) {
        this.stopTimer();
        
        document.getElementById('game-over-title').textContent = won ? 'Congratulations!' : 'Game Over';
        document.getElementById('result-icon').textContent = won ? '🏆' : '😔';
        document.getElementById('result-message').textContent = won ? 'You solved the puzzle!' : 'Better luck next time!';
        document.getElementById('final-score').textContent = AppState.playerScore;
        document.getElementById('final-time').textContent = UI.formatTime(AppState.gameSeconds);
        document.getElementById('opponent-score-row').style.display = 'none';
        
        if (won) {
            AudioManager.playVictory();
        } else {
            AudioManager.playDefeat();
        }
        
        ViewManager.showModal('game-over-modal');
    },
    
    endVersusGame(match) {
        this.stopTimer();
        
        const isWinner = match.winner === AppState.currentUser?.uid;
        const isTie = match.winner === 'tie';
        
        document.getElementById('game-over-title').textContent = 
            isTie ? 'It\'s a Tie!' : (isWinner ? 'Victory!' : 'Defeat');
        document.getElementById('result-icon').textContent = 
            isTie ? '🤝' : (isWinner ? '🏆' : '😔');
        document.getElementById('result-message').textContent = 
            isTie ? 'Great match!' : (isWinner ? 'You won the match!' : 'Your opponent won');
        
        const userId = AppState.currentUser?.uid;
        const opponentId = match.playerIds.find(id => id !== userId);
        
        document.getElementById('final-score').textContent = match.scores[userId] || 0;
        document.getElementById('opponent-score-row').style.display = 'flex';
        document.getElementById('final-opponent-score').textContent = match.scores[opponentId] || 0;
        document.getElementById('final-time').textContent = UI.formatTime(AppState.gameSeconds);
        
        if (isWinner) {
            AudioManager.playVictory();
            ProfileManager.updateStats(userId, true);
        } else if (!isTie) {
            AudioManager.playDefeat();
            ProfileManager.updateStats(userId, false);
        }
        
        ViewManager.showModal('game-over-modal');
    },
    
    updateScores(scores, playerIds) {
        const userId = AppState.currentUser?.uid;
        const opponentId = playerIds?.find(id => id !== userId);
        
        document.getElementById('player-score').textContent = scores[userId] || 0;
        if (opponentId) {
            document.getElementById('opponent-score').textContent = scores[opponentId] || 0;
        }
    }
};

// ===========================================
// Event Handlers
// ===========================================
function setupEventListeners() {
    // Theme toggle
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const body = document.body;
        const isDark = body.classList.contains('dark-theme');
        body.classList.remove('dark-theme', 'light-theme');
        body.classList.add(isDark ? 'light-theme' : 'dark-theme');
        
        const icon = document.querySelector('.theme-icon');
        if (icon) icon.textContent = isDark ? '☀️' : '🌙';
    });
    
    // Sound toggle
    document.getElementById('sound-toggle')?.addEventListener('click', () => {
        AppState.soundEnabled = !AppState.soundEnabled;
        const icon = document.querySelector('.sound-icon');
        if (icon) icon.textContent = AppState.soundEnabled ? '🔊' : '🔇';
    });
    
    // Auth - Anonymous login
    document.getElementById('anonymous-login')?.addEventListener('click', async () => {
        try {
            await signInAnonymously(auth);
        } catch (error) {
            console.error('Anonymous login failed:', error);
            alert('Login failed. Please try again.');
        }
    });
    
    // Auth - Email login
    document.getElementById('email-auth-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error('Email login failed:', error);
            alert('Login failed: ' + error.message);
        }
    });
    
    // Auth - Email signup
    document.getElementById('email-signup')?.addEventListener('click', async () => {
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        
        if (!email || !password) {
            alert('Please enter email and password');
            return;
        }
        
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error('Signup failed:', error);
            alert('Signup failed: ' + error.message);
        }
    });
    
    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await PresenceSystem.cleanup();
        await signOut(auth);
    });
    
    // Single player start
    document.getElementById('start-single')?.addEventListener('click', () => {
        const difficulty = document.getElementById('difficulty-select').value;
        startSinglePlayerGame(difficulty);
    });
    
    // Create room
    document.getElementById('create-room')?.addEventListener('click', async () => {
        try {
            const displayName = AppState.currentUser?.displayName || 
                              `Player_${AppState.currentUser?.uid.substring(0, 6)}`;
            const code = await LobbyManager.createRoom(AppState.currentUser.uid, displayName);
            
            AppState.currentRoom = code;
            document.getElementById('display-room-code').textContent = code;
            
            ViewManager.show('waiting');
            PresenceSystem.updateActivity('Waiting for opponent');
            
            // Listen for player joins
            LobbyManager.listenToRoom(code, handleRoomUpdate);
        } catch (error) {
            console.error('Failed to create room:', error);
            alert('Failed to create room. Please try again.');
        }
    });
    
    // Join room
    document.getElementById('join-room')?.addEventListener('click', async () => {
        const code = document.getElementById('room-code-input').value;
        
        if (!code || code.length !== 4) {
            alert('Please enter a valid 4-digit room code');
            return;
        }
        
        try {
            const displayName = AppState.currentUser?.displayName || 
                              `Player_${AppState.currentUser?.uid.substring(0, 6)}`;
            await LobbyManager.joinRoom(code, AppState.currentUser.uid, displayName);
            
            AppState.currentRoom = code;
            ViewManager.show('waiting');
            document.getElementById('display-room-code').textContent = code;
            
            // Listen for game start
            LobbyManager.listenToRoom(code, handleRoomUpdate);
        } catch (error) {
            console.error('Failed to join room:', error);
            alert(error.message || 'Failed to join room');
        }
    });
    
    // Cancel waiting
    document.getElementById('cancel-waiting')?.addEventListener('click', async () => {
        if (AppState.currentRoom) {
            await LobbyManager.leaveRoom(AppState.currentRoom, AppState.currentUser.uid);
            AppState.currentRoom = null;
        }
        ViewManager.show('lobby');
        PresenceSystem.updateActivity('In Lobby');
    });
    
    // Copy room code
    document.getElementById('copy-code')?.addEventListener('click', () => {
        const code = document.getElementById('display-room-code').textContent;
        navigator.clipboard.writeText(code).then(() => {
            alert('Code copied to clipboard!');
        });
    });
    
    // Number pad
    document.querySelectorAll('.num-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const num = parseInt(btn.dataset.num);
            GameUI.inputNumber(num);
        });
    });
    
    // Keyboard input
    document.addEventListener('keydown', (e) => {
        if (AppState.currentView !== 'game') return;
        
        const num = parseInt(e.key);
        if (num >= 1 && num <= 9) {
            GameUI.inputNumber(num);
        } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
            GameUI.inputNumber(0);
        }
    });
    
    // Hint button
    document.getElementById('hint-btn')?.addEventListener('click', () => {
        if (AppState.gameMode === 'single' && AppState.selectedCell) {
            const { row, col } = AppState.selectedCell;
            const correctValue = AppState.solution[row][col];
            GameUI.inputNumber(correctValue);
        }
    });
    
    // Quit game
    document.getElementById('quit-game')?.addEventListener('click', async () => {
        if (confirm('Are you sure you want to quit?')) {
            GameUI.stopTimer();
            
            if (AppState.currentMatch) {
                await MatchManager.endMatch(AppState.currentMatch);
                AppState.currentMatch = null;
            }
            
            if (AppState.currentRoom) {
                await LobbyManager.leaveRoom(AppState.currentRoom, AppState.currentUser.uid);
                AppState.currentRoom = null;
            }
            
            ViewManager.show('lobby');
            PresenceSystem.updateActivity('In Lobby');
        }
    });
    
    // Game over modal buttons
    document.getElementById('play-again')?.addEventListener('click', () => {
        ViewManager.hideModal('game-over-modal');
        
        if (AppState.gameMode === 'single') {
            const difficulty = document.getElementById('difficulty-select').value;
            startSinglePlayerGame(difficulty);
        } else {
            ViewManager.show('lobby');
        }
    });
    
    document.getElementById('back-to-lobby')?.addEventListener('click', () => {
        ViewManager.hideModal('game-over-modal');
        ViewManager.show('lobby');
        PresenceSystem.updateActivity('In Lobby');
    });
    
    // Global chat
    document.getElementById('global-chat-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('global-chat-input');
        const text = input.value.trim();
        
        if (text && AppState.currentUser) {
            const displayName = AppState.currentUser.displayName || 
                              `Player_${AppState.currentUser.uid.substring(0, 6)}`;
            await ChatManager.sendGlobalMessage(AppState.currentUser.uid, displayName, text);
            input.value = '';
        }
    });
    
    // Game chat
    document.getElementById('game-chat-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('game-chat-input');
        const text = input.value.trim();
        
        if (text && AppState.currentUser && AppState.currentMatch) {
            const displayName = AppState.currentUser.displayName || 
                              `Player_${AppState.currentUser.uid.substring(0, 6)}`;
            await ChatManager.sendGameMessage(AppState.currentMatch, AppState.currentUser.uid, displayName, text);
            input.value = '';
        }
    });
    
    // Challenge modal
    document.getElementById('accept-challenge')?.addEventListener('click', async () => {
        // Handle challenge acceptance
        ViewManager.hideModal('challenge-modal');
    });
    
    document.getElementById('decline-challenge')?.addEventListener('click', () => {
        ViewManager.hideModal('challenge-modal');
    });
    
    // Profile modal close
    document.getElementById('close-profile')?.addEventListener('click', () => {
        ViewManager.hideModal('profile-modal');
    });
}

// ===========================================
// Game Functions
// ===========================================
function startSinglePlayerGame(difficulty) {
    AppState.gameMode = 'single';
    AppState.playerScore = 0;
    AppState.selectedCell = null;
    
    const { puzzle, solution } = SudokuGenerator.createPuzzle(difficulty);
    AppState.puzzle = puzzle.map(row => [...row]);
    AppState.solution = solution;
    
    GameUI.createGrid();
    GameUI.renderPuzzle(AppState.puzzle);
    
    document.getElementById('game-mode-label').textContent = `Single Player - ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`;
    document.getElementById('opponent-info').style.display = 'none';
    document.getElementById('game-chat').style.display = 'none';
    document.getElementById('player-score').textContent = '0';
    
    ViewManager.show('game');
    GameUI.startTimer();
    PresenceSystem.updateActivity(`Playing: ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Mode`);
}

async function startVersusGame(roomData) {
    AppState.gameMode = 'versus';
    AppState.playerScore = 0;
    AppState.opponentScore = 0;
    AppState.selectedCell = null;
    
    // Generate puzzle (host generates)
    const isHost = roomData.host === AppState.currentUser?.uid;
    let matchId;
    
    if (isHost) {
        const { puzzle, solution } = SudokuGenerator.createPuzzle('medium');
        matchId = await MatchManager.createMatch(
            AppState.currentRoom,
            roomData.players,
            puzzle,
            solution
        );
    } else {
        // Wait for match to be created
        const roomRef = ref(rtdb, `lobbies/${AppState.currentRoom}`);
        const snapshot = await get(roomRef);
        matchId = snapshot.val()?.matchId;
        
        // If not ready, wait a bit
        if (!matchId) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retrySnapshot = await get(roomRef);
            matchId = retrySnapshot.val()?.matchId;
        }
    }
    
    if (!matchId) {
        alert('Failed to start game. Please try again.');
        ViewManager.show('lobby');
        return;
    }
    
    AppState.currentMatch = matchId;
    
    // Get opponent info
    const opponentId = Object.keys(roomData.players).find(
        id => id !== AppState.currentUser?.uid
    );
    const opponent = roomData.players[opponentId];
    
    GameUI.createGrid();
    
    document.getElementById('game-mode-label').textContent = 'Bust the Board - 1v1';
    document.getElementById('opponent-info').style.display = 'block';
    document.getElementById('opponent-name').textContent = opponent?.name || 'Opponent';
    document.getElementById('game-chat').style.display = 'block';
    document.getElementById('player-score').textContent = '0';
    document.getElementById('opponent-score').textContent = '0';
    
    ViewManager.show('game');
    GameUI.startTimer();
    PresenceSystem.updateActivity('Playing: Bust the Board');
    
    // Listen for match updates
    MatchManager.listenToMatch(matchId, handleMatchUpdate);
    
    // Listen for game chat
    ChatManager.listenToGameChat(matchId, (message) => {
        UI.addChatMessage('game-chat-messages', message.displayName, message.text, message.timestamp);
    });
}

function handleRoomUpdate(room) {
    if (!room) {
        // Room was deleted
        ViewManager.show('lobby');
        AppState.currentRoom = null;
        return;
    }
    
    const playerCount = Object.keys(room.players || {}).length;
    
    if (playerCount === 2 && room.status === 'waiting') {
        // Both players joined, start the game
        startVersusGame(room);
    }
}

function handleMatchUpdate(match) {
    if (!match) return;
    
    // Update board
    const board = match.board;
    const puzzle = [];
    for (let row = 0; row < 9; row++) {
        puzzle[row] = [];
        for (let col = 0; col < 9; col++) {
            const cellData = board[`${row}_${col}`];
            puzzle[row][col] = cellData?.value || 0;
        }
    }
    
    GameUI.renderPuzzle(puzzle, board);
    GameUI.updateScores(match.scores, match.playerIds);
    
    // Check if game ended
    if (match.status === 'finished') {
        GameUI.endVersusGame(match);
    }
}

// ===========================================
// Auth State Handler
// ===========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        AppState.currentUser = user;
        
        // Create/update user profile
        const profile = await ProfileManager.createOrUpdateProfile(user.uid, {
            displayName: user.displayName || user.email || `Player_${user.uid.substring(0, 6)}`
        });
        
        const profileData = profile.data();
        
        // Update UI
        document.getElementById('user-info').style.display = 'flex';
        document.getElementById('user-name').textContent = profileData?.displayName || 'Player';
        
        UI.updateStats(profileData?.stats || { wins: 0, losses: 0 });
        UI.updateBadges(profileData?.badges || []);
        
        // Initialize presence
        await PresenceSystem.init(user.uid, profileData?.displayName || 'Player');
        
        // Listen to online players
        PresenceSystem.listenToOnlinePlayers((players) => {
            AppState.onlinePlayers = players;
            UI.updatePlayersList(players);
        });
        
        // Listen to global chat
        ChatManager.listenToGlobalChat((message) => {
            UI.addChatMessage('global-chat-messages', message.displayName, message.text, message.timestamp);
        });
        
        // Listen for challenges
        ChallengeSystem.listenToNotifications(user.uid, (challengerId, notification) => {
            if (notification.status === 'pending') {
                document.getElementById('challenger-name').textContent = notification.fromName;
                ViewManager.showModal('challenge-modal');
            }
        });
        
        ViewManager.show('lobby');
    } else {
        AppState.currentUser = null;
        document.getElementById('user-info').style.display = 'none';
        
        // Cleanup listeners
        AppState.listeners = [];
        
        ViewManager.show('auth');
    }
});

// ===========================================
// Initialize App
// ===========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('Sudoku Versus initialized');
    
    // Initialize audio
    AudioManager.init();
    
    // Set up event listeners
    setupEventListeners();
    
    // Create initial grid structure
    GameUI.createGrid();
});
