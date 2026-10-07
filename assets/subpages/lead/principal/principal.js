/**
 * Principal Executive Portal JavaScript Module
 * Kuthbukhana Anwariyya - Library Management System
 */

let principalViewMode = 'cards'; // 'cards' or 'table'

// Helper to fetch categories
function fetchPrincipalCategories() {
    const data = localStorage.getItem('libraryCategories');
    if (!data) return {};
    return JSON.parse(data);
}

function fetchPrincipalBooks() {
    if (typeof getBooksData === 'function') {
        return getBooksData();
    }
    const data = localStorage.getItem('libraryBooks');
    return data ? JSON.parse(data) : {};
}

function fetchPrincipalLedger() {
    if (typeof getLedgerData === 'function') {
        return getLedgerData();
    }
    const data = localStorage.getItem('libraryLedger');
    return data ? JSON.parse(data) : [];
}

// Populate Section Filter Dropdown
function renderPrincipalSectionOptions() {
    const categories = fetchPrincipalCategories();
    const filterSelect = document.getElementById('principalSectionFilter');
    if (!filterSelect) return;

    const curVal = filterSelect.value || 'all';
    const keys = Object.keys(categories);

    filterSelect.innerHTML = `<option value="all">All Library Sections</option>` +
        keys.map(code => `<option value="${code}">${categories[code]} (${code})</option>`).join('');
    
    filterSelect.value = curVal;
}

// Render Executive Dashboard KPI Cards & Book Availability List
function renderPrincipalView() {
    const books = fetchPrincipalBooks();
    const categories = fetchPrincipalCategories();

    const bookList = Object.keys(books).map(id => ({ id, ...books[id] }));
    const totalBooks = bookList.length;
    const holdCount = bookList.filter(b => b.status === 'Admin Hold' || b.issuedTo === 'Admin Hold Reserved' || b.issuedTo === 'Admin Hold').length;
    const issuedCount = bookList.filter(b => b.status === 'Issued' && b.issuedTo !== 'Admin Hold Reserved' && b.issuedTo !== 'Admin Hold').length;
    const inStockCount = bookList.filter(b => b.status === 'Available').length;

    // Update KPI metric elements
    const totalEl = document.getElementById('principalTotalBooks');
    const inStockEl = document.getElementById('principalInStock');
    const issuedEl = document.getElementById('principalIssuedCount');
    const holdEl = document.getElementById('principalHoldCount');

    if (totalEl) totalEl.innerText = totalBooks;
    if (inStockEl) inStockEl.innerText = inStockCount;
    if (issuedEl) issuedEl.innerText = issuedCount;
    if (holdEl) holdEl.innerText = holdCount;

    // Filter list
    const searchInput = document.getElementById('principalSearchInput')?.value?.toLowerCase() || '';
    const sectionFilter = document.getElementById('principalSectionFilter')?.value || 'all';
    const statusFilter = document.getElementById('principalStatusFilter')?.value || 'all';

    const filteredList = bookList.filter(b => {
        const matchesSearch = !searchInput || 
            b.id.toLowerCase().includes(searchInput) ||
            b.title.toLowerCase().includes(searchInput) ||
            (b.author && b.author.toLowerCase().includes(searchInput));

        const matchesSection = sectionFilter === 'all' || 
            (b.section && b.section.toUpperCase() === sectionFilter.toUpperCase()) ||
            (b.id.toUpperCase().startsWith(sectionFilter.toUpperCase()));

        const matchesStatus = statusFilter === 'all' || b.status === statusFilter;

        return matchesSearch && matchesSection && matchesStatus;
    });

    const resultsBadge = document.getElementById('principalResultsBadge');
    if (resultsBadge) {
        resultsBadge.innerText = `${filteredList.length} of ${totalBooks} Books Loaded`;
    }

    if (principalViewMode === 'cards') {
        renderCardsView(filteredList, categories);
    } else {
        renderTableView(filteredList, categories);
    }
}

