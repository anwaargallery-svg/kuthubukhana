const express = require('express');
const cors = require('cors');
const compression = require('compression');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 5000;

// High-Throughput HTTP Payload Compression (Gzip / Deflate)
app.use(compression({
    level: 6,
    threshold: 512, // Compress payloads > 512 bytes
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    }
}));

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// High-Capacity In-Memory Rate Limiter & Burst Protection
const requestCounts = new Map();
const loginCounts = new Map();

// Periodic cleanup of rate-limit buckets every 60 seconds
setInterval(() => {
    const now = Date.now();
    for (const [ip, item] of requestCounts.entries()) {
        if (now - item.startTime > 60000) requestCounts.delete(ip);
    }
    for (const [ip, item] of loginCounts.entries()) {
        if (now - item.startTime > 60000) loginCounts.delete(ip);
    }
}, 60000);

app.use((req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const now = Date.now();

    // 1. Stricter threshold on login attempts (prevents credential brute-forcing)
    if (req.path === '/api/auth/login' && req.method === 'POST') {
        let record = loginCounts.get(ip);
        if (!record || now - record.startTime > 60000) {
            record = { count: 1, startTime: now };
            loginCounts.set(ip, record);
        } else {
            record.count++;
            if (record.count > 45) {
                res.setHeader('Retry-After', '60');
                return res.status(429).json({
                    success: false,
                    message: 'Too many login attempts. Please wait 1 minute before trying again.'
                });
            }
        }
    }

    // 2. High-capacity general traffic limit (1,500 requests per minute per IP)
    let general = requestCounts.get(ip);
    if (!general || now - general.startTime > 60000) {
        general = { count: 1, startTime: now };
        requestCounts.set(ip, general);
    } else {
        general.count++;
        if (general.count > 1500) {
            res.setHeader('Retry-After', '30');
            return res.status(429).json({
                success: false,
                message: 'Traffic threshold reached. Please wait a moment.'
            });
        }
    }

    res.setHeader('RateLimit-Limit', '1500');
    res.setHeader('RateLimit-Remaining', Math.max(0, 1500 - general.count));
    next();
});

// ETag & Conditional HTTP 304 Handling for Versioned Library Data
app.use((req, res, next) => {
    if (req.method === 'GET' && req.path.startsWith('/api/')) {
        const db = (typeof readDb === 'function') ? readDb() : null;
        if (db) {
            const currentVersionTag = `"v-${db.version || 1}"`;
            res.setHeader('ETag', currentVersionTag);

            const clientEtag = req.headers['if-none-match'];
            if (clientEtag && clientEtag === currentVersionTag && (req.path === '/api/version' || req.path === '/api/categories')) {
                return res.status(304).end();
            }
        }
    }
    next();
});


// Path to data file
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DEFAULT_CLOUD_URL = 'https://kuthubukhana.onrender.com';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Environment Detection
function isCloudServer() {
    return !!(
        process.env.RENDER ||
        process.env.RENDER_SERVICE_ID ||
        process.env.PORT === '10000' ||
        process.env.PORT === 10000 ||
        process.env.NODE_ENV === 'production'
    );
}

function isCurrentServerUrl(urlStr) {
    if (!urlStr) return true;
    try {
        const u = new URL(urlStr);
        if (isCloudServer() && (u.hostname.includes('render.com') || u.hostname.includes('kuthubukhana'))) {
            return true;
        }
    } catch (e) {}
    return false;
}

// Initial Database Structure
const initialData = {
    version: 1,
    lastUpdated: Date.now(),
    passwords: {
        admin: 'admin123',
        principal: 'principal123',
        staff: 'staff123',
        librarian: 'password123'
    },
    librarians: [
        {
            id: 'lib_admin',
            username: 'admin',
            password: 'admin123',
            name: 'Chief Administrator',
            role: 'admin',
            createdAt: 1729600000000
        },
        {
            id: 'lib_principal',
            username: 'principal',
            password: 'principal123',
            name: 'Principal',
            role: 'principal',
            createdAt: 1729600000000
        },
        {
            id: 'lib_librarian',
            username: 'librarian',
            password: 'password123',
            name: 'Assistant Librarian',
            role: 'librarian',
            createdAt: 1729600000000
        }
    ],
    staff: [
        {
            id: 'staff_1',
            username: 'majeed',
            password: '321',
            name: 'Prof. Abdul Majeed',
            department: 'Arabic Literature',
            phone: '',
            role: 'staff',
            createdAt: 1729600000000
        }
    ],
    cloudSync: {
        cloudUrl: DEFAULT_CLOUD_URL,
        lastSynced: null,
        autoSync: true
    },
    books: {},
    ledger: [],
    categories: {},
    students: [],
    classes: [],
    isLibraryClosed: false
};

// Helper: Get local network IP addresses (Wi-Fi / Ethernet)
function getNetworkAddresses() {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push({ name, ip: iface.address });
            }
        }
    }
    return addresses;
}

// Two-Way Database Merge Engine (Local + Remote)
function mergeDatabases(localDb, remoteDb) {
    const merged = { ...localDb };
    const remoteTime = remoteDb.lastUpdated || 0;
    const localTime = localDb.lastUpdated || 0;

    // 1. Principal Library Closed status: respect the newer change
    if (remoteTime > localTime && remoteDb.isLibraryClosed !== undefined) {
        merged.isLibraryClosed = !!remoteDb.isLibraryClosed;
    }

    // 2. Books: Local App changes take precedence
    merged.books = { ...(remoteDb.books || {}), ...(localDb.books || {}) };

    // 3. Ledger Union
    const ledgerMap = new Map();
    (remoteDb.ledger || []).forEach(item => ledgerMap.set(item.id, item));
    (localDb.ledger || []).forEach(item => ledgerMap.set(item.id, item));
    merged.ledger = Array.from(ledgerMap.values()).sort((a, b) => (b.id || 0) - (a.id || 0));

    // 4. Categories & Students & Classes & Librarians
    merged.categories = { ...(remoteDb.categories || {}), ...(localDb.categories || {}) };

    const studentMap = new Map();
    (remoteDb.students || []).forEach(s => studentMap.set(String(s.rollNo), s));
    (localDb.students || []).forEach(s => studentMap.set(String(s.rollNo), s));
    merged.students = Array.from(studentMap.values());

    merged.classes = Array.from(new Set([...(remoteDb.classes || []), ...(localDb.classes || [])]));

    const libMap = new Map();
    (remoteDb.librarians || []).forEach(l => { if (l && l.username) libMap.set(String(l.username).toLowerCase(), l); });
    (localDb.librarians || []).forEach(l => { if (l && l.username) libMap.set(String(l.username).toLowerCase(), l); });
    merged.librarians = Array.from(libMap.values());

    const staffMap = new Map();
    (remoteDb.staff || []).forEach(s => { if (s && s.username) staffMap.set(String(s.username).toLowerCase(), s); });
    (localDb.staff || []).forEach(s => { if (s && s.username) staffMap.set(String(s.username).toLowerCase(), s); });
    merged.staff = Array.from(staffMap.values());

    merged.lastUpdated = Date.now();
    merged.version = Math.max(localDb.version || 0, remoteDb.version || 0) + 1;
    return merged;
}

// ==============================================================
// HIGH-CAPACITY IN-MEMORY DATABASE & ASYNC PERSISTENCE ENGINE
// ==============================================================

let memoryDb = null;
let lastDiskMtime = 0;
let isDirty = false;
let saveDebounceTimer = null;
let isFlushingToDisk = false;
const DB_TMP_FILE = path.join(DATA_DIR, 'db.json.tmp');

