/**
 * Kuthbukhana Anwariyya - Universal Auth & Cloud Sync Module
 * Enforces role password security and automatic two-way cloud website synchronization
 */

const AUTH_API_BASE = (window.location.protocol && window.location.protocol.startsWith('http'))
    ? window.location.origin
    : 'http://localhost:5000';

// 1. Strict Page Auth Guard
function enforcePageAuth(allowedRoles) {
    const role = localStorage.getItem('library_auth_role');
    const token = localStorage.getItem('library_auth_token');

    const rolesList = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    // Check if user is logged in
    if (!token || !role) {
        sessionStorage.setItem('redirect_after_login', window.location.href);
        const path = window.location.pathname.replace(/\\/g, '/');
        let loginPath = 'login.html';
        if (path.includes('lead/admin') || path.includes('lead/principal')) {
            loginPath = '../../login.html';
        } else if (path.includes('subpages')) {
            loginPath = 'login.html';
        } else {
            loginPath = 'assets/subpages/login.html';
        }
        const targetRole = rolesList[0] || 'admin';
        window.location.replace(`${loginPath}?role=${encodeURIComponent(targetRole)}`);
        return false;
    }

    const currentUsername = (localStorage.getItem('library_auth_username') || '').toLowerCase();
    const isTrueAdmin = (role === 'admin' && currentUsername !== 'librarian');

    // Admin has universal access; otherwise must be in allowedRoles
    const isAuthorized = isTrueAdmin || rolesList.includes(role);

    if (isAuthorized) {
        return true;
    }

    // --- Access Denied Handling (User is NOT in allowedRoles) ---

    // 1. Librarian attempting to access restricted Admin-Only pages
    if ((role === 'librarian' || currentUsername === 'librarian') && rolesList.includes('admin') && !rolesList.includes('librarian')) {
        alert('⛔ Access Denied!\n\nYou are logged in as a Librarian (@' + (currentUsername || 'librarian') + ').\nOnly the Chief Administrator can access the Admin Dashboard.\n\nLibrarians have full access to Open Library circulation, Ledger, and Fine Slips.');
        const path = window.location.pathname.replace(/\\/g, '/');
        if (path.includes('lead/admin')) {
            window.location.replace('../../../../index.html');
        } else {
            window.location.replace('index.html');
        }
        return false;
    }

    // 2. Teacher attempting to access restricted pages (e.g. Admin or Circulation Desk)
    if (role === 'staff') {
        alert('⛔ Access Restricted to Staff Portal!\n\nYou are logged in as a College Teacher / Staff member.\nPlease view your borrowed books and history in your Teacher Portal.');
        const path = window.location.pathname.replace(/\\/g, '/');
        let staffPortalPath = 'staff-portal.html';
        if (path.includes('lead/admin') || path.includes('lead/principal')) {
            staffPortalPath = '../../staff-portal.html';
        } else if (!path.includes('subpages')) {
            staffPortalPath = 'assets/subpages/staff-portal.html';
        }
        window.location.replace(staffPortalPath);
        return false;
    }

    // 3. Principal attempting to access restricted desk pages
    if (role === 'principal') {
        alert('⛔ Access Denied: This page is restricted to administrators and library desk staff.');
        window.location.replace('index.html');
        return false;
    }

    // 4. Default Access Denied
    alert(`⛔ Access Denied: This page requires ${rolesList.join(' or ')} privileges.`);
    window.location.replace('index.html');
    return false;
}