// Render Book Cards View
function renderCardsView(list, categories) {
    const cardsContainer = document.getElementById('principalCardsContainer');
    const tableCard = document.getElementById('principalTableCard');

    if (cardsContainer) cardsContainer.style.display = 'flex';
    if (tableCard) tableCard.style.display = 'none';

    if (!cardsContainer) return;

    if (list.length === 0) {
        cardsContainer.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="bi bi-search fs-1 text-primary opacity-50 d-block mb-3"></i>
                <h5 class="fw-bold text-dark">No books match your search term</h5>
                <p class="text-muted">Try searching with a different book title, author, or accession number.</p>
                <button class="btn btn-outline-primary rounded-pill px-4" onclick="clearPrincipalSearch()">Reset Search</button>
            </div>
        `;
        return;
    }

    cardsContainer.innerHTML = list.map(b => {
        const hasValidCover = b.cover && !b.cover.includes('placeholder') && (b.cover.startsWith('data:') || b.cover.startsWith('http'));
        const secName = b.sectionName || categories[b.section] || 'General';

        let statusHtml = '';
        if (b.status === 'Admin Hold' || b.issuedTo === 'Admin Hold Reserved' || b.issuedTo === 'Admin Hold') {
            statusHtml = `<span class="badge badge-principal-status status-hold"><i class="bi bi-shield-lock-fill"></i> ⛔ ADMIN HOLD</span>`;
        } else if (b.status === 'Issued') {
            statusHtml = `<span class="badge badge-principal-status status-issued"><i class="bi bi-x-circle-fill"></i> OUT OF STOCK</span>`;
        } else {
            statusHtml = `<span class="badge badge-principal-status status-in-stock"><i class="bi bi-check-circle-fill"></i> IN STOCK (AVAILABLE)</span>`;
        }

        return `
            <div class="col-xl-4 col-md-6">
                <div class="book-avail-card p-3">
                    <div class="d-flex gap-3 align-items-start mb-3">
                        ${hasValidCover ?
                            `<img src="${b.cover}" alt="Cover" class="book-avail-cover" onerror="this.onerror=null; this.outerHTML='<div class=\\'book-avail-placeholder\\'><i class=\\'bi bi-book fs-4 mb-1\\'></i><span>${b.section || 'BOOK'}</span></div>';">` :
                            `<div class="book-avail-placeholder">
                                <i class="bi bi-book fs-4 mb-1"></i>
                                <span>${b.section || 'BOOK'}</span>
                            </div>`
                        }
                        <div class="flex-grow-1 overflow-hidden">
                            <div class="d-flex align-items-center gap-2 mb-1">
                                <code class="bg-light text-dark font-monospace fw-bold px-2 py-1 rounded border small">${b.id}</code>
                                <span class="badge bg-secondary opacity-75" style="font-size: 0.72rem;">${b.section || 'GEN'}</span>
                            </div>
                            <h5 class="fw-bold text-dark mb-1 text-truncate" title="${b.title}">${b.title}</h5>
                            <p class="text-muted small mb-2 text-truncate"><i class="bi bi-person me-1"></i>${b.author || 'General'}</p>
                            ${statusHtml}
                        </div>
                    </div>

                    <div class="bg-light p-2.5 rounded-3 border mt-auto text-dark small">
                        ${b.status === 'Issued' ?
                            `<div class="d-flex align-items-center justify-content-between">
                                <span class="fw-semibold text-danger"><i class="bi bi-person-badge me-1"></i>Borrower:</span>
                                <span class="fw-bold text-dark text-truncate ms-2">${b.issuedTo || 'Issued'}</span>
                             </div>` :
                            (b.status === 'Admin Hold' ?
                                `<div class="d-flex align-items-center justify-content-between">
                                    <span class="fw-semibold text-warning"><i class="bi bi-shield-exclamation me-1"></i>Notice:</span>
                                    <span class="fw-bold text-dark">Hold by Admin</span>
                                 </div>` :
                                `<div class="d-flex align-items-center justify-content-between">
                                    <span class="fw-semibold text-success"><i class="bi bi-geo-alt me-1"></i>Location:</span>
                                    <span class="fw-bold text-dark">[${b.section || 'GEN'}] ${secName}</span>
                                 </div>`
                            )
                        }
                    </div>

                    <div class="mt-3 text-end">
                        <button class="btn btn-sm btn-outline-primary fw-semibold rounded-pill px-3" onclick="openBorrowerDetailsModal('${b.id}')">
                            <i class="bi bi-info-circle me-1"></i> View Full Details
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Render Book Table View
function renderTableView(list, categories) {
    const cardsContainer = document.getElementById('principalCardsContainer');
    const tableCard = document.getElementById('principalTableCard');
    const tbody = document.getElementById('principalTableBody');

    if (cardsContainer) cardsContainer.style.display = 'none';
    if (tableCard) tableCard.style.display = 'block';

    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No books match search criteria.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map((b, idx) => {
        const hasValidCover = b.cover && !b.cover.includes('placeholder') && (b.cover.startsWith('data:') || b.cover.startsWith('http'));

        let statusBadge = '';
        if (b.status === 'Admin Hold' || b.issuedTo === 'Admin Hold Reserved' || b.issuedTo === 'Admin Hold') {
            statusBadge = `<span class="badge badge-principal-status status-hold"><i class="bi bi-shield-lock-fill"></i> ⛔ ADMIN HOLD</span>`;
        } else if (b.status === 'Issued') {
            statusBadge = `<span class="badge badge-principal-status status-issued"><i class="bi bi-x-circle-fill"></i> OUT OF STOCK</span>`;
        } else {
            statusBadge = `<span class="badge badge-principal-status status-in-stock"><i class="bi bi-check-circle-fill"></i> IN STOCK</span>`;
        }

        return `
            <tr>
                <td class="text-muted fw-bold">${idx + 1}</td>
                <td>
                    ${hasValidCover ? 
                        `<img src="${b.cover}" alt="Cover" class="rounded shadow-sm" style="width: 40px; height: 56px; object-fit: cover;">` :
                        `<div class="bg-secondary text-white rounded d-flex align-items-center justify-content-center fw-bold small" style="width: 40px; height: 56px;">${b.section || 'BOOK'}</div>`
                    }
                </td>
                <td><code>${b.id}</code></td>
                <td><span class="badge bg-secondary">[${b.section || 'GEN'}] ${b.sectionName || categories[b.section] || 'General'}</span></td>
                <td class="fw-bold text-dark">${b.title}</td>
                <td class="text-secondary">${b.author || 'General'}</td>
                <td>${statusBadge}</td>
                <td>
                    ${b.status === 'Issued' ? 
                        `<span class="fw-bold text-dark">${b.issuedTo || 'Issued'}</span>` : 
                        (b.status === 'Admin Hold' ? `<span class="text-warning fw-bold">Admin Reserved</span>` : `<span class="text-success fw-bold">On Shelf</span>`)
                    }
                    <button class="btn btn-sm btn-link text-primary p-0 ms-2" onclick="openBorrowerDetailsModal('${b.id}')">Details</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Switch View Mode (Cards vs Table)
function switchPrincipalViewMode(mode) {
    principalViewMode = mode;
    const btnCards = document.getElementById('btnViewCards');
    const btnTable = document.getElementById('btnViewTable');

    if (mode === 'cards') {
        if (btnCards) btnCards.classList.add('active');
        if (btnTable) btnTable.classList.remove('active');
    } else {
        if (btnCards) btnCards.classList.remove('active');
        if (btnTable) btnTable.classList.add('active');
    }

    renderPrincipalView();
}

// Reset Search Inputs
function clearPrincipalSearch() {
    const input = document.getElementById('principalSearchInput');
    const secSelect = document.getElementById('principalSectionFilter');
    const statSelect = document.getElementById('principalStatusFilter');

    if (input) input.value = '';
    if (secSelect) secSelect.value = 'all';
    if (statSelect) statSelect.value = 'all';

    renderPrincipalView();
}

// Borrower Details Modal
function openBorrowerDetailsModal(bookId) {
    const books = fetchPrincipalBooks();
    const ledger = fetchPrincipalLedger();
    const book = books[bookId];

    if (!book) return;

    const modalBody = document.getElementById('principalBorrowerModalBody');
    if (!modalBody) return;

    // Search ledger for transaction records of this book
    const history = ledger.filter(r => String(r.bookId) === String(bookId));

    let html = `
        <div class="text-center mb-4">
            <img src="${book.cover}" class="rounded shadow border mb-2" style="width: 100px; height: 140px; object-fit: cover;" onerror="this.src='https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=100';">
            <h5 class="fw-bold text-dark mb-1">${book.title}</h5>
            <p class="text-muted small mb-0">Author: ${book.author || 'General'} | Accession Code: <code>${bookId}</code></p>
        </div>

        <div class="p-3 rounded-3 border mb-3 ${book.status === 'Available' ? 'bg-success bg-opacity-10 border-success' : (book.status === 'Issued' ? 'bg-danger bg-opacity-10 border-danger' : 'bg-warning bg-opacity-10 border-warning')}">
            <h6 class="fw-bold mb-1">
                ${book.status === 'Available' ? '🟢 Current Status: In Stock (Available on Shelf)' :
                    (book.status === 'Issued' ? '🔴 Current Status: Out of Stock (Issued)' : '⛔ Current Status: Reserved under Admin Hold')
                }
            </h6>
            ${book.status === 'Issued' ? `<p class="mb-0 small text-dark"><strong>Issued To:</strong> ${book.issuedTo} | <strong>Issue Date:</strong> ${book.issueDate || 'Recent'}</p>` : ''}
            ${book.status === 'Admin Hold' ? `<p class="mb-0 small text-dark">This book is currently placed on hold by the library administration.</p>` : ''}
        </div>

        <h6 class="fw-bold text-dark mb-2"><i class="bi bi-clock-history me-1"></i> Transaction History Log (${history.length}):</h6>
    `;

    if (history.length === 0) {
        html += `<p class="text-muted small p-2 bg-light rounded text-center">No previous ledger transactions recorded for this book.</p>`;
    } else {
        html += `
            <div class="table-responsive" style="max-height: 200px; overflow-y: auto;">
                <table class="table table-sm border align-middle small">
                    <thead class="table-light">
                        <tr>
                            <th>Student</th>
                            <th>Class</th>
                            <th>Issue Date</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${history.map(r => `
                            <tr>
                                <td><strong>${r.studentName}</strong> (Roll #${r.rollNo})</td>
                                <td>${r.classDiv || '-'}</td>
                                <td>${r.issueDate || '-'}</td>
                                <td><span class="badge ${r.status === 'Returned' ? 'bg-success' : 'bg-danger'}">${r.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    modalBody.innerHTML = html;

    const modalEl = document.getElementById('principalBorrowerModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

// Print Executive Report Window
function printExecutiveReport() {
    const books = fetchPrincipalBooks();
    const bookList = Object.keys(books).map(id => ({ id, ...books[id] }));
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const printWin = window.open('', '_blank');
    printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Executive Library Stock & Availability Report - ${dateStr}</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #1e293b; }
                .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
                .header h2 { margin: 0; color: #2563eb; font-size: 24px; font-weight: 800; }
                .header p { margin: 6px 0 0 0; color: #475569; font-size: 15px; font-weight: 600; }
                .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; color: #64748b; background: #f8fafc; padding: 12px 18px; border-radius: 8px; border: 1px solid #e2e8f0; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
                th, td { border: 1px solid #cbd5e1; padding: 9px 12px; text-align: left; }
                th { background-color: #2563eb; color: white; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
                tr:nth-child(even) { background-color: #f8fafc; }
                .btn-print { background: #059669; color: white; border: none; padding: 10px 20px; font-size: 14px; font-weight: bold; border-radius: 8px; cursor: pointer; margin-bottom: 20px; box-shadow: 0 4px 10px rgba(5, 150, 105, 0.2); }
                @media print { .btn-print { display: none; } }
            </style>
        </head>
        <body>
            <button class="btn-print" onclick="window.print()">🖨️ Print Executive Report / Save as PDF</button>
            <div class="header">
                <h2>Kuthbukhana Anwariyya Library Management System</h2>
                <p>Principal & Executive Book Availability Report</p>
            </div>
            <div class="meta">
                <span><strong>Report Date:</strong> ${dateStr}</span>
                <span><strong>Total Books Cataloged:</strong> ${bookList.length}</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Book ID</th>
                        <th>Section</th>
                        <th>Book Title</th>
                        <th>Author</th>
                        <th>Availability Status</th>
                        <th>Borrower / Reserved Info</th>
                    </tr>
                </thead>
                <tbody>
                    ${bookList.map((b, idx) => `
                        <tr>
                            <td>${idx + 1}</td>
                            <td><strong>${b.id}</strong></td>
                            <td>[${b.section || 'GEN'}] ${b.sectionName || 'General'}</td>
                            <td>${b.title}</td>
                            <td>${b.author || '-'}</td>
                            <td><strong>${b.status}</strong></td>
                            <td>${b.issuedTo || 'On Shelf'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `);
    printWin.document.close();
    setTimeout(() => { printWin.print(); }, 500);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    renderPrincipalSectionOptions();
    renderPrincipalView();
});