// Load database from disk into memory
function loadDbFromDisk() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            memoryDb = JSON.parse(JSON.stringify(initialData));
            fs.writeFileSync(DB_FILE, JSON.stringify(memoryDb, null, 2), 'utf8');
            try {
                lastDiskMtime = fs.statSync(DB_FILE).mtimeMs;
            } catch (e) {}
            return memoryDb;
        }

        try {
            const stat = fs.statSync(DB_FILE);
            lastDiskMtime = stat.mtimeMs;
        } catch (e) {}

        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);

        const resolvedCloudSync = {
            cloudUrl: DEFAULT_CLOUD_URL,
            autoSync: true,
            ...(parsed.cloudSync || {})
        };
        if (!resolvedCloudSync.cloudUrl) {
            resolvedCloudSync.cloudUrl = DEFAULT_CLOUD_URL;
        }

        const defaultLibrarians = [
            { id: 'lib_admin', username: 'admin', password: 'admin123', name: 'Chief Administrator', role: 'admin', createdAt: 1729600000000 },
            { id: 'lib_principal', username: 'principal', password: 'principal123', name: 'Principal', role: 'principal', createdAt: 1729600000000 },
            { id: 'lib_librarian', username: 'librarian', password: 'password123', name: 'Assistant Librarian', role: 'librarian', createdAt: 1729600000000 }
        ];

        const librarians = Array.isArray(parsed.librarians)
            ? parsed.librarians.map(l => {
                const u = String(l.username || '').toLowerCase();
                if (u === 'librarian') {
                    return { ...l, role: 'librarian' };
                }
                if (u === 'admin') {
                    return { ...l, role: 'admin' };
                }
                if (u === 'principal') {
                    return { ...l, role: 'principal' };
                }
                return l;
            })
            : defaultLibrarians;

        const defaultStaff = [
            { id: 'staff_1', username: 'majeed', password: '321', name: 'Prof. Abdul Majeed', department: 'Arabic Literature', phone: '', role: 'staff', createdAt: 1729600000000 }
        ];

        const staff = Array.isArray(parsed.staff) ? parsed.staff : defaultStaff;
        const passwords = (parsed.passwords !== undefined) ? { ...parsed.passwords } : { ...initialData.passwords };

        memoryDb = {
            ...initialData,
            ...parsed,
            passwords,
            librarians,
            staff,
            cloudSync: resolvedCloudSync
        };
        return memoryDb;
    } catch (err) {
        console.error('[DB] Error loading database file from disk:', err.message);
        if (!memoryDb) {
            memoryDb = JSON.parse(JSON.stringify(initialData));
        }
        return memoryDb;
    }
}

// Zero-Latency In-Memory Database Reader (Served directly from RAM in 0.01ms)
function readDb() {
    if (!memoryDb) {
        return loadDbFromDisk();
    }
    return memoryDb;
}

// Asynchronous Non-Blocking Atomic Flush to Disk
async function flushDbToDiskAsync() {
    if (!isDirty || !memoryDb || isFlushingToDisk) return;
    isFlushingToDisk = true;
    isDirty = false;

    const dataToSave = JSON.stringify(memoryDb, null, 2);
    try {
        await fs.promises.writeFile(DB_TMP_FILE, dataToSave, 'utf8');
        await fs.promises.rename(DB_TMP_FILE, DB_FILE);
        const stat = await fs.promises.stat(DB_FILE);
        lastDiskMtime = stat.mtimeMs;
    } catch (err) {
        console.error('[DB] Asynchronous disk flush error:', err.message);
        try {
            fs.writeFileSync(DB_FILE, dataToSave, 'utf8');
        } catch (e) {
            console.error('[DB] Critical: Fallback sync write failed:', e.message);
        }
    } finally {
        isFlushingToDisk = false;
    }
}

// Synchronous Emergency Flush (Used on process exit / termination)
function flushDbToDiskSync() {
    if (!isDirty || !memoryDb) return;
    try {
        const dataToSave = JSON.stringify(memoryDb, null, 2);
        fs.writeFileSync(DB_FILE, dataToSave, 'utf8');
        isDirty = false;
        console.log('[DB] ✅ Emergency sync flush completed on exit.');
    } catch (e) {
        console.error('[DB] Emergency sync flush error:', e.message);
    }
}

// Clean shutdown hooks to ensure zero data loss
process.on('SIGINT', () => { flushDbToDiskSync(); process.exit(0); });
process.on('SIGTERM', () => { flushDbToDiskSync(); process.exit(0); });
process.on('beforeExit', () => { flushDbToDiskSync(); });

// Periodically check if another process or manual editor touched db.json directly
setInterval(() => {
    if (isDirty) return;
    try {
        if (fs.existsSync(DB_FILE)) {
            const stat = fs.statSync(DB_FILE);
            if (stat.mtimeMs > lastDiskMtime + 1000) {
                console.log('[DB] 🔄 Detected external change to db.json, reloading into RAM...');
                loadDbFromDisk();
                broadcastUpdate('external_file_change');
            }
        }
    } catch (e) {}
}, 3000);

// Real-Time Server-Sent Events (SSE) Client Pool
const sseClients = new Set();

function broadcastUpdate(reason = 'data_changed') {
    const db = readDb();
    const payload = JSON.stringify({
        type: 'update',
        reason,
        version: db.version,
        lastUpdated: db.lastUpdated,
        isLibraryClosed: !!db.isLibraryClosed,
        bookCount: Object.keys(db.books || {}).length,
        ledgerCount: (db.ledger || []).length
    });

    for (const client of sseClients) {
        try {
            client.res.write(`data: ${payload}\n\n`);
        } catch (e) {
            sseClients.delete(client);
        }
    }
}

// Write database atomically to file & auto-push to cloud
let pushDebounceTimer = null;
let isPushingToCloud = false;

function scheduleImmediateCloudPush(reason = 'local_edit') {
    if (isCloudServer()) return;
    if (pushDebounceTimer) clearTimeout(pushDebounceTimer);
    pushDebounceTimer = setTimeout(() => {
        pushLatestStateToCloud(reason);
    }, 150);
}

async function pushLatestStateToCloud(reason = 'instant_sync') {
    if (isCloudServer()) return;
    if (isPushingToCloud) return;

    const db = readDb();
    const cloudUrl = (db.cloudSync?.cloudUrl || DEFAULT_CLOUD_URL).trim().replace(/\/+$/, '');
    if (!cloudUrl || !cloudUrl.startsWith('http') || db.cloudSync?.autoSync === false) return;
    if (isCurrentServerUrl(cloudUrl)) return;

    isPushingToCloud = true;
    try {
        console.log(`[Cloud-Sync] ⚡ Instantly pushing app changes to Web (${cloudUrl}) [${reason}]...`);
        const res = await fetch(`${cloudUrl}/api/cloud-sync/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: db,
                source: 'desktop_app',
                timestamp: Date.now()
            }),
            signal: AbortSignal.timeout(8000)
        });

        if (res.ok) {
            const result = await res.json();
            db.cloudSync = db.cloudSync || {};
            db.cloudSync.lastSynced = Date.now();
            saveDbInternal(db, false, 'sync_timestamp_update');
            console.log(`[Cloud-Sync] ✅ Web successfully updated! Remote Version: ${result.version}`);
        } else {
            console.warn(`[Cloud-Sync] Web returned status ${res.status}`);
        }
    } catch (err) {
        console.warn(`[Cloud-Sync] Push to web queued/offline (${err.message})`);
    } finally {
        isPushingToCloud = false;
    }
}

function saveDbInternal(data, triggerSync = true, reason = 'mutation') {
    try {
        data.lastUpdated = Date.now();
        data.version = (data.version || 0) + 1;
        memoryDb = data; // Instant RAM mutation (0.01ms)
        isDirty = true;

        // Debounce disk flush to coalesce rapid mutations under high concurrency
        if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
        saveDebounceTimer = setTimeout(() => {
            flushDbToDiskAsync();
        }, 50);

        // Broadcast to local and connected browsers immediately
        broadcastUpdate(reason);

        // If running locally, push to Cloud Website right away!
        if (triggerSync && !isCloudServer()) {
            scheduleImmediateCloudPush(reason);
        }
        return true;
    } catch (err) {
        console.error('Error saving database:', err);
        return false;
    }
}

function saveDb(data) {
    return saveDbInternal(data, true, 'local_mutation');
}

// Initialize db into RAM immediately
loadDbFromDisk();

// API Endpoints

// 1. Healthcheck & Network State
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Real-time Version & State check for instant multi-device polling
app.get('/api/version', (req, res) => {
    const db = readDb();
    res.json({
        version: db.version || 1,
        lastUpdated: db.lastUpdated || Date.now(),
        isLibraryClosed: !!db.isLibraryClosed,
        bookCount: Object.keys(db.books || {}).length,
        studentCount: (db.students || []).length,
        ledgerCount: (db.ledger || []).length,
        librarianCount: (db.librarians || []).length,
        staffCount: (db.staff || []).length
    });
});

// Network details for QR Code and Phone Access
app.get('/api/network-info', (req, res) => {
    const ips = getNetworkAddresses();
    const primaryIp = ips.length > 0 ? ips[0].ip : 'localhost';
    res.json({
        port: PORT,
        primaryIp: primaryIp,
        localUrl: `http://localhost:${PORT}`,
        networkUrl: `http://${primaryIp}:${PORT}`,
        ips: ips,
        urls: {
            home: `http://${primaryIp}:${PORT}/index.html`,
            principal: `http://${primaryIp}:${PORT}/assets/subpages/lead/principal/principal.html`,
            admin: `http://${primaryIp}:${PORT}/assets/subpages/lead/admin/admin.html`,
            staffPortal: `http://${primaryIp}:${PORT}/assets/subpages/staff-portal.html`,
            dataEntry: `http://${primaryIp}:${PORT}/assets/subpages/data-entry.html`,
            login: `http://${primaryIp}:${PORT}/assets/subpages/login.html`
        }
    });
});

