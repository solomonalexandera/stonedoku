import { AppState } from '../core/appState.js';
import {
    get,
    onValue,
    push,
    ref,
    remove,
    serverTimestamp,
    set,
    update
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

export function createLobbyManager({ rtdb, appState = AppState } = {}) {
    if (!rtdb) throw new Error('createLobbyManager: rtdb required');

    return {
        generateRoomCode() {
            return Math.floor(1000 + Math.random() * 9000).toString();
        },

        async createRoom(userId, displayName) {
            let code = this.generateRoomCode();
            let attempts = 0;

            while (attempts < 10) {
                const roomRef = ref(rtdb, `lobbies/${code}`);
                const snapshot = await get(roomRef);

                if (!snapshot.exists()) {
                    await set(roomRef, {
                        code,
                        host: userId,
                        hostName: displayName,
                        players: {
                            [userId]: {
                                name: displayName,
                                ready: false,
                                joinedAt: serverTimestamp()
                            }
                        },
                        status: 'waiting',
                        createdAt: serverTimestamp(),
                        chat: {}
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

            await update(ref(rtdb, `lobbies/${code}/players`), {
                [userId]: {
                    name: displayName,
                    ready: false,
                    joinedAt: serverTimestamp()
                }
            });

            return room;
        },

        async setReady(code, userId, isReady) {
            await update(ref(rtdb, `lobbies/${code}/players/${userId}`), {
                ready: isReady
            });
        },

        async sendLobbyChat(code, userId, displayName, text) {
            const chatRef = ref(rtdb, `lobbies/${code}/chat`);
            const newMsgRef = push(chatRef);
            await set(newMsgRef, {
                userId,
                displayName,
                text,
                timestamp: serverTimestamp()
            });
        },

        listenToLobbyChat(code, callback) {
            const chatRef = ref(rtdb, `lobbies/${code}/chat`);
            const listener = onValue(chatRef, (snapshot) => {
                const messages = [];
                snapshot.forEach(child => {
                    messages.push({ id: child.key, ...child.val() });
                });
                callback(messages);
            });
            appState.listeners.push({ ref: chatRef, callback: listener });
            return listener;
        },

        async leaveRoom(code, userId) {
            const roomRef = ref(rtdb, `lobbies/${code}`);
            const snapshot = await get(roomRef);

            if (snapshot.exists()) {
                const room = snapshot.val();

                if (room.host === userId) {
                    await remove(roomRef);
                } else {
                    await remove(ref(rtdb, `lobbies/${code}/players/${userId}`));
                }
            }
        },

        listenToRoom(code, callback) {
            const roomRef = ref(rtdb, `lobbies/${code}`);
            const listener = onValue(roomRef, (snapshot) => {
                callback(snapshot.val());
            });
            appState.listeners.push({ ref: roomRef, callback: listener });
            return listener;
        }
    };
}
