import { AppState } from '../core/appState.js';
import {
    addDoc,
    arrayRemove,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    query,
    runTransaction as runFsTransaction,
    setDoc,
    Timestamp,
    updateDoc,
    where
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { ref, serverTimestamp, set as rtdbSet } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

export const friendRequestId = (a, b) => {
    const ids = [String(a), String(b)].sort();
    return `${ids[0]}_${ids[1]}`;
};

export const friendParticipants = (a, b) => [String(a), String(b)].sort();

function ensureBadgeSet(state) {
    if (!state._recentBadgeReveals) state._recentBadgeReveals = new Set();
    return state._recentBadgeReveals;
}

export function createProfileManager({
    firestore,
    rtdb,
    storage,
    appState = AppState,
    isRegisteredUser = () => true,
    getUI = () => globalThis.UI,
    getBadgeInfo
} = {}) {
    if (!firestore) throw new Error('createProfileManager: firestore required');

    const resolveUI = () => (typeof getUI === 'function' ? getUI() : getUI) || globalThis.UI;
    const resolveBadgeInfo = () => {
        const fromParam = typeof getBadgeInfo === 'function' ? getBadgeInfo() : getBadgeInfo;
        if (fromParam) return fromParam;
        const ui = resolveUI();
        return ui?.badgeInfo || {};
    };

    const manager = {
        _defaults(userId, usernameRaw, email) {
            const username = usernameRaw || `Player_${String(userId).substring(0, 6)}`;
            const usernameLower = username.toLowerCase();
            return {
                userId,
                username,
                usernameLower,
                displayName: username,
                email: email || null,
                memberSince: Timestamp.now(),
                badges: [],
                stats: {
                    wins: 0,
                    losses: 0,
                    gamesPlayed: 0,
                    bestTime: null
                },
                bio: '',
                profilePicture: null,
                friends: [],
                socialLinks: {},
                isPublic: true,
                preferences: {}
            };
        },

        _formatDisplayName(displayName, isAdmin) {
            if (!displayName) displayName = 'Player';
            // Remove existing admin prefix if present
            displayName = displayName.replace(/^admin_/, '');
            // Add admin prefix if needed
            if (isAdmin) {
                return `admin_${displayName}`;
            }
            return displayName;
        },

        async checkUsernameAvailable(username) {
            const cleaned = (username || '').trim().toLowerCase();
            if (!cleaned) return false;
            
            // Check for reserved usernames
            const reservedTerms = ['admin', 'administrator', 'staff', 'mod', 'moderator', 'support', 'system', 'root', 'superuser', 'owner'];
            if (reservedTerms.includes(cleaned) || 
                cleaned.includes('admin') || 
                cleaned.includes('staff') || 
                cleaned.includes('moderator')) {
                throw new Error('username_reserved');
            }
            
            const usernameRef = doc(firestore, 'usernames', cleaned);
            const snapshot = await getDoc(usernameRef);
            return !snapshot.exists();
        },

        async _reserveUsername(tx, usernameRaw, userId) {
            const username = (usernameRaw || '').trim();
            const usernameLower = username.toLowerCase();
            
            // Check for reserved usernames
            const reservedTerms = ['admin', 'administrator', 'staff', 'mod', 'moderator', 'support', 'system', 'root', 'superuser', 'owner'];
            if (reservedTerms.includes(usernameLower) || 
                usernameLower.includes('admin') || 
                usernameLower.includes('staff') || 
                usernameLower.includes('moderator')) {
                throw new Error('username_reserved');
            }
            
            const usernameRef = doc(firestore, 'usernames', usernameLower);
            const existingUsername = await tx.get(usernameRef);
            if (existingUsername.exists()) {
                const owner = existingUsername.data()?.userId || null;
                if (!owner) throw new Error('username_taken');
                if (owner !== userId) throw new Error('username_taken');
            }
            if (existingUsername.exists() && existingUsername.data()?.userId === userId) {
                return;
            }
            tx.set(usernameRef, {
                userId,
                username,
                usernameLower,
                createdAt: Timestamp.now()
            });
        },

        async createOrUpdateProfile(userId, data) {
            const profileRef = doc(firestore, 'users', userId);

            await runFsTransaction(firestore, async (tx) => {
                const existingSnap = await tx.get(profileRef);
                const existing = existingSnap.exists() ? existingSnap.data() : {};
                const existingLower = existing.usernameLower || (existing.username ? existing.username.toLowerCase() : null);
                let chosenUsername = data.username || existing.username || data.displayName || `Player_${String(userId).substring(0, 6)}`;
                let usernameLower = chosenUsername.toLowerCase();

                const needsReservation = !existingSnap.exists() || !!data.username || !existingLower;
                if (needsReservation) {
                    try {
                        await this._reserveUsername(tx, chosenUsername, userId);
                    } catch (e) {
                        if (e.message === 'username_taken') {
                            if (existingSnap.exists() && !data.username && existingLower) {
                                chosenUsername = existing.username || chosenUsername;
                                usernameLower = existingLower;
                            } else {
                                throw e;
                            }
                        } else {
                            throw e;
                        }
                    }
                }
                const email = data.email || existing.email || null;
                const base = this._defaults(userId, chosenUsername, email);
                if (existing.memberSince) base.memberSince = existing.memberSince;
                
                // Apply admin prefix to displayName if needed
                const displayName = data.displayName || existing.displayName || chosenUsername;
                const isAdmin = data.isAdmin !== undefined ? data.isAdmin : existing.isAdmin;
                const formattedDisplayName = this._formatDisplayName(displayName, isAdmin);
                
                tx.set(profileRef, Object.assign({}, base, existing, data, {
                    username: chosenUsername,
                    usernameLower,
                    displayName: formattedDisplayName,
                    email
                }), { merge: true });
            });

            const vanitySnapshot = await getDoc(profileRef);
            const vanityEmail = vanitySnapshot?.data()?.email;
            const vanityUsername = vanitySnapshot?.data()?.username;
            const vanityLower = vanitySnapshot?.data()?.usernameLower;
            if (vanityEmail && vanityUsername && vanityLower) {
                try {
                    const vanityRef = doc(firestore, 'vanityLinks', vanityLower);
                    const existingVanity = await getDoc(vanityRef);
                    if (!existingVanity.exists()) {
                        await setDoc(vanityRef, {
                            userId,
                            username: vanityUsername,
                            path: `/u/${vanityLower}`,
                            createdAt: Timestamp.now()
                        });
                    }
                } catch (e) {
                    console.warn('Failed to set vanity link', e);
                }
            }
            return vanitySnapshot;
        },

        async getProfileByUsername(username) {
            const usernameLower = (username || '').toLowerCase();
            const q = query(collection(firestore, 'users'), where('usernameLower', '==', usernameLower), limit(1));
            const snapshot = await getDocs(q);
            if (snapshot.empty) return null;
            return snapshot.docs[0];
        },

        async getProfile(userId) {
            const profileRef = doc(firestore, 'users', userId);
            return await getDoc(profileRef);
        },

        async updateProfile(userId, data) {
            const profileRef = doc(firestore, 'users', userId);
            const wantsUsernameChange = !!data.username;
            const existingSnap = await getDoc(profileRef);
            const existingLower = existingSnap.exists() ? existingSnap.data()?.usernameLower : null;
            if (wantsUsernameChange) {
                const newUsername = data.username.trim();
                const newLower = newUsername.toLowerCase();
                await runFsTransaction(firestore, async (tx) => {
                    await this._reserveUsername(tx, newUsername, userId);
                    const snap = await tx.get(profileRef);
                    const existing = snap.exists() ? snap.data() : {};
                    tx.set(profileRef, Object.assign({}, existing, data, {
                        username: newUsername,
                        usernameLower: newLower,
                        displayName: data.displayName || existing.displayName || newUsername
                    }), { merge: true });
                });
            } else {
                await updateDoc(profileRef, data);
            }

            const updated = await getDoc(profileRef);
            const hasEmail = !!(updated.data()?.email);
            if (wantsUsernameChange && hasEmail) {
                try {
                    const lower = data.username.toLowerCase();
                    const vanityRef = doc(firestore, 'vanityLinks', lower);
                    const existingVanity = await getDoc(vanityRef);
                    if (!existingVanity.exists()) {
                        await setDoc(vanityRef, {
                            userId,
                            username: data.username,
                            path: `/u/${lower}`,
                            createdAt: Timestamp.now()
                        });
                    }
                } catch (e) {
                    console.warn('Failed to create vanity link on username change', e);
                }
            }

            return updated;
        },

        async updateStats(userId, won) {
            const profileRef = doc(firestore, 'users', userId);
            const profile = await getDoc(profileRef);
            if (!profile.exists()) return;

            const stats = Object.assign({ wins: 0, losses: 0, gamesPlayed: 0, bestTime: null }, profile.data().stats || {});
            if (won === true) stats.wins++;
            else if (won === false) stats.losses++;
            stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;

            await updateDoc(profileRef, { stats });
            await this.checkBadges(userId, stats);
        },

        async checkBadges(userId, stats) {
            const wins = Number(stats.wins) || 0;
            const losses = Number(stats.losses) || 0;
            const gamesPlayed = Number(stats.gamesPlayed) || wins + losses || 0;
            const totalGames = gamesPlayed || wins + losses;
            const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
            const bestTime = Number(stats.bestTime);

            const profileRef = doc(firestore, 'users', userId);
            let profileData = {};
            try {
                const snap = await getDoc(profileRef);
                if (snap.exists()) profileData = snap.data() || {};
            } catch (e) {
                console.warn('Failed to fetch profile for badge check', e);
            }

            const friendsCount = Array.isArray(profileData.friends) ? profileData.friends.length : 0;
            const hasBio = typeof profileData.bio === 'string' && profileData.bio.trim().length >= 20;
            const hasAvatar = !!profileData.profilePicture;
            const isAdmin = !!profileData.isAdmin;

            const earnedSet = new Set();

            if (gamesPlayed >= 1) earnedSet.add('rookie');
            if (gamesPlayed >= 5) earnedSet.add('learner');
            if (gamesPlayed >= 10) earnedSet.add('veteran');
            if (gamesPlayed >= 50) earnedSet.add('marathoner');
            if (gamesPlayed >= 100) earnedSet.add('legend');

            if (wins >= 5) earnedSet.add('winner');
            if (wins >= 20) earnedSet.add('champion');
            if (wins >= 50) earnedSet.add('unstoppable');
            if (wins >= 10 && losses === 0) earnedSet.add('undefeated');
            if (winRate >= 70 && totalGames >= 20) earnedSet.add('tactician');

            if (Number.isFinite(bestTime) && bestTime > 0 && bestTime <= 180) {
                earnedSet.add('speedster');
            }

            if (friendsCount >= 1) earnedSet.add('socialite');
            if (friendsCount >= 5) earnedSet.add('connector');
            if (friendsCount >= 15) earnedSet.add('ambassador');
            if (hasBio) earnedSet.add('storyteller');
            if (hasAvatar) earnedSet.add('portrait');

            if (isAdmin) earnedSet.add('warden');

            const existingBadges = Array.isArray(profileData.badges) ? profileData.badges : [];
            const newBadges = Array.from(earnedSet).filter((b) => !existingBadges.includes(b));
            if (newBadges.length === 0) return;

            await updateDoc(profileRef, { badges: arrayUnion(...newBadges) });

            try {
                for (const badge of newBadges) {
                    try {
                        await addDoc(collection(firestore, 'badgeAwards'), {
                            userId,
                            badge,
                            createdAt: Timestamp.now()
                        });
                    } catch (e) {
                        console.debug('Failed to record badge award', badge, e?.message || e);
                    }
                }
            } catch (e) {
                console.warn('badgeAwards logging failed', e);
            }

            let refreshed = null;
            try {
                const fresh = await getDoc(profileRef);
                if (fresh.exists()) refreshed = fresh.data() || {};
            } catch (e) {
                console.warn('Failed to refresh profile after awarding badges', e);
            }

            const ui = resolveUI();
            const badgeInfo = resolveBadgeInfo();
            const revealSet = ensureBadgeSet(appState);

            if (appState.currentUser && appState.currentUser.uid === userId) {
                if (refreshed) {
                    appState.profile = refreshed;
                    appState.friends = refreshed.friends || [];
                    try { ui?.updateBadges?.(refreshed.badges || []); } catch (e) { /* ignore */ }
                }
                
                // Store new badges for post-match display
                if (newBadges.length > 0) {
                    appState.newBadgesPostMatch = newBadges;
                }
                
                // Show toast notification for new badges
                for (const badge of newBadges) {
                    if (revealSet.has(badge)) continue;
                    revealSet.add(badge);
                    const info = badgeInfo[badge] || { name: badge, desc: '' };
                    if (appState.settings?.notifications?.badges) ui?.showToast?.(`New badge: ${info.name}`, 'success');
                }
            }
        },

        async addBadge(userId, badge) {
            const profileRef = doc(firestore, 'users', userId);
            await updateDoc(profileRef, { badges: arrayUnion(badge) });
            const ui = resolveUI();
            const badgeInfo = resolveBadgeInfo();
            if (appState.currentUser && appState.currentUser.uid === userId && appState.settings?.notifications?.badges) {
                const info = badgeInfo[badge] || { name: badge, desc: '' };
                const msg = info.desc ? `New badge: ${info.name}` : `New badge: ${info.name}`;
                ui?.showToast?.(msg, 'success');
            }
        },

        async uploadProfilePicture(userId, file) {
            if (!file || !userId) return null;
            if (!file.type.startsWith('image/')) throw new Error('File must be an image');
            if (file.size > 2 * 1024 * 1024) throw new Error('Image must be under 2MB');
            if (!storage) throw new Error('Storage not available');

            const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const fileRef = storageRef(storage, `avatars/${userId}/${safeName}`);
            await uploadBytes(fileRef, file);
            const downloadURL = await getDownloadURL(fileRef);
            await this.updateProfile(userId, { profilePicture: downloadURL });
            return downloadURL;
        },

        async sendFriendRequest(fromUserId, toUserId) {
            if (!fromUserId || !toUserId || fromUserId === toUserId) return;
            if (!isRegisteredUser()) {
                throw new Error('Friends require a registered email account.');
            }
            const reqId = friendRequestId(fromUserId, toUserId);
            const reqRef = doc(firestore, 'friendRequests', reqId);
            const participants = friendParticipants(fromUserId, toUserId);

            let existingSnap = null;
            try {
                existingSnap = await this.getFriendRequestBetween(fromUserId, toUserId);
            } catch (e) {
                console.warn('Failed to check existing friend request', e);
            }

            if (existingSnap && existingSnap.exists()) {
                const existing = existingSnap.data() || {};
                const status = existing.status;
                const existingTo = existing.toUid;

                if (status === 'pending') {
                    if (existingTo === fromUserId) {
                        await this.acceptFriendRequest(fromUserId, toUserId);
                        return 'accepted_existing';
                    }
                    throw new Error('Friend request already pending.');
                }

                if (status === 'accepted') {
                    throw new Error('You are already friends.');
                }

                try {
                    await deleteDoc(existingSnap.ref);
                } catch (e) {
                    console.warn('Failed to clear stale friend request', e);
                }
            }

            await setDoc(reqRef, {
                fromUid: fromUserId,
                toUid: toUserId,
                participants,
                status: 'pending',
                createdAt: Timestamp.now()
            }, { merge: true });
            const result = 'sent';
            try {
                if (rtdb) {
                    await rtdbSet(ref(rtdb, `notifications/${toUserId}/friend_${fromUserId}`), {
                        type: 'friend_request',
                        from: fromUserId,
                        timestamp: serverTimestamp()
                    });
                }
            } catch (e) {
                console.debug('Friend request notification skipped', e?.message || e);
            }
            return result;
        },

        async acceptFriendRequest(userId, friendId) {
            if (!userId || !friendId) return;
            const reqId = friendRequestId(userId, friendId);
            const reqRef = doc(firestore, 'friendRequests', reqId);
            const participants = friendParticipants(userId, friendId);
            
            // Use updateDoc instead of setDoc to comply with Firestore rules
            // The rules only allow update (not create) for accepting requests
            await updateDoc(reqRef, {
                status: 'accepted',
                respondedAt: Timestamp.now(),
                participants
            });

            try {
                if (rtdb) {
                    await rtdbSet(ref(rtdb, `notifications/${friendId}/friend_${userId}`), {
                        type: 'friend_accept',
                        from: userId,
                        timestamp: serverTimestamp()
                    });
                }
            } catch (e) {
                console.debug('Friend accept notification skipped', e?.message || e);
            }
        },

        async declineFriendRequest(userId, friendId) {
            if (!userId || !friendId) return;
            const reqId = friendRequestId(userId, friendId);
            const reqRef = doc(firestore, 'friendRequests', reqId);
            const participants = friendParticipants(userId, friendId);
            
            // Use updateDoc instead of setDoc to comply with Firestore rules
            await updateDoc(reqRef, {
                status: 'declined',
                respondedAt: Timestamp.now(),
                participants
            });
            try {
                if (rtdb) {
                    await rtdbSet(ref(rtdb, `notifications/${friendId}/friend_${userId}`), {
                        type: 'friend_decline',
                        from: userId,
                        timestamp: serverTimestamp()
                    });
                }
            } catch (e) {
                console.debug('Friend decline notification skipped', e?.message || e);
            }
        },

        async removeFriend(userId, friendId) {
            if (!userId || !friendId) return;
            const userRef = doc(firestore, 'users', userId);
            const friendRef = doc(firestore, 'users', friendId);
            await Promise.all([
                updateDoc(userRef, { friends: arrayRemove(friendId) }),
                updateDoc(friendRef, { friends: arrayRemove(userId) }),
                addDoc(collection(firestore, 'friendRemovals'), {
                    users: [userId, friendId],
                    createdAt: Timestamp.now()
                })
            ]);
        },

        async getFriends(userId) {
            const profile = await this.getProfile(userId);
            if (!profile.exists()) return [];
            const friendIds = profile.data().friends || [];
            const friends = [];
            for (const friendId of friendIds) {
                const friendProfile = await this.getProfile(friendId);
                if (friendProfile.exists()) friends.push({ id: friendId, ...friendProfile.data() });
            }
            return friends;
        },

        async getFriendRequestBetween(a, b) {
            const primaryRef = doc(firestore, 'friendRequests', friendRequestId(a, b));
            const primarySnap = await getDoc(primaryRef);
            if (primarySnap.exists()) return primarySnap;
            const legacyRefs = [
                doc(firestore, 'friendRequests', `${a}_${b}`),
                doc(firestore, 'friendRequests', `${b}_${a}`)
            ];
            const [legacyA, legacyB] = await Promise.all(legacyRefs.map((r) => getDoc(r)));
            if (legacyA.exists()) return legacyA;
            if (legacyB.exists()) return legacyB;
            return null;
        },

        async getProfiles(userIds) {
            const ids = Array.from(new Set((userIds || []).filter(Boolean)));
            const results = await Promise.all(ids.map(async (id) => {
                try {
                    const snap = await this.getProfile(id);
                    if (!snap.exists()) return { id, data: null };
                    return { id, data: snap.data() || null };
                } catch {
                    return { id, data: null };
                }
            }));
            return results;
        }
    };

    return manager;
}