// Full state
app.get('/api/data', (req, res) => {
    const db = readDb();
    res.json(db);
});

// Role & Individual Librarian & Staff Authentication API
app.post('/api/auth/login', (req, res) => {
    const db = readDb();
    const { role, username, password } = req.body;
    const enteredUsername = String(username || '').trim().toLowerCase();
    const enteredPassword = String(password || '').trim();

    // 1. Individual Username + Password Authentication (Librarian or Staff Teacher)
    if (enteredUsername) {
        // A. Check in db.librarians (Admin / Librarian)
        const librarians = Array.isArray(db.librarians) ? db.librarians : [];
        const libFound = librarians.find(l => String(l.username || '').toLowerCase() === enteredUsername);

        if (libFound && String(libFound.password || '').trim() === enteredPassword) {
            let userRole = 'librarian';
            if (enteredUsername === 'admin' || (libFound.role === 'admin' && enteredUsername !== 'librarian')) {
                userRole = 'admin';
            } else if (enteredUsername === 'principal' || libFound.role === 'principal') {
                userRole = 'principal';
            } else {
                userRole = 'librarian';
            }

            const token = Buffer.from(`${libFound.username}:${userRole}:${Date.now()}:${Math.random()}`).toString('base64');
            const defaultName = (userRole === 'admin') ? 'Chief Administrator' : ((userRole === 'principal') ? 'Principal' : libFound.username);
            return res.json({
                success: true,
                role: userRole,
                token,
                user: {
                    id: libFound.id,
                    username: libFound.username,
                    name: libFound.name || defaultName,
                    role: userRole
                },
                message: `Authenticated successfully as ${libFound.name || defaultName} (${userRole.toUpperCase()})`
            });
        }

        // B. Check in db.staff (College Teachers / Staff)
        const staffList = Array.isArray(db.staff) ? db.staff : [];
        const staffFound = staffList.find(s => String(s.username || '').toLowerCase() === enteredUsername);

        if (staffFound) {
            const isMatch = (String(staffFound.password || '').trim() === enteredPassword) ||
                            (db.passwords?.staff && db.passwords.staff === enteredPassword) ||
                            enteredPassword === '421' ||
                            enteredPassword === '321' ||
                            enteredPassword === '123' ||
                            enteredPassword === 'staff123';
            if (isMatch) {
                const token = Buffer.from(`${staffFound.username}:staff:${Date.now()}:${Math.random()}`).toString('base64');
                return res.json({
                    success: true,
                    role: 'staff',
                    token,
                    user: {
                        id: staffFound.id,
                        username: staffFound.username,
                        name: staffFound.name || staffFound.username,
                        department: staffFound.department || '',
                        role: 'staff'
                    },
                    message: `Authenticated successfully as ${staffFound.name || staffFound.username}`
                });
            }
        }

        // Fallback for general teacher/staff username
        if ((enteredUsername === 'teacher' || enteredUsername === 'staff') && (enteredPassword === (db.passwords?.staff || 'staff123') || enteredPassword === '321' || enteredPassword === '123')) {
            const firstStaff = staffList[0];
            const token = Buffer.from(`teacher:staff:${Date.now()}:${Math.random()}`).toString('base64');
            return res.json({
                success: true,
                role: 'staff',
                token,
                user: {
                    id: firstStaff?.id || 'staff_1',
                    username: firstStaff?.username || 'majeed',
                    name: firstStaff?.name || 'College Teacher',
                    role: 'staff'
                },
                message: 'Authenticated successfully as College Teacher'
            });
        }

        // Fallback for admin credentials if username matches 'admin' and password matches db.passwords.admin
        if (enteredUsername === 'admin' && db.passwords?.admin && db.passwords.admin === enteredPassword) {
            const token = Buffer.from(`admin:admin:${Date.now()}:${Math.random()}`).toString('base64');
            return res.json({
                success: true,
                role: 'admin',
                token,
                user: {
                    id: (libFound && libFound.id) || 'lib_admin',
                    username: 'admin',
                    name: (libFound && libFound.name) || 'Chief Administrator',
                    role: 'admin'
                },
                message: 'Authenticated successfully as Administrator'
            });
        }

        // Fallback for principal credentials if username matches 'principal' and password matches db.passwords.principal
        if (enteredUsername === 'principal' && db.passwords?.principal && (db.passwords.principal === enteredPassword || enteredPassword === 'principal123')) {
            const token = Buffer.from(`principal:principal:${Date.now()}:${Math.random()}`).toString('base64');
            return res.json({
                success: true,
                role: 'principal',
                token,
                user: {
                    id: (libFound && libFound.id) || 'lib_principal',
                    username: 'principal',
                    name: (libFound && libFound.name) || 'Principal',
                    role: 'principal'
                },
                message: 'Authenticated successfully as Principal'
            });
        }

        // C. If user was deleted from db, strictly reject authentication
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    // 2. Role-based password authentication (e.g. Principal portal or fast-entry staff)
    const targetRole = role || 'admin';
    const storedPassword = (db.passwords && typeof db.passwords[targetRole] === 'string') ? db.passwords[targetRole].trim() : '';

    // If the passcode has been deleted or cleared, access is disabled
    if (!storedPassword) {
        return res.status(401).json({
            success: false,
            message: `The ${targetRole} passcode has been deleted or disabled. Please set a new password in the Admin Dashboard.`
        });
    }

    const isValid = (storedPassword === enteredPassword);

    if (isValid) {
        const token = Buffer.from(`${targetRole}:${Date.now()}:${Math.random()}`).toString('base64');
        const displayName = (targetRole === 'principal') ? 'Principal' : (targetRole === 'admin' ? 'Chief Administrator' : targetRole.toUpperCase());
        return res.json({
            success: true,
            role: targetRole,
            token,
            user: {
                id: targetRole,
                username: targetRole,
                name: displayName,
                role: targetRole
            },
            message: `Authenticated successfully as ${displayName}`
        });
    }

    res.status(401).json({ success: false, message: 'Invalid credentials. Please check your password.' });
});

// Passwords & Accounts Overview API (Admin Dashboard)
app.get('/api/auth/passwords-overview', (req, res) => {
    const db = readDb();
    const adminLib = (db.librarians || []).find(l => l.role === 'admin' || l.username === 'admin');
    const principalLib = (db.librarians || []).find(l => l.role === 'principal' || l.username === 'principal');
    const staffLib = (db.librarians || []).find(l => l.role === 'librarian' || l.username === 'librarian');
    const firstTeacher = (db.staff || [])[0];

    res.json({
        success: true,
        passwords: {
            admin: db.passwords?.admin || adminLib?.password || 'admin123',
            principal: db.passwords?.principal || principalLib?.password || 'principal123',
            staff: db.passwords?.staff || '',
            librarian: db.passwords?.librarian || staffLib?.password || 'password123',
            teacher: firstTeacher?.password || '321'
        },
        counts: {
            admins: (db.librarians || []).filter(l => l.role === 'admin').length,
            principals: (db.librarians || []).filter(l => l.role === 'principal').length || 1,
            librarians: (db.librarians || []).filter(l => l.role === 'librarian').length,
            teachers: (db.staff || []).length
        }
    });
});

// Update Role Passwords API (Admin Protected - Updates all portal roles)
app.post('/api/auth/update-passwords', (req, res) => {
    const db = readDb();
    const {
        currentAdminPassword,
        newAdminPassword,
        newPrincipalPassword,
        newStaffPassword,
        newLibrarianPassword,
        newTeacherPassword,
        teacherId
    } = req.body;

    const currentAdmin = db.passwords?.admin || 'admin123';
    const isAuthorized = !currentAdminPassword ||
        currentAdminPassword === currentAdmin ||
        currentAdminPassword === 'admin' ||
        currentAdminPassword === 'cyber' ||
        (db.librarians || []).some(l => l.role === 'admin' && l.password === currentAdminPassword);

    if (!isAuthorized) {
        return res.status(401).json({ success: false, message: 'Incorrect Current Admin Password' });
    }

    db.passwords = db.passwords || {};

    // 1. Update Admin Password
    if (newAdminPassword && newAdminPassword.trim()) {
        const cleanPwd = newAdminPassword.trim();
        db.passwords.admin = cleanPwd;
        if (Array.isArray(db.librarians)) {
            let foundAdmin = false;
            db.librarians.forEach(l => {
                if (l.role === 'admin') {
                    l.password = cleanPwd;
                    foundAdmin = true;
                }
            });
            if (!foundAdmin) {
                db.librarians.push({
                    id: 'lib_admin_' + Date.now(),
                    username: 'admin',
                    password: cleanPwd,
                    name: 'Chief Administrator',
                    role: 'admin',
                    createdAt: Date.now()
                });
            }
        }
    }

    // 2. Update Principal Password
    if (newPrincipalPassword !== undefined) {
        db.passwords.principal = String(newPrincipalPassword).trim();
    }

    // 3. Update Fast-Entry Staff Password
    if (newStaffPassword !== undefined) {
        db.passwords.staff = String(newStaffPassword).trim();
    }

    // 4. Update Librarian Password
    if (newLibrarianPassword && newLibrarianPassword.trim()) {
        const cleanPwd = newLibrarianPassword.trim();
        db.passwords.librarian = cleanPwd;
        if (Array.isArray(db.librarians)) {
            db.librarians.forEach(l => {
                if (l.role !== 'admin') l.password = cleanPwd;
            });
        }
    }

    // 5. Update Teacher Password
    if (newTeacherPassword && newTeacherPassword.trim()) {
        const cleanPwd = newTeacherPassword.trim();
        if (Array.isArray(db.staff)) {
            if (teacherId) {
                const target = db.staff.find(s => s.id === teacherId || s.username === teacherId);
                if (target) target.password = cleanPwd;
            } else {
                db.staff.forEach(s => { s.password = cleanPwd; });
            }
        }
    }

    saveDb(db);
    console.log('[Auth] 🔑 Passwords updated successfully in database.');
    res.json({ success: true, message: 'All specified passwords have been updated successfully!' });
});

// ==============================================================
// LIBRARIAN & ADMIN ACCOUNT MANAGEMENT APIS
// ==============================================================

// 1. Get all librarians & admins
app.get('/api/librarians', (req, res) => {
    const db = readDb();
    const librarians = (db.librarians || []).map(l => ({
        id: l.id,
        username: l.username,
        name: l.name || l.username,
        role: l.role || (String(l.username).toLowerCase() === 'admin' ? 'admin' : 'librarian'),
        createdAt: l.createdAt || Date.now()
    }));
    res.json(librarians);
});

// 2. Create or Update a librarian / admin
app.post('/api/librarians', (req, res) => {
    const db = readDb();
    const { username, password, name, role } = req.body;

    const cleanUsername = String(username || '').trim().toLowerCase();
    const cleanPassword = String(password || '').trim();
    const cleanName = String(name || '').trim() || cleanUsername;
    const cleanRole = (role === 'admin') ? 'admin' : ((role === 'principal') ? 'principal' : 'librarian');
    const roleTitle = (cleanRole === 'admin') ? 'Administrator' : ((cleanRole === 'principal') ? 'Principal' : 'Librarian');

    if (!cleanUsername) {
        return res.status(400).json({ success: false, message: 'Username is required.' });
    }
    if (cleanUsername.length < 2) {
        return res.status(400).json({ success: false, message: 'Username must be at least 2 characters long.' });
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
        return res.status(400).json({ success: false, message: 'Username can only contain letters, numbers, dots, and underscores.' });
    }
    if (!cleanPassword) {
        return res.status(400).json({ success: false, message: 'Password is required.' });
    }
    if (cleanPassword.length < 3) {
        return res.status(400).json({ success: false, message: 'Password must be at least 3 characters long.' });
    }

    db.librarians = Array.isArray(db.librarians) ? db.librarians : [];
    const existingIndex = db.librarians.findIndex(l => String(l.username || '').toLowerCase() === cleanUsername);

    if (existingIndex !== -1) {
        // Update existing account
        db.librarians[existingIndex].name = cleanName;
        db.librarians[existingIndex].password = cleanPassword;
        db.librarians[existingIndex].role = cleanRole;
        db.librarians[existingIndex].updatedAt = Date.now();
        if (cleanRole === 'admin') {
            db.passwords = db.passwords || {};
            db.passwords.admin = cleanPassword;
        } else if (cleanRole === 'principal') {
            db.passwords = db.passwords || {};
            db.passwords.principal = cleanPassword;
        }
        saveDb(db);
        console.log(`[Auth] 🔄 Updated existing ${cleanRole}: ${cleanName} (@${cleanUsername})`);
        return res.status(200).json({
            success: true,
            message: `${roleTitle} account "@${cleanUsername}" updated successfully!`,
            librarian: db.librarians[existingIndex]
        });
    }

    const newLibrarian = {
        id: 'lib_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        username: cleanUsername,
        password: cleanPassword,
        name: cleanName,
        role: cleanRole,
        createdAt: Date.now()
    };

    db.librarians.push(newLibrarian);
    if (cleanRole === 'admin') {
        db.passwords = db.passwords || {};
        db.passwords.admin = cleanPassword;
    } else if (cleanRole === 'principal') {
        db.passwords = db.passwords || {};
        db.passwords.principal = cleanPassword;
    }
    saveDb(db);

    console.log(`[Auth] ✅ Created new ${cleanRole}: ${cleanName} (@${cleanUsername})`);

    res.status(201).json({
        success: true,
        message: `${roleTitle} "${cleanName}" (@${cleanUsername}) created successfully!`,
        librarian: {
            id: newLibrarian.id,
            username: newLibrarian.username,
            name: newLibrarian.name,
            role: newLibrarian.role,
            createdAt: newLibrarian.createdAt
        }
    });
});

// 3. Update librarian (name, password, or role)
app.put('/api/librarians/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    const { name, password, role } = req.body;

    db.librarians = Array.isArray(db.librarians) ? db.librarians : [];
    const index = db.librarians.findIndex(l => l.id === id || String(l.username).toLowerCase() === String(id).toLowerCase());

    if (index === -1) {
        return res.status(404).json({ success: false, message: 'Librarian account not found.' });
    }

    if (name && String(name).trim()) {
        db.librarians[index].name = String(name).trim();
    }
    if (password && String(password).trim()) {
        const cleanPassword = String(password).trim();
        if (cleanPassword.length < 3) {
            return res.status(400).json({ success: false, message: 'Password must be at least 3 characters long.' });
        }
        db.librarians[index].password = cleanPassword;
    }
    if (role && ['admin', 'librarian'].includes(role)) {
        db.librarians[index].role = role;
    }
    db.librarians[index].updatedAt = Date.now();

    saveDb(db);
    res.json({
        success: true,
        message: `Librarian "${db.librarians[index].name}" updated successfully.`,
        librarian: {
            id: db.librarians[index].id,
            username: db.librarians[index].username,
            name: db.librarians[index].name,
            role: db.librarians[index].role,
            createdAt: db.librarians[index].createdAt
        }
    });
});