// Check role authentication before navigating from home buttons
function checkAuthAndGo(targetRole, action = null) {
    const role = localStorage.getItem('library_auth_role');
    const token = localStorage.getItem('library_auth_token');
    const currentUsername = (localStorage.getItem('library_auth_username') || '').toLowerCase();

    const path = window.location.pathname.replace(/\\/g, '/');
    const loginPath = (path.includes('subpages')) ? 'login.html' : 'assets/subpages/login.html';

    if (targetRole === 'admin') {
        if (token && role === 'admin' && currentUsername !== 'librarian') {
            if (action) {
                let adminPath = path.includes('subpages') ? 'lead/admin/admin.html' : 'assets/subpages/lead/admin/admin.html';
                window.location.href = `${adminPath}?action=${encodeURIComponent(action)}`;
            } else {
                goadmin();
            }
        } else if (token && (role === 'librarian' || currentUsername === 'librarian')) {
            if (confirm('Chief Administrator access is required for Admin Panel & Passwords.\n\nWould you like to sign in as Administrator now?')) {
                localStorage.removeItem('library_auth_token');
                localStorage.removeItem('library_auth_role');
                localStorage.removeItem('library_auth_username');
                window.location.href = `${loginPath}?role=admin`;
            }
            return;
        } else {
            window.location.href = `${loginPath}?role=admin`;
        }
        return;
    }

    if (targetRole === 'staff') {
        let staffPath = (path.includes('subpages')) ? 'staff-portal.html' : 'assets/subpages/staff-portal.html';
        if (token && (role === 'staff' || role === 'admin')) {
            window.location.href = staffPath;
        } else {
            window.location.href = `${loginPath}?role=staff`;
        }
        return;
    }

    if (targetRole === 'principal') {
        if (token && (role === 'principal' || role === 'admin')) {
            goprincipal();
        } else {
            window.location.href = `${loginPath}?role=principal`;
        }
        return;
    }
}

// 2. User Logout
function handleUserLogout() {
    localStorage.removeItem('library_auth_token');
    localStorage.removeItem('library_auth_role');
    localStorage.removeItem('library_auth_time');
    localStorage.removeItem('library_auth_user');
    localStorage.removeItem('library_auth_username');
    localStorage.removeItem('library_auth_name');

    const path = window.location.pathname.replace(/\\/g, '/');
    let loginPath = 'login.html';
    if (path.includes('lead/admin') || path.includes('lead/principal')) {
        loginPath = '../../login.html';
    } else if (path.includes('subpages')) {
        loginPath = 'login.html';
    } else {
        loginPath = 'assets/subpages/login.html';
    }
    window.location.href = loginPath;
}

