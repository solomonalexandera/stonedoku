import { AppState } from '../appState.js';
import {
    get,
    onDisconnect,
    onValue,
    ref,
    remove,
    serverTimestamp,
    set,
    update
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

export function createMatchManager({ rtdb, appState = AppState } = {}) {
    if (!rtdb) throw new Error('createMatchManager: rtdb required');

    const manager = {
        async createMatch(roomCode, players, puzzle, solution) {
            const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const playerIds = Object.keys(players);

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

            const playerIdsObject = {};
            playerIds.forEach(id => { playerIdsObject[id] = true; });

            const matchData = {
                id: matchId,
                roomCode,
                players,
                playerIds: playerIdsObject,
                scores: {
                    [playerIds[0]]: 0,
                    [playerIds[1]]: 0
                },
                mistakes: {
                    [playerIds[0]]: 0,
                    [playerIds[1]]: 0
                },
                maxMistakes: 3,
                board: boardState,
                solution: solution.flat(),
                status: 'active',
                startedAt: serverTimestamp(),
                winner: null,
                winReason: null
            };

            await set(ref(rtdb, `matches/${matchId}`), matchData);
            await update(ref(rtdb, `lobbies/${roomCode}`), {
                status: 'playing',
                matchId
            });

            return matchId;
        },

        async makeMove(matchId, userId, row, col, value) {
            const cellRef = ref(rtdb, `matches/${matchId}/board/${row}_${col}`);
            const matchRef = ref(rtdb, `matches/${matchId}`);

            try {
                const matchSnapshot = await get(matchRef);
                const match = matchSnapshot.val();

                const participants = typeof match.playerIds === 'object' ? Object.keys(match.playerIds) : match.playerIds || [];
                if (!participants.includes(userId)) {
                    return { success: false, reason: 'Not a participant' };
                }

                if (!match || !match.solution) {
                    return { success: false, reason: 'Match data invalid' };
                }

                const cellSnapshot = await get(cellRef);
                const cellData = cellSnapshot.val();

                if (!cellData) {
                    return { success: false, reason: 'Match not found' };
                }

                if (cellData.given === true) {
                    return { success: false, reason: 'Cell is given' };
                }

                if (cellData.filledBy) {
                    return { success: false, reason: 'Cell already filled' };
                }

                const cellIndex = row * 9 + col;
                const isCorrect = match.solution[cellIndex] === value;

                if (isCorrect) {
                    await update(cellRef, {
                        value,
                        filledBy: userId
                    });

                    const newScore = (match.scores?.[userId] || 0) + 1;
                    await update(ref(rtdb, `matches/${matchId}/scores`), {
                        [userId]: newScore
                    });

                    await this.checkWinCondition(matchId);
                } else {
                    const currentMistakes = (match.mistakes?.[userId] || 0) + 1;
                    await update(ref(rtdb, `matches/${matchId}/mistakes`), {
                        [userId]: currentMistakes
                    });

                    if (currentMistakes >= (match.maxMistakes || 3)) {
                        await this.endMatchByMistakes(matchId, userId);
                        return { success: true, correct: false, gameOver: true, reason: 'mistakes' };
                    }
                }

                return { success: true, correct: isCorrect, mistakes: match.mistakes?.[userId] || 0 };
            } catch (error) {
                console.error('makeMove error:', error);
                return { success: false, reason: error.message };
            }
        },

        async clearCell(matchId, row, col) {
            const cellRef = ref(rtdb, `matches/${matchId}/board/${row}_${col}`);

            try {
                await update(cellRef, {
                    value: 0,
                    filledBy: null
                });
                return { success: true };
            } catch (error) {
                console.error('Clear cell error:', error);
                return { success: false, reason: error.message };
            }
        },

        async endMatchByMistakes(matchId, losingPlayerId) {
            const matchRef = ref(rtdb, `matches/${matchId}`);
            const snapshot = await get(matchRef);
            const match = snapshot.val();

            if (!match || match.status !== 'active') return;

            const playerIds = typeof match.playerIds === 'object' ? Object.keys(match.playerIds) : match.playerIds;
            const winningPlayerId = playerIds.find(id => id !== losingPlayerId);

            await update(matchRef, {
                status: 'finished',
                winner: winningPlayerId,
                winReason: 'opponent_mistakes',
                finishedAt: serverTimestamp()
            });
        },

        async checkWinCondition(matchId) {
            const matchRef = ref(rtdb, `matches/${matchId}`);
            const snapshot = await get(matchRef);
            const match = snapshot.val();

            if (!match || match.status !== 'active') return;

            const playerIds = typeof match.playerIds === 'object' ? Object.keys(match.playerIds) : match.playerIds;

            const board = match.board;
            let correctCells = 0;

            for (const cellId in board) {
                if (board[cellId].value !== 0) {
                    const [row, col] = cellId.split('_').map(Number);
                    const cellIndex = row * 9 + col;
                    if (match.solution[cellIndex] === board[cellId].value) {
                        correctCells++;
                    }
                }
            }

            if (correctCells === 81) {
                const scores = match.scores;
                let winner;
                if (scores[playerIds[0]] > scores[playerIds[1]]) {
                    winner = playerIds[0];
                } else if (scores[playerIds[1]] > scores[playerIds[0]]) {
                    winner = playerIds[1];
                } else {
                    winner = 'tie';
                }

                await update(matchRef, {
                    status: 'finished',
                    winner,
                    winReason: 'board_complete',
                    finishedAt: serverTimestamp()
                });
            }
        },

        listenToMatch(matchId, callback) {
            const matchRef = ref(rtdb, `matches/${matchId}`);
            const listener = onValue(matchRef, (snapshot) => {
                const data = snapshot.val();
                callback(data);
            }, (error) => {
                console.error('Match listener error:', error);
            });
            appState.listeners.push({ ref: matchRef, callback: listener });
            return listener;
        },

        startOpponentPresenceMonitor(matchId, opponentId, onDisconnectHandler) {
            const opponentPresenceRef = ref(rtdb, `presence/${opponentId}`);
            appState.opponentDisconnectTimers = appState.opponentDisconnectTimers || {};

            const listener = onValue(opponentPresenceRef, (snapshot) => {
                const presenceData = snapshot.val();

                if (presenceData && presenceData.status === 'online') {
                    const existing = appState.opponentDisconnectTimers[opponentId];
                    if (existing) {
                        clearTimeout(existing);
                        delete appState.opponentDisconnectTimers[opponentId];
                    }
                    return;
                }

                const graceMs = 30000;
                const timerId = setTimeout(() => {
                    delete appState.opponentDisconnectTimers[opponentId];
                    try {
                        onDisconnectHandler();
                    } catch (e) {
                        console.error('onDisconnect handler threw:', e);
                    }
                }, graceMs);

                if (appState.opponentDisconnectTimers[opponentId]) {
                    clearTimeout(appState.opponentDisconnectTimers[opponentId]);
                }
                appState.opponentDisconnectTimers[opponentId] = timerId;
            });

            appState.listeners.push({ ref: opponentPresenceRef, callback: listener });
            return listener;
        },

        async handleOpponentDisconnect(matchId, currentUserId) {
            const matchRef = ref(rtdb, `matches/${matchId}`);

            try {
                const snapshot = await get(matchRef);
                const match = snapshot.val();

                if (!match || match.status !== 'active') {
                    return;
                }

                await update(matchRef, {
                    status: 'finished',
                    winner: currentUserId,
                    finishedAt: serverTimestamp(),
                    endReason: 'opponent_disconnect'
                });
            } catch (error) {
                console.error('Error handling opponent disconnect:', error);
            }
        },

        async setupMatchHeartbeat(matchId, userId) {
            const matchActivityRef = ref(rtdb, `matches/${matchId}/activity/${userId}`);

            await set(matchActivityRef, {
                lastActive: serverTimestamp(),
                online: true
            });

            const heartbeatInterval = setInterval(async () => {
                if (appState.currentMatch !== matchId) {
                    clearInterval(heartbeatInterval);
                    return;
                }

                try {
                    await update(matchActivityRef, {
                        lastActive: serverTimestamp()
                    });
                } catch (error) {
                    console.error('Heartbeat update failed:', error);
                }
            }, 15000);

            onDisconnect(matchActivityRef).update({
                online: false,
                disconnectedAt: serverTimestamp()
            });

            return heartbeatInterval;
        },

        async endMatch(matchId) {
            await update(ref(rtdb, `matches/${matchId}`), {
                status: 'finished',
                finishedAt: serverTimestamp()
            });
        },

        async resignMatch(matchId, userId) {
            if (!matchId || !userId) return;
            const matchRef = ref(rtdb, `matches/${matchId}`);
            const snapshot = await get(matchRef);
            const match = snapshot.val();
            if (!match || match.status !== 'active') return;

            const playerIds = typeof match.playerIds === 'object' ? Object.keys(match.playerIds) : match.playerIds || [];
            const opponentId = playerIds.find((id) => id !== userId);
            if (!opponentId) return;

            await update(matchRef, {
                status: 'finished',
                winner: opponentId,
                finishedAt: serverTimestamp(),
                winReason: 'resign',
                resignedBy: userId
            });
        }
    };

    return manager;
}