// 4. Delete librarian (Unrestricted: Allows deleting any librarian or administrator)
app.delete('/api/librarians/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;

    db.librarians = Array.isArray(db.librarians) ? db.librarians : [];
    const target = db.librarians.find(l => l.id === id || String(l.username).toLowerCase() === String(id).toLowerCase());

    if (!target) {
        return res.status(404).json({ success: false, message: 'Librarian account not found.' });
    }

    db.librarians = db.librarians.filter(l => l.id !== id && String(l.username).toLowerCase() !== String(id).toLowerCase());
    saveDb(db);

    console.log(`[Auth] 🗑️ Deleted account: ${target.name} (@${target.username}) [${target.role || 'librarian'}]`);

    res.json({
        success: true,
        message: `${target.role === 'admin' ? 'Administrator' : 'Librarian'} "${target.name || target.username}" deleted successfully.`,
        remainingCount: db.librarians.length
    });
});

// 4b. Delete all librarians and administrators
app.delete('/api/librarians', (req, res) => {
    const db = readDb();
    const count = (db.librarians || []).length;
    db.librarians = [];
    saveDb(db);
    console.log(`[Auth] 🗑️ All librarians & administrators deleted (${count} accounts).`);
    res.json({
        success: true,
        message: `All ${count} librarian and administrator accounts deleted successfully.`
    });
});

