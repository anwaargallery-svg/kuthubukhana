// Navigation Functions
function openlibrary() {
    const path = window.location.pathname.replace(/\\/g, '/');
    if (path.includes('lead/admin') || path.includes('lead/principal')) {
        window.location.href = '../../openlibrary.html';
    } else if (path.includes('subpages')) {
        window.location.href = 'openlibrary.html';
    } else {
        window.location.href = 'assets/subpages/openlibrary.html';
    }
}

function checkledger() {
    const path = window.location.pathname.replace(/\\/g, '/');
    if (path.includes('lead/admin') || path.includes('lead/principal')) {
        window.location.href = '../../checkLedger.html';
    } else if (path.includes('subpages')) {
        window.location.href = 'checkLedger.html';
    } else {
        window.location.href = 'assets/subpages/checkLedger.html';
    }
}

function openfineslip() {
    const path = window.location.pathname.replace(/\\/g, '/');
    if (path.includes('lead/admin') || path.includes('lead/principal')) {
        window.location.href = '../../fineSlip.html';
    } else if (path.includes('subpages')) {
        window.location.href = 'fineSlip.html';
    } else {
        window.location.href = 'assets/subpages/fineSlip.html';
    }
}

function gohome() {
    const path = window.location.pathname.replace(/\\/g, '/');
    if (path.includes('lead/admin') || path.includes('lead/principal')) {
        window.location.href = '../../../index.html';
    } else if (path.includes('subpages')) {
        window.location.href = '../../index.html';
    } else {
        window.location.href = 'index.html';
    }
}

function goadmin() {
    const path = window.location.pathname.replace(/\\/g, '/');
    if (path.includes('lead/admin')) {
        window.location.href = 'admin.html';
    } else if (path.includes('lead/principal')) {
        window.location.href = '../admin/admin.html';
    } else if (path.includes('subpages')) {
        window.location.href = 'lead/admin/admin.html';
    } else {
        window.location.href = 'assets/subpages/lead/admin/admin.html';
    }
}

function goprincipal() {
    const path = window.location.pathname.replace(/\\/g, '/');
    if (path.includes('lead/principal')) {
        window.location.href = 'principal.html';
    } else if (path.includes('lead/admin')) {
        window.location.href = '../principal/principal.html';
    } else if (path.includes('subpages')) {
        window.location.href = 'lead/principal/principal.html';
    } else {
        window.location.href = 'assets/subpages/lead/principal/principal.html';
    }
}

function godataentry() {
    const path = window.location.pathname.replace(/\\/g, '/');
    if (path.includes('lead/admin') || path.includes('lead/principal')) {
        window.location.href = '../../data-entry.html';
    } else if (path.includes('subpages')) {
        window.location.href = 'data-entry.html';
    } else {
        window.location.href = 'assets/subpages/data-entry.html';
    }
}

function gologin() {
    const path = window.location.pathname.replace(/\\/g, '/');
    if (path.includes('lead/admin') || path.includes('lead/principal')) {
        window.location.href = '../../login.html';
    } else if (path.includes('subpages')) {
        window.location.href = 'login.html';
    } else {
        window.location.href = 'assets/subpages/login.html';
    }
}

async function openConnectModal() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/network-info`);
        if (res.ok) {
            const data = await res.json();
            const input = document.getElementById('indexNetworkUrlInput');
            if (input) input.value = data.networkUrl;
            const qrImg = document.getElementById('indexQrCodeImg');
            if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data.networkUrl)}`;
        }
    } catch (e) {
        console.warn('Network info error:', e);
    }
    const modalEl = document.getElementById('connectModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

function copyIndexNetworkUrl() {
    const input = document.getElementById('indexNetworkUrlInput');
    if (!input) return;
    input.select();
    navigator.clipboard.writeText(input.value);
    alert('Link copied: ' + input.value);
}

// Default initial inventory database with Section Categories
const initialBooks = {};

const initialLedger = [];

const defaultCategories = {};

const defaultStudents = [];

// Backend REST API Sync Layer
const API_BASE_URL = (window.location.protocol && window.location.protocol.startsWith('http'))
    ? window.location.origin
    : 'http://localhost:5000';

let cachedBackendData = {
    books: null,
    ledger: null,
    categories: null,
    students: null,
    classes: null
};

// Close Library State Management
function isLibraryClosed() {
    const closed = localStorage.getItem('isLibraryClosed');
    return closed === 'true';
}

function setLibraryClosedStatus(closedState, showToast = true) {
    const isClosed = !!closedState;
    localStorage.setItem('isLibraryClosed', isClosed ? 'true' : 'false');

    fetch(`${API_BASE_URL}/api/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLibraryClosed: isClosed })
    }).catch(err => console.warn('Backend library status sync warning:', err));

    if (showToast) {
        const msg = isClosed ? '🔒 Library is now CLOSED. Transactions are paused.' : '🔓 Library is now RE-OPENED & LIVE.';
        const type = isClosed ? 'warning' : 'success';
        const icon = isClosed ? 'bi-lock-fill' : 'bi-unlock-fill';
        if (typeof showAdminToast === 'function') {
            showAdminToast(msg, type, icon);
        } else {
            showPopupAlert('Library Status Update', msg, type, icon);
        }
    }

    renderLibraryClosedStateUI();
}

async function toggleCloseLibrary(e) {
    if (e && e.preventDefault) e.preventDefault();
    const current = isLibraryClosed();
    const actionName = current ? 'RE-OPEN' : 'CLOSE';

    const confirmed = await showPopupConfirm(
        `${actionName} Library`,
        `Are you sure you want to ${actionName} the Library?\n\n${current ? 'Book issue and return transactions will be re-enabled.' : 'Book transactions will be paused while the library is closed.'}`,
        current ? 'info' : 'warning',
        `${actionName} Library`,
        'Cancel'
    );
    if (confirmed) {
        setLibraryClosedStatus(!current, true);
    }
}

function renderLibraryClosedStateUI() {
    const closed = isLibraryClosed();

    const closeBtns = document.querySelectorAll('.btn-close-library-toggle');
    closeBtns.forEach(btn => {
        if (closed) {
            btn.className = 'btn btn-warning btn-sm fw-bold btn-close-library-toggle shadow-sm';
            btn.innerHTML = `<i class="bi bi-unlock-fill me-1"></i> Re-open Library`;
        } else {
            btn.className = 'btn btn-outline-danger btn-sm fw-bold btn-close-library-toggle shadow-sm';
            btn.innerHTML = `<i class="bi bi-lock-fill me-1"></i> Close Library`;
        }
    });

    const statusDots = document.querySelectorAll('.status-dot, .status-dot-openlib, .status-dot-principal');
    statusDots.forEach(dot => {
        if (closed) {
            dot.style.backgroundColor = '#ef4444';
            dot.style.boxShadow = '0 0 8px #ef4444';
        } else {
            dot.style.backgroundColor = '#10b981';
            dot.style.boxShadow = '0 0 8px #10b981';
        }
    });

    const closedBanner = document.getElementById('libraryClosedBanner');
    const issueBtn = document.getElementById('issueBookBtn');
    const staffBtn = document.getElementById('staffBookBtn');

    if (closedBanner) {
        if (closed) {
            closedBanner.style.display = 'block';
            closedBanner.className = 'alert alert-danger shadow-sm mb-4 py-3 px-4 rounded-4 text-center border-danger';
            closedBanner.innerHTML = `
                <div class="d-flex align-items-center justify-content-center gap-2 mb-1 text-danger">
                    <i class="bi bi-lock-fill fs-4"></i>
                    <h5 class="fw-bold mb-0">LIBRARY IS CURRENTLY CLOSED</h5>
                </div>
                <p class="mb-0 small text-dark">Book issuance and return transactions are temporarily paused until re-opened by Admin/Staff.</p>
            `;
        } else {
            closedBanner.style.display = 'none';
        }
    }

    if (issueBtn) issueBtn.disabled = closed;
    if (staffBtn) staffBtn.disabled = closed;
}

// Initial sync with backend REST API on application load
async function syncWithBackendData() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/data`);
        if (response.ok) {
            const data = await response.json();
            if (data.books !== undefined) {
                cachedBackendData.books = data.books;
                localStorage.setItem('libraryBooks', JSON.stringify(data.books));
            }
            if (data.ledger !== undefined) {
                cachedBackendData.ledger = data.ledger;
                localStorage.setItem('libraryLedger', JSON.stringify(data.ledger));
            }
            if (data.categories !== undefined) {
                cachedBackendData.categories = data.categories || {};
                localStorage.setItem('libraryCategories', JSON.stringify(data.categories || {}));
            }
            if (data.students !== undefined) {
                cachedBackendData.students = data.students;
                localStorage.setItem('libraryStudents', JSON.stringify(data.students));
            }
            if (data.classes !== undefined) {
                cachedBackendData.classes = data.classes || [];
                localStorage.setItem('libraryClasses', JSON.stringify(data.classes || []));
            }
            if (data.isLibraryClosed !== undefined) {
                localStorage.setItem('isLibraryClosed', data.isLibraryClosed ? 'true' : 'false');
            }

            renderLibraryClosedStateUI();
            if (typeof renderAdminDashboard === 'function') renderAdminDashboard();
            if (typeof renderPrincipalView === 'function') renderPrincipalView();
            if (typeof loadOpenLibraryBooks === 'function') loadOpenLibraryBooks();
            if (typeof renderLedgerTable === 'function') renderLedgerTable();
        }
    } catch (err) {
        console.warn('Backend server offline or unreachable. Operating in offline mode.', err);
        renderLibraryClosedStateUI();
    }
}

function resetDefaultData(showNotification = true, password = 'admin') {
    localStorage.setItem('libraryBooks', JSON.stringify(initialBooks));
    localStorage.setItem('libraryLedger', JSON.stringify(initialLedger));
    localStorage.setItem('libraryCategories', JSON.stringify(defaultCategories));
    localStorage.setItem('libraryStudents', JSON.stringify(defaultStudents));

    fetch(`${API_BASE_URL}/api/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password || 'admin' })
    }).catch(err => console.warn('Backend reset sync warning:', err));

    if (showNotification) {
        if (typeof showAdminToast === 'function') {
            showAdminToast('All library data has been reset on backend & local state!', 'success', 'bi-arrow-counterclockwise');
        } else {
            showPopupAlert('Reset Successful', 'All library data has been reset on backend & local state!', 'success');
        }
    }

    if (typeof renderAdminDashboard === 'function') {
        renderAdminDashboard();
    }
    if (typeof renderPrincipalView === 'function') {
        renderPrincipalView();
    }
    if (typeof loadOpenLibraryBooks === 'function') {
        loadOpenLibraryBooks();
    }
    if (typeof renderLedgerTable === 'function') {
        renderLedgerTable();
    }
}

const VALID_RESET_PASSWORDS = ['admin', 'admin123', 'cyber', '1234'];

function confirmResetDefaultData() {
    const modalEl = document.getElementById('resetDataModal');
    const pwdInput = document.getElementById('resetPasswordInput');
    const errDiv = document.getElementById('resetPasswordError');
    if (pwdInput) {
        pwdInput.value = '';
        pwdInput.classList.remove('is-invalid');
    }
    if (errDiv) errDiv.classList.add('d-none');

    if (modalEl && typeof bootstrap !== 'undefined') {
        const instance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        instance.show();
    } else {
        const password = prompt('SECURITY REQUIRED: Enter Admin Password to reset all library data:');
        if (password === null) return;
        if (VALID_RESET_PASSWORDS.includes(password.trim())) {
            resetDefaultData(true, password.trim());
        } else {
            showPopupAlert('Authentication Failed', '❌ Incorrect Admin Password! Reset action cancelled.', 'danger');
        }
    }
}

function toggleResetPasswordVisibility() {
    const pwdInput = document.getElementById('resetPasswordInput');
    const icon = document.getElementById('toggleResetPasswordIcon');
    if (!pwdInput || !icon) return;
    if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        icon.className = 'bi bi-eye-slash';
    } else {
        pwdInput.type = 'password';
        icon.className = 'bi bi-eye';
    }
}

function executeResetDefaultData(e) {
    if (e && e.preventDefault) e.preventDefault();
    const pwdInput = document.getElementById('resetPasswordInput');
    const errDiv = document.getElementById('resetPasswordError');

    const entered = pwdInput ? pwdInput.value.trim() : '';

    if (!VALID_RESET_PASSWORDS.includes(entered)) {
        if (errDiv) {
            errDiv.classList.remove('d-none');
            errDiv.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-1"></i> Incorrect Admin Password! Please try again.';
        } else {
            showPopupAlert('Authentication Failed', '❌ Incorrect Admin Password!', 'danger');
        }
        if (pwdInput) {
            pwdInput.classList.add('is-invalid');
            pwdInput.focus();
        }
        return false;
    }

    if (pwdInput) {
        pwdInput.classList.remove('is-invalid');
        pwdInput.value = '';
    }
    if (errDiv) errDiv.classList.add('d-none');

    resetDefaultData(true, entered);

    const modalEl = document.getElementById('resetDataModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const instance = bootstrap.Modal.getInstance(modalEl);
        if (instance) instance.hide();
    }
    return false;
}

// LocalStorage & Backend REST API helpers
function getBooksData() {
    const data = localStorage.getItem('libraryBooks');
    if (!data) {
        saveBooksData(initialBooks);
        return initialBooks;
    }
    return JSON.parse(data);
}

function saveBooksData(books) {
    localStorage.setItem('libraryBooks', JSON.stringify(books));
    cachedBackendData.books = books;
    fetch(`${API_BASE_URL}/api/books/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(books)
    }).catch(err => {
        fetch(`${API_BASE_URL}/api/books`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(books)
        }).catch(e => console.warn('Failed to sync books to backend REST API:', e));
    });
}

function getLedgerData() {
    const data = localStorage.getItem('libraryLedger');
    if (!data) {
        saveLedgerData(initialLedger);
        return initialLedger;
    }
    return JSON.parse(data);
}

function saveLedgerData(ledger) {
    localStorage.setItem('libraryLedger', JSON.stringify(ledger));
    cachedBackendData.ledger = ledger;
    fetch(`${API_BASE_URL}/api/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ledger)
    }).catch(err => console.warn('Failed to sync ledger to backend REST API:', err));
}

function getCategoriesData() {
    const data = localStorage.getItem('libraryCategories');
    if (!data) {
        return {};
    }
    try {
        const parsed = JSON.parse(data);
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch (e) {
        return {};
    }
}

function saveCategoriesData(categories) {
    localStorage.setItem('libraryCategories', JSON.stringify(categories));
    if (typeof cachedBackendData !== 'undefined' && cachedBackendData) {
        cachedBackendData.categories = categories;
    }
    return fetch(`${API_BASE_URL}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categories)
    }).then(res => res.json())
        .catch(err => console.warn('Failed to sync categories to backend REST API:', err));
}

