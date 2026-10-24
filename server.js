const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Path to data file
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial Database Structure
const initialData = {
    books: {},
    ledger: [],
    categories: {},
    students: [],
    classes: [],
    isLibraryClosed: false,
    auth: {
        adminPassword: 'admin',
        principalPassword: 'admin',
        librarians: [
            {
                id: 'lib_default',
                name: 'Chief Librarian',
                username: 'librarian',
                password: '123',
                phone: '9876543210',
                createdAt: new Date().toISOString()
            }
        ]
    }
};

// Read database from file
function readDb() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            saveDb(initialData);
            return { ...initialData };
        }
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const data = JSON.parse(raw);
        let modified = false;

        if (!data.auth) {
            data.auth = { ...initialData.auth };
            modified = true;
        } else {
            if (!data.auth.adminPassword) {
                data.auth.adminPassword = 'admin';
                modified = true;
            }
            if (!data.auth.principalPassword) {
                data.auth.principalPassword = 'admin';
                modified = true;
            }
            if (!Array.isArray(data.auth.librarians) || data.auth.librarians.length === 0) {
                data.auth.librarians = [ ...initialData.auth.librarians ];
                modified = true;
            }
        }

        if (modified) {
            saveDb(data);
        }
        return data;
    } catch (err) {
        console.error('Error reading database file:', err);
        return { ...initialData };
    }
}

// Write database atomically to file
function saveDb(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('Error saving database file:', err);
        return false;
    }
}

// Initialize db file if missing
readDb();

// API Endpoints

// 1. Healthcheck & Full State
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/data', (req, res) => {
    const db = readDb();
    res.json(db);
});

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

// 2. Books API
app.get('/api/books', (req, res) => {
    const db = readDb();
    res.json(db.books || {});
});

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
        books: {},
        ledger: [],
        categories: { ...initialData.categories },
        students: [],
        classes: []
    };
    saveDb(resetState);
    res.json({ success: true, message: 'System data successfully reset to factory defaults', data: resetState });
});

// 8. Authentication & Role Login API
app.post('/api/auth/login', (req, res) => {
    const { role, username, password } = req.body;
    const db = readDb();
    const auth = db.auth || initialData.auth;
    const cleanPass = String(password || '').trim();
    const cleanUser = String(username || '').trim().toLowerCase();
    const cleanRole = String(role || '').trim().toLowerCase();

    // 1. Admin Login
    if (cleanRole === 'admin' || cleanUser === 'admin') {
        const validAdminPasswords = ['admin', 'admin123', 'cyber', '1234', auth.adminPassword].filter(Boolean);
        if (validAdminPasswords.includes(cleanPass)) {
            return res.json({
                success: true,
                user: {
                    role: 'admin',
                    name: 'System Administrator',
                    username: 'admin',
                    permissions: ['all']
                },
                message: 'Admin authentication successful'
            });
        }
        return res.status(401).json({ success: false, message: 'Invalid Admin Password' });
    }

    // 2. Principal Login
    if (cleanRole === 'principal' || cleanUser === 'principal') {
        const validPrincipalPasswords = ['principal', 'principal123', 'admin', auth.principalPassword].filter(Boolean);
        if (validPrincipalPasswords.includes(cleanPass)) {
            return res.json({
                success: true,
                user: {
                    role: 'principal',
                    name: 'Principal / Executive',
                    username: 'principal',
                    permissions: ['principal']
                },
                message: 'Principal authentication successful'
            });
        }
        return res.status(401).json({ success: false, message: 'Invalid Principal Password' });
    }

    // 3. Librarian Login (Check against registered librarians)
    const librarians = Array.isArray(auth.librarians) ? auth.librarians : [];
    const foundLib = librarians.find(l => 
        l.username.toLowerCase() === cleanUser && String(l.password).trim() === cleanPass
    );
    if (foundLib) {
        return res.json({
            success: true,
            user: {
                role: 'librarian',
                id: foundLib.id,
                name: foundLib.name,
                username: foundLib.username,
                phone: foundLib.phone || '',
                permissions: ['openlibrary', 'checkledger']
            },
            message: `Welcome, ${foundLib.name}`
        });
    }

    // Also support default librarian fallback
    if ((cleanUser === 'librarian' || cleanRole === 'librarian') && (cleanPass === '123' || cleanPass === 'librarian123' || cleanPass === 'admin')) {
        return res.json({
            success: true,
            user: {
                role: 'librarian',
                id: 'lib_default',
                name: 'Chief Librarian',
                username: 'librarian',
                permissions: ['openlibrary', 'checkledger']
            },
            message: 'Librarian authentication successful'
        });
    }

    return res.status(401).json({ success: false, message: 'Invalid Librarian username or password' });
});

// 9. Librarian Management APIs (For Admin)
app.get('/api/librarians', (req, res) => {
    const db = readDb();
    const auth = db.auth || initialData.auth;
    const librarians = (auth.librarians || []).map(l => ({
        id: l.id,
        name: l.name,
        username: l.username,
        password: l.password,
        phone: l.phone || '',
        createdAt: l.createdAt
    }));
    res.json(librarians);
});

app.post('/api/librarians', (req, res) => {
    const { name, username, password, phone } = req.body;
    if (!name || !username || !password) {
        return res.status(400).json({ success: false, message: 'Name, username, and password are required' });
    }

    const cleanUser = String(username).trim().toLowerCase();
    if (cleanUser === 'admin' || cleanUser === 'principal') {
        return res.status(400).json({ success: false, message: 'Username cannot be "admin" or "principal"' });
    }

    const db = readDb();
    if (!db.auth) db.auth = { ...initialData.auth };
    if (!Array.isArray(db.auth.librarians)) db.auth.librarians = [];

    const existing = db.auth.librarians.find(l => l.username.toLowerCase() === cleanUser);
    if (existing) {
        return res.status(400).json({ success: false, message: `Username "${cleanUser}" already exists` });
    }

    const newLib = {
        id: 'lib_' + Date.now(),
        name: String(name).trim(),
        username: cleanUser,
        password: String(password).trim(),
        phone: String(phone || '').trim(),
        createdAt: new Date().toISOString()
    };

    db.auth.librarians.push(newLib);
    saveDb(db);
    res.json({ success: true, message: `Librarian "${newLib.name}" added successfully`, librarian: newLib, librarians: db.auth.librarians });
});

app.delete('/api/librarians/:id', (req, res) => {
    const { id } = req.params;
    const db = readDb();
    if (!db.auth || !Array.isArray(db.auth.librarians)) {
        return res.status(404).json({ success: false, message: 'No librarians found' });
    }

    const initialLen = db.auth.librarians.length;
    db.auth.librarians = db.auth.librarians.filter(l => l.id !== id && l.username.toLowerCase() !== id.toLowerCase());
    if (db.auth.librarians.length === initialLen) {
        return res.status(404).json({ success: false, message: 'Librarian not found' });
    }

    saveDb(db);
    res.json({ success: true, message: 'Librarian deleted successfully', librarians: db.auth.librarians });
});

// Serve static frontend files
app.use(express.static(__dirname));

// Start backend server
app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  🚀 Kuthbukhana Anwariyya Library Backend Server`);
    console.log(`  🌐 Server running at: http://localhost:${PORT}`);
    console.log(`  📁 Database persisted at: ${DB_FILE}`);
    console.log(`====================================================`);
});