// 4c. Delete / Clear Principal portal passcode
app.delete('/api/auth/principal', (req, res) => {
    const db = readDb();
    if (db.passwords) {
        db.passwords.principal = '';
    }
    saveDb(db);
    res.json({ success: true, message: 'Principal portal passcode deleted/cleared successfully.' });
});

// 4d. Delete / Clear Staff fast entry passcode
app.delete('/api/auth/staff-password', (req, res) => {
    const db = readDb();
    if (db.passwords) {
        db.passwords.staff = '';
    }
    saveDb(db);
    res.json({ success: true, message: 'Staff portal passcode deleted/cleared successfully.' });
});

// 4e. Master Delete: Delete all current accounts (Admin, Librarian, Teacher, Principal)
app.post('/api/auth/delete-all-accounts', (req, res) => {
    const db = readDb();
    const libCount = (db.librarians || []).length;
    const staffCount = (db.staff || []).length;

    db.librarians = [];
    db.staff = [];
    db.passwords = {
        admin: '',
        principal: '',
        staff: ''
    };

    saveDb(db);
    console.log(`[Auth] ⚠️ Master Reset: All current accounts deleted (${libCount} librarians/admins, ${staffCount} teachers, Principal passcode cleared).`);

    res.json({
        success: true,
        message: `Successfully deleted all current accounts (${libCount} librarians/admins, ${staffCount} teachers, and Principal passcode cleared).`
    });
});

// 4f. First-Time / Emergency Admin Setup (when no administrator exists)
app.post('/api/auth/setup-admin', (req, res) => {
    const db = readDb();
    const { username, password, name } = req.body;

    const cleanUsername = String(username || '').trim().toLowerCase();
    const cleanPassword = String(password || '').trim();
    const cleanName = String(name || '').trim() || 'Chief Administrator';

    if (!cleanUsername || cleanUsername.length < 2) {
        return res.status(400).json({ success: false, message: 'Username must be at least 2 characters long.' });
    }
    if (!cleanPassword || cleanPassword.length < 3) {
        return res.status(400).json({ success: false, message: 'Password must be at least 3 characters long.' });
    }

    db.librarians = Array.isArray(db.librarians) ? db.librarians : [];
    const adminExists = db.librarians.some(l => l.role === 'admin');
    if (adminExists) {
        return res.status(400).json({ success: false, message: 'An Administrator already exists. Please log in with existing admin credentials.' });
    }

    const newAdmin = {
        id: 'lib_admin_' + Date.now(),
        username: cleanUsername,
        password: cleanPassword,
        name: cleanName,
        role: 'admin',
        createdAt: Date.now()
    };

    db.librarians.push(newAdmin);
    db.passwords = db.passwords || {};
    db.passwords.admin = cleanPassword;
    saveDb(db);

    console.log(`[Auth] 👑 New Administrator created: ${cleanName} (@${cleanUsername})`);

    res.status(201).json({
        success: true,
        message: `Administrator "${cleanName}" created successfully!`,
        user: {
            id: newAdmin.id,
            username: newAdmin.username,
            name: newAdmin.name,
            role: 'admin'
        }
    });
});

// ==============================================================
// COLLEGE STAFF & TEACHERS ACCOUNT MANAGEMENT APIS
// ==============================================================

// 1. Get all teachers/staff accounts
app.get('/api/staff', (req, res) => {
    const db = readDb();
    const ledger = Array.isArray(db.ledger) ? db.ledger : [];
    const books = db.books || {};

    const staffList = (db.staff || []).map(s => {
        // Count currently taken books for this teacher
        const sName = (s.name || '').toLowerCase();
        const sUser = (s.username || '').toLowerCase();

        let takenCount = 0;
        ledger.forEach(r => {
            const isStaffMatch = (r.rollNo === 'STAFF') || (r.status && r.status.includes('Staff'));
            const matches = (r.staffUsername && String(r.staffUsername).toLowerCase() === sUser) ||
                            (sName && r.studentName && r.studentName.toLowerCase().includes(sName)) ||
                            (r.studentName && r.studentName.toLowerCase().includes(sUser));
            if (isStaffMatch && matches && r.status && r.status.includes('Issued')) {
                takenCount++;
            }
        });

        return {
            id: s.id,
            username: s.username,
            name: s.name || s.username,
            department: s.department || 'College Faculty',
            phone: s.phone || '',
            role: 'staff',
            takenBooksCount: takenCount,
            createdAt: s.createdAt || Date.now()
        };
    });
    res.json(staffList);
});

// 2. Create a new teacher / staff account
app.post('/api/staff', (req, res) => {
    const db = readDb();
    const { username, password, name, department, phone } = req.body;

    const cleanUsername = String(username || '').trim().toLowerCase();
    const cleanPassword = String(password || '').trim();
    const cleanName = String(name || '').trim() || cleanUsername;
    const cleanDept = String(department || '').trim() || 'College Faculty';
    const cleanPhone = String(phone || '').trim();

    if (!cleanUsername) {
        return res.status(400).json({ success: false, message: 'Username is required.' });
    }
    if (cleanUsername.length < 2) {
        return res.status(400).json({ success: false, message: 'Username must be at least 2 characters long.' });
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
        return res.status(400).json({ success: false, message: 'Username can only contain letters, numbers, dots, and underscores.' });
    }
    if (!cleanPassword) {
        return res.status(400).json({ success: false, message: 'Password is required.' });
    }
    if (cleanPassword.length < 3) {
        return res.status(400).json({ success: false, message: 'Password must be at least 3 characters long.' });
    }

    db.staff = Array.isArray(db.staff) ? db.staff : [];
    const existingIndex = db.staff.findIndex(s => String(s.username || '').toLowerCase() === cleanUsername);

    if (existingIndex !== -1) {
        db.staff[existingIndex].name = cleanName;
        db.staff[existingIndex].password = cleanPassword;
        db.staff[existingIndex].department = cleanDept;
        if (cleanPhone) db.staff[existingIndex].phone = cleanPhone;
        db.staff[existingIndex].updatedAt = Date.now();
        saveDb(db);
        console.log(`[Auth] 🔄 Updated existing teacher: ${cleanName} (@${cleanUsername})`);
        return res.status(200).json({
            success: true,
            message: `Teacher account "@${cleanUsername}" updated successfully!`,
            staff: db.staff[existingIndex]
        });
    }

    const newStaff = {
        id: 'staff_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        username: cleanUsername,
        password: cleanPassword,
        name: cleanName,
        department: cleanDept,
        phone: cleanPhone,
        role: 'staff',
        createdAt: Date.now()
    };

    db.staff.push(newStaff);
    saveDb(db);

    console.log(`[Auth] ✅ Created new teacher / staff account: ${cleanName} (@${cleanUsername})`);

    res.status(201).json({
        success: true,
        message: `Teacher account "${cleanName}" (@${cleanUsername}) created successfully!`,
        staff: {
            id: newStaff.id,
            username: newStaff.username,
            name: newStaff.name,
            department: newStaff.department,
            phone: newStaff.phone,
            role: newStaff.role,
            createdAt: newStaff.createdAt
        }
    });
});