// Custom Classes & Divisions Management Helper Functions
function getClassesData() {
    const data = localStorage.getItem('libraryClasses');
    if (!data) return [];
    try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function saveClassesData(classesList) {
    const cleanList = Array.isArray(classesList) ? classesList.map(c => String(c).trim()).filter(Boolean) : [];
    const uniqueList = Array.from(new Set(cleanList)).sort();

    localStorage.setItem('libraryClasses', JSON.stringify(uniqueList));
    if (typeof cachedBackendData !== 'undefined' && cachedBackendData) {
        cachedBackendData.classes = uniqueList;
    }

    fetch(`${API_BASE_URL}/api/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uniqueList)
    }).catch(err => console.warn('Failed to sync classes to backend REST API:', err));

    populateClassFilterDropdowns();
    if (typeof renderManageClassesModal === 'function') renderManageClassesModal();
    return uniqueList;
}

function addCustomClass(className) {
    const name = className ? String(className).trim() : '';
    if (!name) return false;
    const current = getClassesData();
    if (current.some(c => c.toLowerCase() === name.toLowerCase())) {
        if (typeof showPopupAlert === 'function') {
            showPopupAlert('Class Exists', `Class <strong>"${name}"</strong> is already in your class list!`, 'warning');
        }
        return false;
    }
    current.push(name);
    saveClassesData(current);
    if (typeof showAdminToast === 'function') {
        showAdminToast(`Added custom class "${name}"`, 'success', 'bi-plus-circle');
    }
    return true;
}

function deleteCustomClass(className) {
    const name = className ? String(className).trim() : '';
    if (!name) return false;
    const current = getClassesData();
    const filtered = current.filter(c => c.toLowerCase() !== name.toLowerCase());
    saveClassesData(filtered);
    if (typeof showAdminToast === 'function') {
        showAdminToast(`Removed class "${name}"`, 'info', 'bi-trash');
    }
    return true;
}

// Note: Book cover uploading is managed exclusively through the Admin Dashboard.

// Handle typing number or hardware scan into Book ID / Barcode field
function handleBookInput(val) {
    const trimmed = val ? val.trim() : '';
    const bookTitleInput = document.getElementById('bookTitleInput');
    const bookAuthorInput = document.getElementById('bookAuthorInput');
    const bookCoverImg = document.getElementById('bookCoverImg');
    const bookTitlePreview = document.getElementById('bookTitlePreview');
    const bookAuthorPreview = document.getElementById('bookAuthorPreview');
    const bookCoverCard = document.getElementById('bookCoverCard');
    const bookStatusBadge = document.getElementById('bookStatusBadge');
    const stockAlertDiv = document.getElementById('stockAlertDiv');
    const issueBtn = document.getElementById('issueBookBtn');

    if (!trimmed) {
        if (bookCoverCard) bookCoverCard.style.display = 'none';
        return;
    }

    if (bookCoverCard) bookCoverCard.style.display = 'block';

    const books = getBooksData();
    const book = books[trimmed];

    if (book) {
        // Auto-fill Title & Author
        if (bookTitleInput) bookTitleInput.value = book.title;
        if (bookAuthorInput) bookAuthorInput.value = book.author || 'Unknown Author';

        if (bookCoverImg) bookCoverImg.src = book.cover;
        if (bookTitlePreview) bookTitlePreview.innerText = book.title;
        if (bookAuthorPreview) bookAuthorPreview.innerText = "Author: " + (book.author || 'Unknown') + (book.sectionName ? ` | Section: [${book.section}] ${book.sectionName}` : '');

        // Check Inventory Stock & Admin Hold Status
        if (book.status === 'Admin Hold' || book.issuedTo === 'Admin Hold') {
            if (bookStatusBadge) {
                bookStatusBadge.className = "badge bg-danger fs-6 text-uppercase fw-bold p-2";
                bookStatusBadge.innerHTML = `<i class="bi bi-shield-lock-fill me-1"></i> ⛔ ADMIN HOLD - DO NOT ISSUE`;
            }
            if (stockAlertDiv) {
                stockAlertDiv.style.display = 'block';
                stockAlertDiv.className = 'alert alert-danger border border-3 border-danger p-3 mb-2 shadow text-center bg-danger text-white rounded-3';
                stockAlertDiv.innerHTML = `<h5 class="fw-bold mb-1"><i class="bi bi-exclamation-triangle-fill me-2 fs-4"></i>⛔ LIBRARIAN WARNING: ADMIN HOLD!</h5>
                <p class="mb-0 fw-bold">This book ("${book.title}") is on <strong>ADMIN HOLD</strong>! System Administrator has reserved this book. <u>DO NOT issue this book to any student or user!</u></p>`;
            }
            if (issueBtn) {
                issueBtn.disabled = true;
                issueBtn.classList.replace('btn-primary', 'btn-secondary');
            }
        } else if (book.status === 'Issued') {
            if (bookStatusBadge) {
                bookStatusBadge.className = "badge bg-danger fs-6";
                bookStatusBadge.innerHTML = `<i class="bi bi-x-circle me-1"></i> OUT OF STOCK`;
            }
            if (stockAlertDiv) {
                stockAlertDiv.style.display = 'block';
                stockAlertDiv.className = 'alert alert-danger p-2 small mb-2';
                stockAlertDiv.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1"></i> <strong>Out of Stock!</strong> Issued to ${book.issuedTo || 'another student'} since ${book.issueDate || 'recently'}. Return book first to issue again.`;
            }
            if (issueBtn) {
                issueBtn.disabled = false;
                issueBtn.classList.replace('btn-primary', 'btn-secondary');
            }
        } else {
            if (bookStatusBadge) {
                bookStatusBadge.className = "badge bg-success fs-6";
                bookStatusBadge.innerHTML = `<i class="bi bi-check-circle me-1"></i> Available (In Stock)`;
            }
            if (stockAlertDiv) {
                stockAlertDiv.style.display = 'block';
                stockAlertDiv.className = 'alert alert-success p-2 small mb-2';
                stockAlertDiv.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> <strong>In Stock:</strong> Ready to be issued.`;
            }
            if (issueBtn) {
                issueBtn.disabled = false;
                issueBtn.classList.replace('btn-secondary', 'btn-primary');
            }
        }
    } else {
        // New / Unregistered Book ID
        const coverUrl = `https://covers.openlibrary.org/b/isbn/${trimmed}-M.jpg`;
        const altCoverUrl = `https://covers.openlibrary.org/b/id/${trimmed}-M.jpg`;
        const fallbackImg = "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&auto=format&fit=crop&q=80";

        if (bookCoverImg) {
            bookCoverImg.src = coverUrl;
            bookCoverImg.onerror = function () {
                this.onerror = function () {
                    this.src = fallbackImg;
                };
                this.src = altCoverUrl;
            };
        }

        const titleVal = (bookTitleInput && bookTitleInput.value) ? bookTitleInput.value : `Book #${trimmed}`;
        const authorVal = (bookAuthorInput && bookAuthorInput.value) ? bookAuthorInput.value : `Accession #${trimmed}`;

        if (bookTitlePreview) bookTitlePreview.innerText = titleVal;
        if (bookAuthorPreview) bookAuthorPreview.innerText = "Author: " + authorVal;

        if (bookStatusBadge) {
            bookStatusBadge.className = "badge bg-info text-dark fs-6";
            bookStatusBadge.innerHTML = `<i class="bi bi-box me-1"></i> Available (New Registration)`;
        }
        if (stockAlertDiv) {
            stockAlertDiv.style.display = 'block';
            stockAlertDiv.className = 'alert alert-info p-2 small mb-2';
            stockAlertDiv.innerHTML = `<i class="bi bi-info-circle me-1"></i> New book ID detected. Will be added to inventory stock.`;
        }
        if (issueBtn) {
            issueBtn.disabled = false;
            issueBtn.classList.replace('btn-secondary', 'btn-primary');
        }
    }
}

// Update live preview when editing title or author fields manually
function updatePreviewTitle() {
    const bookTitleInput = document.getElementById('bookTitleInput');
    const bookAuthorInput = document.getElementById('bookAuthorInput');
    const bookTitlePreview = document.getElementById('bookTitlePreview');
    const bookAuthorPreview = document.getElementById('bookAuthorPreview');
    const bookIdInput = document.getElementById('bookIdInput');

    if (bookTitlePreview) {
        bookTitlePreview.innerText = (bookTitleInput && bookTitleInput.value) ? bookTitleInput.value : `Book #${bookIdInput ? bookIdInput.value : ''}`;
    }
    if (bookAuthorPreview) {
        bookAuthorPreview.innerText = "Author: " + ((bookAuthorInput && bookAuthorInput.value) ? bookAuthorInput.value : 'General');
    }
}

// Issue Book Algorithm with Stock & Admin Hold Check
// Extract numeric grade from class string (e.g. "10-A" -> 10, "6B" -> 6, "5" -> 5)
function getClassGradeNum(classDiv) {
    if (!classDiv) return 1;
    const match = String(classDiv).match(/\d+/);
    return match ? parseInt(match[0], 10) : 1;
}

// Count working days between two date strings (excluding Sundays)
function countWorkingDays(startDateStr, endDateStr = new Date().toISOString().split('T')[0]) {
    if (!startDateStr) return 0;
    let start = new Date(startDateStr);
    let end = new Date(endDateStr);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (start >= end) return 0;

    let count = 0;
    let cur = new Date(start);
    cur.setDate(cur.getDate() + 1);

    while (cur <= end) {
        if (cur.getDay() !== 0) { // Exclude Sundays (0)
            count++;
        }
        cur.setDate(cur.getDate() + 1);
    }
    return count;
}

// Add N working days to a start date string (excluding Sundays)
function addWorkingDays(startDateStr, numWorkingDays) {
    let cur = startDateStr ? new Date(startDateStr) : new Date();
    cur.setHours(0, 0, 0, 0);

    let added = 0;
    while (added < numWorkingDays) {
        cur.setDate(cur.getDate() + 1);
        if (cur.getDay() !== 0) { // Exclude Sundays
            added++;
        }
    }
    return cur.toISOString().split('T')[0];
}

// Calculate overdue working days and fine amount (₹5/working day default fine rate)
function calculateOverdueFine(issueDateStr, allowedWorkingDays = 5, fineRate = 5, isStaff = false) {
    if (!issueDateStr || isStaff || allowedWorkingDays > 900000) return { daysElapsed: countWorkingDays(issueDateStr), overdueDays: 0, fineAmount: 0 };
    const workingDaysElapsed = countWorkingDays(issueDateStr);
    const overdueWorkingDays = Math.max(0, workingDaysElapsed - allowedWorkingDays);
    const fineAmount = overdueWorkingDays * fineRate;

    return { daysElapsed: workingDaysElapsed, overdueDays: overdueWorkingDays, fineAmount };
}

// Circulation Action Mode Radio Button Switcher (Issue Student, Staff Use, Return Book)
function switchCircAction(action) {
    const studentSec = document.getElementById('studentFieldsSection');
    const staffSec = document.getElementById('staffFieldsSection');
    const submitBtn = document.getElementById('circSubmitBtn');
    const rollNoInput = document.getElementById('rollNoInput');
    const studentNameInput = document.getElementById('studentNameInput');
    const staffNameInput = document.getElementById('staffNameInputMain');

    if (action === 'issue_student') {
        if (studentSec) studentSec.style.display = 'block';
        if (staffSec) staffSec.style.display = 'none';
        if (rollNoInput) rollNoInput.required = true;
        if (studentNameInput) studentNameInput.required = true;
        if (staffNameInput) staffNameInput.required = false;

        if (submitBtn) {
            submitBtn.className = 'btn btn-issue w-100 py-2.5 fw-bold fs-6';
            submitBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i> Issue Book (Student)';
        }
    } else if (action === 'staff_use') {
        if (studentSec) studentSec.style.display = 'none';
        if (staffSec) staffSec.style.display = 'block';
        if (rollNoInput) rollNoInput.required = false;
        if (studentNameInput) studentNameInput.required = false;
        if (staffNameInput) staffNameInput.required = true;

        if (submitBtn) {
            submitBtn.className = 'btn btn-staff w-100 py-2.5 fw-bold fs-6';
            submitBtn.innerHTML = '<i class="bi bi-person-workspace me-1"></i> Confirm Staff Checkout';
        }
    } else if (action === 'return_book') {
        if (studentSec) studentSec.style.display = 'none';
        if (staffSec) staffSec.style.display = 'none';
        if (rollNoInput) rollNoInput.required = false;
        if (studentNameInput) studentNameInput.required = false;
        if (staffNameInput) staffNameInput.required = false;

        if (submitBtn) {
            submitBtn.className = 'btn btn-return w-100 py-2.5 fw-bold fs-6';
            submitBtn.innerHTML = '<i class="bi bi-box-arrow-in-left me-1"></i> Confirm Book Return';
        }
    }
}

// Master Circulation Form Handler
function handleCirculationFormSubmit(e) {
    if (e) e.preventDefault();
    const action = document.querySelector('input[name="circAction"]:checked')?.value || 'issue_student';

    if (action === 'issue_student') {
        processIssueBook(e);
    } else if (action === 'staff_use') {
        processStaffUseBookMain(e);
    } else if (action === 'return_book') {
        processReturnBook();
    }
}

// Staff Use Checkout from Main Radio Form
async function processStaffUseBookMain(e) {
    if (e) e.preventDefault();
    const bookId = document.getElementById('bookIdInput')?.value?.trim();
    const staffName = document.getElementById('staffNameInputMain')?.value?.trim();
    const staffDept = document.getElementById('staffDeptInputMain')?.value?.trim() || 'Staff Member';

    if (!bookId || !staffName) {
        showPopupAlert('Input Required', 'Please enter both Book ID and Staff Name!', 'warning');
        return false;
    }

    const books = getBooksData();
    const book = books[bookId] || { title: `Book #${bookId}`, author: `Accession #${bookId}`, cover: `https://covers.openlibrary.org/b/id/${bookId}-M.jpg`, status: "Available" };

    if (book.status === 'Admin Hold' || book.issuedTo === 'Admin Hold Reserved' || book.issuedTo === 'Admin Hold') {
        showPopupAlert('⛔ CRITICAL LIBRARIAN WARNING!', `THIS BOOK ("${book.title}") IS ON ADMIN HOLD!\n\nSystem Administration has placed this book on hold. YOU CANNOT ISSUE THIS BOOK FOR STAFF USE.`, 'danger');
        return false;
    }

    if (book.status === 'Issued') {
        showPopupAlert('❌ OUT OF STOCK!', `This book ("${book.title}") is currently issued to ${book.issuedTo || 'another person'}.\n\nIt cannot be checked out again until it is returned!`, 'danger');
        return false;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    book.status = 'Issued';
    book.issuedTo = `Staff: ${staffName} (${staffDept})`;
    book.issueDate = todayStr;
    book.dueDate = 'Unlimited (Staff Use)';
    book.allowedDays = 999999;
    book.isStaff = true;
    books[bookId] = book;
    saveBooksData(books);

    const ledger = getLedgerData();
    ledger.unshift({
        id: Date.now(),
        rollNo: "STAFF",
        studentName: `Staff: ${staffName}`,
        classDiv: staffDept,
        bookId: bookId,
        bookTitle: book.title,
        author: book.author || 'General',
        issueDate: todayStr,
        dueDate: 'Unlimited (Staff Use)',
        allowedDays: 999999,
        returnDate: null,
        status: "Issued (Staff Use)"
    });
    saveLedgerData(ledger);

    showPopupAlert('✅ STAFF CHECKOUT SUCCESSFUL!', `Staff Member: ${staffName}\nDepartment: ${staffDept}\nBook Title: "${book.title}"\nDate: ${todayStr}\n\n✨ Staff Borrowing Policy:\n• Unlimited Books Allowed (No Quantity Limit)\n• Unlimited Duration (No Due Date / No Fines)\n\nInventory Status is now: OUT OF STOCK (Issued to Staff).`, 'success');
    handleBookInput(bookId);
    return true;
}

// Issue Book Algorithm with Class Grade Limits, Usage Duration & Admin Hold Check
async function processIssueBook(e) {
    if (e) e.preventDefault();

    const rollNo = document.getElementById('rollNoInput')?.value?.trim();
    const studentName = document.getElementById('studentNameInput')?.value?.trim();
    const classDiv = document.getElementById('classDivInput')?.value?.trim();
    const bookId = document.getElementById('bookIdInput')?.value?.trim();
    const bookTitle = document.getElementById('bookTitleInput')?.value || `Book #${bookId}`;
    const bookAuthor = document.getElementById('bookAuthorInput')?.value || `Author #${bookId}`;

    if (!bookId || !rollNo || !studentName) {
        showPopupAlert('Input Required', 'Please enter Roll No, Student Name, and Book ID!', 'warning');
        return false;
    }

    const books = getBooksData();
    const book = books[bookId] || { title: bookTitle, author: bookAuthor, cover: `https://covers.openlibrary.org/b/id/${bookId}-M.jpg`, status: "Available" };

    // 1. Check for Admin Hold Block
    if (book.status === 'Admin Hold' || book.issuedTo === 'Admin Hold Reserved' || book.issuedTo === 'Admin Hold') {
        showPopupAlert('⛔ CRITICAL LIBRARIAN WARNING!', `THIS BOOK ("${book.title}") IS ON ADMIN HOLD!\n\nSystem Administration has placed this book on hold. YOU CANNOT ISSUE THIS BOOK TO ANY STUDENT OR USER.`, 'danger');
        return false;
    }

    // 2. Stock Validation Algorithm: Check if Out of Stock
    if (book.status === 'Issued') {
        showPopupAlert('❌ OUT OF STOCK!', `This book ("${book.title}") is currently issued to ${book.issuedTo || 'another student'}.\n\nIt cannot be issued again until it is returned!`, 'danger');
        return false;
    }

    // 3. CLASS GRADE BORROWING LIMIT ENFORCEMENT:
    // - Class 6 & Above: Max 2 books at a time, Usage period: 2 Working Weeks (10 Working Days)
    // - Below Class 6: Max 1 book at a time, Usage period: 1 Working Week (5 Working Days)
    const ledger = getLedgerData();
    const activeIssuedForStudent = ledger.filter(r => String(r.rollNo) === String(rollNo) && r.status === 'Issued');

    const grade = getClassGradeNum(classDiv);
    const maxAllowedBooks = (grade >= 6) ? 2 : 1;
    const allowedWorkingWeeks = (grade >= 6) ? 2 : 1;
    const allowedWorkingDays = (grade >= 6) ? 10 : 5;

    if (activeIssuedForStudent.length >= maxAllowedBooks) {
        const bookListStr = activeIssuedForStudent.map(b => `• "${b.bookTitle}" (ID: ${b.bookId})`).join('\n');
        showPopupAlert('⚠️ BORROWING LIMIT EXCEEDED!', `Rule Enforcement:\n- Class 6 & Above Students: Max 2 books at a time (2 Working Weeks / 10 Working Days)\n- Below Class 6 Students: Max 1 book at a time (1 Working Week / 5 Working Days)\n\nStudent "${studentName}" (Roll #${rollNo}, Class: ${classDiv || 'N/A'}) currently has ${activeIssuedForStudent.length} active issued book(s):\n${bookListStr}\n\n❌ THIS STUDENT CANNOT BORROW MORE BOOKS UNTIL PREVIOUS BOOK(S) ARE RETURNED!`, 'warning');
        return false;
    }

    // Calculate Due Date based on Working Days (Excluding Sundays)
    const todayStr = new Date().toISOString().split('T')[0];
    const dueDateStr = addWorkingDays(todayStr, allowedWorkingDays);

    // Update Stock Status to Issued / Out of Stock
    book.title = bookTitle;
    book.author = bookAuthor;
    book.status = 'Issued';
    book.issuedTo = `${studentName} (Roll #${rollNo})`;
    book.issueDate = todayStr;
    book.dueDate = dueDateStr;
    book.allowedDays = allowedWorkingDays;
    books[bookId] = book;
    saveBooksData(books);

    // Record in Ledger
    ledger.unshift({
        id: Date.now(),
        rollNo: rollNo,
        studentName: studentName,
        classDiv: classDiv,
        bookId: bookId,
        bookTitle: bookTitle,
        author: bookAuthor,
        issueDate: todayStr,
        dueDate: dueDateStr,
        allowedDays: allowedWorkingDays,
        returnDate: null,
        status: "Issued",
        fineAmount: 0,
        finePaid: false
    });
    saveLedgerData(ledger);

    showPopupAlert('✅ BOOK ISSUED SUCCESSFULLY!', `Book: "${bookTitle}"\nIssued To: ${studentName} (Roll #${rollNo}, Class ${classDiv || 'N/A'})\nIssue Date: ${todayStr}\nDue Date: ${dueDateStr} (${allowedWorkingWeeks} Working Week(s) / ${allowedWorkingDays} Working Days allowed)\n\nBorrowing Limit: ${activeIssuedForStudent.length + 1} of ${maxAllowedBooks} book(s) used.`, 'success');

    // Refresh preview card
    handleBookInput(bookId);
    return true;
}

// Open Staff Use Checkout Modal
function openStaffUseModal() {
    const bookIdInput = document.getElementById('bookIdInput');
    const staffBookId = document.getElementById('staffBookId');
    if (bookIdInput && staffBookId) {
        staffBookId.value = bookIdInput.value.trim();
    }
    const modalEl = document.getElementById('staffUseModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

// Process Book Checkout for Staff Use
async function processStaffUseBook(e) {
    if (e) e.preventDefault();
    const bookId = document.getElementById('staffBookId')?.value?.trim();
    const staffName = document.getElementById('staffNameInput')?.value?.trim();
    const staffDept = document.getElementById('staffDeptInput')?.value?.trim() || 'Staff Member';

    if (!bookId || !staffName) {
        showPopupAlert('Input Required', 'Please enter both Book ID and Staff Name!', 'warning');
        return false;
    }

    const books = getBooksData();
    const book = books[bookId] || { title: `Book #${bookId}`, author: `Accession #${bookId}`, cover: `https://covers.openlibrary.org/b/id/${bookId}-M.jpg`, status: "Available" };

    // Check for Admin Hold Block
    if (book.status === 'Admin Hold' || book.issuedTo === 'Admin Hold Reserved' || book.issuedTo === 'Admin Hold') {
        showPopupAlert('⛔ CRITICAL LIBRARIAN WARNING!', `THIS BOOK ("${book.title}") IS ON ADMIN HOLD!\n\nSystem Administration has placed this book on hold. YOU CANNOT ISSUE THIS BOOK FOR STAFF USE.`, 'danger');
        return false;
    }

    // Stock Validation: Check if Out of Stock
    if (book.status === 'Issued') {
        showPopupAlert('❌ OUT OF STOCK!', `This book ("${book.title}") is currently issued to ${book.issuedTo || 'another person'}.\n\nIt cannot be checked out again until it is returned!`, 'danger');
        return false;
    }

    // Update Stock Status to Issued for Staff Use
    const todayStr = new Date().toISOString().split('T')[0];
    book.status = 'Issued';
    book.issuedTo = `Staff: ${staffName} (${staffDept})`;
    book.issueDate = todayStr;
    book.dueDate = 'Unlimited (Staff Use)';
    book.allowedDays = 999999;
    book.isStaff = true;
    books[bookId] = book;
    saveBooksData(books);

    // Record in Ledger
    const ledger = getLedgerData();
    ledger.unshift({
        id: Date.now(),
        rollNo: "STAFF",
        studentName: `Staff: ${staffName}`,
        classDiv: staffDept,
        bookId: bookId,
        bookTitle: book.title,
        author: book.author || 'General',
        issueDate: todayStr,
        dueDate: 'Unlimited (Staff Use)',
        allowedDays: 999999,
        returnDate: null,
        status: "Issued (Staff Use)"
    });
    saveLedgerData(ledger);

    showPopupAlert('✅ STAFF CHECKOUT SUCCESSFUL!', `Staff Member: ${staffName}\nDepartment: ${staffDept}\nBook Title: "${book.title}"\nDate: ${todayStr}\n\n✨ Staff Borrowing Policy:\n• Unlimited Books Allowed (No Quantity Limit)\n• Unlimited Duration (No Due Date / No Fines)\n\nInventory Status is now: OUT OF STOCK (Issued to Staff).`, 'success');

    // Reset Form & Hide Modal
    document.getElementById('staffUseForm')?.reset();
    const modalEl = document.getElementById('staffUseModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const instance = bootstrap.Modal.getInstance(modalEl);
        if (instance) instance.hide();
    }

    // Sync main page book input preview
    const bookIdInput = document.getElementById('bookIdInput');
    if (bookIdInput) {
        bookIdInput.value = bookId;
        handleBookInput(bookId);
    }

    return true;
}

// Return Book Algorithm with Overdue Fine Collection Engine
async function processReturnBook() {
    const bookId = document.getElementById('bookIdInput')?.value?.trim();

    if (!bookId) {
        showPopupAlert('Input Required', 'Please enter or scan the Book ID to return!', 'warning');
        return;
    }

    const books = getBooksData();
    const book = books[bookId];

    if (!book || book.status !== 'Issued') {
        showPopupAlert('Notice', `Book #${bookId} is already IN STOCK (Available).`, 'info');
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const previousBorrower = book.issuedTo || 'Borrower';
    const issueDateStr = book.issueDate;
    const allowedDays = book.allowedDays || (getClassGradeNum(book.classDiv) >= 6 ? 10 : 5);

    // Calculate Overdue Fine based on Working Days
    const fineInfo = calculateOverdueFine(issueDateStr, allowedDays, 5);
    let fineMsg = '';
    let fineCollected = false;

    if (fineInfo.overdueDays > 0) {
        const confirmReturn = await showPopupConfirm(
            '⚠️ OVERDUE FINE NOTICE!',
            `Book: "${book.title}"\nBorrower: ${previousBorrower}\nWorking Days Kept: ${fineInfo.daysElapsed} working day(s) (Allowed: ${allowedDays} working days)\nOverdue Working Days: ${fineInfo.overdueDays} working day(s)\n\n💰 OVERDUE FINE DUE: ₹${fineInfo.fineAmount} (Rate: ₹5/working day overdue, Sundays excluded)\n\nClick "Collect Fine & Return" if fine ₹${fineInfo.fineAmount} has been collected.`,
            'warning',
            'Collect Fine & Return',
            'Cancel'
        );
        if (!confirmReturn) return;
        fineCollected = true;
        fineMsg = `\n💰 Overdue Fine ₹${fineInfo.fineAmount} collected (${fineInfo.overdueDays} working day(s) overdue).`;
    }

    // Update Stock Status to Available
    book.status = 'Available';
    book.issuedTo = null;
    book.issueDate = null;
    book.dueDate = null;
    books[bookId] = book;
    saveBooksData(books);

    // Update Ledger Record
    const ledger = getLedgerData();
    const record = ledger.find(r => r.bookId === bookId && (r.status === 'Issued' || r.status.includes('Issued')));
    if (record) {
        record.status = 'Returned';
        record.returnDate = todayStr;
        record.fineAmount = fineInfo.fineAmount;
        record.finePaid = fineCollected;
        saveLedgerData(ledger);
    }

    await showPopupAlert('✅ BOOK RETURNED SUCCESSFULLY!', `Book: "${book.title}"\nReturned By: ${previousBorrower}\nReturn Date: ${todayStr}${fineMsg}\n\nInventory Status is now: IN STOCK (Available for re-issue).`, 'success');

    // If fine was collected, offer instant fine slip generation
    if (fineInfo.overdueDays > 0) {
        const wantsSlip = await showPopupConfirm(
            '🖨️ PRINT FINE SLIP RECEIPT?',
            `Overdue Fine ₹${fineInfo.fineAmount} collected from ${previousBorrower}.\nBook: "${book.title}" (Code: ${bookId})\n\nWould you like to generate and print the Official Library Fine Slip receipt now?`,
            'info',
            'Print Fine Slip',
            'Later'
        );
        if (wantsSlip) {
            openFineSlipModalWithData({
                receiptNo: 'FS-' + (record?.id ? String(record.id).slice(-6) : Date.now().toString().slice(-6)),
                bookId: bookId,
                bookTitle: book.title,
                author: book.author || record?.author || 'Unknown Author',
                section: book.sectionName || book.section || 'General',
                studentName: record ? record.studentName : previousBorrower,
                rollNo: record ? record.rollNo : 'N/A',
                classDiv: record ? record.classDiv : (book.classDiv || 'N/A'),
                issueDate: issueDateStr,
                dueDate: book.dueDate || record?.dueDate || 'N/A',
                returnDate: todayStr,
                allowedDays: allowedDays,
                overdueDays: fineInfo.overdueDays,
                fineRate: 5,
                overdueFine: fineInfo.fineAmount,
                damageFine: 0,
                damageReason: 'None Reported (Intact)',
                fineAmount: fineInfo.fineAmount,
                finePaid: fineCollected,
                paymentMode: 'Cash Desk',
                receiptDate: todayStr
            });
        }
    }

    // Refresh preview card
    handleBookInput(bookId);
}

// Entry Mode Switcher (Manual vs Barcode)
function switchEntryMode(mode) {
    const manualSec = document.getElementById('manualEntrySection');
    const barcodeSec = document.getElementById('barcodeScanSection');
    const modeBadge = document.getElementById('activeModeBadge');

    if (mode === 'barcode') {
        if (manualSec) manualSec.style.display = 'none';
        if (barcodeSec) barcodeSec.style.display = 'block';
        if (modeBadge) {
            modeBadge.className = 'badge bg-primary fs-6';
            modeBadge.innerHTML = '<i class="bi bi-qr-code-scan me-1"></i> Mode: Barcode Scanner Active';
        }
        startInlineScanner();
    } else {
        if (manualSec) manualSec.style.display = 'block';
        if (barcodeSec) barcodeSec.style.display = 'none';
        if (modeBadge) {
            modeBadge.className = 'badge bg-secondary fs-6';
            modeBadge.innerHTML = '<i class="bi bi-keyboard me-1"></i> Mode: Manual Entry Active';
        }
        stopInlineScanner();
    }
}

let inlineQrCode = null;

function startInlineScanner() {
    const readerDiv = document.getElementById('inlineReader');
    if (!readerDiv) return;

    setTimeout(() => {
        try {
            if (typeof Html5Qrcode !== 'undefined') {
                if (!inlineQrCode) {
                    inlineQrCode = new Html5Qrcode("inlineReader");
                }
                inlineQrCode.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 250, height: 150 } },
                    (decodedText) => {
                        const bookIdInput = document.getElementById('bookIdInput');
                        if (bookIdInput) {
                            bookIdInput.value = decodedText;
                            handleBookInput(decodedText);
                        }
                    },
                    () => { }
                ).catch(err => {
                    const errDiv = document.getElementById('inlineScannerError');
                    if (errDiv) {
                        errDiv.style.display = 'block';
                        errDiv.innerText = "Camera notice: Camera not active or permission denied. Hardware USB Barcode Readers work automatically!";
                    }
                });
            }
        } catch (e) { }
    }, 300);
}

function stopInlineScanner() {
    if (inlineQrCode && inlineQrCode.isScanning) {
        inlineQrCode.stop().catch(e => { });
    }
}

function simulateScan(code) {
    const bookIdInput = document.getElementById('bookIdInput');
    if (bookIdInput) {
        bookIdInput.value = code;
        handleBookInput(code);
    }
}

// Hardware USB / Bluetooth Barcode Device Listener
let barcodeBuffer = '';
let barcodeTimeout = null;

document.addEventListener('keydown', (e) => {
    const activeEl = document.activeElement;
    const isSpecialInput = activeEl && (activeEl.id === 'studentNameInput' || activeEl.id === 'classDivInput' || activeEl.id === 'rollNoInput' || activeEl.tagName === 'TEXTAREA');

    if (isSpecialInput) return;

    if (e.key === 'Enter') {
        if (barcodeBuffer.length >= 2) {
            const scannedCode = barcodeBuffer.trim();
            const bookIdInput = document.getElementById('bookIdInput');
            if (bookIdInput) {
                bookIdInput.value = scannedCode;
                handleBookInput(scannedCode);

                const scannerNotice = document.getElementById('hardwareScannerNotice');
                if (scannerNotice) {
                    scannerNotice.style.display = 'block';
                    scannerNotice.innerHTML = `<i class="bi bi-upc-scan me-1"></i> <strong>USB Barcode Device Detected:</strong> Scanned Code #${scannedCode}`;
                    setTimeout(() => { scannerNotice.style.display = 'none'; }, 4000);
                }
            }
            barcodeBuffer = '';
        }
    } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
        clearTimeout(barcodeTimeout);
        barcodeTimeout = setTimeout(() => {
            barcodeBuffer = '';
        }, 200);
    }
});

// Populate class filter dropdowns dynamically
function populateClassFilterDropdowns() {
    const classFilterSelects = [
        document.getElementById('ledgerClassFilter'),
        document.getElementById('exportClassFilter'),
        document.getElementById('studentClassFilter')
    ];

    const ledger = getLedgerData();
    let students = [];
    try {
        const raw = localStorage.getItem('libraryStudents');
        if (raw) students = JSON.parse(raw);
    } catch (e) { }

    const classSet = new Set();
    const customClasses = getClassesData();
    customClasses.forEach(c => { if (c) classSet.add(c.trim()); });

    ledger.forEach(item => { if (item.classDiv) classSet.add(item.classDiv.trim()); });
    students.forEach(st => { if (st.classDiv) classSet.add(st.classDiv.trim()); });

    const sortedClasses = Array.from(classSet).filter(Boolean).sort();

    classFilterSelects.forEach(selectEl => {
        if (!selectEl) return;
        const currentVal = selectEl.value || 'all';
        const isFilterSelect = selectEl.id !== 'newStudentClassSelect';

        let optionsHtml = isFilterSelect ? `<option value="all">🎓 All Classes & Divisions</option>` : `<option value="">-- Select Class / Division --</option>`;

        sortedClasses.forEach(cls => {
            optionsHtml += `<option value="${cls}">${cls}</option>`;
        });
        selectEl.innerHTML = optionsHtml;
        selectEl.value = currentVal;
    });
}

// Export Ledger Data filtered by class/division to CSV
function exportClassBasedLedger() {
    const ledger = getLedgerData();
    const searchVal = document.getElementById('ledgerSearch')?.value?.toLowerCase() || '';
    const filterVal = document.getElementById('ledgerFilter')?.value || 'all';
    const classVal = document.getElementById('ledgerClassFilter')?.value || 'all';

    const filtered = ledger.filter(item => {
        const matchesSearch = !searchVal ||
            item.studentName.toLowerCase().includes(searchVal) ||
            item.rollNo.toString().includes(searchVal) ||
            item.bookTitle.toLowerCase().includes(searchVal) ||
            item.bookId.toLowerCase().includes(searchVal);

        const isStaffItem = item.rollNo === 'STAFF' || (item.status && item.status.includes('Staff'));
        const allowedDays = item.allowedDays || (getClassGradeNum(item.classDiv) >= 6 ? 14 : 7);
        const fineInfo = calculateOverdueFine(item.issueDate, allowedDays, 5, isStaffItem);
        const isOverdue = item.status.includes('Issued') && fineInfo.overdueDays > 0;

        const matchesFilter = filterVal === 'all' ||
            (filterVal === 'issued' && item.status.includes('Issued')) ||
            (filterVal === 'overdue' && isOverdue) ||
            (filterVal === 'staff' && (item.rollNo === 'STAFF' || item.status.includes('Staff'))) ||
            (filterVal === 'returned' && item.status === 'Returned');

        const matchesClass = classVal === 'all' ||
            (item.classDiv && item.classDiv.toLowerCase() === classVal.toLowerCase());

        return matchesSearch && matchesFilter && matchesClass;
    });

    if (filtered.length === 0) {
        showPopupAlert('Notice', 'No ledger records match the selected class or status filter!', 'warning');
        return;
    }

    const classLabel = classVal === 'all' ? 'All_Classes' : `Class_${classVal.replace(/\s+/g, '_')}`;
    const fileName = `Library_Ledger_${classLabel}_${new Date().toISOString().slice(0, 10)}.csv`;

    const headers = ['ID', 'Roll No', 'Student Name', 'Class / Division', 'Book ID', 'Book Title', 'Issue Date', 'Return Date', 'Status'];
    const rows = filtered.map(r => [
        r.id,
        `"${r.rollNo || ''}"`,
        `"${r.studentName || ''}"`,
        `"${r.classDiv || ''}"`,
        `"${r.bookId || ''}"`,
        `"${(r.bookTitle || '').replace(/"/g, '""')}"`,
        `"${r.issueDate || ''}"`,
        `"${r.returnDate || ''}"`,
        `"${r.status || ''}"`
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Render dynamic ledger table for checkLedger.html
function renderLedgerTable() {
    const tbody = document.getElementById('ledgerTableBody');
    if (!tbody) return;

    populateClassFilterDropdowns();

    const ledger = getLedgerData();
    const searchVal = document.getElementById('ledgerSearch')?.value?.toLowerCase() || '';
    const filterVal = document.getElementById('ledgerFilter')?.value || 'all';
    const classVal = document.getElementById('ledgerClassFilter')?.value || 'all';

    let filtered = ledger.filter(item => {
        const matchesSearch = !searchVal ||
            item.studentName.toLowerCase().includes(searchVal) ||
            item.rollNo.toString().includes(searchVal) ||
            item.bookTitle.toLowerCase().includes(searchVal) ||
            item.bookId.toLowerCase().includes(searchVal);

        const isStaffItem = item.rollNo === 'STAFF' || (item.status && item.status.includes('Staff'));
        const allowedDays = item.allowedDays || (getClassGradeNum(item.classDiv) >= 6 ? 14 : 7);
        const fineInfo = calculateOverdueFine(item.issueDate, allowedDays, 5, isStaffItem);
        const isOverdue = item.status.includes('Issued') && fineInfo.overdueDays > 0;

        const matchesFilter = filterVal === 'all' ||
            (filterVal === 'issued' && item.status.includes('Issued')) ||
            (filterVal === 'overdue' && isOverdue) ||
            (filterVal === 'staff' && (item.rollNo === 'STAFF' || item.status.includes('Staff'))) ||
            (filterVal === 'returned' && item.status === 'Returned');

        const matchesClass = classVal === 'all' ||
            (item.classDiv && item.classDiv.toLowerCase() === classVal.toLowerCase());

        return matchesSearch && matchesFilter && matchesClass;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted"><i class="bi bi-inbox fs-3 d-block mb-2"></i>No ledger records found matching selected class or filter.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((item, index) => {
        const isStaffUse = item.rollNo === 'STAFF' || item.status.includes('Staff');
        const isReturned = item.status === 'Returned';
        const allowedDays = item.allowedDays || (getClassGradeNum(item.classDiv) >= 6 ? 14 : 7);
        const fineInfo = calculateOverdueFine(item.issueDate, allowedDays, 5, isStaffUse);

        let statusBadgeHtml = '';
        if (isReturned) {
            let fineStr = item.fineAmount ? ` (Fine ₹${item.fineAmount} Collected)` : '';
            statusBadgeHtml = `<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i> Returned (${item.returnDate || 'Returned'})${fineStr}</span>`;
        } else if (isStaffUse) {
            statusBadgeHtml = `<span class="badge bg-info text-white shadow-sm"><i class="bi bi-person-workspace me-1"></i> Staff Use (Unlimited Duration - No Fine)</span>`;
        } else if (fineInfo.overdueDays > 0) {
            statusBadgeHtml = `<span class="badge bg-danger shadow-sm"><i class="bi bi-exclamation-octagon-fill me-1"></i> Overdue ${fineInfo.overdueDays}d (Fine: ₹${fineInfo.fineAmount})</span>`;
        } else {
            statusBadgeHtml = `<span class="badge bg-primary"><i class="bi bi-clock me-1"></i> Out of Stock (Issued)</span>`;
        }

        const dueDateDisplay = isStaffUse
            ? `<span class="badge bg-info text-white"><i class="bi bi-infinity me-1"></i>Unlimited Duration</span>`
            : (item.dueDate ? `${item.dueDate} (${allowedDays / 7} wk)` : (allowedDays ? `${allowedDays} Days` : '-'));

        // Fine Slip button with contextual styling
        let slipBtnHtml = '';
        const recordKey = item.id || item.bookId || index;
        if (isReturned && item.fineAmount > 0) {
            slipBtnHtml = `<button class="btn btn-sm btn-outline-success fw-bold shadow-sm py-1 px-2" onclick="openFineSlipByLedgerId('${recordKey}')" title="Print Fine Receipt (Paid)">
                <i class="bi bi-receipt me-1"></i> Slip (₹${item.fineAmount})
            </button>`;
        } else if (fineInfo.overdueDays > 0) {
            slipBtnHtml = `<button class="btn btn-sm btn-danger fw-bold shadow-sm py-1 px-2" onclick="openFineSlipByLedgerId('${recordKey}')" title="Generate Overdue Fine Slip">
                <i class="bi bi-receipt me-1"></i> Slip (₹${fineInfo.fineAmount})
            </button>`;
        } else {
            slipBtnHtml = `<button class="btn btn-sm btn-outline-secondary py-1 px-2" onclick="openFineSlipByLedgerId('${recordKey}')" title="View / Generate Slip">
                <i class="bi bi-receipt me-1"></i> Slip
            </button>`;
        }

        return `
            <tr>
                <td class="text-muted fw-bold">${index + 1}</td>
                <td><span class="badge ${isStaffUse ? 'bg-info text-white' : 'bg-secondary'}">${item.rollNo}</span></td>
                <td><strong>${item.studentName}</strong> <small class="text-muted">(${item.classDiv || 'Staff'})</small></td>
                <td><code>${item.bookId}</code></td>
                <td class="fw-semibold text-dark">${item.bookTitle}</td>
                <td>${item.issueDate}</td>
                <td><small class="fw-bold text-secondary">${dueDateDisplay}</small></td>
                <td>${statusBadgeHtml}</td>
                <td class="text-center">${slipBtnHtml}</td>
            </tr>
        `;
    }).join('');
}

// Auto-initialize ledger table and student lookup on load
document.addEventListener('DOMContentLoaded', () => {
    syncWithBackendData();

    // Auto-sync backend data live every 5 seconds across all open devices
    setInterval(() => {
        syncWithBackendData();
    }, 5000);

    // Sync immediately when user switches back to this browser tab
    window.addEventListener('focus', () => {
        syncWithBackendData();
    });

    populateClassFilterDropdowns();
    if (document.getElementById('ledgerTableBody')) {
        renderLedgerTable();
    }

    const circActionChecked = document.querySelector('input[name="circAction"]:checked')?.value || 'issue_student';
    if (document.querySelector('input[name="circAction"]')) {
        switchCircAction(circActionChecked);
    }

    const rollNoInput = document.getElementById('rollNoInput');
    if (rollNoInput) {
        rollNoInput.addEventListener('input', (e) => {
            const val = e.target.value?.trim();
            if (!val) return;
            const studentsData = localStorage.getItem('libraryStudents');
            if (studentsData) {
                const students = JSON.parse(studentsData);
                const matched = students.find(s => String(s.rollNo) === String(val));
                if (matched) {
                    const nameInput = document.getElementById('studentNameInput');
                    const classInput = document.getElementById('classDivInput');
                    if (nameInput) nameInput.value = matched.name;
                    if (classInput) classInput.value = matched.classDiv || '10-A';
                }
            }
        });
    }
});

// Custom Animated Popup Modal System (Alerts & Confirmations)
function createGlobalPopupModalContainer() {
    let overlay = document.getElementById('globalPopupModalOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'globalPopupModalOverlay';
        overlay.className = 'custom-modal-overlay';
        overlay.innerHTML = `
            <div class="custom-modal-box">
                <div class="custom-modal-header">
                    <div id="popupModalIcon" class="custom-modal-icon-badge info">
                        <i class="bi bi-info-circle-fill"></i>
                    </div>
                    <div class="custom-modal-title-group">
                        <span id="popupModalSubtitle" class="custom-modal-subtitle">System Notification</span>
                        <h4 id="popupModalTitle" class="custom-modal-title">Notification</h4>
                    </div>
                </div>
                <div id="popupModalBody" class="custom-modal-body">
                    Message content
                </div>
                <div class="custom-modal-footer">
                    <button id="popupModalCancelBtn" class="custom-modal-btn custom-modal-btn-cancel" style="display: none;">Cancel</button>
                    <button id="popupModalConfirmBtn" class="custom-modal-btn custom-modal-btn-confirm-info">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    return overlay;
}

function showPopupAlert(title, message, type = 'info', icon = null) {
    return new Promise((resolve) => {
        const overlay = createGlobalPopupModalContainer();
        const iconEl = document.getElementById('popupModalIcon');
        const subtitleEl = document.getElementById('popupModalSubtitle');
        const titleEl = document.getElementById('popupModalTitle');
        const bodyEl = document.getElementById('popupModalBody');
        const cancelBtn = document.getElementById('popupModalCancelBtn');
        const confirmBtn = document.getElementById('popupModalConfirmBtn');

        const iconMap = {
            success: 'bi-check-circle-fill',
            danger: 'bi-exclamation-triangle-fill',
            warning: 'bi-exclamation-octagon-fill',
            info: 'bi-info-circle-fill'
        };

        const chosenIcon = icon || iconMap[type] || 'bi-info-circle-fill';
        const typeClass = ['success', 'danger', 'warning', 'info'].includes(type) ? type : 'info';

        if (iconEl) {
            iconEl.className = `custom-modal-icon-badge ${typeClass}`;
            iconEl.innerHTML = `<i class="bi ${chosenIcon}"></i>`;
        }
        if (subtitleEl) subtitleEl.innerText = `${typeClass.toUpperCase()} NOTICE`;
        if (titleEl) titleEl.innerText = title || 'Notification';
        if (bodyEl) bodyEl.innerText = message || '';

        if (cancelBtn) cancelBtn.style.display = 'none';

        if (confirmBtn) {
            confirmBtn.className = `custom-modal-btn custom-modal-btn-confirm-${typeClass}`;
            confirmBtn.innerHTML = `<i class="bi bi-check-lg"></i> OK`;

            const handleConfirm = () => {
                confirmBtn.removeEventListener('click', handleConfirm);
                overlay.classList.remove('active');
                resolve(true);
            };
            confirmBtn.onclick = handleConfirm;
        }

        overlay.classList.add('active');
    });
}

function showPopupConfirm(title, message, type = 'warning', confirmText = 'Confirm', cancelText = 'Cancel') {
    return new Promise((resolve) => {
        const overlay = createGlobalPopupModalContainer();
        const iconEl = document.getElementById('popupModalIcon');
        const subtitleEl = document.getElementById('popupModalSubtitle');
        const titleEl = document.getElementById('popupModalTitle');
        const bodyEl = document.getElementById('popupModalBody');
        const cancelBtn = document.getElementById('popupModalCancelBtn');
        const confirmBtn = document.getElementById('popupModalConfirmBtn');

        const iconMap = {
            success: 'bi-check-circle-fill',
            danger: 'bi-trash-fill',
            warning: 'bi-exclamation-triangle-fill',
            info: 'bi-question-circle-fill'
        };

        const chosenIcon = iconMap[type] || 'bi-question-circle-fill';
        const typeClass = ['success', 'danger', 'warning', 'info'].includes(type) ? type : 'warning';

        if (iconEl) {
            iconEl.className = `custom-modal-icon-badge ${typeClass}`;
            iconEl.innerHTML = `<i class="bi ${chosenIcon}"></i>`;
        }
        if (subtitleEl) subtitleEl.innerText = `CONFIRMATION REQUIRED`;
        if (titleEl) titleEl.innerText = title || 'Are you sure?';
        if (bodyEl) bodyEl.innerText = message || '';

        if (cancelBtn) {
            cancelBtn.style.display = 'inline-flex';
            cancelBtn.innerText = cancelText;
            cancelBtn.onclick = () => {
                overlay.classList.remove('active');
                resolve(false);
            };
        }

        if (confirmBtn) {
            confirmBtn.className = `custom-modal-btn custom-modal-btn-confirm-${typeClass}`;
            confirmBtn.innerHTML = `<i class="bi bi-check-lg"></i> ${confirmText}`;
            confirmBtn.onclick = () => {
                overlay.classList.remove('active');
                resolve(true);
            };
        }

        overlay.classList.add('active');
    });
}

// ==========================================
// AUTOMATIC BARCODE GENERATOR & PRINT ENGINE
// ==========================================

const CODE128_PATTERNS = [
    '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
    '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
    '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
    '212123', '212321', '212321', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
    '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
    '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
    '314111', '221411', '411131', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
    '112412', '122114', '122411', '142112', '142211', '241211', '221114', '411122', '134111', '111242',
    '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', '214121',
    '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', '114131',
    '311141', '411131', '211412', '211214', '211232', '233111', '2331112'
];

/**
 * Generate pure SVG Code 128 barcode string for any book code ID.
 */
function renderBookBarcode(codeText, options = {}) {
    const height = options.height || 30;
    const widthModule = options.width || 1.2;
    const displayValue = options.displayValue !== false;
    const fontSize = options.fontSize || 9;

    const str = String(codeText || '').trim();
    if (!str) return '<svg width="0" height="0"></svg>';

    let checksum = 104; // Start B Code128
    const symbolIndices = [104];

    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i) - 32;
        const val = (code >= 0 && code <= 95) ? code : 0;
        symbolIndices.push(val);
        checksum += val * (i + 1);
    }

    checksum = checksum % 103;
    symbolIndices.push(checksum);
    symbolIndices.push(106); // Stop symbol

    let modules = '';
    for (const idx of symbolIndices) {
        modules += CODE128_PATTERNS[idx] || CODE128_PATTERNS[0];
    }

    let totalModules = 0;
    for (let i = 0; i < modules.length; i++) {
        totalModules += parseInt(modules[i], 10);
    }

    const quietZone = 6;
    const svgWidth = Math.ceil((totalModules * widthModule) + (quietZone * 2));
    const svgHeight = height + (displayValue ? fontSize + 4 : 0);

    let x = quietZone;
    let rects = '';
    let isBar = true;

    for (let i = 0; i < modules.length; i++) {
        const w = parseInt(modules[i], 10) * widthModule;
        if (isBar) {
            rects += `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${height}" fill="#0f172a" />`;
        }
        x += w;
        isBar = !isBar;
    }

    let textSvg = '';
    if (displayValue) {
        textSvg = `<text x="${(svgWidth / 2).toFixed(2)}" y="${(height + fontSize + 1).toFixed(2)}" font-family="Consolas, monospace" font-size="${fontSize}" font-weight="bold" text-anchor="middle" fill="#0284c7" letter-spacing="1px">${str}</text>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}" class="book-barcode-svg">
        ${rects}
        ${textSvg}
    </svg>`;
}

/**
 * Get dynamic relative path to College Logo image
 */
function getCollegeLogoUrl() {
    const p = window.location.pathname.replace(/\\/g, '/');
    if (p.includes('/lead/admin') || p.includes('/lead/principal')) {
        return '../../../images/image.png';
    } else if (p.includes('/subpages/')) {
        return '../images/image.png';
    } else {
        return 'assets/images/image.png';
    }
}

/**
 * Render standard Anwariyya College Barcode Label Pill (Logo + Arabic Calligraphy + Address + Barcode Stamp)
 */
function renderBookBarcodeLabelCard(b) {
    if (!b) return '';
    const logoSrc = getCollegeLogoUrl();
    const bookId = b.id || b.bookId || '000';
    const bookTitle = b.title || b.bookTitle || 'Library Book';
    const bookSection = b.section || b.sectionName || 'GEN';

    return `
        <div class="barcode-label-pill shadow-sm">
            <!-- Left Column: Logo & Arabic Calligraphy -->
            <div class="barcode-logo-col">
                <img src="${logoSrc}" alt="College Logo" class="barcode-logo-img" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=100&auto=format&fit=crop&q=80'">
                <div class="barcode-arabic-title">الكلية الأنورية العربية</div>
                <div class="barcode-english-sub">ANWARIYYA ARABIC COLLEGE</div>
            </div>

            <!-- Center Column: College Name & Address -->
            <div class="barcode-address-col">
                <div class="barcode-college-header">ANWARIYA ARABIC COLLEGE</div>
                <div class="barcode-address-line">POTTACHIRA</div>
                <div class="barcode-address-line">NELLAYA</div>
                <div class="barcode-address-line">BEEVIPPADI</div>
                <div class="barcode-address-line font-monospace">679335</div>
            </div>

            <!-- Right Column: White Barcode Box -->
            <div class="barcode-stamp-box">
                <div class="barcode-stamp-title" title="${bookTitle.replace(/"/g, '&quot;')}">${bookTitle}</div>
                <div class="barcode-stamp-svg">${renderBookBarcode(bookId, { height: 26, fontSize: 8 })}</div>
                <div class="barcode-stamp-id">ID: ${bookId} | ${bookSection}</div>
            </div>
        </div>
    `;
}

/**
 * Print individual or batch barcode label sheet
 */
function printBarcodeLabels(bookList = []) {
    if (!bookList || bookList.length === 0) {
        if (typeof showPopupAlert === 'function') {
            showPopupAlert('No Books Selected', 'Please select at least one book to print barcode labels!', 'warning');
        } else {
            alert('Please select at least one book to print barcode labels!');
        }
        return;
    }

    let printArea = document.getElementById('printableBarcodeArea');
    if (!printArea) {
        printArea = document.createElement('div');
        printArea.id = 'printableBarcodeArea';
        document.body.appendChild(printArea);
    }

    printArea.innerHTML = bookList.map(b => renderBookBarcodeLabelCard(b)).join('');

    setTimeout(() => {
        window.print();
    }, 200);
}

// ==========================================
// OPEN LIBRARY BOOK SEARCH & LOOKUP ENGINE
// ==========================================

// Open Search Books Modal
function openBookSearchModal() {
    populateModalCategoryDropdown();
    renderModalBookSearchResults();

    const modalEl = document.getElementById('searchBooksModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const instance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        instance.show();
        setTimeout(() => {
            const input = document.getElementById('modalBookSearchInput');
            if (input) input.focus();
        }, 300);
    }
}

// Switch Tab between Local Catalog & Online API
function switchSearchTab(tabName) {
    if (tabName === 'online') {
        const onlineInput = document.getElementById('openLibApiSearchInput');
        if (onlineInput) setTimeout(() => onlineInput.focus(), 200);
    } else {
        const localInput = document.getElementById('modalBookSearchInput');
        if (localInput) setTimeout(() => localInput.focus(), 200);
    }
}

// Populate Category Filter Dropdown in Search Modal
function populateModalCategoryDropdown() {
    const select = document.getElementById('modalCategoryFilter');
    if (!select) return;
    const categories = getCategoriesData();

    let html = '<option value="">All Categories</option>';
    for (const [code, name] of Object.entries(categories)) {
        html += `<option value="${code}">[${code}] ${name}</option>`;
    }
    select.innerHTML = html;
}

// Clear Search Input in Modal
function clearModalBookSearch() {
    const input = document.getElementById('modalBookSearchInput');
    const catSelect = document.getElementById('modalCategoryFilter');
    const statusSelect = document.getElementById('modalStatusFilter');
    if (input) input.value = '';
    if (catSelect) catSelect.value = '';
    if (statusSelect) statusSelect.value = '';
    renderModalBookSearchResults();
}

// Render Local School Library Book Search Results
function renderModalBookSearchResults() {
    const container = document.getElementById('modalSearchResultsContainer');
    const countText = document.getElementById('modalSearchCountText');
    const totalBadge = document.getElementById('modalSearchTotalBadge');
    if (!container) return;

    const query = document.getElementById('modalBookSearchInput')?.value?.toLowerCase().trim() || '';
    const selectedCategory = document.getElementById('modalCategoryFilter')?.value || '';
    const selectedStatus = document.getElementById('modalStatusFilter')?.value || '';

    const booksObj = getBooksData();
    const categoriesObj = getCategoriesData();
    const booksList = Object.entries(booksObj).map(([id, book]) => ({
        id,
        ...book
    }));

    // Filter books
    const filtered = booksList.filter(book => {
        const matchesQuery = !query ||
            book.id.toLowerCase().includes(query) ||
            (book.title && book.title.toLowerCase().includes(query)) ||
            (book.author && book.author.toLowerCase().includes(query)) ||
            (book.section && book.section.toLowerCase().includes(query)) ||
            (book.sectionName && book.sectionName.toLowerCase().includes(query));

        const matchesCat = !selectedCategory || (book.section === selectedCategory);
        const matchesStatus = !selectedStatus || (book.status === selectedStatus);

        return matchesQuery && matchesCat && matchesStatus;
    });

    if (totalBadge) totalBadge.innerText = `${filtered.length} Book${filtered.length !== 1 ? 's' : ''}`;
    if (countText) countText.innerHTML = `<i class="bi bi-check2-circle me-1 text-success"></i> Found ${filtered.length} of ${booksList.length} total registered books`;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="p-4 bg-white rounded-4 shadow-sm border">
                    <i class="bi bi-search fs-1 text-muted d-block mb-2"></i>
                    <h6 class="fw-bold text-dark mb-1">No Books Found</h6>
                    <p class="text-muted small mb-0">No books in inventory match "${query || selectedCategory || selectedStatus}".</p>
                </div>
            </div>
        `;
        return;
    }

    let cardsHtml = '';
    filtered.forEach(book => {
        const coverSrc = book.cover || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&auto=format&fit=crop&q=80';
        const sectionName = book.sectionName || categoriesObj[book.section] || book.section || 'General';

        let statusBadge = '';
        if (book.status === 'Admin Hold' || book.issuedTo === 'Admin Hold') {
            statusBadge = `<span class="badge bg-danger"><i class="bi bi-shield-lock-fill me-1"></i>Admin Hold</span>`;
        } else if (book.status === 'Issued') {
            statusBadge = `<span class="badge bg-warning text-dark"><i class="bi bi-box-arrow-right me-1"></i>Issued to ${book.issuedTo || 'User'}</span>`;
        } else {
            statusBadge = `<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Available</span>`;
        }

        const safeTitle = (book.title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const safeAuthor = (book.author || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

        cardsHtml += `
            <div class="col-md-6">
                <div class="card h-100 border rounded-4 shadow-sm hover-shadow transition-all overflow-hidden search-book-card">
                    <div class="card-body p-3 d-flex gap-3">
                        <img src="${coverSrc}" alt="${book.title}" class="rounded-3 shadow-sm flex-shrink-0" style="width: 70px; height: 95px; object-fit: cover;" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&auto=format&fit=crop&q=80'">
                        <div class="flex-grow-1 overflow-hidden d-flex flex-column justify-content-between">
                            <div>
                                <div class="d-flex align-items-center justify-content-between gap-1 mb-1">
                                    <span class="badge bg-primary-soft text-primary fw-bold border px-2 py-1 small" style="font-size: 0.75rem;">
                                        <i class="bi bi-upc-scan me-1"></i>ID: ${book.id}
                                    </span>
                                    ${statusBadge}
                                </div>
                                <h6 class="fw-bold text-dark text-truncate mb-1" title="${book.title}">${book.title}</h6>
                                <p class="text-secondary small mb-1 text-truncate"><i class="bi bi-person me-1"></i>${book.author || 'Unknown Author'}</p>
                                <small class="text-muted d-block text-truncate" style="font-size: 0.73rem;">
                                    <i class="bi bi-tag me-1"></i>Section: ${sectionName}
                                </small>
                            </div>
                            <div class="mt-2 pt-1 border-top">
                                <button type="button" class="btn btn-sm btn-outline-primary w-100 fw-bold rounded-3 py-1" onclick="selectBookFromSearch('${book.id}', '${safeTitle}', '${safeAuthor}')">
                                    <i class="bi bi-check-circle me-1"></i> Select & Fill Workstation
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = cardsHtml;
}

// Search Open Library Online API (openlibrary.org)
async function searchOpenLibraryAPI() {
    const input = document.getElementById('openLibApiSearchInput');
    const container = document.getElementById('openLibApiResultsContainer');
    const statusText = document.getElementById('openLibApiStatusText');
    if (!input || !container) return;

    const query = input.value.trim();
    if (!query) {
        if (statusText) statusText.innerHTML = `<span class="text-danger"><i class="bi bi-exclamation-circle me-1"></i> Please enter a title, author, or ISBN to search!</span>`;
        return;
    }

    if (statusText) {
        statusText.innerHTML = `<span class="text-primary"><i class="spinner-border spinner-border-sm me-1"></i> Searching Open Library API for "${query}"...</span>`;
    }

    container.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="spinner-border text-primary mb-2" role="status"></div>
            <p class="text-muted mb-0 fw-semibold">Fetching books from openlibrary.org...</p>
        </div>
    `;

    try {
        const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=12`);
        if (!response.ok) throw new Error('API Response Error');
        const data = await response.json();

        if (!data.docs || data.docs.length === 0) {
            if (statusText) statusText.innerHTML = `<span class="text-warning"><i class="bi bi-info-circle me-1"></i> No matching online books found for "${query}".</span>`;
            container.innerHTML = `
                <div class="col-12 text-center py-4">
                    <div class="alert alert-warning border mb-0">No results found on Open Library API for "${query}". Try another search term.</div>
                </div>
            `;
            return;
        }

        if (statusText) {
            statusText.innerHTML = `<span class="text-success"><i class="bi bi-check-circle-fill me-1"></i> Found ${data.docs.length} books on Open Library API</span>`;
        }

        let html = '';
        data.docs.forEach(doc => {
            const title = doc.title || 'Untitled Book';
            const author = (doc.author_name && doc.author_name.length > 0) ? doc.author_name[0] : 'Unknown Author';
            const firstPublish = doc.first_publish_year ? `First published: ${doc.first_publish_year}` : '';
            const isbn = (doc.isbn && doc.isbn.length > 0) ? doc.isbn[0] : '';
            const coverId = doc.cover_i;
            const coverUrl = coverId
                ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
                : (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg` : 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&auto=format&fit=crop&q=80');

            const bookCode = isbn || (doc.key ? doc.key.replace('/works/', '') : '') || `OL-${Math.floor(Math.random() * 10000)}`;
            const safeTitle = title.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const safeAuthor = author.replace(/'/g, "\\'").replace(/"/g, '&quot;');

            html += `
                <div class="col-md-6">
                    <div class="card h-100 border rounded-4 shadow-sm hover-shadow transition-all overflow-hidden search-book-card">
                        <div class="card-body p-3 d-flex gap-3">
                            <img src="${coverUrl}" alt="${title}" class="rounded-3 shadow-sm flex-shrink-0" style="width: 70px; height: 95px; object-fit: cover;" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&auto=format&fit=crop&q=80'">
                            <div class="flex-grow-1 overflow-hidden d-flex flex-column justify-content-between">
                                <div>
                                    <div class="d-flex align-items-center justify-content-between gap-1 mb-1">
                                        <span class="badge bg-info text-dark fw-bold border px-2 py-1 small" style="font-size: 0.75rem;">
                                            <i class="bi bi-globe me-1"></i>OpenLib: ${bookCode}
                                        </span>
                                    </div>
                                    <h6 class="fw-bold text-dark text-truncate mb-1" title="${title}">${title}</h6>
                                    <p class="text-secondary small mb-1 text-truncate"><i class="bi bi-person me-1"></i>${author}</p>
                                    <small class="text-muted d-block text-truncate" style="font-size: 0.73rem;">
                                        ${firstPublish}
                                    </small>
                                </div>
                                <div class="mt-2 pt-1 border-top">
                                    <button type="button" class="btn btn-sm btn-outline-info w-100 fw-bold rounded-3 py-1 text-dark" onclick="selectBookFromSearch('${bookCode}', '${safeTitle}', '${safeAuthor}')">
                                        <i class="bi bi-download me-1"></i> Use Book in Workstation
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (err) {
        console.error('Open Library API Search Error:', err);
        if (statusText) statusText.innerHTML = `<span class="text-danger"><i class="bi bi-exclamation-triangle-fill me-1"></i> Failed to connect to Open Library API. Check network connection.</span>`;
        container.innerHTML = `
            <div class="col-12 text-center py-4">
                <div class="alert alert-danger border mb-0">Error fetching data from Open Library API.</div>
            </div>
        `;
    }
}

// Select Book from Search Modal and populate circulation form
function selectBookFromSearch(bookId, title, author) {
    const bookIdInput = document.getElementById('bookIdInput');
    const bookTitleInput = document.getElementById('bookTitleInput');
    const bookAuthorInput = document.getElementById('bookAuthorInput');

    if (bookIdInput) {
        bookIdInput.value = bookId;
    }
    if (bookTitleInput && title) {
        bookTitleInput.value = title;
    }
    if (bookAuthorInput && author) {
        bookAuthorInput.value = author;
    }

    // Trigger handleBookInput to update book preview, stock badge, and warnings
    handleBookInput(bookId);

    // Close Modal
    const modalEl = document.getElementById('searchBooksModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const instance = bootstrap.Modal.getInstance(modalEl);
        if (instance) instance.hide();
    }

    // Scroll to workstation form smoothly
    const checkoutCard = document.querySelector('.checkout-card');
    if (checkoutCard) {
        checkoutCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Show popup notification or toast
    if (typeof showPopupAlert === 'function') {
        showPopupAlert('Book Selected', `Book <strong>"${title || bookId}"</strong> (#${bookId}) loaded into workstation.`, 'success');
    }
}

// ==========================================
// CUSTOM DATA EXPORT ENGINE
// ==========================================

function openCustomExportModal() {
    populateCustomExportFilters();
    const modalEl = document.getElementById('customDataExportModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const instance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        instance.show();
    }
}

function toggleAllExportFields(selectAll) {
    const checkboxes = document.querySelectorAll('.custom-export-field');
    checkboxes.forEach(cb => {
        cb.checked = selectAll;
    });
}

function populateCustomExportFilters() {
    const classSelect = document.getElementById('customExportClassFilter');
    const catSelect = document.getElementById('customExportCategoryFilter');

    if (classSelect) {
        const classSet = new Set();
        const customClasses = getClassesData();
        customClasses.forEach(c => { if (c) classSet.add(c.trim()); });

        const ledger = getLedgerData();
        ledger.forEach(item => { if (item.classDiv) classSet.add(item.classDiv.trim()); });

        let html = '<option value="all">🎓 All Classes & Divisions</option>';
        Array.from(classSet).filter(Boolean).sort().forEach(c => {
            html += `<option value="${c}">${c}</option>`;
        });
        classSelect.innerHTML = html;
    }

    if (catSelect) {
        const categories = getCategoriesData();
        let html = '<option value="all">All Category Sections</option>';
        for (const [code, name] of Object.entries(categories)) {
            html += `<option value="${code}">[${code}] ${name}</option>`;
        }
        catSelect.innerHTML = html;
    }
}

function generateCustomExportData() {
    const scope = document.getElementById('customExportScope')?.value || 'all_books';
    const format = document.getElementById('customExportFormat')?.value || 'csv';
    const classFilter = document.getElementById('customExportClassFilter')?.value || 'all';
    const catFilter = document.getElementById('customExportCategoryFilter')?.value || 'all';

    // Get selected field checkboxes
    const includeTitle = document.getElementById('chkBookName')?.checked ?? true;
    const includeAuthor = document.getElementById('chkAuthorName')?.checked ?? true;
    const includeBarcode = document.getElementById('chkBarcode')?.checked ?? true;
    const includeInStock = document.getElementById('chkInStock')?.checked ?? true;
    const includeOutOfStock = document.getElementById('chkOutOfStock')?.checked ?? true;
    const includeFine = document.getElementById('chkFineDetails')?.checked ?? true;
    const includeSection = document.getElementById('chkSection')?.checked ?? true;
    const includeBorrower = document.getElementById('chkBorrower')?.checked ?? true;
    const includeDates = document.getElementById('chkIssueDate')?.checked ?? true;

    const booksObj = getBooksData();
    const ledgerList = getLedgerData();
    const categoriesObj = getCategoriesData();

    let exportRows = [];

    if (scope === 'full_ledger') {
        exportRows = ledgerList.filter(item => {
            const matchClass = classFilter === 'all' || (item.classDiv && item.classDiv.toLowerCase() === classFilter.toLowerCase());
            return matchClass;
        }).map(item => {
            const bookInfo = booksObj[item.bookId] || {};
            const isStaffItem = item.rollNo === 'STAFF' || (item.status && item.status.includes('Staff'));
            const allowedDays = item.allowedDays || (getClassGradeNum(item.classDiv) >= 6 ? 10 : 5);
            const fineInfo = calculateOverdueFine(item.issueDate, allowedDays, 5, isStaffItem);
            const isIssued = item.status.includes('Issued');

            return {
                barcode: item.bookId || '',
                title: item.bookTitle || bookInfo.title || 'Untitled',
                author: bookInfo.author || 'Unknown',
                section: bookInfo.sectionName || categoriesObj[bookInfo.section] || bookInfo.section || 'General',
                instockStatus: isIssued ? 'NO (Out of Stock)' : 'YES (In Stock)',
                outofstockDetails: isIssued ? `Issued to ${item.studentName} (${item.classDiv || 'Class'})` : 'In Library Stock',
                fineAmount: fineInfo.fineAmount > 0 ? `₹${fineInfo.fineAmount}` : '₹0',
                fineDaysOverdue: fineInfo.overdueDays > 0 ? `${fineInfo.overdueDays} days overdue` : 'No fine',
                fineStatus: fineInfo.fineAmount > 0 ? `FINE DUE: ₹${fineInfo.fineAmount}` : 'Clear',
                borrowerName: `${item.studentName} (${item.rollNo})`,
                classDiv: item.classDiv || '-',
                issueDate: item.issueDate || '-',
                returnDate: item.returnDate || item.status,
                status: item.status
            };
        });
    } else {
        const booksList = Object.entries(booksObj).map(([id, b]) => ({ id, ...b }));

        exportRows = booksList.filter(b => {
            const matchCat = catFilter === 'all' || b.section === catFilter;
            let matchScope = true;
            if (scope === 'instock') matchScope = (b.status === 'Available');
            else if (scope === 'out_of_stock') matchScope = (b.status === 'Issued' || b.issuedTo);
            else if (scope === 'overdue_fines') {
                const isStaff = b.issuedTo && (b.issuedTo.includes('Staff') || b.isStaff);
                const fineInfo = calculateOverdueFine(b.issueDate, 5, 5, isStaff);
                matchScope = (b.status === 'Issued' && fineInfo.overdueDays > 0);
            }
            return matchCat && matchScope;
        }).map(b => {
            const isIssued = (b.status === 'Issued' || (b.issuedTo && b.issuedTo !== 'Admin Hold'));
            const isStaff = b.issuedTo && (b.issuedTo.includes('Staff') || b.isStaff);
            const fineInfo = calculateOverdueFine(b.issueDate, 5, 5, isStaff);

            return {
                barcode: b.id,
                title: b.title || 'Untitled',
                author: b.author || 'Unknown Author',
                section: b.sectionName || categoriesObj[b.section] || b.section || 'General',
                instockStatus: (b.status === 'Available') ? 'In Stock (Available)' : (b.status === 'Admin Hold' ? 'Admin Hold' : 'Out of Stock'),
                outofstockDetails: isIssued ? `Out of Stock - Issued to ${b.issuedTo || 'User'} on ${b.issueDate || 'Recent'}` : (b.status === 'Admin Hold' ? 'Admin Hold (Reserved)' : 'Available in Stock'),
                fineAmount: isIssued ? `₹${fineInfo.fineAmount}` : '₹0',
                fineDaysOverdue: isIssued ? `${fineInfo.overdueDays} overdue days` : '0 days',
                fineStatus: isIssued && fineInfo.overdueDays > 0 ? `⚠️ OVERDUE FINE: ₹${fineInfo.fineAmount}` : 'No Fine',
                borrowerName: b.issuedTo || 'N/A',
                classDiv: 'N/A',
                issueDate: b.issueDate || 'N/A',
                returnDate: b.status,
                status: b.status
            };
        });
    }

    if (exportRows.length === 0) {
        if (typeof showPopupAlert === 'function') {
            showPopupAlert('No Data Matches', 'No records match the selected scope and filter criteria for export!', 'warning');
        } else {
            alert('No records match the selected scope and filter criteria!');
        }
        return;
    }

    // Build columns to export
    const columns = [];
    if (includeBarcode) columns.push({ key: 'barcode', label: 'Barcode / Book ID' });
    if (includeTitle) columns.push({ key: 'title', label: 'Book Name (Title)' });
    if (includeAuthor) columns.push({ key: 'author', label: 'Author Name' });
    if (includeSection) columns.push({ key: 'section', label: 'Section / Category' });
    if (includeInStock) columns.push({ key: 'instockStatus', label: 'In Stock Availability' });
    if (includeOutOfStock) columns.push({ key: 'outofstockDetails', label: 'Out of Stock Details' });
    if (includeFine) columns.push({ key: 'fineStatus', label: 'Fine Details (Overdue ₹)' });
    if (includeBorrower) columns.push({ key: 'borrowerName', label: 'Borrower Name / Roll No' });
    if (includeDates) columns.push({ key: 'issueDate', label: 'Issue Date' });

    if (columns.length === 0) {
        if (typeof showPopupAlert === 'function') {
            showPopupAlert('No Fields Selected', 'Please check at least one field checkbox to export!', 'warning');
        } else {
            alert('Please check at least one field checkbox to export!');
        }
        return;
    }

    // Process Export by Format
    if (format === 'pdf') {
        const printWin = window.open('', '_blank');
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        const thHtml = columns.map(c => `<th>${c.label}</th>`).join('');
        const trHtml = exportRows.map((row, idx) => {
            const tds = columns.map(c => {
                let val = row[c.key] || '-';
                if (c.key === 'barcode') {
                    const barcodeSvg = (typeof renderBookBarcode === 'function') ? renderBookBarcode(row.barcode, { height: 24, fontSize: 8 }) : `<strong>${val}</strong>`;
                    return `<td style="text-align: center;">${barcodeSvg}</td>`;
                }
                if (c.key === 'fineStatus' && val.includes('OVERDUE')) {
                    return `<td style="color: #dc2626; font-weight: bold;">${val}</td>`;
                }
                if (c.key === 'instockStatus' && val.includes('In Stock')) {
                    return `<td style="color: #16a34a; font-weight: bold;">${val}</td>`;
                }
                return `<td>${val}</td>`;
            }).join('');

            return `<tr><td>${idx + 1}</td>${tds}</tr>`;
        }).join('');

        printWin.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Library Custom Export Report - ${dateStr}</title>
                <style>
                    body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; padding: 25px; color: #0f172a; }
                    .header { text-align: center; border-bottom: 3px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
                    .header h2 { margin: 0; color: #0284c7; font-size: 22px; font-weight: 800; }
                    .header p { margin: 4px 0 0 0; color: #475569; font-size: 14px; font-weight: 600; }
                    .meta { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 13px; color: #475569; background: #f8fafc; padding: 10px 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
                    th { background-color: #0f172a; color: white; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
                    tr:nth-child(even) { background-color: #f8fafc; }
                    .btn-print { background: #059669; color: white; border: none; padding: 10px 20px; font-size: 14px; font-weight: bold; border-radius: 8px; cursor: pointer; margin-bottom: 20px; box-shadow: 0 4px 10px rgba(5, 150, 105, 0.2); }
                    @media print { .btn-print { display: none; } }
                </style>
            </head>
            <body>
                <button class="btn-print" onclick="window.print()">🖨️ Save as PDF / Print Document</button>
                <div class="header">
                    <h2>Kuthbukhana Anwariyya Library Management System</h2>
                    <p>Custom Export Data Report (Book Names, Authors, Stock, Fines & Barcodes)</p>
                </div>
                <div class="meta">
                    <span><strong>Report Generated:</strong> ${dateStr}</span>
                    <span><strong>Total Exported Records:</strong> ${exportRows.length}</span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            ${thHtml}
                        </tr>
                    </thead>
                    <tbody>
                        ${trHtml}
                    </tbody>
                </table>
            </body>
            </html>
        `);
        printWin.document.close();
        setTimeout(() => { printWin.print(); }, 500);

    } else if (format === 'json') {
        const jsonContent = JSON.stringify(exportRows.map(row => {
            const filteredObj = {};
            columns.forEach(c => filteredObj[c.label] = row[c.key]);
            return filteredObj;
        }), null, 2);

        downloadExportFile(jsonContent, `library_custom_export_${Date.now()}.json`, 'application/json');

    } else {
        // CSV Format
        const headerCsv = columns.map(c => `"${c.label}"`).join(',');
        const rowsCsv = exportRows.map(row => {
            return columns.map(c => {
                let val = row[c.key] === null || row[c.key] === undefined ? '' : String(row[c.key]);
                val = val.replace(/"/g, '""');
                return `"${val}"`;
            }).join(',');
        }).join('\n');

        const csvContent = headerCsv + '\n' + rowsCsv;
        downloadExportFile(csvContent, `library_custom_export_${Date.now()}.csv`, 'text/csv;charset=utf-8;');
    }

    // Close Modal
    const modalEl = document.getElementById('customDataExportModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const instance = bootstrap.Modal.getInstance(modalEl);
        if (instance) instance.hide();
    }

    if (typeof showPopupAlert === 'function') {
        showPopupAlert('Export Complete', `Successfully exported ${exportRows.length} record(s) with selected fields!`, 'success');
    }
}

function downloadExportFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================
// OFFICIAL LIBRARY FINE SLIP & RECEIPT ENGINE
// ==========================================

// Global state holding current fine slip data
let currentActiveFineSlipData = null;

// Convert numerical amount to English currency words
function numberToWordsRupees(amount) {
    amount = Math.round(Number(amount) || 0);
    if (amount <= 0) return 'Zero Rupees (No Fine Due)';

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function convertLessThanThousand(n) {
        if (n === 0) return '';
        if (n < 20) return ones[n] + ' ';
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '') + ' ';
        return ones[Math.floor(n / 100)] + ' Hundred ' + (n % 100 !== 0 ? convertLessThanThousand(n % 100) : '');
    }

    let words = '';
    if (amount >= 10000000) {
        words += convertLessThanThousand(Math.floor(amount / 10000000)) + 'Crore ';
        amount %= 10000000;
    }
    if (amount >= 100000) {
        words += convertLessThanThousand(Math.floor(amount / 100000)) + 'Lakh ';
        amount %= 100000;
    }
    if (amount >= 1000) {
        words += convertLessThanThousand(Math.floor(amount / 1000)) + 'Thousand ';
        amount %= 1000;
    }
    if (amount > 0) {
        words += convertLessThanThousand(amount);
    }

    return words.trim() + ' Rupees Only';
}

let currentFineSlipLayoutMode = 'atm-card'; // Default to ATM card size as requested

// Switch between ATM Card (85.6x54mm), Pocket Slip (85.6mm width), and Full Standard Slip
function setFineSlipLayout(mode) {
    currentFineSlipLayoutMode = mode;
    try { sessionStorage.setItem('preferredSlipLayout', mode); } catch (e) { }

    // Sync button states across all switchers (modal & standalone page)
    ['atm-card', 'atm-pocket', 'standard'].forEach(m => {
        document.querySelectorAll(`.btn-slip-layout-${m}`).forEach(btn => {
            if (m === mode) {
                btn.classList.add('active', 'btn-primary');
                btn.classList.remove('btn-outline-secondary', 'btn-outline-light');
            } else {
                btn.classList.remove('active', 'btn-primary');
                btn.classList.add(btn.closest('.modal-header') ? 'btn-outline-light' : 'btn-outline-secondary');
            }
        });
    });

    const previewContainer = document.getElementById('fineSlipPreviewContainer');
    if (previewContainer && currentActiveFineSlipData) {
        previewContainer.innerHTML = generateFineSlipCardHTML(currentActiveFineSlipData, currentFineSlipLayoutMode);
    }
}

// Generate the printable / viewable fine slip card HTML
function generateFineSlipCardHTML(data, layoutMode = null) {
    const mode = layoutMode || currentFineSlipLayoutMode || 'atm-card';
    const receiptNo = data.receiptNo || ('FS-' + (Date.now().toString().slice(-6)));
    const now = new Date();
    const formattedDate = data.receiptDate || now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    const studentName = data.studentName || 'Student / Borrower';
    const rollNo = data.rollNo || 'N/A';
    const classDiv = data.classDiv || 'N/A';
    const isStaff = String(rollNo).toUpperCase() === 'STAFF' || (data.status && data.status.includes('Staff'));
    const borrowerCategory = isStaff ? 'Faculty / Staff Member' : `Regular Student (Class ${classDiv})`;

    const bookId = data.bookId || 'BOOK-CODE';
    const bookTitle = data.bookTitle || 'Unknown Title';
    const author = data.author || 'Unknown Author';
    const section = data.section || data.sectionName || 'GENERAL';

    const issueDate = data.issueDate || 'N/A';
    const dueDate = data.dueDate || 'N/A';
    const returnDate = data.returnDate || formattedDate;
    const allowedDays = data.allowedDays || (getClassGradeNum(classDiv) >= 6 ? 10 : 5);
    const overdueDays = Math.max(0, parseInt(data.overdueDays, 10) || 0);
    const fineRate = parseFloat(data.fineRate) || 5;
    const overdueFine = overdueDays * fineRate;

    const damageFine = Math.max(0, parseFloat(data.damageFine) || 0);
    const damageReason = data.damageReason || (damageFine > 0 ? 'Physical Damage / Penalty' : 'None Reported (Intact)');

    const calculatedTotal = overdueFine + damageFine;
    const fineAmount = (data.fineAmount !== undefined && !isNaN(parseFloat(data.fineAmount)))
        ? parseFloat(data.fineAmount)
        : calculatedTotal;
    const isPaid = !!data.finePaid;
    const paymentMode = data.paymentMode || 'Cash Desk';

    const words = numberToWordsRupees(fineAmount);
    const barcodeSvg = typeof renderBookBarcode === 'function'
        ? renderBookBarcode(bookId, { height: 26, fontSize: 8 })
        : `<div class="fw-bold text-center text-primary font-monospace">${bookId}</div>`;

    const miniBarcodeSvg = typeof renderBookBarcode === 'function'
        ? renderBookBarcode(bookId, { height: 16, fontSize: 0 })
        : `<div class="fw-bold font-monospace" style="font-size: 5pt;">${bookId}</div>`;

    const stampClass = isPaid ? 'paid' : 'due';
    const stampText = isPaid ? 'PAID' : 'FINE DUE';
    const stampSubText = isPaid ? 'COLLECTED & VERIFIED' : 'PENDING PAYMENT';

    // Logo path resolution based on location
    const path = (window.location && window.location.pathname) ? window.location.pathname.replace(/\\/g, '/') : '';
    let logoSrc = '../images/image.png';
    if (path.includes('lead/admin') || path.includes('lead/principal')) {
        logoSrc = '../../../images/image.png';
    } else if (path.includes('subpages')) {
        logoSrc = '../images/image.png';
    } else {
        logoSrc = 'assets/images/image.png';
    }

    // 1. ATM CARD SIZE (ISO 7810 ID-1: 85.6mm x 53.98mm - Front & Back Pocket Wallet Card)
    if (mode === 'atm-card') {
        return `
            <div class="atm-slip-wrapper" id="activeFineSlipElement">
                <div class="atm-cut-guide no-print">
                    <i class="bi bi-scissors text-danger"></i>
                    <span><strong>ATM Card Size:</strong> 85.6 mm &times; 53.98 mm &bull; Front (Fine Details) & Back (Policy Conditions & Signatures)</span>
                </div>

                <div class="atm-card-pair">
                    <!-- FRONT SIDE OF ATM CARD (85.6mm x 54mm) -->
                    <div class="atm-card atm-card-front" id="atmCardFront">
                        <div class="atm-card-header">
                            <div class="atm-header-left">
                                <img src="${logoSrc}" alt="Logo" class="atm-card-logo" onerror="this.onerror=null; this.src='https://img.icons8.com/color/96/000000/books.png';">
                                <div class="atm-header-titles">
                                    <h4 class="atm-college-name">KUTHBUKHANA ANWARIYYA</h4>
                                    <div class="atm-slip-subtitle">FINE RECEIPT CARD &bull; <span class="atm-receipt-no">${receiptNo}</span></div>
                                </div>
                            </div>
                            <div class="atm-header-right">
                                <div class="atm-chip" title="EMV Smart Chip"></div>
                            </div>
                        </div>

                        <div class="atm-card-body">
                            <div class="atm-row">
                                <div class="atm-row-item">
                                    <span class="atm-label">Borrower:</span>
                                    <strong class="atm-val">${studentName}</strong> 
                                    <span class="text-muted">(#${rollNo}, Cl: ${classDiv})</span>
                                </div>
                            </div>

                            <div class="atm-row">
                                <div class="atm-row-item">
                                    <span class="atm-label">Book:</span>
                                    <strong class="atm-val">${bookTitle}</strong> 
                                    <span class="atm-val-code">${bookId}</span>
                                </div>
                            </div>

                            <div class="atm-row" style="font-size: 5.1pt;">
                                <div class="atm-row-item">
                                    <span class="atm-label">Author:</span> <strong class="atm-val">${author}</strong>
                                    <span class="mx-1 text-muted">|</span>
                                    <span class="atm-label">Dates:</span> <span class="text-muted">${issueDate} &rarr; ${returnDate}</span>
                                </div>
                            </div>

                            <!-- Overdue & Damage Breakdown strip -->
                            <div class="atm-breakdown-strip">
                                <div class="atm-breakdown-col">
                                    <div class="atm-b-title">
                                        <span>Ower Days:</span>
                                        <span class="atm-b-fee">₹${overdueFine.toFixed(0)}</span>
                                    </div>
                                    <div class="atm-b-detail">${overdueDays} day(s) late &times; ₹${fineRate}/d</div>
                                </div>
                                <div class="atm-breakdown-col" style="border-left: 0.6px solid #cbd5e1; padding-left: 1.2mm;">
                                    <div class="atm-b-title">
                                        <span>Damage:</span>
                                        <span class="atm-b-fee">₹${damageFine.toFixed(0)}</span>
                                    </div>
                                    <div class="atm-b-detail">${damageReason}</div>
                                </div>
                            </div>
                        </div>

                        <div class="atm-card-footer">
                            <div class="atm-footer-barcode">
                                ${miniBarcodeSvg}
                                <div class="atm-barcode-code">${bookId}</div>
                            </div>
                            <div class="atm-stamp-badge ${stampClass}">
                                ${stampText}
                            </div>
                            <div class="atm-amount-group">
                                <div class="atm-amount-lbl">TOTAL FINE</div>
                                <div class="atm-amount-num ${isPaid ? 'is-paid' : ''}">₹${fineAmount.toFixed(2)}</div>
                                <div class="atm-amount-words">${words}</div>
                            </div>
                        </div>
                    </div>

                    <!-- BACK SIDE OF ATM CARD (85.6mm x 54mm) -->
                    <div class="atm-card atm-card-back" id="atmCardBack">
                        <div class="atm-mag-stripe"></div>

                        <div class="atm-back-content">
                            <div class="atm-back-header">
                                <span class="atm-back-title"><i class="bi bi-shield-check text-primary"></i> Library Rules (നിബന്ധനകൾ)</span>
                                <span class="atm-back-ref">${formattedDate}</span>
                            </div>

                            <ol class="atm-conditions-list">
                                <li><strong>Overdue Days (വൈകിയ ദിവസങ്ങൾ):</strong> ₹5.00/working day after due date.</li>
                                <li><strong>Book Damage (കേടുപാടുകൾ):</strong> Strict fine for torn/water-damaged copies.</li>
                                <li><strong>Lost / Irreparable (നഷ്ടപ്പെട്ട പുസ്തകം):</strong> Must replace or pay full book cost.</li>
                                <li><strong>Clearance (ക്ലിയറൻസ്):</strong> Settle dues to borrow books or get clearance.</li>
                            </ol>

                            <div class="atm-back-bottom">
                                <div class="atm-sig-box">
                                    <div class="atm-sig-line"></div>
                                    <div class="atm-sig-txt">Borrower Sign</div>
                                </div>
                                <div class="atm-seal-mini">
                                    <span>LIBRARY<br>SEAL</span>
                                </div>
                                <div class="atm-sig-box">
                                    <div class="atm-sig-line"></div>
                                    <div class="atm-sig-txt">Librarian Sign</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // 2. POCKET SLIP (ATM Card Width: 85.6mm, Continuous Single Vertical Card)
    if (mode === 'atm-pocket') {
        return `
            <div class="atm-slip-wrapper" id="activeFineSlipElement">
                <div class="atm-cut-guide no-print">
                    <i class="bi bi-wallet2 text-primary"></i>
                    <span><strong>Pocket Slip:</strong> 85.6 mm Width (Fits into pocket/wallet or inside book)</span>
                </div>

                <div class="atm-pocket-card">
                    <!-- Header -->
                    <div class="slip-header">
                        <div class="slip-header-logo-row">
                            <img src="${logoSrc}" alt="Library Logo" class="slip-logo" onerror="this.onerror=null; this.src='https://img.icons8.com/color/96/000000/books.png';">
                            <div class="slip-header-text">
                                <h3 class="slip-library-title">KUTHBUKHANA ANWARIYYA</h3>
                                <div class="slip-library-subtitle">CENTRAL LIBRARY &bull; FINE SLIP</div>
                                <div class="slip-doc-badge">SLIP #${receiptNo}</div>
                            </div>
                        </div>
                        <div class="slip-meta-strip mt-2">
                            <div><strong>Date:</strong> <span>${formattedDate}</span></div>
                            <div><strong>Borrower:</strong> <strong>${studentName}</strong> (#${rollNo})</div>
                        </div>
                    </div>

                    <!-- Book particulars -->
                    <div class="slip-section-box slip-book-highlight-box">
                        <div class="slip-section-heading">
                            <i class="bi bi-book-half text-info"></i> Book Particulars
                        </div>
                        <div class="slip-grid-2">
                            <div class="slip-full-width">
                                <span class="slip-label">Title:</span> 
                                <strong class="slip-value slip-book-title-value" style="font-size: 0.85rem;">${bookTitle}</strong>
                            </div>
                            <div>
                                <span class="slip-label">Code:</span> 
                                <span class="slip-code-pill" style="font-size: 0.65rem;">${bookId}</span>
                            </div>
                            <div>
                                <span class="slip-label">Author:</span> 
                                <strong class="slip-value">${author}</strong>
                            </div>
                        </div>
                    </div>

                    <!-- Breakdown Table -->
                    <div class="slip-section-box">
                        <div class="slip-section-heading">
                            <i class="bi bi-calculator-fill text-danger"></i> Assessment Breakdown
                        </div>
                        <div class="slip-breakdown-box">
                            <table class="slip-breakdown-table">
                                <thead>
                                    <tr>
                                        <th>Particulars</th>
                                        <th style="text-align: right;">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>
                                            <strong>Ower Days:</strong> ${overdueDays}d &times; ₹${fineRate}/d
                                        </td>
                                        <td style="text-align: right; font-weight: 700; color: ${overdueFine > 0 ? '#b91c1c' : '#334155'};">
                                            ₹${overdueFine.toFixed(2)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <strong>Damage:</strong> ${damageReason}
                                        </td>
                                        <td style="text-align: right; font-weight: 700; color: ${damageFine > 0 ? '#b91c1c' : '#334155'};">
                                            ₹${damageFine.toFixed(2)}
                                        </td>
                                    </tr>
                                    <tr class="slip-breakdown-total-row">
                                        <td><strong>TOTAL FINE:</strong></td>
                                        <td style="text-align: right; font-weight: 800; color: #b91c1c;">
                                            ₹${fineAmount.toFixed(2)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Fine Summary Row -->
                    <div class="slip-fine-summary-row py-2 px-2 my-2">
                        <div class="slip-barcode-area">
                            ${miniBarcodeSvg}
                            <small class="text-muted fw-bold" style="font-size: 0.58rem;">${bookId}</small>
                        </div>
                        <div class="slip-status-stamp-area">
                            <div class="slip-stamp ${stampClass}" style="padding: 2px 8px;">
                                <span class="slip-stamp-text" style="font-size: 0.85rem;">${stampText}</span>
                            </div>
                        </div>
                        <div class="slip-amount-box ${isPaid ? 'is-paid' : ''}">
                            <div class="slip-amount-num" style="font-size: 1.15rem;">₹${fineAmount.toFixed(2)}</div>
                            <div class="slip-amount-words" style="font-size: 0.58rem;">${words}</div>
                        </div>
                    </div>

                    <!-- Conditions Box -->
                    <div class="slip-conditions-box">
                        <div class="slip-conditions-header" style="font-size: 0.62rem;">
                            <i class="bi bi-shield-check text-primary"></i> Library Conditions (നിബന്ധനകൾ):
                        </div>
                        <ol class="slip-conditions-list">
                            <li><strong>Overdue:</strong> ₹5.00/working day after due date.</li>
                            <li><strong>Damage:</strong> Strict penalty for torn or marked copies.</li>
                            <li><strong>Loss:</strong> Must replace or pay full book cost.</li>
                            <li><strong>Clearance:</strong> Settle all dues before borrowing.</li>
                        </ol>
                    </div>

                    <!-- Signatures -->
                    <div class="slip-signatures-row mt-2 pt-1">
                        <div class="slip-sig-block" style="width: 100px;">
                            <div class="slip-sig-line" style="height: 18px;"></div>
                            <div class="slip-sig-text" style="font-size: 0.55rem;">Borrower Sign</div>
                        </div>
                        <div class="slip-official-seal-circle" style="width: 38px; height: 38px; font-size: 0.45rem;">
                            <span>SEAL</span>
                        </div>
                        <div class="slip-sig-block" style="width: 100px;">
                            <div class="slip-sig-line" style="height: 18px;"></div>
                            <div class="slip-sig-text" style="font-size: 0.55rem;">Librarian Sign</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // 3. FULL STANDARD DETAILED SLIP (A4 Sheet Layout)
    return `
        <div class="fine-slip-card" id="activeFineSlipElement">
            <!-- Header -->
            <div class="slip-header">
                <div class="slip-header-logo-row">
                    <img src="${logoSrc}" alt="Library Logo" class="slip-logo" onerror="this.onerror=null; this.src='https://img.icons8.com/color/96/000000/books.png';">
                    <div class="slip-header-text">
                        <h3 class="slip-library-title">KUTHBUKHANA ANWARIYYA</h3>
                        <div class="slip-library-subtitle">CENTRAL LIBRARY & INFORMATION RESOURCE CENTRE</div>
                        <div class="slip-doc-badge">OFFICIAL OVERDUE & DAMAGE FINE RECEIPT SLIP</div>
                    </div>
                </div>
                <div class="slip-meta-strip">
                    <div><strong>Slip / Receipt No:</strong> <code class="text-primary fw-bold">${receiptNo}</code></div>
                    <div><strong>Receipt Date:</strong> <span>${formattedDate} &bull; ${timeStr}</span></div>
                </div>
            </div>

            <!-- Borrower / Student Details -->
            <div class="slip-section-box">
                <div class="slip-section-heading">
                    <i class="bi bi-person-fill text-primary"></i> 1. Borrower Particulars
                </div>
                <div class="slip-grid-2">
                    <div><span class="slip-label">Student Name:</span> <strong class="slip-value">${studentName}</strong></div>
                    <div><span class="slip-label">Roll / Adm No:</span> <strong class="slip-value text-primary">${rollNo}</strong></div>
                    <div><span class="slip-label">Class & Division:</span> <span class="slip-value">${classDiv}</span></div>
                    <div><span class="slip-label">Category:</span> <span class="slip-value">${borrowerCategory}</span></div>
                </div>
            </div>

            <!-- Book Particulars (Specifically Highlighted with Name, Code, Author) -->
            <div class="slip-section-box slip-book-highlight-box">
                <div class="slip-section-heading">
                    <i class="bi bi-book-half text-info"></i> 2. Book Particulars (Name, Code & Author)
                </div>
                <div class="slip-grid-2">
                    <div class="slip-full-width">
                        <span class="slip-label">Book Name (Title):</span> 
                        <strong class="slip-value slip-book-title-value">${bookTitle}</strong>
                    </div>
                    <div>
                        <span class="slip-label">Book Code / ID:</span> 
                        <span class="slip-code-pill">${bookId}</span>
                    </div>
                    <div>
                        <span class="slip-label">Author Name:</span> 
                        <strong class="slip-value text-dark">${author}</strong>
                    </div>
                    <div>
                        <span class="slip-label">Section / Category:</span> 
                        <span class="slip-value">${section}</span>
                    </div>
                </div>
            </div>

            <!-- Circulation & Overdue Timeline Table -->
            <div class="slip-section-box">
                <div class="slip-section-heading">
                    <i class="bi bi-calendar-range text-warning"></i> 3. Circulation & Timeline Details
                </div>
                <table class="slip-details-table">
                    <thead>
                        <tr>
                            <th>Issue Date</th>
                            <th>Due Date</th>
                            <th>Return / Settlement Date</th>
                            <th>Allowed Duration</th>
                            <th>Overdue Days (Ower Days)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${issueDate}</td>
                            <td>${dueDate}</td>
                            <td>${returnDate}</td>
                            <td>${allowedDays} Working Days</td>
                            <td><strong class="${overdueDays > 0 ? 'text-danger' : 'text-success'}">${overdueDays} Day(s)</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Fine Assessment Breakdown (Overdue Days & Book Damage) -->
            <div class="slip-section-box">
                <div class="slip-section-heading">
                    <i class="bi bi-calculator-fill text-danger"></i> 4. Fine Assessment Breakdown (Overdue Days & Book Damage)
                </div>
                <div class="slip-breakdown-box">
                    <table class="slip-breakdown-table">
                        <thead>
                            <tr>
                                <th style="width: 36%;">Charge Particulars</th>
                                <th>Assessment Basis / Remarks</th>
                                <th style="width: 24%; text-align: right;">Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    <strong><i class="bi bi-clock-history text-danger me-1"></i> Overdue Days (Ower Days)</strong>
                                </td>
                                <td>
                                    ${overdueDays} working day(s) late &times; ₹${fineRate.toFixed(2)}/day
                                    <small class="text-muted d-block" style="font-size: 0.68rem;">(Sundays strictly excluded from overdue count)</small>
                                </td>
                                <td style="text-align: right; font-weight: 700; color: ${overdueFine > 0 ? '#b91c1c' : '#334155'};">
                                    ₹${overdueFine.toFixed(2)}
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <strong><i class="bi bi-exclamation-triangle-fill text-warning me-1"></i> Book Damage (Damage Penalty)</strong>
                                </td>
                                <td>
                                    <span class="${damageFine > 0 ? 'text-danger fw-bold' : 'text-secondary'}">${damageReason}</span>
                                    <small class="text-muted d-block" style="font-size: 0.68rem;">${damageFine > 0 ? 'Assessed penalty for physical damage / missing pages / marks' : 'Condition verified intact upon return'}</small>
                                </td>
                                <td style="text-align: right; font-weight: 700; color: ${damageFine > 0 ? '#b91c1c' : '#334155'};">
                                    ₹${damageFine.toFixed(2)}
                                </td>
                            </tr>
                            <tr class="slip-breakdown-total-row">
                                <td colspan="2">
                                    <strong>TOTAL FINE ASSESSED (Overdue Days + Book Damage):</strong>
                                </td>
                                <td style="text-align: right; font-weight: 800; font-size: 0.95rem; color: #b91c1c;">
                                    ₹${fineAmount.toFixed(2)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Fine Summary & Status Box -->
            <div class="slip-fine-summary-row">
                <div class="slip-barcode-area">
                    <div class="barcode-stamp-svg mb-1">${barcodeSvg}</div>
                    <small class="text-muted fw-bold" style="font-size: 0.68rem;">CODE128: ${bookId}</small>
                </div>
                <div class="slip-status-stamp-area">
                    <div class="slip-stamp ${stampClass}">
                        <div class="slip-stamp-inner">
                            <span class="slip-stamp-text">${stampText}</span>
                            <span class="slip-stamp-sub">${stampSubText}</span>
                        </div>
                    </div>
                </div>
                <div class="slip-amount-box ${isPaid ? 'is-paid' : ''}">
                    <div class="slip-amount-label">TOTAL FINE AMOUNT</div>
                    <div class="slip-amount-num">₹${fineAmount.toFixed(2)}</div>
                    <div class="slip-amount-words">${words}</div>
                    <div class="slip-payment-mode"><small>Payment Mode: <strong>${paymentMode}</strong></small></div>
                </div>
            </div>

            <!-- Official Library Fine Rules & Conditions -->
            <div class="slip-conditions-box">
                <div class="slip-conditions-header">
                    <i class="bi bi-shield-check text-primary"></i> Library Borrowing & Fine Policy Conditions (ലൈബ്രറി നിബന്ധനകൾ):
                </div>
                <ol class="slip-conditions-list">
                    <li><strong>Overdue Days (വൈകിയ ദിവസങ്ങൾ):</strong> Books must be returned on or before the due date. An overdue fine of ₹5.00 is charged per working day (Sundays excluded).</li>
                    <li><strong>Book Damage & Penalty (കേടുപാടുകൾ):</strong> Borrowers are strictly responsible for returning books in undamaged condition. Pages torn, scribbled, water damaged, or binding ruined will attract repair/damage fines as assessed by the librarian.</li>
                    <li><strong>Irreparable Damage / Loss (നഷ്ടപ്പെട്ട പുസ്തകം):</strong> For lost books or severely damaged copies that cannot be circulated, the borrower must replace with an identical original copy or pay the full replacement cost.</li>
                    <li><strong>Library Clearance:</strong> All outstanding overdue and damage dues must be settled in full before borrowing additional books or obtaining academic/hall clearance.</li>
                    <li><strong>Proof of Settlement:</strong> Retain this computer-generated receipt as authentic clearance proof for Kuthbukhana Anwariyya Library.</li>
                </ol>
            </div>

            <div class="slip-divider-dashed"></div>

            <!-- Signatures & Authority -->
            <div class="slip-signatures-row">
                <div class="slip-sig-block">
                    <div class="slip-sig-line"></div>
                    <div class="slip-sig-text">Borrower / Student Signature</div>
                </div>
                <div class="slip-stamp-placeholder">
                    <div class="slip-official-seal-circle">
                        <span>LIBRARY<br>OFFICIAL<br>SEAL</span>
                    </div>
                </div>
                <div class="slip-sig-block">
                    <div class="slip-sig-line"></div>
                    <div class="slip-sig-text">Authorized Librarian Signature</div>
                </div>
            </div>

            <!-- Official Disclaimer Footer -->
            <div class="slip-footer-disclaimer">
                <p class="mb-0">This is an official computer-generated receipt from Kuthbukhana Anwariyya Library.</p>
                <p class="mb-0 text-muted" style="font-size: 0.68rem;">Please retain this receipt for official clearance. Books must be returned on or before due date to avoid fines.</p>
            </div>
        </div>
    `;
}

// Ensure the global Fine Slip Modal container is present in the DOM
function ensureFineSlipModalInDOM() {
    let modalEl = document.getElementById('fineSlipModal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'fineSlipModal';
        modalEl.className = 'modal fade';
        modalEl.tabIndex = -1;
        modalEl.setAttribute('aria-labelledby', 'fineSlipModalLabel');
        modalEl.setAttribute('aria-hidden', 'true');
        modalEl.innerHTML = `
            <div class="modal-dialog modal-lg fine-slip-modal-dialog modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content rounded-4 shadow-lg border-0 overflow-hidden">
                    <div class="modal-header bg-dark text-white p-3">
                        <div class="d-flex align-items-center gap-2">
                            <i class="bi bi-receipt-cutoff text-warning fs-4"></i>
                            <div>
                                <h5 class="modal-title fw-bold mb-0" id="fineSlipModalLabel">Library Fine Slip & Receipt</h5>
                                <small class="text-light" style="opacity: 0.8;">Kuthbukhana Anwariyya &bull; Overdue Days & Book Damage Assessment</small>
                            </div>
                        </div>
                        <div class="d-flex gap-2 align-items-center flex-wrap">
                            <!-- Size Switcher Buttons -->
                            <div class="btn-group btn-group-sm" role="group" aria-label="Slip Size Options">
                                <button type="button" class="btn btn-sm btn-primary active btn-slip-layout-atm-card" onclick="setFineSlipLayout('atm-card')" title="Standard ATM Card Size (85.6 × 54 mm)">
                                    <i class="bi bi-credit-card-2-front me-1"></i> ATM Card
                                </button>
                                <button type="button" class="btn btn-sm btn-outline-light btn-slip-layout-atm-pocket" onclick="setFineSlipLayout('atm-pocket')" title="Pocket Slip (85.6 mm width)">
                                    <i class="bi bi-receipt me-1"></i> Pocket
                                </button>
                                <button type="button" class="btn btn-sm btn-outline-light btn-slip-layout-standard" onclick="setFineSlipLayout('standard')" title="Full Page Detailed Slip">
                                    <i class="bi bi-file-earmark-text me-1"></i> Full
                                </button>
                            </div>
                            <button type="button" class="btn btn-outline-light btn-sm" onclick="toggleFineSlipCustomizeDrawer()" id="btnToggleCustomizeSlip">
                                <i class="bi bi-sliders me-1"></i> Customize / Edit
                            </button>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                    </div>
                    <div class="modal-body p-0 bg-light">
                        <!-- Collapsible Editor Drawer -->
                        <div id="fineSlipCustomizeDrawer" class="p-3 bg-white border-bottom shadow-sm" style="display: none;">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h6 class="fw-bold mb-0 text-primary"><i class="bi bi-pencil-square me-1"></i> Edit Fine Slip Particulars (Overdue Days & Damage)</h6>
                                <button type="button" class="btn btn-sm btn-link text-muted p-0 text-decoration-none" onclick="toggleFineSlipCustomizeDrawer()">Hide Editor <i class="bi bi-chevron-up"></i></button>
                            </div>
                            <!-- Quick select from active ledger -->
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-muted mb-1">Quick-Fill from Overdue / Recent Ledger</label>
                                <select id="slipQuickLedgerSelect" class="form-select form-select-sm" onchange="loadSlipFromQuickPicker(this.value)">
                                    <option value="">-- Choose a Borrower or Book from Ledger --</option>
                                </select>
                            </div>
                            <div class="row g-2">
                                <div class="col-md-4">
                                    <label class="form-label small fw-bold mb-0">Student / Borrower Name</label>
                                    <input type="text" id="slipEditStudentName" class="form-control form-control-sm" oninput="liveUpdateFineSlip()">
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label small fw-bold mb-0">Roll No</label>
                                    <input type="text" id="slipEditRollNo" class="form-control form-control-sm" oninput="liveUpdateFineSlip()">
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label small fw-bold mb-0">Class / Div</label>
                                    <input type="text" id="slipEditClassDiv" class="form-control form-control-sm" oninput="liveUpdateFineSlip()">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label small fw-bold mb-0">Book Code / ID</label>
                                    <input type="text" id="slipEditBookId" class="form-control form-control-sm" oninput="liveUpdateFineSlip()">
                                </div>
                                <div class="col-md-5">
                                    <label class="form-label small fw-bold mb-0">Book Name (Title)</label>
                                    <input type="text" id="slipEditBookTitle" class="form-control form-control-sm" oninput="liveUpdateFineSlip()">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label small fw-bold mb-0">Author Name</label>
                                    <input type="text" id="slipEditAuthor" class="form-control form-control-sm" oninput="liveUpdateFineSlip()">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label small fw-bold mb-0">Category / Section</label>
                                    <input type="text" id="slipEditSection" class="form-control form-control-sm" oninput="liveUpdateFineSlip()">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label small fw-bold mb-0">Issue Date</label>
                                    <input type="date" id="slipEditIssueDate" class="form-control form-control-sm" onchange="liveRecalculateFineSlip()">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label small fw-bold mb-0">Due Date</label>
                                    <input type="date" id="slipEditDueDate" class="form-control form-control-sm" onchange="liveUpdateFineSlip()">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label small fw-bold mb-0">Return / Settlement Date</label>
                                    <input type="date" id="slipEditReturnDate" class="form-control form-control-sm" onchange="liveRecalculateFineSlip()">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label small fw-bold mb-0 text-danger"><i class="bi bi-clock-history"></i> Overdue Working Days</label>
                                    <input type="number" id="slipEditOverdueDays" class="form-control form-control-sm" min="0" oninput="liveRecalculateFineSlipAmount()">
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label small fw-bold mb-0">Fine Rate (₹/day)</label>
                                    <input type="number" id="slipEditFineRate" class="form-control form-control-sm" value="5" min="0" oninput="liveRecalculateFineSlipAmount()">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label small fw-bold mb-0 text-warning"><i class="bi bi-exclamation-triangle-fill"></i> Book Damage Fine (₹)</label>
                                    <input type="number" id="slipEditDamageFine" class="form-control form-control-sm" value="0" min="0" oninput="liveRecalculateFineSlipAmount()">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label small fw-bold mb-0">Damage Reason / Notes</label>
                                    <input type="text" id="slipEditDamageReason" class="form-control form-control-sm" placeholder="e.g. Torn pages, water damage, or None" oninput="liveUpdateFineSlip()">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label small fw-bold mb-0 text-success">Total Fine Amount (₹)</label>
                                    <input type="number" id="slipEditFineAmount" class="form-control form-control-sm fw-bold text-danger" oninput="liveUpdateFineSlip()">
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label small fw-bold mb-0">Payment Status</label>
                                    <select id="slipEditStatus" class="form-select form-select-sm" onchange="liveUpdateFineSlip()">
                                        <option value="paid">✅ Paid</option>
                                        <option value="due">⚠️ Due</option>
                                    </select>
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label small fw-bold mb-0">Payment Mode</label>
                                    <input type="text" id="slipEditPaymentMode" class="form-control form-control-sm" value="Cash Desk" oninput="liveUpdateFineSlip()">
                                </div>
                            </div>
                        </div>

                        <!-- Slip Preview Container -->
                        <div class="fine-slip-wrapper" id="printableFineSlipArea">
                            <div id="fineSlipPreviewContainer" class="w-100 d-flex justify-content-center">
                                <!-- Generated Dynamically -->
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer bg-white border-top p-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <div class="d-flex gap-2">
                            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
                                <i class="bi bi-x-lg me-1"></i> Close
                            </button>
                            <button type="button" class="btn btn-outline-primary" onclick="copyFineSlipSummary()">
                                <i class="bi bi-clipboard-check me-1"></i> Copy Receipt Text
                            </button>
                            <button type="button" class="btn btn-outline-dark" onclick="openStandaloneFineSlipPage()">
                                <i class="bi bi-box-arrow-up-right me-1"></i> Open Full Page Slip
                            </button>
                        </div>
                        <div class="d-flex gap-2">
                            <button type="button" class="btn btn-success fw-bold px-4 shadow-sm" onclick="printActiveFineSlip()">
                                <i class="bi bi-printer-fill me-1"></i> Print Fine Slip
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }
    return modalEl;
}

// Open Fine Slip Modal with concrete slip data object
function openFineSlipModalWithData(slipData) {
    currentActiveFineSlipData = { ...slipData };
    ensureFineSlipModalInDOM();

    // Populate the slip preview in current layout (default: atm-card)
    const previewContainer = document.getElementById('fineSlipPreviewContainer');
    if (previewContainer) {
        previewContainer.innerHTML = generateFineSlipCardHTML(currentActiveFineSlipData, currentFineSlipLayoutMode);
    }

    // Sync layout buttons
    setFineSlipLayout(currentFineSlipLayoutMode);

    // Populate editor fields
    populateSlipEditorFields(currentActiveFineSlipData);
    populateFineSlipQuickPicker();

    // Show modal
    const modalEl = document.getElementById('fineSlipModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const instance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        instance.show();
    }
}

// Open Fine Slip Modal for a specific ledger entry
function openFineSlipByLedgerId(id) {
    const ledger = getLedgerData();
    const books = getBooksData();
    const todayStr = new Date().toISOString().split('T')[0];

    // Find entry by id or bookId
    let item = ledger.find(r => String(r.id) === String(id) || String(r.bookId) === String(id));
    if (!item && !isNaN(Number(id)) && ledger[Number(id)]) {
        item = ledger[Number(id)];
    }

    if (!item) {
        // Fallback: try checking if it's a book in books table
        const book = books[id];
        if (book) {
            const isStaff = book.issuedTo && book.issuedTo.includes('STAFF');
            const allowed = book.allowedDays || (getClassGradeNum(book.classDiv) >= 6 ? 10 : 5);
            const fineCalc = calculateOverdueFine(book.issueDate, allowed, 5, isStaff);
            openFineSlipModalWithData({
                receiptNo: 'FS-' + (Date.now().toString().slice(-6)),
                bookId: id,
                bookTitle: book.title || 'Unknown Title',
                author: book.author || 'Unknown Author',
                section: book.sectionName || book.section || 'General',
                studentName: book.issuedTo || 'Borrower',
                rollNo: 'N/A',
                classDiv: book.classDiv || 'N/A',
                issueDate: book.issueDate || todayStr,
                dueDate: book.dueDate || todayStr,
                returnDate: todayStr,
                allowedDays: allowed,
                overdueDays: fineCalc.overdueDays,
                fineRate: 5,
                overdueFine: fineCalc.fineAmount,
                damageFine: 0,
                damageReason: 'None / Intact',
                fineAmount: fineCalc.fineAmount,
                finePaid: false,
                paymentMode: 'Cash Desk',
                receiptDate: todayStr
            });
            return;
        }
        showPopupAlert('Record Not Found', 'Could not locate the requested ledger record or book.', 'warning');
        return;
    }

    const book = books[item.bookId] || {};
    const isStaff = item.rollNo === 'STAFF' || (item.status && item.status.includes('Staff'));
    const isReturned = item.status === 'Returned';
    const allowedDays = item.allowedDays || (getClassGradeNum(item.classDiv) >= 6 ? 10 : 5);

    // Calculate overdue working days
    const returnOrToday = isReturned && item.returnDate ? item.returnDate : todayStr;
    const workingDaysElapsed = countWorkingDays(item.issueDate, returnOrToday);
    const overdueWorkingDays = Math.max(0, workingDaysElapsed - allowedDays);
    const calculatedOverdueFine = overdueWorkingDays * 5;

    const damageFine = item.damageFine || 0;
    const damageReason = item.damageReason || (damageFine > 0 ? 'Damage penalty' : 'None / Intact');

    const totalFine = (isReturned && item.fineAmount !== undefined && item.fineAmount !== null)
        ? item.fineAmount
        : (calculatedOverdueFine + damageFine);
    const finePaid = isReturned ? (item.finePaid ?? (item.fineAmount > 0)) : false;

    openFineSlipModalWithData({
        receiptNo: 'FS-' + (item.id ? String(item.id).slice(-6) : Date.now().toString().slice(-6)),
        bookId: item.bookId,
        bookTitle: item.bookTitle || book.title || 'Unknown Title',
        author: item.author || book.author || 'Unknown Author',
        section: book.sectionName || book.section || 'General',
        studentName: item.studentName || 'Student',
        rollNo: item.rollNo || 'N/A',
        classDiv: item.classDiv || 'N/A',
        issueDate: item.issueDate,
        dueDate: item.dueDate || 'N/A',
        returnDate: returnOrToday,
        allowedDays: allowedDays,
        overdueDays: isReturned ? Math.max(0, workingDaysElapsed - allowedDays) : overdueWorkingDays,
        fineRate: 5,
        overdueFine: calculatedOverdueFine,
        damageFine: damageFine,
        damageReason: damageReason,
        fineAmount: totalFine,
        finePaid: finePaid,
        paymentMode: 'Cash Desk',
        receiptDate: todayStr
    });
}

// Open Fine Slip Modal for manual entry or new slip generation
function openManualFineSlipModal(presetData = null) {
    const todayStr = new Date().toISOString().split('T')[0];
    const defaultData = presetData || {
        receiptNo: 'FS-' + Date.now().toString().slice(-6),
        bookId: '',
        bookTitle: '',
        author: '',
        section: 'General',
        studentName: '',
        rollNo: '',
        classDiv: '',
        issueDate: todayStr,
        dueDate: todayStr,
        returnDate: todayStr,
        allowedDays: 10,
        overdueDays: 0,
        fineRate: 5,
        overdueFine: 0,
        damageFine: 0,
        damageReason: 'None / Intact',
        fineAmount: 0,
        finePaid: true,
        paymentMode: 'Cash Desk',
        receiptDate: todayStr
    };

    openFineSlipModalWithData(defaultData);

    // Automatically open the customize drawer so the user can enter information immediately
    const drawer = document.getElementById('fineSlipCustomizeDrawer');
    if (drawer) drawer.style.display = 'block';
}

// Toggle visibility of the customization drawer in the modal
function toggleFineSlipCustomizeDrawer() {
    const drawer = document.getElementById('fineSlipCustomizeDrawer');
    if (!drawer) return;
    if (drawer.style.display === 'none' || !drawer.style.display) {
        drawer.style.display = 'block';
    } else {
        drawer.style.display = 'none';
    }
}

// Populate the editor inputs from data
function populateSlipEditorFields(data) {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val !== undefined && val !== null ? val : '';
    };

    setVal('slipEditStudentName', data.studentName);
    setVal('slipEditRollNo', data.rollNo);
    setVal('slipEditClassDiv', data.classDiv);
    setVal('slipEditBookId', data.bookId);
    setVal('slipEditBookTitle', data.bookTitle);
    setVal('slipEditAuthor', data.author);
    setVal('slipEditSection', data.section || data.sectionName);
    setVal('slipEditIssueDate', data.issueDate);
    setVal('slipEditDueDate', data.dueDate);
    setVal('slipEditReturnDate', data.returnDate);
    setVal('slipEditOverdueDays', data.overdueDays || 0);
    setVal('slipEditFineRate', data.fineRate || 5);
    setVal('slipEditDamageFine', data.damageFine || 0);
    setVal('slipEditDamageReason', data.damageReason || '');
    setVal('slipEditFineAmount', data.fineAmount !== undefined ? data.fineAmount : 0);
    setVal('slipEditPaymentMode', data.paymentMode || 'Cash Desk');

    const statusEl = document.getElementById('slipEditStatus');
    if (statusEl) {
        statusEl.value = data.finePaid ? 'paid' : 'due';
    }
}

// Populate quick picker dropdown with overdue and recent ledger items
function populateFineSlipQuickPicker() {
    const select = document.getElementById('slipQuickLedgerSelect');
    if (!select) return;

    const ledger = getLedgerData();
    let options = '<option value="">-- Choose a Borrower or Book from Ledger --</option>';

    ledger.slice(0, 50).forEach((item, idx) => {
        const isStaff = item.rollNo === 'STAFF' || (item.status && item.status.includes('Staff'));
        const allowed = item.allowedDays || (getClassGradeNum(item.classDiv) >= 6 ? 10 : 5);
        const fineInfo = calculateOverdueFine(item.issueDate, allowed, 5, isStaff);
        const isOverdue = item.status === 'Issued' && fineInfo.overdueDays > 0;
        const icon = isOverdue ? '⚠️ OVERDUE' : (item.status === 'Returned' && item.fineAmount > 0 ? '💰 FINE PAID' : '📋');
        const key = item.id || idx;

        options += `<option value="${key}">${icon} ${item.studentName} (Roll #${item.rollNo}) - "${item.bookTitle}" [${item.bookId}]</option>`;
    });

    select.innerHTML = options;
}

// Load chosen record from quick picker
function loadSlipFromQuickPicker(key) {
    if (!key) return;
    openFineSlipByLedgerId(key);
}

// Live update fine slip preview based on inputs in customize drawer
function liveUpdateFineSlip() {
    if (!currentActiveFineSlipData) currentActiveFineSlipData = {};

    const getVal = (id) => document.getElementById(id)?.value?.trim() || '';

    currentActiveFineSlipData.studentName = getVal('slipEditStudentName');
    currentActiveFineSlipData.rollNo = getVal('slipEditRollNo');
    currentActiveFineSlipData.classDiv = getVal('slipEditClassDiv');
    currentActiveFineSlipData.bookId = getVal('slipEditBookId');
    currentActiveFineSlipData.bookTitle = getVal('slipEditBookTitle');
    currentActiveFineSlipData.author = getVal('slipEditAuthor');
    currentActiveFineSlipData.section = getVal('slipEditSection');
    currentActiveFineSlipData.issueDate = getVal('slipEditIssueDate');
    currentActiveFineSlipData.dueDate = getVal('slipEditDueDate');
    currentActiveFineSlipData.returnDate = getVal('slipEditReturnDate');
    currentActiveFineSlipData.overdueDays = parseInt(getVal('slipEditOverdueDays'), 10) || 0;
    currentActiveFineSlipData.fineRate = parseFloat(getVal('slipEditFineRate')) || 5;
    currentActiveFineSlipData.overdueFine = currentActiveFineSlipData.overdueDays * currentActiveFineSlipData.fineRate;

    currentActiveFineSlipData.damageFine = parseFloat(getVal('slipEditDamageFine')) || 0;
    currentActiveFineSlipData.damageReason = getVal('slipEditDamageReason') || (currentActiveFineSlipData.damageFine > 0 ? 'Physical Damage / Penalty' : 'None / Intact');

    const totalInputVal = parseFloat(getVal('slipEditFineAmount'));
    currentActiveFineSlipData.fineAmount = !isNaN(totalInputVal)
        ? totalInputVal
        : (currentActiveFineSlipData.overdueFine + currentActiveFineSlipData.damageFine);

    currentActiveFineSlipData.paymentMode = getVal('slipEditPaymentMode') || 'Cash Desk';
    currentActiveFineSlipData.finePaid = document.getElementById('slipEditStatus')?.value === 'paid';

    const previewContainer = document.getElementById('fineSlipPreviewContainer');
    if (previewContainer) {
        previewContainer.innerHTML = generateFineSlipCardHTML(currentActiveFineSlipData, currentFineSlipLayoutMode);
    }
}

// Live recalculate overdue days from dates
function liveRecalculateFineSlip() {
    const issueDate = document.getElementById('slipEditIssueDate')?.value;
    const returnDate = document.getElementById('slipEditReturnDate')?.value || new Date().toISOString().split('T')[0];
    const classDiv = document.getElementById('slipEditClassDiv')?.value;
    const allowed = (getClassGradeNum(classDiv) >= 6) ? 10 : 5;

    if (issueDate) {
        const elapsed = countWorkingDays(issueDate, returnDate);
        const overdue = Math.max(0, elapsed - allowed);
        const overdueInput = document.getElementById('slipEditOverdueDays');
        if (overdueInput) overdueInput.value = overdue;

        const rateInput = document.getElementById('slipEditFineRate');
        const rate = rateInput ? (parseFloat(rateInput.value) || 5) : 5;
        const damageInput = document.getElementById('slipEditDamageFine');
        const damage = damageInput ? (parseFloat(damageInput.value) || 0) : 0;

        const amountInput = document.getElementById('slipEditFineAmount');
        if (amountInput) amountInput.value = ((overdue * rate) + damage).toFixed(2);
    }
    liveUpdateFineSlip();
}

// Live recalculate fine amount from overdue days * rate + damage fine
function liveRecalculateFineSlipAmount() {
    const overdue = parseInt(document.getElementById('slipEditOverdueDays')?.value, 10) || 0;
    const rate = parseFloat(document.getElementById('slipEditFineRate')?.value) || 5;
    const damage = parseFloat(document.getElementById('slipEditDamageFine')?.value) || 0;

    const total = (overdue * rate) + damage;
    const amountInput = document.getElementById('slipEditFineAmount');
    if (amountInput) amountInput.value = total.toFixed(2);
    liveUpdateFineSlip();
}

// Print the active fine slip
function printActiveFineSlip() {
    if (!currentActiveFineSlipData) return;

    const mode = currentFineSlipLayoutMode || 'atm-card';
    const slipCardHtml = generateFineSlipCardHTML(currentActiveFineSlipData, mode);
    const printWindow = window.open('', '_blank', 'width=850,height=750');
    if (printWindow) {
        // Path resolution for stylesheet
        const path = (window.location && window.location.pathname) ? window.location.pathname.replace(/\\/g, '/') : '';
        let styleHref = '../style.css';
        if (path.includes('lead/admin') || path.includes('lead/principal')) {
            styleHref = '../../../style.css';
        } else if (path.includes('subpages')) {
            styleHref = '../style.css';
        } else {
            styleHref = 'assets/style.css';
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Fine Slip - ${currentActiveFineSlipData.receiptNo || 'Receipt'}</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet">
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
                <link rel="stylesheet" href="${styleHref}">
                <style>
                    body {
                        font-family: 'Poppins', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        background: #ffffff;
                        margin: 0;
                        padding: 15px;
                        color: #0f172a;
                    }
                    @media print {
                        body { padding: 0 !important; margin: 0 !important; }
                        .no-print { display: none !important; }
                        .atm-card-pair {
                            display: flex !important;
                            flex-direction: row !important;
                            justify-content: center !important;
                            align-items: center !important;
                            gap: 6mm !important;
                            margin: 0 auto !important;
                            page-break-inside: avoid !important;
                        }
                        .atm-card {
                            box-shadow: none !important;
                            border: 1.5px solid #000000 !important;
                            page-break-inside: avoid !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        .atm-pocket-card {
                            box-shadow: none !important;
                            border: 1.5px solid #000000 !important;
                            page-break-inside: avoid !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        .fine-slip-card {
                            box-shadow: none !important;
                            border: 2px solid #000000 !important;
                            max-width: 100% !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                </style>
            </head>
            <body>
                ${slipCardHtml}
                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
        // Fallback to standard window print
        window.print();
    }
}

// Copy a clean textual receipt summary to the clipboard
function copyFineSlipSummary() {
    if (!currentActiveFineSlipData) return;
    const d = currentActiveFineSlipData;

    const overdueDays = d.overdueDays || 0;
    const fineRate = d.fineRate || 5;
    const overdueFine = d.overdueFine !== undefined ? d.overdueFine : (overdueDays * fineRate);
    const damageFine = d.damageFine || 0;
    const damageReason = d.damageReason || (damageFine > 0 ? 'Damage penalty' : 'None / Intact');

    const summary = `================================================
KUTHBUKHANA ANWARIYYA - OFFICIAL FINE RECEIPT
================================================
Slip No:        ${d.receiptNo || 'N/A'}
Receipt Date:   ${d.receiptDate || new Date().toISOString().split('T')[0]}
Borrower:       ${d.studentName} (Roll #${d.rollNo}, Class ${d.classDiv})
------------------------------------------------
BOOK DETAILS:
Book Name:      ${d.bookTitle}
Book Code / ID: ${d.bookId}
Author Name:    ${d.author || 'Not specified'}
Category:       ${d.section || 'General'}
------------------------------------------------
ASSESSMENT BREAKDOWN:
1. OVERDUE DAYS (Ower Days):
   • ${overdueDays} working day(s) @ ₹${fineRate.toFixed(2)}/day = ₹${overdueFine.toFixed(2)}
2. BOOK DAMAGE (Damage Penalty):
   • Penalty: ₹${damageFine.toFixed(2)}
   • Reason / Notes: ${damageReason}
------------------------------------------------
TOTAL FINE:     ₹${(d.fineAmount || 0).toFixed(2)} (${numberToWordsRupees(d.fineAmount)})
Status:         ${d.finePaid ? 'PAID' : 'PENDING DUE'} (${d.paymentMode || 'Cash Desk'})
------------------------------------------------
POLICY CONDITIONS (നിബന്ധനകൾ):
1. Overdue fine is ₹5.00/working day (Sundays excluded).
2. Damage to books incurs repair penalty or replacement cost.
3. Lost or destroyed books must be replaced with original copies.
4. All dues must be cleared before academic/library clearance.
================================================
Authorized by Kuthbukhana Anwariyya Central Library
================================================`;

if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(summary).then(() => {
        if (typeof showPopupAlert === 'function') {
            showPopupAlert('Receipt Copied', 'Fine receipt text summary copied to clipboard successfully!', 'success');
        } else {
            alert('Receipt copied to clipboard!');
        }
    });
} else {
    const textarea = document.createElement('textarea');
    textarea.value = summary;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    alert('Fine receipt text summary copied to clipboard!');
}
}

// Open standalone fine slip page
function openStandaloneFineSlipPage() {
    if (!currentActiveFineSlipData) return;
    sessionStorage.setItem('activeFineSlipData', JSON.stringify(currentActiveFineSlipData));

    const path = window.location.pathname.replace(/\\/g, '/');
    let target = 'fineSlip.html';
    if (path.includes('lead/admin') || path.includes('lead/principal')) {
        target = '../../fineSlip.html';
    } else if (path.includes('subpages')) {
        target = 'fineSlip.html';
    } else {
        target = 'assets/subpages/fineSlip.html';
    }
    window.open(`${target}?id=${encodeURIComponent(currentActiveFineSlipData.receiptNo)}`, '_blank');
}