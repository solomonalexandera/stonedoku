import { AppState } from '../core/appState.js';
import { BoardIntegritySystem } from './boardIntegrity.js';

export function createGameUi({
    AppState: appState = AppState,
    BoardIntegritySystem: boardIntegrity = BoardIntegritySystem,
    GameHelpers: gameHelpers,
    AudioManager: audioManager,
    CreativeFeatures: creativeFeatures = globalThis.CreativeFeatures,
    ArchitecturalStateSystem: architecturalStateSystem = globalThis.ArchitecturalStateSystem,
    UI: ui = globalThis.UI,
    ProfileManager: profileManager = globalThis.ProfileManager,
    ViewManager: viewManager = globalThis.ViewManager,
    MatchManager: matchManager = globalThis.MatchManager,
    showPostMatchScreen: showPostMatchScreenFn = globalThis.showPostMatchScreen
} = {}) {
    if (!gameHelpers) throw new Error('GameUI requires GameHelpers');
    if (!audioManager) throw new Error('GameUI requires AudioManager');

    const gameUI = {
        createGrid() {
            const grid = document.getElementById('sudoku-grid');
            if (!grid) return;

            grid.innerHTML = '';
            boardIntegrity.initGrid(grid);

            grid.setAttribute('role', 'grid');
            grid.setAttribute('aria-label', 'Sudoku puzzle board');

            for (let row = 0; row < 9; row++) {
                for (let col = 0; col < 9; col++) {
                    const cell = document.createElement('div');
                    cell.className = 'sudoku-cell';
                    cell.dataset.row = row;
                    cell.dataset.col = col;
                    boardIntegrity.registerCell(cell, row, col);

                    const valueEl = document.createElement('span');
                    valueEl.className = 'cell-value';
                    valueEl.setAttribute('aria-hidden', 'true');
                    cell.appendChild(valueEl);

                    const notesEl = document.createElement('div');
                    notesEl.className = 'cell-notes';
                    notesEl.setAttribute('aria-hidden', 'true');
                    cell.appendChild(notesEl);

                    cell.setAttribute('role', 'gridcell');
                    cell.setAttribute('tabindex', '0');
                    cell.setAttribute('aria-label', `Row ${row + 1}, Column ${col + 1}, empty`);

                    cell.addEventListener('click', () => this.selectCell(row, col));

                    cell.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            this.selectCell(row, col);
                        }
                    });

                    grid.appendChild(cell);
                }
            }
        },

        renderPuzzle(puzzle, board = null) {
            console.log('renderPuzzle called, board:', board ? 'present' : 'null');

            let cellsFound = 0;
            for (let row = 0; row < 9; row++) {
                for (let col = 0; col < 9; col++) {
                    const cell = document.querySelector(
                        `.sudoku-cell[data-row="${row}"][data-col="${col}"]`
                    );

                    if (!cell) {
                        continue;
                    }
                    cellsFound++;

                    cell.classList.remove('given', 'selected', 'error', 'correct',
                                          'player-fill', 'opponent-fill');

                    let value, isGiven, filledBy;

                    if (board) {
                        const cellData = board[`${row}_${col}`];
                        value = cellData?.value || 0;
                        isGiven = cellData?.given || false;
                        filledBy = cellData?.filledBy;
                    } else {
                        value = puzzle[row][col];
                        isGiven = appState.originalPuzzle?.[row]?.[col] !== 0;
                    }
                    const valueEl = cell.querySelector('.cell-value');
                    const notesEl = cell.querySelector('.cell-notes');
                    if (valueEl) valueEl.textContent = value !== 0 ? String(value) : '';
                    else cell.textContent = value !== 0 ? String(value) : '';

                    if (!board && !isGiven && value === 0 && notesEl) {
                        const key = `${row}_${col}`;
                        const set = appState.notes?.[key];
                        this.renderNotesForCell(notesEl, set);
                    } else if (notesEl) {
                        notesEl.innerHTML = '';
                    }

                    let ariaLabel = `Row ${row + 1}, Column ${col + 1}`;
                    if (value !== 0) {
                        ariaLabel += `, ${value}`;
                        if (isGiven) {
                            ariaLabel += ' (given)';
                        } else if (filledBy) {
                            ariaLabel += filledBy === appState.currentUser?.uid ? ' (your entry)' : ' (opponent entry)';
                        }
                    } else {
                        ariaLabel += ', empty';
                    }
                    cell.setAttribute('aria-label', ariaLabel);

                    if (isGiven) {
                        cell.classList.add('given');
                    } else if (filledBy) {
                        if (filledBy === appState.currentUser?.uid) {
                            cell.classList.add('player-fill');
                        } else {
                            cell.classList.add('opponent-fill');
                        }
                    }
                }
            }

            console.log('renderPuzzle complete, cells found:', cellsFound);

            if (board) {
                boardIntegrity.updateFromVersusBoard(board);
            } else {
                boardIntegrity.updateFromSingleState();
            }

            if (board) {
                appState.puzzle = puzzle;
            }
        },

        renderNotesForCell(notesEl, set) {
            if (!notesEl) return;
            const nums = Array.isArray(set) ? set : (set instanceof Set ? Array.from(set) : []);
            const sorted = nums.map(n => Number(n)).filter(n => n >= 1 && n <= 9).sort((a, b) => a - b);
            notesEl.innerHTML = '';
            for (let i = 1; i <= 9; i++) {
                const s = document.createElement('span');
                s.textContent = String(i);
                s.className = sorted.includes(i) ? 'on' : '';
                notesEl.appendChild(s);
            }
        },

        selectCell(row, col) {
            document.querySelectorAll('.sudoku-cell.selected').forEach(c => {
                c.classList.remove('selected');
            });
            document.querySelectorAll('.sudoku-cell.same-number').forEach(c => {
                c.classList.remove('same-number');
            });

            const cell = document.querySelector(
                `.sudoku-cell[data-row="${row}"][data-col="${col}"]`
            );

            if (cell) {
                cell.classList.add('selected');
                appState.selectedCell = { row, col };

                const num = appState.puzzle?.[row]?.[col];
                if (num && num !== 0) {
                    gameHelpers.highlightSameNumbers(num);
                }
                try {
                    if (appState.tutorialActive && (appState.tutorialStep || 0) === 0) {
                        setTimeout(() => { try { TutorialGame.next(); } catch(e) { console.warn('Tutorial next failed', e); } }, 220);
                    }
                } catch (e) {}
            }
        },

        async inputNumber(num) {
            console.log('inputNumber called:', num, 'gameMode:', appState.gameMode, 'currentMatch:', appState.currentMatch);

            if (!appState.selectedCell) {
                console.log('No cell selected');
                return;
            }

            const { row, col } = appState.selectedCell;
            console.log('Selected cell:', row, col);

            const cell = document.querySelector(
                `.sudoku-cell[data-row="${row}"][data-col="${col}"]`
            );

            if (!cell) {
                console.log('Cell not found in DOM');
                return;
            }

            if (cell.classList.contains('given')) {
                console.log('Cell is a given number, cannot modify');
                return;
            }

            if (appState.gameMode === 'single') {
                const currentValue = appState.puzzle?.[row]?.[col] || 0;
                const key = `${row}_${col}`;
                const notesEl = cell.querySelector('.cell-notes');

                if (appState.notesMode && num >= 1 && num <= 9 && currentValue === 0) {
                    const existing = appState.notes[key] instanceof Set ? appState.notes[key] : new Set(Array.isArray(appState.notes[key]) ? appState.notes[key] : []);
                    if (existing.has(num)) existing.delete(num);
                    else existing.add(num);
                    appState.notes[key] = existing;
                    if (notesEl) this.renderNotesForCell(notesEl, existing);
                    audioManager.playCellFill();
                    return;
                }

                if (num === 0 && appState.notesMode) {
                    delete appState.notes[key];
                    if (notesEl) notesEl.innerHTML = '';
                    audioManager.playCellFill();
                    return;
                }
            }

            if (appState.gameMode === 'versus') {
                const hasPlayerFill = cell.classList.contains('player-fill');
                const hasOpponentFill = cell.classList.contains('opponent-fill');
                const valueEl = cell.querySelector('.cell-value');
                const hasContent = (valueEl ? valueEl.textContent : cell.textContent).trim() !== '';

                console.log('Cell state check:', { hasPlayerFill, hasOpponentFill, hasContent, content: (valueEl ? valueEl.textContent : cell.textContent) });

                if (hasPlayerFill || hasOpponentFill) {
                    console.log('Cell already filled in versus mode (by class)');
                    return;
                }

                if (appState.puzzle && appState.puzzle[row] && appState.puzzle[row][col] !== 0) {
                    if (cell.classList.contains('given')) {
                        console.log('Cell is a given number');
                        return;
                    }
                }
            }

            if (audioManager.context?.state === 'suspended') {
                audioManager.context.resume();
            }

            if (appState.gameMode === 'versus' && appState.currentMatch) {
                try {
                    const result = await matchManager.makeMove(
                        appState.currentMatch,
                        appState.currentUser.uid,
                        row, col, num
                    );

                    if (result && result.success) {
                        if (result.correct) {
                            audioManager.playCorrect();
                            cell.classList.add('correct');
                            cell.classList.add('player-fill');
                            {
                                const valueEl = cell.querySelector('.cell-value');
                                if (valueEl) valueEl.textContent = String(num);
                                else cell.textContent = String(num);
                            }

                            setTimeout(() => {
                                cell.classList.remove('correct');
                            }, 500);
                        } else {
                            audioManager.playError();
                            cell.classList.add('error');
                            {
                                const valueEl = cell.querySelector('.cell-value');
                                if (valueEl) valueEl.textContent = String(num);
                                else cell.textContent = String(num);
                            }

                            setTimeout(() => {
                                cell.classList.remove('error');
                                const valueEl = cell.querySelector('.cell-value');
                                if (valueEl) valueEl.textContent = '';
                                else cell.textContent = '';
                            }, 500);
                        }
                    } else {
                        audioManager.playError();
                    }
                } catch (error) {
                    console.error('Move failed:', error);
                }
            } else {
                const oldValue = appState.puzzle[row][col];

                if (num === 0) {
                    if (appState.toolLimits.eraseLeft <= 0) return;
                    const valueEl = cell.querySelector('.cell-value');
                    if (valueEl) valueEl.textContent = '';
                    else cell.textContent = '';
                    appState.puzzle[row][col] = 0;
                    gameHelpers.addToHistory(row, col, oldValue, 0);
                    delete appState.notes[`${row}_${col}`];
                    const notesEl = cell.querySelector('.cell-notes');
                    if (notesEl) notesEl.innerHTML = '';
                    gameHelpers.consumeEraseIfNeeded(oldValue !== 0);
                } else {
                    const valueEl = cell.querySelector('.cell-value');
                    if (valueEl) valueEl.textContent = String(num);
                    else cell.textContent = String(num);
                    appState.puzzle[row][col] = num;
                    gameHelpers.addToHistory(row, col, oldValue, num);
                    delete appState.notes[`${row}_${col}`];
                    const notesEl = cell.querySelector('.cell-notes');
                    if (notesEl) notesEl.innerHTML = '';

                    const isCorrect = num === appState.solution[row][col];

                    if (appState.settings.autoCheck) {
                        if (isCorrect) {
                            audioManager.playCorrect();
                            cell.classList.add('correct');
                            cell.classList.add('player-fill');
                            appState.playerScore++;

                            creativeFeatures.incrementStreak();
                            creativeFeatures.animateCellComplete(row, col);
                            creativeFeatures.checkGroupCompletion(appState.puzzle, row, col);
                            architecturalStateSystem.noteCorrect();
                        } else {
                            audioManager.playError();
                            cell.classList.add('error');

                            creativeFeatures.resetStreak();
                            architecturalStateSystem.noteMistake();

                            appState.mistakes++;
                            gameHelpers.updateMistakesDisplay();

                            setTimeout(() => {
                                const valueEl = cell.querySelector('.cell-value');
                                if (valueEl) valueEl.textContent = '';
                                else cell.textContent = '';
                                appState.puzzle[row][col] = 0;
                                cell.classList.remove('error');
                                gameHelpers.updateRemainingCounts();
                            }, 400);

                            if (appState.mistakes >= appState.maxMistakes) {
                                setTimeout(() => {
                                    this.endSinglePlayerGame(false);
                                }, 600);
                                return;
                            }
                            return;
                        }
                    } else {
                        cell.classList.add('player-fill');

                        if (!isCorrect) {
                            architecturalStateSystem.noteMistake();
                            appState.mistakes++;
                            gameHelpers.updateMistakesDisplay();

                            if (appState.mistakes >= appState.maxMistakes) {
                                setTimeout(() => {
                                    this.endSinglePlayerGame(false);
                                }, 600);
                                return;
                            }
                        }
                    }

                    setTimeout(() => {
                        cell.classList.remove('correct', 'error');
                    }, 500);

                    gameHelpers.highlightSameNumbers(num);

                    this.checkSinglePlayerComplete();
                }

                gameHelpers.updateRemainingCounts();
                gameHelpers.updateProgress();
            }

            audioManager.playCellFill();
            try {
                if (appState.tutorialActive && (appState.tutorialStep || 0) === 1) {
                    setTimeout(() => { try { TutorialGame.next(); } catch (e) { console.warn('Tutorial next failed', e); } }, 260);
                }
            } catch (e) {}
        },

        checkSinglePlayerComplete() {
            if (!appState.puzzle || !appState.solution) return;

            for (let row = 0; row < 9; row++) {
                for (let col = 0; col < 9; col++) {
                    if (appState.puzzle[row][col] !== appState.solution[row][col]) {
                        return;
                    }
                }
            }

            this.endSinglePlayerGame(true);
        },

        startTimer() {
            appState.gameSeconds = 0;
            const timerEl = document.getElementById('game-timer');
            const versusTimerEl = document.getElementById('game-timer-versus');

            appState.gameTimer = setInterval(() => {
                appState.gameSeconds++;
                const formatted = ui.formatTime(appState.gameSeconds);
                if (timerEl) timerEl.textContent = formatted;
                if (versusTimerEl) versusTimerEl.textContent = formatted;

                if (appState.gameMode === 'single' && appState.timeLimitSeconds > 0 && appState.gameSeconds >= appState.timeLimitSeconds) {
                    this.endSinglePlayerGame(false, 'Time limit reached');
                }
            }, 1000);
        },

        stopTimer() {
            if (appState.gameTimer) {
                clearInterval(appState.gameTimer);
                appState.gameTimer = null;
            }
        },

        endSinglePlayerGame(won, reason = null) {
            this.stopTimer();

            document.getElementById('game-over-title').textContent = won ? 'Congratulations!' : 'Game Over';
            const resultIcon = document.getElementById('result-icon');
            if (resultIcon) {
                resultIcon.innerHTML = won
                    ? '<svg class="ui-icon ui-icon-xl" aria-hidden="true"><use href="#i-trophy"></use></svg>'
                    : '<svg class="ui-icon ui-icon-xl" aria-hidden="true"><use href="#i-x"></use></svg>';
            }
            document.getElementById('result-message').textContent = won ? 'You solved the puzzle!' : (reason || 'Better luck next time!');
            document.getElementById('final-score').textContent = appState.playerScore;
            document.getElementById('final-time').textContent = ui.formatTime(appState.gameSeconds);
            const oppRow = document.getElementById('opponent-score-row');
            if (oppRow) {
                oppRow.style.display = 'none';
            }

            if (won) {
                audioManager.playVictory();
                creativeFeatures.showConfetti();
                architecturalStateSystem.onVictory({ perfect: appState.mistakes === 0 });
            } else {
                audioManager.playDefeat();
                architecturalStateSystem.pulseStrain(1400);
            }

            viewManager.showModal('game-over-modal');
            appState.gameMode = 'lobby';

            const uid = appState.currentUser?.uid;
            if (uid) {
                profileManager.updateStats(uid, !!won).catch(() => {});
            }
        },

        endVersusGame(match) {
            if (appState.isGameOver) return;
            appState.isGameOver = true;

            this.stopTimer();

            const userId = appState.currentUser?.uid;
            let isWinner = match.winner === userId;
            const isTie = match.winner === 'tie';
            const isDisconnect = match.winReason === 'opponent_disconnect';
            const isMistakesLoss = match.winReason === 'opponent_mistakes';

            if (match.winReason === 'board_complete') {
                const scores = match.scores;
                const playerIds = Object.keys(match.players);
                const opponentId = playerIds.find(id => id !== userId);
                if (scores[userId] > scores[opponentId]) {
                    isWinner = true;
                } else if (scores[userId] < scores[opponentId]) {
                    isWinner = false;
                } else {
                    isWinner = null;
                }
            }

            const playerIds = typeof match.playerIds === 'object' ? Object.keys(match.playerIds) : match.playerIds;
            const opponentId = playerIds?.find(id => id !== userId);

            if (isTie) {
                profileManager.updateStats(userId, null);
            } else if (isWinner) {
                audioManager.playVictory();
                creativeFeatures.showConfetti();
                architecturalStateSystem.onVictory({ perfect: false });
                profileManager.updateStats(userId, true);
            } else if (isWinner === false) {
                audioManager.playDefeat();
                architecturalStateSystem.pulseStrain(1400);
                profileManager.updateStats(userId, false);
            }

            showPostMatchScreenFn(match, userId, opponentId, isWinner, isTie, isDisconnect, isMistakesLoss);
        },

        updateScores(scores, playerIds) {
            const userId = appState.currentUser?.uid;
            const playerIdArray = typeof playerIds === 'object' ? Object.keys(playerIds) : playerIds;
            const opponentId = playerIdArray?.find(id => id !== userId);

            const playerScoreEl = document.getElementById('player-score');
            const opponentScoreEl = document.getElementById('opponent-score');

            if (playerScoreEl) playerScoreEl.textContent = scores?.[userId] || 0;
            if (opponentScoreEl && opponentId) opponentScoreEl.textContent = scores?.[opponentId] || 0;
        },

        updateLives(mistakes, playerIds, maxMistakes = 3) {
            const userId = appState.currentUser?.uid;
            const playerIdArray = typeof playerIds === 'object' ? Object.keys(playerIds) : playerIds;
            const opponentId = playerIdArray?.find(id => id !== userId);

            const playerLivesEl = document.getElementById('player-lives');
            const opponentLivesEl = document.getElementById('opponent-lives');

            const playerMistakes = mistakes?.[userId] || 0;
            const opponentMistakes = mistakes?.[opponentId] || 0;

            if (playerLivesEl) {
                const hearts = playerLivesEl.querySelectorAll('.life-heart');
                hearts.forEach((heart, index) => {
                    const isLost = index < playerMistakes;
                    heart.classList.toggle('lost', isLost);
                });
            }

            if (opponentLivesEl) {
                const hearts = opponentLivesEl.querySelectorAll('.life-heart');
                hearts.forEach((heart, index) => {
                    const isLost = index < opponentMistakes;
                    heart.classList.toggle('lost', isLost);
                });
            }
        },

        resetLivesDisplay() {
            ['player-lives', 'opponent-lives'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    const hearts = el.querySelectorAll('.life-heart');
                    hearts.forEach(heart => heart.classList.remove('lost', 'losing'));
                }
            });
        }
    };

    return gameUI;
}