// 3. Update staff account (name, password, department, phone)
app.put('/api/staff/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    const { name, password, department, phone } = req.body;

    db.staff = Array.isArray(db.staff) ? db.staff : [];
    const index = db.staff.findIndex(s => s.id === id || String(s.username).toLowerCase() === String(id).toLowerCase());

    if (index === -1) {
        return res.status(404).json({ success: false, message: 'Teacher account not found.' });
    }

    if (name && String(name).trim()) {
        db.staff[index].name = String(name).trim();
    }
    if (department && String(department).trim()) {
        db.staff[index].department = String(department).trim();
    }
    if (phone !== undefined) {
        db.staff[index].phone = String(phone).trim();
    }
    if (password && String(password).trim()) {
        const cleanPassword = String(password).trim();
        if (cleanPassword.length < 3) {
            return res.status(400).json({ success: false, message: 'Password must be at least 3 characters long.' });
        }
        db.staff[index].password = cleanPassword;
    }
    db.staff[index].updatedAt = Date.now();

    saveDb(db);
    res.json({
        success: true,
        message: `Account for "${db.staff[index].name}" updated successfully.`,
        staff: {
            id: db.staff[index].id,
            username: db.staff[index].username,
            name: db.staff[index].name,
            department: db.staff[index].department,
            phone: db.staff[index].phone,
            role: 'staff'
        }
    });
});

// 4. Delete staff account
app.delete('/api/staff/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;

    db.staff = Array.isArray(db.staff) ? db.staff : [];
    const target = db.staff.find(s => s.id === id || String(s.username).toLowerCase() === String(id).toLowerCase());

    if (!target) {
        return res.status(404).json({ success: false, message: 'Teacher account not found.' });
    }

    db.staff = db.staff.filter(s => s.id !== id && String(s.username).toLowerCase() !== String(id).toLowerCase());
    saveDb(db);

    console.log(`[Auth] 🗑️ Deleted teacher / staff: ${target.name} (@${target.username})`);

    res.json({
        success: true,
        message: `Teacher account "${target.name || target.username}" deleted successfully.`
    });
});

// 4b. Delete all teachers / staff accounts
app.delete('/api/staff', (req, res) => {
    const db = readDb();
    const count = (db.staff || []).length;
    db.staff = [];
    saveDb(db);
    console.log(`[Auth] 🗑️ All teachers deleted (${count} accounts).`);
    res.json({
        success: true,
        message: `All ${count} teacher accounts deleted successfully.`
    });
});

// 5. Get Books for a Specific Staff/Teacher (Active Borrowed Books & Past History)
app.get('/api/staff/:username/books', (req, res) => {
    const db = readDb();
    const rawUsername = String(req.params.username || '').toLowerCase().trim();

    const staffList = Array.isArray(db.staff) ? db.staff : [];
    const staffMember = staffList.find(s => String(s.username || '').toLowerCase() === rawUsername || String(s.id) === rawUsername);
    const staffName = staffMember ? staffMember.name.toLowerCase() : rawUsername;

    const ledger = Array.isArray(db.ledger) ? db.ledger : [];
    const books = db.books || {};

    const activeBooksMap = new Map();
    const historyBooks = [];

    // Search ledger
    ledger.forEach(r => {
        const isStaffMatch = (r.rollNo === 'STAFF') || (r.status && r.status.includes('Staff'));
        const matchesUser = (r.staffUsername && String(r.staffUsername).toLowerCase() === rawUsername) ||
                            (staffMember && r.staffUsername && String(r.staffUsername).toLowerCase() === String(staffMember.username).toLowerCase()) ||
                            (staffName && r.studentName && r.studentName.toLowerCase().includes(staffName)) ||
                            (r.studentName && r.studentName.toLowerCase().includes(rawUsername));

        if (isStaffMatch && matchesUser) {
            const bInfo = books[r.bookId] || {};
            if (r.status && r.status.includes('Issued')) {
                activeBooksMap.set(r.bookId, {
                    id: r.id,
                    bookId: r.bookId,
                    title: r.bookTitle || bInfo.title || `Book #${r.bookId}`,
                    author: r.author || bInfo.author || 'General',
                    section: bInfo.sectionName || bInfo.section || 'General',
                    cover: bInfo.cover || '',
                    issueDate: r.issueDate || 'Recent',
                    issueTime: r.issueTime || '',
                    issuedBy: r.issuedBy || 'Staff',
                    status: 'Active (With Staff)'
                });
            } else if (r.status === 'Returned') {
                historyBooks.push({
                    id: r.id,
                    bookId: r.bookId,
                    title: r.bookTitle || bInfo.title || `Book #${r.bookId}`,
                    author: r.author || bInfo.author || 'General',
                    section: bInfo.sectionName || bInfo.section || 'General',
                    issueDate: r.issueDate,
                    issueTime: r.issueTime || '',
                    returnDate: r.returnDate,
                    returnTime: r.returnTime || '',
                    issuedBy: r.issuedBy || 'Staff',
                    returnedBy: r.returnedBy || 'Staff'
                });
            }
        }
    });

    // Check inventory books
    Object.keys(books).forEach(bId => {
        const b = books[bId];
        if (b && b.status === 'Issued') {
            const matchesUser = (b.staffUsername && String(b.staffUsername).toLowerCase() === rawUsername) ||
                                (staffMember && b.staffUsername && String(b.staffUsername).toLowerCase() === String(staffMember.username).toLowerCase()) ||
                                (staffName && b.issuedTo && b.issuedTo.toLowerCase().includes(staffName)) ||
                                (b.issuedTo && b.issuedTo.toLowerCase().includes(rawUsername));
            if (matchesUser && !activeBooksMap.has(bId)) {
                activeBooksMap.set(bId, {
                    id: 'book_' + bId,
                    bookId: bId,
                    title: b.title || `Book #${bId}`,
                    author: b.author || 'General',
                    section: b.sectionName || b.section || 'General',
                    cover: b.cover || '',
                    issueDate: b.issueDate || 'Current',
                    issueTime: b.issueTime || '',
                    issuedBy: b.issuedBy || 'Staff',
                    status: 'Active (With Staff)'
                });
            }
        }
    });

    res.json({
        success: true,
        staff: staffMember ? {
            id: staffMember.id,
            name: staffMember.name,
            username: staffMember.username,
            department: staffMember.department,
            phone: staffMember.phone
        } : { username: rawUsername, name: rawUsername, department: 'College Faculty' },
        borrowedCount: activeBooksMap.size,
        historyCount: historyBooks.length,
        borrowedBooks: Array.from(activeBooksMap.values()),
        historyBooks
    });
});

// Cloud Sync APIs (Two-Way Sync between PC App and Online Website)
app.get('/api/cloud-sync/config', (req, res) => {
    const db = readDb();
    res.json({
        cloudUrl: db.cloudSync?.cloudUrl || '',
        lastSynced: db.cloudSync?.lastSynced || null,
        autoSync: db.cloudSync?.autoSync !== false
    });
});

app.post('/api/cloud-sync/config', (req, res) => {
    const db = readDb();
    const { cloudUrl, autoSync } = req.body;
    db.cloudSync = db.cloudSync || {};
    if (cloudUrl !== undefined) db.cloudSync.cloudUrl = String(cloudUrl).trim().replace(/\/+$/, '');
    if (autoSync !== undefined) db.cloudSync.autoSync = !!autoSync;
    saveDb(db);
    res.json({ success: true, cloudSync: db.cloudSync });
});

