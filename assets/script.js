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
    fetch(`${API_BASE_URL}/api/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(books)
    }).catch(err => console.warn('Failed to sync books to backend REST API:', err));
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
    } catch(e) {
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
            bookCoverImg.onerror = function() {
                this.onerror = function() {
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
    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);

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
    cur.setHours(0,0,0,0);

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
    const newRecord = {
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
    };
    ledger.unshift(newRecord);
    saveLedgerData(ledger);

    // Refresh preview card
    handleBookInput(bookId);

    const wantPrint = await showPopupConfirm(
        '✅ BOOK ISSUED SUCCESSFULLY!',
        `Book: "${bookTitle}"\nIssued To: ${studentName} (Roll #${rollNo}, Class ${classDiv || 'N/A'})\nIssue Date: ${todayStr}\nDue Date: ${dueDateStr} (${allowedWorkingWeeks} Working Week(s) / ${allowedWorkingDays} Working Days allowed)\n\nBorrowing Limit: ${activeIssuedForStudent.length + 1} of ${maxAllowedBooks} book(s) used.\n\nWould you like to print the Issue Slip now?`,
        'success',
        '🖨️ Print Issue Slip',
        'Close'
    );

    if (wantPrint) {
        openPrintSlipModal(newRecord);
    }
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
    const staffRecord = {
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
    };
    ledger.unshift(staffRecord);
    saveLedgerData(ledger);

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

    const wantPrint = await showPopupConfirm(
        '✅ STAFF CHECKOUT SUCCESSFUL!',
        `Staff Member: ${staffName}\nDepartment: ${staffDept}\nBook Title: "${book.title}"\nDate: ${todayStr}\n\nInventory Status is now: OUT OF STOCK (Issued to Staff).\n\nWould you like to print the Staff Issue Slip now?`,
        'success',
        '🖨️ Print Staff Slip',
        'Close'
    );

    if (wantPrint) {
        openPrintSlipModal(staffRecord);
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

    const returnRecord = record || {
        id: Date.now(),
        rollNo: 'N/A',
        studentName: previousBorrower,
        classDiv: 'N/A',
        bookId: bookId,
        bookTitle: book.title,
        author: book.author || 'General',
        issueDate: issueDateStr,
        dueDate: book.dueDate,
        returnDate: todayStr,
        status: "Returned",
        fineAmount: fineInfo.fineAmount,
        finePaid: fineCollected
    };

    // Refresh preview card
    handleBookInput(bookId);

    const wantPrint = await showPopupConfirm(
        '✅ BOOK RETURNED SUCCESSFULLY!',
        `Book: "${book.title}"\nReturned By: ${previousBorrower}\nReturn Date: ${todayStr}${fineMsg}\n\nInventory Status is now: IN STOCK (Available for re-issue).\n\nWould you like to print the Return Receipt Slip now?`,
        'success',
        '🖨️ Print Return Slip',
        'Close'
    );

    if (wantPrint) {
        openPrintSlipModal(returnRecord);
    }
}

// ==========================================
// INSTANT BARCODE & DOCUMENT (AAVANAM) AUTO-SCAN SYSTEM
// ==========================================

// Audio Sound Cue for Barcode Scan
function playBarcodeScanSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1800, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
    } catch(e){}
}

let lastScannedBarcode = '';
let lastScannedTime = 0;