// Helper: Get logged-in librarian / teacher details
function getLoggedInLibrarian() {
    try {
        const raw = localStorage.getItem('library_auth_user');
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    const role = localStorage.getItem('library_auth_role') || 'librarian';
    let defaultName = 'Librarian';
    if (role === 'admin') defaultName = 'Chief Administrator';
    else if (role === 'staff') defaultName = 'Teacher / Staff';
    else if (role === 'principal') defaultName = 'Principal';

    return {
        username: localStorage.getItem('library_auth_username') || role,
        name: localStorage.getItem('library_auth_name') || defaultName,
        role: role
    };
}

// Update UI badges showing current librarian / teacher name
function updateLoggedInUserUI() {
    const user = getLoggedInLibrarian();
    const badge = document.getElementById('currentLibrarianBadge');
    if (badge && user) {
        let roleTag = user.role === 'admin' ? '(Admin)' : (user.role === 'librarian' ? '(Librarian)' : (user.role === 'staff' ? '(Teacher)' : ''));
        badge.innerText = `${user.name || user.username} ${roleTag}`.trim();
    }
    const usernameSpan = document.getElementById('currentLibrarianUsernameBadge');
    if (usernameSpan && user && user.username) {
        usernameSpan.innerText = '@' + user.username;
    }
}

// 3. Cloud Sync Client Manager
let cloudSyncState = {
    cloudUrl: '',
    lastSynced: null,
    status: 'checking' // 'online-synced', 'offline', 'syncing', 'unconfigured'
};

const DEFAULT_ONLINE_URL = 'https://kuthubukhana.onrender.com';

// Check cloud sync status from local server
async function fetchCloudSyncStatus() {
    try {
        const res = await fetch(`${AUTH_API_BASE}/api/cloud-sync/config`);
        if (res.ok) {
            const data = await res.json();
            cloudSyncState.cloudUrl = data.cloudUrl || localStorage.getItem('cloud_website_url') || DEFAULT_ONLINE_URL;
            cloudSyncState.lastSynced = data.lastSynced;
            cloudSyncState.status = 'online-synced';
            updateCloudSyncUI();
        }
    } catch (e) {
        cloudSyncState.cloudUrl = localStorage.getItem('cloud_website_url') || DEFAULT_ONLINE_URL;
        updateCloudSyncUI();
    }
}

// Execute Two-Way Sync with Cloud Website
async function executeCloudSync(showToast = true) {
    if (!navigator.onLine) {
        cloudSyncState.status = 'offline';
        updateCloudSyncUI();
        if (showToast) alert('You are currently OFFLINE. The app will automatically sync when internet reconnects.');
        return;
    }

    const cloudUrl = cloudSyncState.cloudUrl || localStorage.getItem('cloud_website_url') || DEFAULT_ONLINE_URL;
    cloudSyncState.status = 'syncing';
    updateCloudSyncUI();

    try {
        const res = await fetch(`${AUTH_API_BASE}/api/cloud-sync/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cloudUrl })
        });

        if (res.ok) {
            const data = await res.json();
            cloudSyncState.status = 'online-synced';
            cloudSyncState.lastSynced = data.lastSynced || Date.now();
            updateCloudSyncUI();

            // Silently refresh UI if functions exist
            if (typeof syncWithBackendData === 'function') syncWithBackendData();
            if (typeof renderAdminDashboard === 'function') renderAdminDashboard();
            if (typeof renderPrincipalView === 'function') renderPrincipalView();

            if (showToast) {
                alert(`✅ Cloud Sync Success!\n\nPC App and Online Website are now synchronized.\nTotal Books: ${data.booksCount}\nLibrary Status: ${data.isLibraryClosed ? 'CLOSED (by Principal)' : 'OPEN'}`);
            }
        } else {
            cloudSyncState.status = 'offline';
            updateCloudSyncUI();
            if (showToast) alert('Could not reach the cloud website. Will retry when connection stabilizes.');
        }
    } catch (err) {
        cloudSyncState.status = 'offline';
        updateCloudSyncUI();
        if (showToast) alert('Cloud sync error. Working in offline mode.');
    }
}

// Update Sync Indicator in Navbar
function updateCloudSyncUI() {
    const pill = document.getElementById('cloudSyncStatusPill');
    if (!pill) return;

    const isOnlineHosted = window.location.hostname.includes('render.com') ||
        window.location.hostname.includes('kuthubukhana') ||
        (window.location.protocol.startsWith('http') &&
         !window.location.hostname.includes('localhost') &&
         !window.location.hostname.includes('127.0.0.1') &&
         !window.location.hostname.startsWith('192.168.'));

    if (isOnlineHosted) {
        pill.className = 'badge bg-success text-white py-2 px-3 fw-semibold shadow-sm';
        pill.innerHTML = `<i class="bi bi-globe-americas me-1"></i> Web Live (Auto-Updated)`;
        pill.title = 'Online Cloud Website. Automatically reflects latest App changes in real time.';
        return;
    }

    if (!cloudSyncState.cloudUrl) {
        pill.className = 'badge bg-secondary text-white py-2 px-3 fw-semibold cursor-pointer shadow-sm';
        pill.innerHTML = `<i class="bi bi-cloud-slash me-1"></i> Setup Cloud Link`;
        pill.title = 'Click to connect with the online website';
        return;
    }

    if (!navigator.onLine || cloudSyncState.status === 'offline') {
        pill.className = 'badge bg-warning text-dark py-2 px-3 fw-semibold cursor-pointer shadow-sm';
        pill.innerHTML = `<i class="bi bi-wifi-off me-1"></i> Offline (Auto-syncs on connect)`;
        pill.title = 'Internet disconnected. Changes will automatically sync when internet is restored.';
        return;
    }

    if (cloudSyncState.status === 'syncing') {
        pill.className = 'badge bg-info text-dark py-2 px-3 fw-semibold shadow-sm';
        pill.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status"></span> Syncing to Web...`;
        return;
    }

    pill.className = 'badge bg-success text-white py-2 px-3 fw-semibold cursor-pointer shadow-sm';
    const timeStr = cloudSyncState.lastSynced ? new Date(cloudSyncState.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live';
    pill.innerHTML = `<i class="bi bi-cloud-check-fill me-1"></i> Cloud Synced (${timeStr})`;
    pill.title = `Connected to ${cloudSyncState.cloudUrl}. App changes are automatically synced to the web!`;
}

// Open Cloud Sync Configuration Modal
function openCloudSyncModal() {
    let modalEl = document.getElementById('cloudSyncModal');
    if (!modalEl) {
        modalEl = createCloudSyncModalDOM();
        document.body.appendChild(modalEl);
    }

    const input = document.getElementById('cloudWebsiteUrlInput');
    if (input) {
        input.value = cloudSyncState.cloudUrl || localStorage.getItem('cloud_website_url') || '';
    }

    const lastSyncEl = document.getElementById('cloudLastSyncDisplay');
    if (lastSyncEl) {
        lastSyncEl.innerText = cloudSyncState.lastSynced ? new Date(cloudSyncState.lastSynced).toLocaleString() : 'Never';
    }

    if (typeof bootstrap !== 'undefined') {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

// Save Cloud Website URL
async function saveCloudWebsiteUrl() {
    const input = document.getElementById('cloudWebsiteUrlInput');
    const val = input ? input.value.trim().replace(/\/+$/, '') : '';

    if (!val || !val.startsWith('http')) {
        alert('Please enter a valid website link (e.g. https://your-library.onrender.com)');
        return;
    }

    cloudSyncState.cloudUrl = val;
    localStorage.setItem('cloud_website_url', val);

    try {
        await fetch(`${AUTH_API_BASE}/api/cloud-sync/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cloudUrl: val, autoSync: true })
        });
    } catch (e) {}

    updateCloudSyncUI();
    executeCloudSync(true);
}

// Create Cloud Sync Modal HTML
function createCloudSyncModalDOM() {
    const div = document.createElement('div');
    div.id = 'cloudSyncModal';
    div.className = 'modal fade';
    div.tabIndex = -1;
    div.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-0 shadow-lg rounded-4">
                <div class="modal-header bg-dark text-white rounded-top-4">
                    <h5 class="modal-title fw-bold">
                        <i class="bi bi-cloud-arrow-up-fill text-primary me-2"></i>Cloud Website Sync Settings
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body p-4">
                    <p class="text-muted small mb-3">
                        Enter the link of your online hosted website (e.g. Render link). Whenever this PC app gets internet, it will automatically pull the Principal's changes from the website and push local data up!
                    </p>
                    
                    <div class="mb-3">
                        <label class="form-label small fw-bold text-muted text-uppercase">Online Website URL</label>
                        <div class="input-group">
                            <span class="input-group-text"><i class="bi bi-globe"></i></span>
                            <input type="url" class="form-control" id="cloudWebsiteUrlInput" placeholder="https://your-library.onrender.com">
                        </div>
                        <small class="text-muted" style="font-size: 0.75rem;">Example: https://anwariyya-library.onrender.com or Localtunnel URL</small>
                    </div>

                    <div class="d-flex justify-content-between align-items-center p-3 bg-light rounded-3 mb-3 border">
                        <div>
                            <small class="text-muted text-uppercase fw-bold d-block" style="font-size: 0.7rem;">Last Two-Way Sync</small>
                            <span class="fw-semibold text-dark small" id="cloudLastSyncDisplay">Never</span>
                        </div>
                        <button type="button" class="btn btn-outline-primary btn-sm fw-semibold" onclick="executeCloudSync(true)">
                            <i class="bi bi-arrow-repeat me-1"></i> Sync Now
                        </button>
                    </div>

                    <div class="alert alert-info py-2 small mb-0">
                        <i class="bi bi-info-circle-fill me-1"></i>
                        <strong>For Principal:</strong> Send the website link to the Principal's phone. Whatever they change on the site will automatically update this PC app whenever internet is connected.
                    </div>
                </div>
                <div class="modal-footer border-0">
                    <button type="button" class="btn btn-secondary rounded-3" data-bs-dismiss="modal">Close</button>
                    <button type="button" class="btn btn-primary fw-semibold rounded-3" onclick="saveCloudWebsiteUrl()">Save & Sync</button>
                </div>
            </div>
        </div>
    `;
    return div;
}

// 4. Automatic Online Reconnect Listener
window.addEventListener('online', () => {
    console.log('[Internet] Connection restored! Triggering cloud sync...');
    executeCloudSync(false); // Silent auto-sync
});

window.addEventListener('offline', () => {
    cloudSyncState.status = 'offline';
    updateCloudSyncUI();
});

// Periodic background sync if online (every 20 seconds)
setInterval(() => {
    if (navigator.onLine && cloudSyncState.cloudUrl) {
        executeCloudSync(false);
    }
}, 20000);

document.addEventListener('DOMContentLoaded', () => {
    fetchCloudSyncStatus();
    updateLoggedInUserUI();
});