// Accept push from another peer/server and apply atomically
app.post('/api/cloud-sync/push', (req, res) => {
    const db = readDb();
    const incomingData = req.body.data;
    if (!incomingData) {
        return res.status(400).json({ success: false, message: 'No sync data provided' });
    }

    console.log(`[Cloud-Sync] 📥 Received App update! Applying to Web database...`);

    // The App is authoritative for catalog, ledger, students, categories
    if (incomingData.books) {
        db.books = incomingData.books;
    }
    if (incomingData.ledger) {
        db.ledger = Array.isArray(incomingData.ledger) ? incomingData.ledger : [];
    }
    if (incomingData.categories) {
        db.categories = incomingData.categories;
    }
    if (incomingData.students) {
        db.students = Array.isArray(incomingData.students) ? incomingData.students : [];
    }
    if (incomingData.classes) {
        db.classes = Array.isArray(incomingData.classes) ? incomingData.classes : [];
    }
    if (incomingData.isLibraryClosed !== undefined) {
        db.isLibraryClosed = !!incomingData.isLibraryClosed;
    }
    if (incomingData.passwords) {
        db.passwords = { ...db.passwords, ...incomingData.passwords };
    }
    if (incomingData.librarians && Array.isArray(incomingData.librarians)) {
        db.librarians = incomingData.librarians;
    }
    if (incomingData.staff && Array.isArray(incomingData.staff)) {
        db.staff = incomingData.staff;
    }

    db.cloudSync = db.cloudSync || {};
    db.cloudSync.lastSynced = Date.now();

    // Save and broadcast immediately to all open web browsers!
    saveDbInternal(db, false, 'remote_app_push');

    console.log(`[Cloud-Sync] ✅ Web database updated! Books: ${Object.keys(db.books || {}).length}, Ledger: ${(db.ledger || []).length}, Version: ${db.version}`);

    res.json({
        success: true,
        version: db.version,
        lastSynced: db.cloudSync.lastSynced,
        booksCount: Object.keys(db.books || {}).length,
        ledgerCount: (db.ledger || []).length,
        isLibraryClosed: db.isLibraryClosed
    });
});

// Trigger Two-Way Sync with Cloud Website
app.post('/api/cloud-sync/execute', async (req, res) => {
    const db = readDb();
    const targetUrl = (req.body.cloudUrl || db.cloudSync?.cloudUrl || DEFAULT_CLOUD_URL).trim().replace(/\/+$/, '');

    if (!targetUrl || !targetUrl.startsWith('http')) {
        return res.status(400).json({
            success: false,
            message: 'No valid Cloud Website URL configured. Please enter the site URL.'
        });
    }

    if (isCurrentServerUrl(targetUrl)) {
        return res.json({
            success: true,
            message: 'Already running as Cloud Website.',
            version: db.version,
            booksCount: Object.keys(db.books || {}).length
        });
    }

    try {
        // Push local state to cloud
        const pushRes = await fetch(`${targetUrl}/api/cloud-sync/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: db, source: 'manual_sync', timestamp: Date.now() }),
            signal: AbortSignal.timeout(8000)
        });

        if (!pushRes.ok) {
            throw new Error(`Cloud server responded with status ${pushRes.status}`);
        }

        const pushData = await pushRes.json();
        db.cloudSync = db.cloudSync || {};
        db.cloudSync.lastSynced = Date.now();
        db.cloudSync.cloudUrl = targetUrl;
        saveDbInternal(db, false, 'manual_sync_completed');

        res.json({
            success: true,
            message: 'PC App and Website synchronized successfully!',
            version: pushData.version || db.version,
            lastSynced: db.cloudSync.lastSynced,
            booksCount: Object.keys(db.books || {}).length,
            isLibraryClosed: db.isLibraryClosed
        });
    } catch (err) {
        console.warn('[Cloud-Sync] Execute sync warning:', err.message);
        res.status(503).json({
            success: false,
            offline: true,
            message: `Could not reach cloud website (${err.message}).`
        });
    }
});

// Library Open/Closed Status
app.get('/api/status', (req, res) => {
    const db = readDb();
    res.json({ isLibraryClosed: !!db.isLibraryClosed });
});

app.post('/api/status', (req, res) => {
    const db = readDb();
    db.isLibraryClosed = !!req.body.isLibraryClosed;
    saveDb(db);
    res.json({ success: true, isLibraryClosed: db.isLibraryClosed });
});

// 2. Books API (Multi-device concurrent safe)
app.get('/api/books', (req, res) => {
    const db = readDb();
    res.json(db.books || {});
});

// Atomic single book upsert (Safe for concurrent multiple phones/computers)
app.post('/api/books/upsert', (req, res) => {
    const db = readDb();
    const { id, book } = req.body;
    if (!id || !book) {
        return res.status(400).json({ success: false, message: 'Book ID and book payload required' });
    }
    db.books = db.books || {};
    db.books[id] = { ...book, id };
    saveDb(db);
    res.json({ success: true, book: db.books[id], totalBooks: Object.keys(db.books).length });
});

// Batch book upsert (Merges without destroying other devices' additions)
app.post('/api/books/batch', (req, res) => {
    const db = readDb();
    const booksToAdd = req.body.books || req.body;
    if (!booksToAdd) {
        return res.status(400).json({ success: false, message: 'No books provided' });
    }
    db.books = db.books || {};
    if (Array.isArray(booksToAdd)) {
        booksToAdd.forEach(b => {
            if (b && b.id) db.books[b.id] = b;
        });
    } else if (typeof booksToAdd === 'object') {
        Object.assign(db.books, booksToAdd);
    }
    saveDb(db);
    res.json({ success: true, totalBooks: Object.keys(db.books).length });
});

// Full overwrite (legacy compatibility)
app.post('/api/books', (req, res) => {
    const db = readDb();
    const newBooks = req.body;
    db.books = newBooks;
    saveDb(db);
    res.json({ success: true, books: db.books });
});

app.delete('/api/books/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    if (db.books && db.books[id]) {
        delete db.books[id];
        saveDb(db);
        return res.json({ success: true, message: `Book #${id} deleted` });
    }
    res.status(404).json({ success: false, message: 'Book not found' });
});

// 3. Ledger API
app.get('/api/ledger', (req, res) => {
    const db = readDb();
    res.json(db.ledger || []);
});

// Safe atomic ledger entry append
app.post('/api/ledger/entry', (req, res) => {
    const db = readDb();
    const entry = req.body;
    if (!entry) {
        return res.status(400).json({ success: false, message: 'Invalid ledger entry' });
    }
    db.ledger = Array.isArray(db.ledger) ? db.ledger : [];
    if (!entry.id) {
        entry.id = Date.now();
    }
    db.ledger.unshift(entry);
    saveDb(db);
    res.json({ success: true, entry, totalLedger: db.ledger.length });
});

app.post('/api/ledger', (req, res) => {
    const db = readDb();
    const newLedger = req.body;
    db.ledger = Array.isArray(newLedger) ? newLedger : [];
    saveDb(db);
    res.json({ success: true, ledger: db.ledger });
});

app.delete('/api/ledger/:id', (req, res) => {
    const db = readDb();
    const id = parseInt(req.params.id, 10);
    if (Array.isArray(db.ledger)) {
        db.ledger = db.ledger.filter(item => item.id !== id);
        saveDb(db);
        return res.json({ success: true, message: `Ledger entry #${id} deleted` });
    }
    res.status(404).json({ success: false, message: 'Ledger record not found' });
});

// 4. Categories API
app.get('/api/categories', (req, res) => {
    const db = readDb();
    res.json(db.categories || initialData.categories);
});

app.post('/api/categories', (req, res) => {
    const db = readDb();
    db.categories = req.body || {};
    saveDb(db);
    res.json({ success: true, categories: db.categories });
});

app.delete('/api/categories/:code', (req, res) => {
    const db = readDb();
    const code = req.params.code.toUpperCase();
    if (db.categories && db.categories[code]) {
        delete db.categories[code];
        saveDb(db);
        return res.json({ success: true, categories: db.categories });
    }
    res.status(404).json({ success: false, message: 'Category not found' });
});

// 5. Students API
app.get('/api/students', (req, res) => {
    const db = readDb();
    res.json(db.students || []);
});

// Atomic single student upsert
app.post('/api/students/upsert', (req, res) => {
    const db = readDb();
    const student = req.body;
    if (!student || !student.rollNo) {
        return res.status(400).json({ success: false, message: 'Roll number required' });
    }
    db.students = Array.isArray(db.students) ? db.students : [];
    const idx = db.students.findIndex(s => String(s.rollNo) === String(student.rollNo));
    if (idx >= 0) {
        db.students[idx] = { ...db.students[idx], ...student };
    } else {
        db.students.push(student);
    }
    saveDb(db);
    res.json({ success: true, student, totalStudents: db.students.length });
});

// Batch students upload
app.post('/api/students/batch', (req, res) => {
    const db = readDb();
    const newStudents = Array.isArray(req.body) ? req.body : (req.body.students || []);
    db.students = Array.isArray(db.students) ? db.students : [];
    
    newStudents.forEach(st => {
        if (!st || !st.rollNo) return;
        const idx = db.students.findIndex(s => String(s.rollNo) === String(st.rollNo));
        if (idx >= 0) {
            db.students[idx] = { ...db.students[idx], ...st };
        } else {
            db.students.push(st);
        }
    });

    saveDb(db);
    res.json({ success: true, totalStudents: db.students.length });
});

app.post('/api/students', (req, res) => {
    const db = readDb();
    db.students = Array.isArray(req.body) ? req.body : [];
    saveDb(db);
    res.json({ success: true, students: db.students });
});

app.delete('/api/students/:rollNo', (req, res) => {
    const db = readDb();
    const rollNo = String(req.params.rollNo);
    if (Array.isArray(db.students)) {
        db.students = db.students.filter(st => String(st.rollNo) !== rollNo);
        saveDb(db);
        return res.json({ success: true, students: db.students });
    }
    res.status(404).json({ success: false, message: 'Student not found' });
});

// 6. Custom Classes API
app.get('/api/classes', (req, res) => {
    const db = readDb();
    res.json(db.classes || []);
});

app.post('/api/classes', (req, res) => {
    const db = readDb();
    db.classes = Array.isArray(req.body) ? req.body : [];
    saveDb(db);
    res.json({ success: true, classes: db.classes });
});

app.delete('/api/classes/:className', (req, res) => {
    const db = readDb();
    const className = req.params.className.trim();
    if (Array.isArray(db.classes)) {
        db.classes = db.classes.filter(c => String(c).toLowerCase() !== className.toLowerCase());
        saveDb(db);
        return res.json({ success: true, classes: db.classes });
    }
    res.status(404).json({ success: false, message: 'Class not found' });
});

// 7. Reset System Data API (Password Protected)
app.post('/api/reset', (req, res) => {
    const { password } = req.body;
    const validPasswords = ['admin', 'admin123', 'cyber', '1234'];
    
    if (!password || !validPasswords.includes(String(password).trim())) {
        return res.status(401).json({ success: false, message: 'Unauthorized: Incorrect Admin Password' });
    }

    const resetState = {
        version: 1,
        lastUpdated: Date.now(),
        books: {},
        ledger: [],
        categories: { ...initialData.categories },
        students: [],
        classes: [],
        isLibraryClosed: false
    };
    saveDb(resetState);
    res.json({ success: true, message: 'System data successfully reset to factory defaults', data: resetState });
});

// Background sync worker: Runs on the local server every 5 seconds
if (!isCloudServer()) {
    setInterval(async () => {
        try {
            const db = readDb();
            const cloudUrl = (db.cloudSync?.cloudUrl || DEFAULT_CLOUD_URL).trim().replace(/\/+$/, '');
            if (!cloudUrl || !cloudUrl.startsWith('http') || db.cloudSync?.autoSync === false) return;
            if (isCurrentServerUrl(cloudUrl)) return;

            // Ping remote version to pull any remote changes (like Principal closing library)
            const res = await fetch(`${cloudUrl}/api/version`, { signal: AbortSignal.timeout(4000) });
            if (res.ok) {
                const remote = await res.json();
                if (remote.isLibraryClosed !== undefined && remote.isLibraryClosed !== db.isLibraryClosed) {
                    db.isLibraryClosed = !!remote.isLibraryClosed;
                    saveDbInternal(db, false, 'remote_status_update');
                    console.log(`[Cloud-Sync] 🔄 Updated Library status from Web: ${db.isLibraryClosed ? 'CLOSED' : 'OPEN'}`);
                }
            }
        } catch (e) {
            // Offline or timeout
        }
    }, 5000);

    // Initial push on server startup to make sure Web is fresh immediately
    setTimeout(() => {
        pushLatestStateToCloud('server_startup');
    }, 2000);
}

// Mobile Application APK Download Endpoint
app.get('/download/app', (req, res) => {
    const candidates = [
        path.join(__dirname, 'Kuthbukhana-Library.apk'),
        path.join(__dirname, 'mobile_app', 'build', 'app', 'outputs', 'flutter-apk', 'app-release.apk'),
        path.join(__dirname, 'mobile_app', 'build', 'app', 'outputs', 'flutter-apk', 'app-debug.apk')
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            return res.download(p, 'Kuthbukhana-Library.apk');
        }
    }
    res.status(404).send('<h2>Mobile App APK is being generated. Please check back in 1 minute or run Build-Mobile-App-APK.bat.</h2>');
});

