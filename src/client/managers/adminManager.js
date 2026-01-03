/**
 * Admin Manager
 * Handles role management, user search, and audit log viewing
 */

/**
 * Create Admin Manager
 * @param {Object} deps - Dependencies
 * @param {Object} deps.functions - Firebase Functions instance
 * @param {Function} deps.httpsCallable - httpsCallable function from Firebase
 * @param {Object} deps.AppState - Application state
 * @param {Object} deps.UI - UI helpers
 * @returns {Object} Admin Manager instance
 */
export function createAdminManager({ functions, httpsCallable, AppState, UI } = {}) {
    
    // Use an object to hold UI reference so it can be updated later
    const deps = { UI };
    let lastAuditId = null;
    
    /**
     * Initialize admin console UI based on user role
     */
    function init() {
        if (!AppState.currentUser) return;
        
        const isSuperAdmin = AppState.currentUser.isSuperAdmin === true;
        const isAdmin = AppState.currentUser.isAdmin === true;
        
        // Show role management for super-admins
        const roleManagementCard = document.getElementById('admin-role-management');
        if (roleManagementCard) {
            roleManagementCard.style.display = isSuperAdmin ? 'block' : 'none';
        }
        
        // Show audit log for all admins
        const auditLogCard = document.getElementById('admin-audit-log');
        if (auditLogCard) {
            auditLogCard.style.display = (isAdmin || isSuperAdmin) ? 'block' : 'none';
        }
        
        // Setup event listeners
        setupEventListeners();
        
        // Load audit log if admin
        if (isAdmin || isSuperAdmin) {
            loadAuditLog();
        }
    }
    
    /**
     * Setup event listeners for admin UI
     */
    function setupEventListeners() {
        // User search
        const searchBtn = document.getElementById('admin-user-search-btn');
        const searchInput = document.getElementById('admin-user-search');
        
        if (searchBtn && searchInput) {
            searchBtn.addEventListener('click', () => searchUsers());
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    searchUsers();
                }
            });
        }
        
        // Audit log load more
        const loadMoreBtn = document.getElementById('admin-audit-load-more');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => loadAuditLog(lastAuditId));
        }
    }
    
    /**
     * Search for users
     */
    async function searchUsers() {
        const searchInput = document.getElementById('admin-user-search');
        const resultsDiv = document.getElementById('admin-user-results');
        const statusDiv = document.getElementById('admin-role-status');
        
        if (!searchInput || !resultsDiv || !statusDiv) return;
        
        const query = searchInput.value.trim();
        
        if (query.length < 2) {
            statusDiv.textContent = 'Please enter at least 2 characters';
            statusDiv.style.display = 'block';
            return;
        }
        
        statusDiv.style.display = 'none';
        resultsDiv.innerHTML = '<p class="loading-text">Searching...</p>';
        resultsDiv.style.display = 'block';
        
        try {
            const searchFn = httpsCallable(functions, 'searchUsers');
            const result = await searchFn({ query, limit: 20 });
            
            if (!result.data.users || result.data.users.length === 0) {
                resultsDiv.innerHTML = '<p class="empty-text">No users found</p>';
                return;
            }
            
            renderUserResults(result.data.users);
        } catch (error) {
            console.error('User search failed:', error);
            statusDiv.textContent = `Error: ${error.message}`;
            statusDiv.style.display = 'block';
            resultsDiv.style.display = 'none';
        }
    }
    
    /**
     * Render user search results
     */
    function renderUserResults(users) {
        const resultsDiv = document.getElementById('admin-user-results');
        if (!resultsDiv) return;
        
        const html = users.map(user => `
            <div class="admin-user-result">
                <div class="user-result-info">
                    <div class="user-result-name">${UI.escapeHtml(user.displayName || user.username || 'No name')}</div>
                    <div class="user-result-meta">
                        ${user.username ? `@${UI.escapeHtml(user.username)}` : ''}
                        ${user.email ? `• ${UI.escapeHtml(user.email)}` : ''}
                    </div>
                    <div class="user-result-role">Current Role: <strong>${user.role || 'user'}</strong></div>
                </div>
                <div class="user-result-actions">
                    <select class="role-select" data-uid="${UI.escapeHtml(user.uid)}">
                        <option value="user" ${user.role === 'user' || !user.role ? 'selected' : ''}>User</option>
                        <option value="moderator" ${user.role === 'moderator' ? 'selected' : ''}>Moderator</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        ${AppState.currentUser?.isSuperAdmin ? 
                            `<option value="superAdmin" ${user.role === 'superAdmin' ? 'selected' : ''}>Super Admin</option>` : 
                            ''}
                    </select>
                    <button class="btn btn-primary btn-sm" onclick="window.AdminManager.appointRole('${deps.UI?.escapeHtml(user.uid)}')">
                        Update
                    </button>
                </div>
            </div>
        `).join('');
        
        resultsDiv.innerHTML = html;
    }
    
    /**
     * Appoint or update a user's role
     */
    async function appointRole(targetUid) {
        const select = document.querySelector(`select[data-uid="${targetUid}"]`);
        const statusDiv = document.getElementById('admin-role-status');
        
        if (!select || !statusDiv) return;
        
        const role = select.value;
        const reason = prompt('Enter reason for role change (optional):');
        
        if (reason === null) return; // User cancelled
        
        statusDiv.style.display = 'none';
        
        try {
            const appointFn = httpsCallable(functions, 'appointAdmin');
            const result = await appointFn({ targetUid, role, reason: reason || undefined });
            
            UI.showToast?.(result.data.message, 'success');
            
            // Refresh search results
            await searchUsers();
            
            // Reload audit log
            lastAuditId = null;
            await loadAuditLog();
        } catch (error) {
            console.error('Role appointment failed:', error);
            statusDiv.textContent = `Error: ${error.message}`;
            statusDiv.style.display = 'block';
        }
    }
    
    /**
     * Load audit log
     */
    async function loadAuditLog(startAfter = null) {
        const auditList = document.getElementById('admin-audit-list');
        const loadMoreBtn = document.getElementById('admin-audit-load-more');
        
        if (!auditList) return;
        
        if (!startAfter) {
            auditList.innerHTML = '<p class="loading-text">Loading audit log...</p>';
        }
        
        try {
            const getAuditLogFn = httpsCallable(functions, 'getAuditLog');
            const result = await getAuditLogFn({ limit: 20, startAfter });
            
            if (!result.data.logs || result.data.logs.length === 0) {
                if (!startAfter) {
                    auditList.innerHTML = '<p class="empty-text">No audit log entries</p>';
                }
                if (loadMoreBtn) loadMoreBtn.style.display = 'none';
                return;
            }
            
            if (!startAfter) {
                auditList.innerHTML = '';
            }
            
            result.data.logs.forEach(log => {
                const entry = document.createElement('div');
                entry.className = 'admin-audit-entry';
                
                const timestamp = log.timestamp?.toDate?.() || new Date(log.timestamp);
                const dateStr = timestamp.toLocaleString();
                
                entry.innerHTML = `
                    <div class="audit-entry-time">${dateStr}</div>
                    <div class="audit-entry-action">
                        <strong>${deps.UI?.escapeHtml(log.action)}</strong>
                        ${log.targetEmail ? `• ${deps.UI?.escapeHtml(log.targetEmail)}` : ''}
                        ${log.targetRole ? `→ <strong>${deps.UI?.escapeHtml(log.targetRole)}</strong>` : ''}
                    </div>
                    <div class="audit-entry-meta">
                        By: ${deps.UI?.escapeHtml(log.performedByEmail || 'system')}
                        ${log.reason ? `• Reason: ${deps.UI?.escapeHtml(log.reason)}` : ''}
                    </div>
                `;
                
                auditList.appendChild(entry);
            });
            
            lastAuditId = result.data.lastId;
            
            if (loadMoreBtn) {
                loadMoreBtn.style.display = result.data.hasMore ? 'block' : 'none';
            }
        } catch (error) {
            console.error('Failed to load audit log:', error);
            auditList.innerHTML = `<p class="error-text">Error loading audit log: ${error.message}</p>`;
        }
    }
    
    return {
        init,
        searchUsers,
        appointRole,
        loadAuditLog,
        set UI(value) {
            deps.UI = value;
        }
    };
}