// Universal Instant Barcode / QR Scan Processor
function processInstantBarcodeScan(scannedCode, source = 'USB QR Reader') {
    if (!scannedCode) return;
    const cleanCode = String(scannedCode).trim();
    if (!cleanCode) return;

    // Hyper-fast 400ms cooldown for identical QR code
    const now = Date.now();
    if (cleanCode === lastScannedBarcode && (now - lastScannedTime) < 400) {
        return;
    }
    lastScannedBarcode = cleanCode;
    lastScannedTime = now;

    // 1. Play Instant Scan Audio Beep
    playBarcodeScanSound();

    // 2. Flash Webcam Scanner Frame if active
    const inlineReader = document.getElementById('inlineReader');
    if (inlineReader) {
        inlineReader.classList.add('scan-flash-active');
        setTimeout(() => {
            inlineReader.classList.remove('scan-flash-active');
        }, 350);
    }

    // 3. Document / Book Lookup in Data Store
    const books = getBooksData();
    const book = books[cleanCode];
    const bookTitle = book ? book.title : `Book / Document #${cleanCode}`;
    const bookAuthor = book ? (book.author || 'Catalog Document') : 'Accession Record';
    const bookStatus = book ? (book.status || 'Available') : 'Available';

    // 4. Render Floating Instant Scan Toast Banner
    showInstantBarcodeToast(cleanCode, bookTitle, bookAuthor, bookStatus, source);

    // 5. Auto-Fill Open Library Circulation Station
    const bookIdInput = document.getElementById('bookIdInput');
    if (bookIdInput) {
        bookIdInput.value = cleanCode;
        handleBookInput(cleanCode);

        // Auto-scroll to preview book card
        const previewCard = document.getElementById('bookCoverCard');
        if (previewCard && previewCard.style.display !== 'none') {
            previewCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    // 6. Auto-Fill Return Modal Input if active
    const returnInput = document.getElementById('returnBookIdInput') || document.getElementById('returnAccessionInput');
    if (returnInput) {
        returnInput.value = cleanCode;
        if (typeof handleReturnBookLookup === 'function') {
            handleReturnBookLookup(cleanCode);
        }
    }

    // 7. Auto-Fill Book Search Modal Input if active
    const searchModalInput = document.getElementById('bookCatalogSearchInput');
    if (searchModalInput) {
        searchModalInput.value = cleanCode;
        if (typeof performCatalogSearch === 'function') {
            performCatalogSearch(cleanCode);
        }
    }

    // 8. Auto-Fill Admin Barcode Preview Field if active
    const adminBarcodeField = document.getElementById('newBookId') || document.getElementById('adminBookSearch');
    if (adminBarcodeField) {
        adminBarcodeField.value = cleanCode;
        if (typeof updateLiveBookBarcodePreview === 'function') {
            updateLiveBookBarcodePreview();
        }
    }
}

// Render Instant Scanned Toast Notification
function showInstantBarcodeToast(code, title, author, status, source) {
    let container = document.getElementById('instantBarcodeToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'instantBarcodeToastContainer';
        container.className = 'instant-barcode-toast-container';
        document.body.appendChild(container);
    }

    let statusBadgeClass = 'bg-success';
    let statusText = 'Available (In Stock)';
    if (status === 'Admin Hold') {
        statusBadgeClass = 'bg-danger';
        statusText = '⛔ Admin Hold';
    } else if (status === 'Issued') {
        statusBadgeClass = 'bg-warning text-dark';
        statusText = '⚠️ Issued';
    }

    const toastHtml = `
        <div class="instant-barcode-toast">
            <div class="d-flex align-items-center justify-content-between mb-2">
                <span class="badge bg-primary text-white font-monospace">
                    <i class="bi bi-qr-code-scan me-1"></i> ${source}
                </span>
                <span class="badge ${statusBadgeClass}">${statusText}</span>
            </div>
            <div class="d-flex align-items-start gap-2">
                <div class="bg-primary text-white p-2 rounded-3 fs-4 d-flex align-items-center justify-content-center" style="width:40px; height:40px; min-width:40px;">
                    <i class="bi bi-qr-code"></i>
                </div>
                <div class="flex-grow-1 overflow-hidden">
                    <div class="fw-bold text-dark text-truncate fs-6">${title}</div>
                    <div class="small text-muted text-truncate"><i class="bi bi-person me-1"></i>${author} | Accession #${code}</div>
                </div>
            </div>
            <div class="mt-2 pt-2 border-top d-flex justify-content-between align-items-center">
                <small class="text-success fw-bold d-flex align-items-center gap-1">
                    <i class="bi bi-check-circle-fill"></i> Instant Scan Synced
                </small>
                <button type="button" class="btn-close btn-sm" onclick="this.closest('.instant-barcode-toast').remove()"></button>
            </div>
        </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = toastHtml;
    const toastEl = wrapper.firstElementChild;
    container.appendChild(toastEl);

    setTimeout(() => {
        if (toastEl && toastEl.parentNode) {
            toastEl.style.opacity = '0';
            toastEl.style.transform = 'translateY(-10px)';
            toastEl.style.transition = 'all 0.3s ease';
            setTimeout(() => toastEl.remove(), 300);
        }
    }, 4500);
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
            modeBadge.className = 'badge bg-primary fs-6 scan-pulse-badge';
            modeBadge.innerHTML = '<i class="bi bi-qr-code-scan me-1"></i> Mode: QR Code Scanner Active';
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
                    inlineQrCode = new Html5Qrcode("inlineReader", {
                        verbose: false,
                        experimentalFeatures: {
                            useBarCodeDetectorIfSupported: true
                        }
                    });
                }

                // Square 1:1 ratio qrbox for fast 2D QR Code detection
                const qrboxFunction = function(viewfinderWidth, viewfinderHeight) {
                    const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                    const boxSize = Math.floor(minEdge * 0.80);
                    return { width: Math.max(boxSize, 200), height: Math.max(boxSize, 200) };
                };

                inlineQrCode.start(
                    { facingMode: "environment" },
                    { 
                        fps: 30, 
                        qrbox: qrboxFunction,
                        aspectRatio: 1.0,
                        videoConstraints: {
                            focusMode: "continuous"
                        }
                    },
                    (decodedText) => {
                        processInstantBarcodeScan(decodedText, 'Camera QR Scanner');
                    },
                    () => {}
                ).catch(err => {
                    const errDiv = document.getElementById('inlineScannerError');
                    if (errDiv) {
                        errDiv.style.display = 'block';
                        errDiv.innerHTML = "<i class='bi bi-info-circle me-1'></i> <strong>Camera scanner notice:</strong> Webcam inactive or permission pending. Hardware USB Barcode/QR Readers scan automatically!";
                    }
                });
            }
        } catch (e) {}
    }, 200);
}

function stopInlineScanner() {
    if (inlineQrCode && inlineQrCode.isScanning) {
        inlineQrCode.stop().catch(e => {});
    }
}

function simulateScan(code) {
    processInstantBarcodeScan(code, 'Simulated Scan');
}

// Hardware USB / Bluetooth Barcode Scanner Keystroke Listener
let barcodeBuffer = '';
let barcodeTimeout = null;

document.addEventListener('keydown', (e) => {
    const activeEl = document.activeElement;
    const isSpecialInput = activeEl && (activeEl.id === 'studentNameInput' || activeEl.id === 'classDivInput' || activeEl.id === 'rollNoInput' || activeEl.tagName === 'TEXTAREA');

    if (isSpecialInput) return;

    // F2 Shortcut for Instant Barcode Scan Trigger
    if (e.key === 'F2') {
        e.preventDefault();
        const modeBarcodeRadio = document.getElementById('modeBarcode');
        if (modeBarcodeRadio) {
            modeBarcodeRadio.checked = true;
            switchEntryMode('barcode');
        }
        return;
    }

    if (e.key === 'Enter') {
        if (barcodeBuffer.length >= 1) {
            const scannedCode = barcodeBuffer.trim();
            barcodeBuffer = '';
            processInstantBarcodeScan(scannedCode, 'USB Barcode Reader');
        }
    } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
        clearTimeout(barcodeTimeout);
        barcodeTimeout = setTimeout(() => {
            barcodeBuffer = '';
        }, 250);
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
    } catch(e){}

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
            : (item.dueDate ? `${item.dueDate} (${allowedDays/7} wk)` : (allowedDays ? `${allowedDays} Days` : '-'));

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
                <td class="text-center">
                    <button type="button" class="btn btn-sm btn-outline-primary fw-bold py-1 px-2.5 shadow-sm" onclick="printLedgerSlip('${item.id}')" title="Print Issue / Return Slip Receipt">
                        <i class="bi bi-printer-fill me-1"></i> Slip
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ==========================================
// PRINT SLIP TRANSACTION RECEIPT ENGINE
// ==========================================

function renderPrintSlipHTML(item) {
    if (!item) return '';

    const isStaffUse = item.rollNo === 'STAFF' || (item.status && item.status.includes('Staff'));
    const isReturned = item.status === 'Returned';
    const booksObj = getBooksData();
    const categoriesObj = getCategoriesData();
    const bookInfo = booksObj[item.bookId] || {};
    
    const author = item.author || bookInfo.author || 'Unknown Author';
    const section = item.section || bookInfo.sectionName || categoriesObj[bookInfo.section] || bookInfo.section || 'General Section';
    const logoUrl = getCollegeLogoUrl();
    const printDateStr = new Date().toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
    }).toUpperCase();

    const pnrNo = `PNR-${String(item.id || Date.now()).slice(-8)}`;
    const ticketClass = isStaffUse ? 'FACULTY PASS' : 'STUDENT CLASS';
    const txnType = isReturned ? 'RETURN CLEARANCE' : 'BOOK ISSUE PASS';

    const fineText = (isReturned && item.fineAmount > 0) 
        ? `RS. ${item.fineAmount}.00 (PAID)`
        : ((!isReturned && !isStaffUse && item.issueDate) 
            ? `RS. 5.00 / DAY OVERDUE` 
            : `RS. 0.00 [CLEAR]`);

    const qrCodeSvg = (typeof renderBookBarcode === 'function') 
        ? renderBookBarcode(item.bookId || '000', { height: 72, fontSize: 8 }) 
        : `<div class="font-monospace fw-bold">${item.bookId}</div>`;

    return `
        <div class="train-ticket-wrapper">
            <div class="train-ticket-card">
                
                <!-- Ticket Top Banner Header -->
                <div class="ticket-header-ribbon">
                    <div class="d-flex align-items-center gap-2">
                        <img src="${logoUrl}" alt="Logo" class="ticket-logo-img" onerror="this.onerror=null;this.style.display='none'">
                        <div>
                            <div class="ticket-title-main">KUTHBUKHANA ANWARIYYA TRANSIT PASS</div>
                            <div class="ticket-sub-title">DEPARTMENT OF LIBRARY CIRCULATION SERVICES</div>
                        </div>
                    </div>
                    <div class="ticket-pnr-box text-end">
                        <div class="ticket-pnr-label">TICKET PNR / NO:</div>
                        <div class="ticket-pnr-val">${pnrNo}</div>
                    </div>
                </div>

                <!-- Main Ticket Body (Split Layout: Journey Data + QR Verification Stub) -->
                <div class="ticket-body-grid">
                    
                    <!-- Left Section: Transit & Passenger Particulars -->
                    <div class="ticket-main-section">
                        
                        <!-- Row 1: Dates & Class -->
                        <div class="ticket-data-row">
                            <div class="ticket-field">
                                <span class="t-label">ISSUE DATE/TIME:</span>
                                <span class="t-val fw-bold">${printDateStr}</span>
                            </div>
                            <div class="ticket-field">
                                <span class="t-label">${isReturned ? 'RETURN DATE:' : 'VALID UPTO / DUE:'}</span>
                                <span class="t-val fw-bold ${isReturned ? 'text-success' : 'text-danger'}">${isReturned ? (item.returnDate || 'RETURNED') : (item.dueDate || 'UNLIMITED')}</span>
                            </div>
                            <div class="ticket-field">
                                <span class="t-label">CLASS / TYPE:</span>
                                <span class="t-val fw-bold">${ticketClass}</span>
                            </div>
                        </div>

                        <!-- Row 2: Borrower Passenger Info -->
                        <div class="ticket-data-row highlight-bg">
                            <div class="ticket-field flex-2">
                                <span class="t-label">PASSENGER / BORROWER:</span>
                                <span class="t-val fw-bold fs-6">${(item.studentName || 'N/A').toUpperCase()}</span>
                            </div>
                            <div class="ticket-field">
                                <span class="t-label">REG / ROLL NO:</span>
                                <span class="t-val font-monospace fw-bold">${item.rollNo || '-'}</span>
                            </div>
                            <div class="ticket-field">
                                <span class="t-label">CLASS / DEPT:</span>
                                <span class="t-val">${(item.classDiv || (isStaffUse ? 'STAFF DEPT' : 'GENERAL')).toUpperCase()}</span>
                            </div>
                        </div>

                        <!-- Row 3: Publication / Book Details -->
                        <div class="ticket-data-row">
                            <div class="ticket-field flex-2">
                                <span class="t-label">BOOK ACCESSION & TITLE:</span>
                                <span class="t-val fw-bold text-primary">[#${item.bookId}] ${(item.bookTitle || 'LIBRARY BOOK').toUpperCase()}</span>
                            </div>
                            <div class="ticket-field">
                                <span class="t-label">AUTHOR:</span>
                                <span class="t-val">${author.toUpperCase()}</span>
                            </div>
                        </div>

                        <!-- Row 4: Route / Station & Charges -->
                        <div class="ticket-data-row">
                            <div class="ticket-field">
                                <span class="t-label">FROM STATION:</span>
                                <span class="t-val">CENTRAL LIBRARY</span>
                            </div>
                            <div class="ticket-field">
                                <span class="t-label">TRANSIT STATUS:</span>
                                <span class="t-val fw-bold text-success">${txnType}</span>
                            </div>
                            <div class="ticket-field">
                                <span class="t-label">FARE / FINE CHARGE:</span>
                                <span class="t-val fw-bold">${fineText}</span>
                            </div>
                        </div>

                        <div class="ticket-footer-text">
                            *** WISHING YOU A HAPPY TRANSIT & ENRICHING READING JOURNEY! PLEASE RETAIN PASS ***
                        </div>

                    </div>

                    <!-- Right Section: Verification Stub with Cut Line & QR Code -->
                    <div class="ticket-stub-section">
                        <div class="stub-notch-top"></div>
                        <div class="stub-header">VERIFICATION STUB</div>
                        <div class="stub-qr-box my-1">
                            ${qrCodeSvg}
                        </div>
                        <div class="stub-acc-id">ID: #${item.bookId}</div>
                        <div class="stub-seal-text">OFFICIALLY ISSUED</div>
                        <div class="stub-notch-bottom"></div>
                    </div>

                </div>

            </div>
        </div>
    `;
}

function openPrintSlipModal(item) {
    if (!item) return;

    let modalOverlay = document.getElementById('printSlipModalOverlay');
    if (!modalOverlay) {
        modalOverlay = document.createElement('div');
        modalOverlay.id = 'printSlipModalOverlay';
        modalOverlay.className = 'custom-modal-overlay';
        modalOverlay.style.zIndex = '999999';
        document.body.appendChild(modalOverlay);
    }

    const slipContent = renderPrintSlipHTML(item);

    modalOverlay.innerHTML = `
        <div class="custom-modal-box" style="max-width: 680px; width: 95%;">
            <div class="custom-modal-header bg-primary text-white p-3 rounded-top d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-printer-fill fs-4"></i>
                    <h5 class="fw-bold mb-0 text-white">Library Transaction Print Slip</h5>
                </div>
                <button type="button" class="btn-close btn-close-white" onclick="closePrintSlipModal()"></button>
            </div>
            <div class="custom-modal-body p-3 bg-light" style="max-height: 75vh; overflow-y: auto;">
                ${slipContent}
            </div>
            <div class="custom-modal-footer bg-white p-3 d-flex justify-content-between align-items-center border-top">
                <button type="button" class="btn btn-secondary fw-semibold" onclick="closePrintSlipModal()">Close</button>
                <button type="button" class="btn btn-success fw-bold px-4 shadow-sm" onclick="executePrintSlipFromModal()">
                    <i class="bi bi-printer-fill me-1"></i> Print Slip / Save PDF
                </button>
            </div>
        </div>
    `;

    window._activePrintSlipItem = item;
    modalOverlay.classList.add('active');
}

function closePrintSlipModal() {
    const modalOverlay = document.getElementById('printSlipModalOverlay');
    if (modalOverlay) {
        modalOverlay.classList.remove('active');
    }
}

function executePrintSlipFromModal() {
    const item = window._activePrintSlipItem;
    if (!item) return;

    let printArea = document.getElementById('printableSlipArea');
    if (!printArea) {
        printArea = document.createElement('div');
        printArea.id = 'printableSlipArea';
        document.body.appendChild(printArea);
    }

    printArea.innerHTML = renderPrintSlipHTML(item);

    setTimeout(() => {
        window.print();
    }, 200);
}

function printLedgerSlip(recordId) {
    const ledger = getLedgerData();
    const item = ledger.find(r => String(r.id) === String(recordId));
    if (!item) {
        showPopupAlert('Record Not Found', 'Could not find transaction record for printing slip!', 'warning');
        return;
    }
    openPrintSlipModal(item);
}

function printLastTransactionSlip() {
    const ledger = getLedgerData();
    if (!ledger || ledger.length === 0) {
        showPopupAlert('No Transactions', 'No circulation transaction records found to print slip!', 'warning');
        return;
    }
    openPrintSlipModal(ledger[0]);
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
                const matched = students.find(s => 
                    String(s.rollNo || s.EnrollNo || '').toLowerCase() === val.toLowerCase() ||
                    String(s.applicationId || '').toLowerCase() === val.toLowerCase()
                );
                if (matched) {
                    const nameInput = document.getElementById('studentNameInput');
                    const classInput = document.getElementById('classDivInput');
                    if (nameInput) nameInput.value = matched.name || matched.Name || matched.studentName || '';
                    if (classInput) {
                        const classVal = matched.classDiv || matched.class || (matched.Course ? `${matched.Course}${matched.CurrentYear ? ' (' + matched.CurrentYear + 'Yr)' : ''}` : 'Shareeath');
                        classInput.value = classVal;
                    }
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
    '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
    '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
    '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
    '212123','212321','212321','111323','131123','131321','112313','132113','132311','211313',
    '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
    '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
    '314111','221411','411131','111224','111422','121124','121421','141122','141221','112214',
    '112412','122114','122411','142112','142211','241211','221114','411122','134111','111242',
    '121142','121241','114212','124112','124211','411212','421112','421211','212141','214121',
    '412121','111143','111341','131141','114113','114311','411113','411311','113141','114131',
    '311141','411131','211412','211214','211232','233111','2331112'
];

// ==========================================
// PURE SVG 2D QR CODE GENERATOR FOR BOOK ACCESSIONS
// ==========================================

function calcReedSolomonECC(dataBytes, eccCount) {
    const gfExp = new Uint8Array(512);
    const gfLog = new Uint8Array(256);
    let x = 1;
    for (let i = 0; i < 255; i++) {
        gfExp[i] = x;
        gfExp[i + 255] = x;
        gfLog[x] = i;
        x <<= 1;
        if (x & 256) x ^= 285;
    }

    function gfMul(a, b) {
        if (a === 0 || b === 0) return 0;
        return gfExp[gfLog[a] + gfLog[b]];
    }

    let gen = [1];
    for (let i = 0; i < eccCount; i++) {
        const nextGen = new Array(gen.length + 1).fill(0);
        for (let j = 0; j < gen.length; j++) {
            nextGen[j] ^= gfMul(gen[j], gfExp[i]);
            nextGen[j + 1] ^= gen[j];
        }
        gen = nextGen;
    }

    const res = new Array(eccCount).fill(0);
    for (const b of dataBytes) {
        const factor = b ^ res[0];
        res.shift();
        res.push(0);
        for (let i = 0; i < eccCount; i++) {
            res[i] ^= gfMul(gen[i], factor);
        }
    }
    return res;
}

function buildQRMatrix(text) {
    const len = text.length;
    let version = 1;
    if (len > 14) version = 2;
    if (len > 26) version = 3;
    const N = 17 + version * 4;

    const matrix = Array.from({ length: N }, () => Array(N).fill(false));
    const isReserved = Array.from({ length: N }, () => Array(N).fill(false));

    function markReserved(r, c, val) {
        matrix[r][c] = val;
        isReserved[r][c] = true;
    }

    // Finder Patterns
    function addFinder(topR, topC) {
        for (let r = -1; r <= 7; r++) {
            for (let c = -1; c <= 7; c++) {
                const mr = topR + r;
                const mc = topC + c;
                if (mr >= 0 && mr < N && mc >= 0 && mc < N) {
                    let isBlack = false;
                    if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
                        if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
                            isBlack = true;
                        }
                    }
                    markReserved(mr, mc, isBlack);
                }
            }
        }
    }

    addFinder(0, 0);
    addFinder(0, N - 7);
    addFinder(N - 7, 0);

    if (version >= 2) {
        const alignPos = version === 2 ? 18 : 22;
        for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
                const isBlack = (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0));
                markReserved(alignPos + r, alignPos + c, isBlack);
            }
        }
    }

    for (let i = 8; i < N - 8; i++) {
        if (!isReserved[6][i]) markReserved(6, i, i % 2 === 0);
        if (!isReserved[i][6]) markReserved(i, 6, i % 2 === 0);
    }
    markReserved(N - 8, 8, true);

    for (let i = 0; i < 9; i++) {
        if (!isReserved[8][i]) isReserved[8][i] = true;
        if (!isReserved[i][8]) isReserved[i][8] = true;
        if (!isReserved[8][N - 1 - i]) isReserved[8][N - 1 - i] = true;
        if (!isReserved[N - 1 - i][8]) isReserved[N - 1 - i][8] = true;
    }

    const bits = [0, 1, 0, 0];
    const countBits = (version <= 9) ? 8 : 16;
    for (let i = countBits - 1; i >= 0; i--) {
        bits.push((len >> i) & 1);
    }
    for (let i = 0; i < len; i++) {
        const code = text.charCodeAt(i);
        for (let b = 7; b >= 0; b--) {
            bits.push((code >> b) & 1);
        }
    }
    while (bits.length % 8 !== 0) bits.push(0);

    const capacityBytes = version === 1 ? 16 : (version === 2 ? 28 : 44);
    const dataBytes = [];
    for (let i = 0; i < bits.length; i += 8) {
        let byteVal = 0;
        for (let b = 0; b < 8; b++) {
            byteVal = (byteVal << 1) | (bits[i + b] || 0);
        }
        dataBytes.push(byteVal);
    }
    const padPatterns = [236, 17];
    let padIdx = 0;
    while (dataBytes.length < capacityBytes) {
        dataBytes.push(padPatterns[padIdx]);
        padIdx = (padIdx + 1) % 2;
    }

    const eccCount = version === 1 ? 10 : (version === 2 ? 16 : 26);
    const eccBytes = calcReedSolomonECC(dataBytes, eccCount);
    const finalCodewords = [...dataBytes, ...eccBytes];

    const allBits = [];
    for (const byteVal of finalCodewords) {
        for (let b = 7; b >= 0; b--) {
            allBits.push((byteVal >> b) & 1);
        }
    }

    let bitIdx = 0;
    let right = N - 1;
    let dir = -1;

    while (right > 0) {
        if (right === 6) right--;
        const col1 = right;
        const col2 = right - 1;
        const rowStart = (dir === -1) ? N - 1 : 0;
        const rowEnd = (dir === -1) ? -1 : N;

        for (let r = rowStart; r !== rowEnd; r += dir) {
            for (const c of [col1, col2]) {
                if (!isReserved[r][c]) {
                    const bit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
                    matrix[r][c] = bit === 1;
                }
            }
        }
        dir = -dir;
        right -= 2;
    }

    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            if (!isReserved[r][c]) {
                if ((r + c) % 2 === 0) {
                    matrix[r][c] = !matrix[r][c];
                }
            }
        }
    }

    const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
    const fmtCoords1 = [
        [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
        [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
    ];
    const fmtCoords2 = [
        [N - 1, 8], [N - 2, 8], [N - 3, 8], [N - 4, 8], [N - 5, 8], [N - 6, 8], [N - 7, 8],
        [8, N - 8], [8, N - 7], [8, N - 6], [8, N - 5], [8, N - 4], [8, N - 3], [8, N - 2], [8, N - 1]
    ];
    for (let i = 0; i < 15; i++) {
        const val = formatBits[i] === 1;
        matrix[fmtCoords1[i][0]][fmtCoords1[i][1]] = val;
        matrix[fmtCoords2[i][0]][fmtCoords2[i][1]] = val;
    }

    return matrix;
}

function generateQRCodeSVG(text, options = {}) {
    const str = String(text || '').trim();
    if (!str) return '<svg width="0" height="0"></svg>';
    const size = options.size || options.height || 70;
    const displayValue = options.displayValue !== false;

    const qrMatrix = buildQRMatrix(str);
    const numModules = qrMatrix.length;
    const margin = 2;
    const viewBoxSize = numModules + margin * 2;

    let pathD = '';
    for (let r = 0; r < numModules; r++) {
        for (let c = 0; c < numModules; c++) {
            if (qrMatrix[r][c]) {
                const x = c + margin;
                const y = r + margin;
                pathD += `M${x},${y}h1v1h-1z `;
            }
        }
    }

    const totalSvgHeight = viewBoxSize + (displayValue ? 3.5 : 0);

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${totalSvgHeight}" width="${size}" height="${displayValue ? Math.round(size * 1.15) : size}" class="book-qr-code-svg">
        <rect width="100%" height="100%" fill="#ffffff" rx="1"/>
        <path d="${pathD}" fill="#0f172a" />
        ${displayValue ? `<text x="${viewBoxSize / 2}" y="${viewBoxSize + 2.8}" font-family="Consolas, monospace" font-size="2.4" font-weight="bold" text-anchor="middle" fill="#0284c7" letter-spacing="0.2px">${str}</text>` : ''}
    </svg>`;
}

/**
 * Generate pure 2D SVG QR Code string for any book code ID.
 */
function renderBookBarcode(codeText, options = {}) {
    const height = options.height || options.size || 70;
    const displayValue = options.displayValue !== false;

    const str = String(codeText || '').trim();
    if (!str) return '<svg width="0" height="0"></svg>';

    return generateQRCodeSVG(str, {
        size: height,
        displayValue: displayValue
    });
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

            <!-- Right Column: White Barcode Stamp Box -->
            <div class="barcode-stamp-box">
                <div class="barcode-stamp-title" title="${bookTitle.replace(/"/g, '&quot;')}">${bookTitle}</div>
                <div class="barcode-stamp-svg">${renderBookBarcode(bookId, { height: 48, fontSize: 8 })}</div>
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

            const bookCode = isbn || (doc.key ? doc.key.replace('/works/', '') : '') || `OL-${Math.floor(Math.random()*10000)}`;
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