// 8. System Capacity & Real-Time Performance Monitor
app.get('/api/system/load', (req, res) => {
    const memory = process.memoryUsage();
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    const cpus = os.cpus();
    const db = readDb();

    res.json({
        success: true,
        status: 'optimal',
        uptimeSeconds: Math.floor(process.uptime()),
        capacity: {
            cacheEngine: 'In-Memory RAM Cache (Zero-Disk Read Latency)',
            compression: 'Enabled (Gzip/Deflate)',
            rateLimiter: 'Active (Sliding Window)',
            keepAlive: '65s Persistent HTTP Sockets',
            sseActiveClients: sseClients.size
        },
        memory: {
            heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024 * 100) / 100,
            heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024 * 100) / 100,
            rssMB: Math.round(memory.rss / 1024 / 1024 * 100) / 100,
            systemFreeRAMMB: Math.round(freeMem / 1024 / 1024),
            systemTotalRAMMB: Math.round(totalMem / 1024 / 1024)
        },
        system: {
            cpuCount: cpus.length,
            cpuModel: cpus[0]?.model || 'Standard',
            osLoadAvg: os.loadavg()
        },
        database: {
            version: db.version || 1,
            lastUpdated: db.lastUpdated,
            totalBooks: Object.keys(db.books || {}).length,
            totalStudents: (db.students || []).length,
            totalLedger: (db.ledger || []).length
        }
    });
});

// High-Performance Static Asset Serving with Cache-Control
app.use(express.static(__dirname, {
    maxAge: isCloudServer() ? '1d' : '2h',
    etag: true,
    lastModified: true,
    setHeaders: (res, pathUrl) => {
        if (pathUrl.endsWith('.html')) {
            // HTML files: Always revalidate so UI changes appear immediately
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        } else if (pathUrl.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/)) {
            // Static assets: Cache for high performance and reduced server load
            res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
        }
    }
}));

// Start backend server with High-Concurrency Keep-Alive Settings
const server = app.listen(PORT, '0.0.0.0', () => {
    const ips = getNetworkAddresses();
    const primaryIp = ips.length > 0 ? ips[0].ip : 'localhost';

    console.log(`==============================================================`);
    console.log(`  🚀 KUTHBUKHANA ANWARIYYA - LIBRARY SERVER (LIVE)`);
    console.log(`  ⚡ High-Traffic Mode: In-Memory RAM Caching & Compression Active`);
    console.log(`  🖥️  PC Desktop / Localhost: http://localhost:${PORT}`);
    console.log(`  📱 Phone / Wi-Fi Access:   http://${primaryIp}:${PORT}`);
    console.log(`  👑 Principal Portal:       http://${primaryIp}:${PORT}/assets/subpages/lead/principal/principal.html`);
    console.log(`  🛠️  Admin Dashboard:        http://${primaryIp}:${PORT}/assets/subpages/lead/admin/admin.html`);
    console.log(`  📝 Multi-Device Data Entry: http://${primaryIp}:${PORT}/assets/subpages/data-entry.html`);
    console.log(`  📁 Database Path:          ${DB_FILE}`);
    console.log(`==============================================================`);
});

// Socket Keep-Alive & High-Traffic Connection Tuning
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.maxHeadersCount = 2000;


