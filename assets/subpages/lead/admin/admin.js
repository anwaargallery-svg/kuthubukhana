/**
 * Admin Dashboard JavaScript Module - Kuthbukhana Anwariyya
 * Full-featured SaaS UI with dynamic toast alerts, category chip filters,
 * student directory, and instant inventory management.
 */

var uploadedCoverDataUrl = null;
var editDetailCoverDataUrl = null;
var editCoverDataUrl = null;

// Toast Notifications System
function showAdminToast(message, type = 'success', icon = 'bi-check-circle-fill') {
    let container = document.getElementById('adminToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'adminToastContainer';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `custom-toast toast-${type}`;
    toast.innerHTML = `<i class="bi ${icon} fs-5"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOutToast 0.35s ease forwards';
        setTimeout(() => toast.remove(), 350);
    }, 3200);
}

// Helpers for localStorage state
function fetchAdminCategories() {
    if (typeof getCategoriesData === 'function') {
        return getCategoriesData();
    }
    try {
        const data = localStorage.getItem('libraryCategories');
        if (!data) return {};
        const parsed = JSON.parse(data);
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch (e) {
        return {};
    }
}

function saveAdminCategories(categories) {
    if (typeof saveCategoriesData === 'function') {
        saveCategoriesData(categories);
    } else {
        localStorage.setItem('libraryCategories', JSON.stringify(categories));
        if (typeof cachedBackendData !== 'undefined' && cachedBackendData) {
            cachedBackendData.categories = categories;
        }
        const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : ((window.location.protocol && window.location.protocol.startsWith('http')) ? window.location.origin : 'http://localhost:5000');
        fetch(`${baseUrl}/api/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(categories)
        }).catch(err => console.warn('Failed to sync categories to backend REST API:', err));
    }
}

function fetchAdminBooks() {
    if (typeof getBooksData === 'function') {
        return getBooksData();
    }
    const data = localStorage.getItem('libraryBooks');
    return data ? JSON.parse(data) : {};
}

function saveAdminBooks(books) {
    if (typeof saveBooksData === 'function') {
        saveBooksData(books);
    } else {
        localStorage.setItem('libraryBooks', JSON.stringify(books));
    }
}

function fetchAdminLedger() {
    if (typeof getLedgerData === 'function') {
        return getLedgerData();
    }
    const data = localStorage.getItem('libraryLedger');
    return data ? JSON.parse(data) : [];
}

// Preview uploaded image from device file picker for Add Book Modal
function previewUploadCover(input) {
    const previewContainer = document.getElementById('uploadPreviewContainer');
    const previewImg = document.getElementById('uploadPreviewImg');

    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            uploadedCoverDataUrl = e.target.result;
            if (previewImg) previewImg.src = uploadedCoverDataUrl;
            if (previewContainer) previewContainer.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        uploadedCoverDataUrl = null;
        if (previewContainer) previewContainer.style.display = 'none';
    }
}

// Populate Category Options & Dynamic Quick Filter Chips
function renderCategoryOptions() {
    const categories = fetchAdminCategories();
    const books = fetchAdminBooks();
    const bookList = Object.values(books);
    
    const filterSelect = document.getElementById('adminSectionFilter');
    const newBookSelect = document.getElementById('newBookSection');
    const editBookSelect = document.getElementById('editBookSection');
    const exportSelect = document.getElementById('exportSectionFilter');
    const existingListDiv = document.getElementById('existingCategoriesList');
    const chipsContainer = document.getElementById('categoryChipsContainer');

    const keys = Object.keys(categories);
    const activeSection = filterSelect ? filterSelect.value || 'all' : 'all';

    if (filterSelect) {
        const curVal = filterSelect.value || 'all';
        filterSelect.innerHTML = `<option value="all">All Sections / Categories</option>` +
            keys.map(code => `<option value="${code}">${categories[code]} (${code})</option>`).join('');
        filterSelect.value = curVal;
    }

    if (newBookSelect) {
        const curVal = newBookSelect.value;
        newBookSelect.innerHTML = keys.map(code => `<option value="${code}">${categories[code]} (Code: ${code})</option>`).join('');
        if (curVal && categories[curVal]) newBookSelect.value = curVal;
    }

    if (editBookSelect) {
        const curVal = editBookSelect.value;
        editBookSelect.innerHTML = keys.map(code => `<option value="${code}">${categories[code]} (${code})</option>`).join('');
        if (curVal && categories[curVal]) editBookSelect.value = curVal;
    }

    if (exportSelect) {
        const curVal = exportSelect.value || 'all';
        exportSelect.innerHTML = `<option value="all">All Sections / Categories</option>` +
            keys.map(code => `<option value="${code}">${categories[code]} (${code})</option>`).join('');
        exportSelect.value = curVal;
    }

    // Category Quick Filter Chips
    if (chipsContainer) {
        const allCount = bookList.length;
        let chipsHtml = `
            <div class="category-chip ${activeSection === 'all' ? 'active' : ''}" onclick="quickFilterCategory('all')">
                <span>All Sections</span>
                <span class="count-pill">${allCount}</span>
            </div>
        `;

        keys.forEach(code => {
            const count = bookList.filter(b => 
                (b.section && b.section.toUpperCase() === code.toUpperCase()) ||
                (b.id && b.id.toUpperCase().startsWith(code.toUpperCase()))
            ).length;
            const isActive = activeSection.toUpperCase() === code.toUpperCase();

            chipsHtml += `
                <div class="category-chip ${isActive ? 'active' : ''}" onclick="quickFilterCategory('${code}')">
                    <span>${code}</span>
                    <span class="count-pill">${count}</span>
                </div>
            `;
        });

        chipsContainer.innerHTML = chipsHtml;
    }

    // Render Sections Cards Grid
    const sectionsGrid = document.getElementById('sectionsCardsGrid');
    if (sectionsGrid) {
        const sectionIcons = {
            'SC': 'bi-flask-fill',
            'IS': 'bi-book-half',
            'CS': 'bi-laptop-fill',
            'MATH': 'bi-calculator-fill',
            'LIT': 'bi-journal-bookmark-fill',
            'GEN': 'bi-archive-fill'
        };

        if (keys.length === 0) {
            sectionsGrid.innerHTML = `<div class="col-12"><div class="alert alert-info mb-0">No library sections defined. Click "Add / Manage Sections" to create one.</div></div>`;
        } else {
            sectionsGrid.innerHTML = keys.map(code => {
                const secName = categories[code];
                const secBooks = bookList.filter(b => 
                    (b.section && b.section.toUpperCase() === code.toUpperCase()) ||
                    (b.id && b.id.toUpperCase().startsWith(code.toUpperCase()))
                );
                const totalSec = secBooks.length;
                const availSec = secBooks.filter(b => b.status === 'Available').length;
                const icon = sectionIcons[code] || 'bi-folder-fill';

                return `
                    <div class="col-xl-4 col-md-6">
                        <div class="section-card-item">
                            <div class="d-flex align-items-center justify-content-between mb-3">
                                <div class="d-flex align-items-center gap-3">
                                    <div class="section-card-icon">
                                        <i class="bi ${icon}"></i>
                                    </div>
                                    <div>
                                        <h6 class="fw-bold text-dark mb-0 fs-6">${secName}</h6>
                                        <span class="section-code-pill">Prefix Code: ${code}-xxx</span>
                                    </div>
                                </div>
                            </div>
                            <div class="d-flex justify-content-between align-items-center pt-2 border-top">
                                <div class="small">
                                    <span class="text-muted">Total:</span> <strong class="text-dark me-2">${totalSec}</strong>
                                    <span class="text-success ms-1">In Stock:</span> <strong class="text-success">${availSec}</strong>
                                </div>
                                <div class="d-flex gap-1">
                                    <button class="btn btn-sm btn-outline-primary py-1 px-2 fw-semibold" style="font-size: 0.78rem;" onclick="quickFilterCategory('${code}')">
                                        <i class="bi bi-filter me-1"></i>View
                                    </button>
                                    <button class="btn btn-sm btn-primary py-1 px-2 fw-semibold" style="font-size: 0.78rem;" onclick="openAddBookForSection('${code}')">
                                        <i class="bi bi-plus-lg me-1"></i>Add Book
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    if (existingListDiv) {
        if (keys.length === 0) {
            existingListDiv.innerHTML = `<div class="p-3 text-center text-muted rounded bg-white border border-dashed"><i class="bi bi-folder2-open d-block fs-3 mb-1 text-primary opacity-50"></i><span class="small fw-semibold">No custom categories added yet. Fill out the form above to add your first category.</span></div>`;
        } else {
            existingListDiv.innerHTML = keys.map(code => {
                const secBooks = bookList.filter(b => 
                    (b.section && b.section.toUpperCase() === code.toUpperCase()) ||
                    (b.id && b.id.toUpperCase().startsWith(code.toUpperCase()))
                ).length;
                return `
                <div class="d-flex align-items-center justify-content-between p-2 px-3 bg-white rounded-3 border shadow-sm w-100">
                    <div class="d-flex align-items-center gap-2">
                        <span class="badge bg-primary px-2 py-1"><i class="bi bi-tag-fill me-1"></i>${code}</span>
                        <span class="fw-semibold text-dark fs-6">${categories[code]}</span>
                        <span class="badge bg-light text-muted border ms-1" style="font-size: 0.72rem;">${secBooks} Book(s)</span>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-danger py-1 px-2 text-nowrap fw-semibold" onclick="deleteAdminCategory('${code}')" title="Delete category">
                        <i class="bi bi-trash me-1"></i> Delete
                    </button>
                </div>`;
            }).join('');
        }
    }
}

// Quick filter handler via Category Chip
function quickFilterCategory(code) {
    const filterSelect = document.getElementById('adminSectionFilter');
    if (filterSelect) {
        filterSelect.value = code;
        renderAdminDashboard();
    }
}

// Open Add Book modal with target section selected
function openAddBookForSection(secCode) {
    const modalEl = document.getElementById('addBookModal');
    const newBookSelect = document.getElementById('newBookSection');
    if (newBookSelect) {
        newBookSelect.value = secCode;
        autoSuggestBookId(secCode);
    }
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

function generateCategoryCode(name) {
    if (!name) return 'CAT' + Math.floor(100 + Math.random() * 900);
    const clean = name.replace(/[^a-zA-Z0-9]/g, ' ').trim();
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0] + (words[2] ? words[2][0] : '')).toUpperCase();
    } else if (words.length === 1 && words[0].length >= 3) {
        return words[0].substring(0, 3).toUpperCase();
    } else if (words.length === 1 && words[0].length > 0) {
        return (words[0] + 'CAT').substring(0, 3).toUpperCase();
    }
    return 'CAT' + Math.floor(100 + Math.random() * 900);
}

// Add New Custom Category / Section
function addAdminCategory(e) {
    if (e) {
        e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
    }
    try {
        const nameInput = document.getElementById('newCategoryName');
        const codeInput = document.getElementById('newCategoryCode');
        const name = nameInput?.value?.trim();
        let rawCode = codeInput?.value?.trim()?.toUpperCase();

        if (!name) {
            showAdminToast("Please enter a Category / Section Name!", "danger", "bi-exclamation-triangle-fill");
            return false;
        }

        if (!rawCode) {
            rawCode = generateCategoryCode(name);
        }

        let code = rawCode.replace(/[^A-Z0-9_\-]/gi, '').toUpperCase();
        if (!code) {
            code = generateCategoryCode(name);
        }

        const categories = fetchAdminCategories();
        categories[code] = name;
        saveAdminCategories(categories);

        showAdminToast(`Category "${name}" [${code}] added & saved to backend!`, "success", "bi-tags-fill");

        // Clear form inputs
        if (nameInput) nameInput.value = '';
        if (codeInput) codeInput.value = '';

        renderCategoryOptions();
        renderAdminDashboard();

        // Auto-suggest new category in Add Book modal
        const newBookSelect = document.getElementById('newBookSection');
        if (newBookSelect) {
            newBookSelect.value = code;
            autoSuggestBookId(code);
        }
    } catch (err) {
        console.error("Error in addAdminCategory:", err);
        showAdminToast("Failed to save category: " + err.message, "danger", "bi-exclamation-octagon-fill");
    }
    return false;
}

// Remove / Delete Custom Category
async function deleteAdminCategory(code) {
    const categories = fetchAdminCategories();
    const name = categories[code] || code;

    const confirmed = await showPopupConfirm(
        'Delete Category',
        `Are you sure you want to remove category "${name}" (Code: ${code})?\n\nExisting books in this section will remain, but the category option will be removed.`,
        'danger',
        'Delete Category',
        'Cancel'
    );
    if (!confirmed) {
        return;
    }

    delete categories[code];
    saveAdminCategories(categories);

    const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : ((window.location.protocol && window.location.protocol.startsWith('http')) ? window.location.origin : 'http://localhost:5000');
    fetch(`${baseUrl}/api/categories/${encodeURIComponent(code)}`, {
        method: 'DELETE'
    }).catch(err => console.warn('Backend category delete endpoint warning:', err));

    showAdminToast(`Category "${name}" [${code}] removed.`, "warning", "bi-trash-fill");

    renderCategoryOptions();
    renderAdminDashboard();
}

// Update Live Barcode Preview in Add Book modal
function updateLiveBookBarcodePreview() {
    const idInput = document.getElementById('newBookId');
    const previewDiv = document.getElementById('newBookBarcodePreview');
    if (idInput && previewDiv) {
        const val = idInput.value.trim();
        if (val && typeof renderBookBarcode === 'function') {
            previewDiv.innerHTML = `
                <small class="text-muted d-block mb-1 font-monospace fw-semibold"><i class="bi bi-upc-scan me-1"></i>Auto-Generated Barcode Preview:</small>
                <div class="book-barcode-container shadow-sm p-2 bg-white rounded border">
                    ${renderBookBarcode(val, { height: 32, fontSize: 9 })}
                </div>
            `;
        } else {
            previewDiv.innerHTML = '';
        }
    }
}

// Auto-suggest Book ID based on selected section code keyword (starts at 001 for each category)
function autoSuggestBookId(secCode) {
    const idInput = document.getElementById('newBookId');
    if (!idInput || !secCode) return;

    const books = (typeof fetchAdminBooks === 'function') ? fetchAdminBooks() : {};
    const prefixUpper = secCode.toUpperCase().trim();

    let maxNum = 0;

    Object.keys(books).forEach(id => {
        const idUpper = id.toUpperCase().trim();
        let numStr = null;
        if (idUpper.startsWith(`${prefixUpper}-`)) {
            numStr = idUpper.substring(prefixUpper.length + 1);
        } else if (idUpper.startsWith(prefixUpper)) {
            numStr = idUpper.substring(prefixUpper.length);
        }

        if (numStr) {
            const parsed = parseInt(numStr, 10);
            if (!isNaN(parsed) && parsed > maxNum) {
                maxNum = parsed;
            }
        }
    });

    const nextNum = maxNum + 1;
    const paddedNum = String(nextNum).padStart(3, '0');
    idInput.value = `${secCode}-${paddedNum}`;

    updateLiveBookBarcodePreview();
}

// Open Single Barcode View & Print Modal
function openPrintSingleBarcodeModal(id) {
    const books = fetchAdminBooks();
    const book = books[id];
    if (!book) return;

    const modalEl = document.getElementById('barcodeModal');
    const contentEl = document.getElementById('barcodeModalContent');
    const printBtn = document.getElementById('barcodePrintBtn');

    if (contentEl) {
        const cardHtml = (typeof renderBookBarcodeLabelCard === 'function') 
            ? renderBookBarcodeLabelCard({ id, ...book })
            : `<div class="p-3 bg-white border rounded">${renderBookBarcode(id)}</div>`;

        contentEl.innerHTML = `
            <div class="text-center mx-auto" style="max-width: 580px;">
                <h5 class="fw-bold text-dark mb-1"><i class="bi bi-upc-scan me-2 text-primary"></i>Barcode & Label Preview</h5>
                <p class="text-secondary small mb-3">Official Anwariyya Arabic College Library Barcode Label</p>
                <div class="p-3 bg-light rounded-4 border shadow-sm d-inline-block mx-auto mb-3 overflow-hidden">
                    ${cardHtml}
                </div>
                <div class="d-flex justify-content-center align-items-center gap-2 flex-wrap">
                    <span class="badge bg-primary fs-6 px-3 py-2"><i class="bi bi-barcode me-1"></i>Accession Code: ${id}</span>
                    <span class="badge ${book.status === 'Available' ? 'bg-success' : 'bg-warning text-dark'} fs-6 px-3 py-2">${book.status || 'In Stock'}</span>
                </div>
            </div>
        `;
    }

    if (printBtn) {
        printBtn.onclick = () => {
            if (typeof printBarcodeLabels === 'function') {
                printBarcodeLabels([{ id, ...book }]);
            }
        };
    }

    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
    }
}

// Open Batch Barcode Print Modal for all books
function openBatchBarcodeModal() {
    const books = fetchAdminBooks();
    const bookList = Object.keys(books).map(id => ({ id, ...books[id] }));

    if (bookList.length === 0) {
        if (typeof showPopupAlert === 'function') {
            showPopupAlert('No Books Available', 'Your inventory has no books to generate barcodes for!', 'info');
        } else {
            alert('Your inventory has no books to generate barcodes for!');
        }
        return;
    }

    const modalEl = document.getElementById('barcodeModal');
    const contentEl = document.getElementById('barcodeModalContent');
    const printBtn = document.getElementById('barcodePrintBtn');

    if (contentEl) {
        contentEl.innerHTML = `
            <div class="text-center mb-3">
                <h5 class="fw-bold text-dark mb-1"><i class="bi bi-printer me-2 text-primary"></i>Batch Barcode Sheet Printer</h5>
                <p class="text-muted small mb-0">Generating barcodes for <strong>${bookList.length} books</strong> in your inventory catalog.</p>
            </div>
            <div class="p-3 bg-light rounded-4 border max-height-300 overflow-auto d-flex flex-wrap justify-content-center gap-3" style="max-height: 420px;">
                ${bookList.map(b => `
                    <div style="cursor: pointer; transform: scale(0.92); transform-origin: center;" onclick="openPrintSingleBarcodeModal('${b.id}')" title="Click to inspect barcode label for ${b.title}">
                        ${typeof renderBookBarcodeLabelCard === 'function' ? renderBookBarcodeLabelCard(b) : renderBookBarcode(b.id)}
                    </div>
                `).join('')}
            </div>
        `;
    }

    if (printBtn) {
        printBtn.onclick = () => {
            if (typeof printBarcodeLabels === 'function') {
                printBarcodeLabels(bookList);
            }
        };
    }

    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
    }
}

// Render Admin KPI Metrics and Inventory Table
function renderAdminDashboard() {
    const books = fetchAdminBooks();
    const categories = fetchAdminCategories();

    const totalBooksEl = document.getElementById('adminTotalBooks');
    const inStockEl = document.getElementById('adminInStock');
    const outOfStockEl = document.getElementById('adminOutOfStock');
    const holdEl = document.getElementById('adminHoldCount');
    const inventoryTbody = document.getElementById('adminInventoryTableBody');
    const countBadge = document.getElementById('filteredBookCountBadge');

    const bookList = Object.keys(books).map(id => ({ id, ...books[id] }));
    const totalBooks = bookList.length;
    const holdCount = bookList.filter(b => b.status === 'Admin Hold' || b.issuedTo === 'Admin Hold Reserved' || b.issuedTo === 'Admin Hold').length;
    const outOfStockCount = bookList.filter(b => b.status === 'Issued' && b.issuedTo !== 'Admin Hold Reserved' && b.issuedTo !== 'Admin Hold').length;
    const inStockCount = bookList.filter(b => b.status === 'Available').length;

    if (totalBooksEl) totalBooksEl.innerText = totalBooks;
    if (inStockEl) inStockEl.innerText = inStockCount;
    if (outOfStockEl) outOfStockEl.innerText = outOfStockCount;
    if (holdEl) holdEl.innerText = holdCount;

    renderCategoryOptions();

    if (inventoryTbody) {
        const searchInput = document.getElementById('adminSearchInput')?.value?.toLowerCase() || '';
        const sectionFilter = document.getElementById('adminSectionFilter')?.value || 'all';
        const statusFilter = document.getElementById('adminStatusFilter')?.value || 'all';

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

        if (countBadge) {
            countBadge.innerText = `${filteredList.length} of ${totalBooks} Books Loaded`;
        }

        if (filteredList.length === 0) {
            inventoryTbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-5 text-muted">
                        <i class="bi bi-inbox fs-1 d-block mb-2 text-primary opacity-50"></i>
                        <span class="fw-semibold">No books match your search or filter criteria.</span>
                        <div class="mt-2">
                            <button class="btn btn-sm btn-outline-primary" onclick="resetAdminFilters()">Reset Filters</button>
                        </div>
                    </td>
                </tr>`;
            return;
        }

        inventoryTbody.innerHTML = filteredList.map((b, idx) => {
            const hasValidCover = b.cover && !b.cover.includes('placeholder') && (b.cover.startsWith('data:') || b.cover.startsWith('http'));
            const barcodeSvg = (typeof renderBookBarcode === 'function') ? renderBookBarcode(b.id, { height: 25, fontSize: 8 }) : '';

            return `
                <tr>
                    <td class="text-muted fw-bold">${idx + 1}</td>
                    <td>
                        ${hasValidCover ? 
                            `<img src="${b.cover}" alt="Cover" class="book-cover-thumb" onclick="openUpdateCoverModal('${b.id}')" title="Click to update cover" onerror="this.onerror=null; this.outerHTML='<div class=\\'book-cover-placeholder\\' onclick=\\'openUpdateCoverModal(\\\\'${b.id}\\\\')\\'><i class=\\'bi bi-book fs-5 mb-1\\'></i>${b.section || 'BOOK'}</div>';">` :
                            `<div class="book-cover-placeholder" onclick="openUpdateCoverModal('${b.id}')" title="Click to upload cover">
                                <i class="bi bi-book fs-5 mb-1"></i>
                                <span>${b.section || 'BOOK'}</span>
                             </div>`
                        }
                    </td>
                    <td>
                        <div class="d-flex flex-column align-items-center gap-1">
                            <code class="accession-pill">${b.id}</code>
                            <div class="book-barcode-container shadow-sm" onclick="openPrintSingleBarcodeModal('${b.id}')" title="Click to view & print barcode for ${b.id}">
                                ${barcodeSvg}
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="badge bg-secondary shadow-sm"><i class="bi bi-tag-fill me-1"></i>${b.section || 'GEN'} (${b.sectionName || categories[b.section] || 'General'})</span>
                    </td>
                    <td class="fw-bold text-dark fs-6">${b.title}</td>
                    <td class="text-secondary">${b.author || 'General'}</td>
                    <td>
                        ${b.status === 'Admin Hold' || b.issuedTo === 'Admin Hold Reserved' || b.issuedTo === 'Admin Hold' ?
                            `<span class="badge badge-status badge-status-hold"><i class="bi bi-shield-lock-fill me-1"></i> ⛔ ADMIN HOLD</span>` :
                            (b.status === 'Issued' ? 
                                `<span class="badge badge-status badge-status-issued"><i class="bi bi-x-circle-fill me-1"></i> Issued (${b.issuedTo || 'Out of Stock'})</span>` : 
                                `<span class="badge badge-status badge-status-available"><i class="bi bi-check-circle-fill me-1"></i> In Stock</span>`
                            )
                        }
                    </td>
                    <td class="text-end">
                        <div class="table-action-group btn-group">
                            <button class="btn btn-outline-dark btn-sm" onclick="openPrintSingleBarcodeModal('${b.id}')" title="View & Print Barcode Label">
                                <i class="bi bi-upc-scan me-1"></i>Barcode
                            </button>
                            <button class="btn btn-outline-primary btn-sm" onclick="openEditBookModal('${b.id}')" title="Edit book details">
                                <i class="bi bi-pencil-square me-1"></i>Edit
                            </button>
                            <button class="btn btn-outline-info btn-sm" onclick="openUpdateCoverModal('${b.id}')" title="Upload cover">
                                <i class="bi bi-upload me-1"></i>Cover
                            </button>
                            <button class="btn btn-outline-warning btn-sm text-dark" onclick="toggleAdminBookStatus('${b.id}')" title="Toggle status / Admin Hold">
                                <i class="bi bi-shield-lock me-1"></i>Hold
                            </button>
                            <button class="btn btn-outline-danger btn-sm" onclick="deleteAdminBook('${b.id}')" title="Delete book">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
}

// Reset Search & Filters
function resetAdminFilters() {
    const searchInput = document.getElementById('adminSearchInput');
    const sectionFilter = document.getElementById('adminSectionFilter');
    const statusFilter = document.getElementById('adminStatusFilter');
    if (searchInput) searchInput.value = '';
    if (sectionFilter) sectionFilter.value = 'all';
    if (statusFilter) statusFilter.value = 'all';
    renderAdminDashboard();
}

// Add New Book to Inventory
function addAdminBook(e) {
    if (e) e.preventDefault();
    const categories = fetchAdminCategories();
    const section = document.getElementById('newBookSection')?.value || 'GEN';
    const id = document.getElementById('newBookId')?.value?.trim();
    const title = document.getElementById('newBookTitle')?.value?.trim();
    const author = document.getElementById('newBookAuthor')?.value?.trim();
    const coverUrlInput = document.getElementById('newBookCover')?.value?.trim();

    const finalCover = uploadedCoverDataUrl || coverUrlInput || `https://covers.openlibrary.org/b/id/${id}-M.jpg`;

    if (!id || !title) {
        showAdminToast("Please enter both Book ID and Title!", "danger", "bi-exclamation-circle-fill");
        return;
    }

    const books = fetchAdminBooks();
    books[id] = {
        title: title,
        author: author || 'General',
        section: section,
        sectionName: categories[section] || 'General',
        cover: finalCover,
        status: "Available",
        issuedTo: null,
        issueDate: null
    };
    saveAdminBooks(books);
    showAdminToast(`Book "${title}" added to inventory!`, "success", "bi-plus-circle-fill");
    
    // Reset Form & Upload Preview
    uploadedCoverDataUrl = null;
    document.getElementById('addBookForm')?.reset();
    const previewContainer = document.getElementById('uploadPreviewContainer');
    if (previewContainer) previewContainer.style.display = 'none';

    renderAdminDashboard();

    const modalEl = document.getElementById('addBookModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const instance = bootstrap.Modal.getInstance(modalEl);
        if (instance) instance.hide();
    }
}

// Edit Uploaded Book Details Functions

function openEditBookModal(id) {
    const books = fetchAdminBooks();
    const book = books[id];
    if (!book) return;

    renderCategoryOptions();

    editDetailCoverDataUrl = null;
    document.getElementById('editBookOriginalId').value = id;
    document.getElementById('editBookId').value = id;
    document.getElementById('editBookTitle').value = book.title;
    document.getElementById('editBookAuthor').value = book.author || 'General';
    document.getElementById('editBookSection').value = book.section || 'GEN';
    document.getElementById('editBookStatus').value = book.status || 'Available';
    document.getElementById('editBookPreviewImg').src = book.cover;
    document.getElementById('editBookDetailCoverFile').value = '';
    document.getElementById('editBookDetailCoverUrl').value = '';

    const modalEl = document.getElementById('editBookModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

function previewEditDetailCover(input) {
    const previewImg = document.getElementById('editBookPreviewImg');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            editDetailCoverDataUrl = e.target.result;
            if (previewImg) previewImg.src = editDetailCoverDataUrl;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function saveEditedBookDetails(e) {
    if (e) e.preventDefault();
    const origId = document.getElementById('editBookOriginalId')?.value;
    const newId = document.getElementById('editBookId')?.value?.trim();
    const title = document.getElementById('editBookTitle')?.value?.trim();
    const author = document.getElementById('editBookAuthor')?.value?.trim();
    const section = document.getElementById('editBookSection')?.value;
    const status = document.getElementById('editBookStatus')?.value;
    const urlInput = document.getElementById('editBookDetailCoverUrl')?.value?.trim();

    if (!newId || !title) {
        showAdminToast("Book ID and Title are required!", "danger", "bi-exclamation-triangle-fill");
        return;
    }

    const categories = fetchAdminCategories();
    const books = fetchAdminBooks();
    const existingCover = books[origId]?.cover || `https://covers.openlibrary.org/b/id/${newId}-M.jpg`;
    const finalCover = editDetailCoverDataUrl || urlInput || existingCover;

    if (origId && origId !== newId) {
        delete books[origId];
    }

    books[newId] = {
        title: title,
        author: author || 'General',
        section: section,
        sectionName: categories[section] || 'General',
        cover: finalCover,
        status: status,
        issuedTo: status === 'Admin Hold' ? 'Admin Hold Reserved' : (status === 'Available' ? null : (books[newId]?.issuedTo || 'Issued')),
        issueDate: status === 'Available' ? null : (books[newId]?.issueDate || new Date().toISOString().split('T')[0])
    };

    saveAdminBooks(books);
    showAdminToast(`Book #${newId} updated successfully!`, "success", "bi-check-circle-fill");

    renderAdminDashboard();

    const modalEl = document.getElementById('editBookModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const instance = bootstrap.Modal.getInstance(modalEl);
        if (instance) instance.hide();
    }
}

// Export Custom Data Function (CSV, JSON, PDF Report)
function processCustomExport() {
    const dataType = document.getElementById('exportDataType')?.value || 'inventory';
    const format = document.getElementById('exportFileFormat')?.value || 'csv';
    const sectionFilter = document.getElementById('exportSectionFilter')?.value || 'all';
    const statusFilter = document.getElementById('exportStatusFilter')?.value || 'all';
    const classFilter = document.getElementById('exportClassFilter')?.value || 'all';

    let dataToExport = [];
    let fileName = `library_export_${dataType}_${Date.now()}`;

    if (dataType === 'inventory') {
        const books = fetchAdminBooks();
        const list = Object.keys(books).map(id => ({ id, ...books[id] }));
        dataToExport = list.filter(b => {
            const matchSec = sectionFilter === 'all' || (b.section && b.section.toUpperCase() === sectionFilter.toUpperCase());
            const matchStat = statusFilter === 'all' || b.status === statusFilter;
            return matchSec && matchStat;
        });
    } else if (dataType === 'students') {
        const students = fetchAdminStudents();
        dataToExport = students.filter(s => {
            const matchClass = classFilter === 'all' || (s.classDiv && s.classDiv.toLowerCase() === classFilter.toLowerCase());
            return matchClass;
        });
    } else {
        const ledger = fetchAdminLedger();
        dataToExport = ledger.filter(item => {
            const matchStat = statusFilter === 'all' || item.status === statusFilter;
            const matchClass = classFilter === 'all' || (item.classDiv && item.classDiv.toLowerCase() === classFilter.toLowerCase());
            return matchStat && matchClass;
        });
    }

    if (dataToExport.length === 0) {
        showAdminToast("No records match the selected export filters!", "warning", "bi-exclamation-triangle-fill");
        return;
    }

    if (format === 'pdf') {
        const printWin = window.open('', '_blank');
        let title = 'Library Report';
        if (dataType === 'inventory') title = 'Library Book Inventory Report';
        else if (dataType === 'students') title = 'Registered Student Directory Report';
        else title = 'Library Transaction Ledger Report';

        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        let tableHtml = '';
        if (dataType === 'inventory') {
            tableHtml = `
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Book ID</th>
                        <th>Section</th>
                        <th>Book Title</th>
                        <th>Author</th>
                        <th>Status</th>
                        <th>Issued To</th>
                    </tr>
                </thead>
                <tbody>
                    ${dataToExport.map((b, idx) => `
                        <tr>
                            <td>${idx + 1}</td>
                            <td><strong>${b.id}</strong></td>
                            <td>[${b.section || 'GEN'}] ${b.sectionName || 'General'}</td>
                            <td>${b.title}</td>
                            <td>${b.author || '-'}</td>
                            <td>${b.status}</td>
                            <td>${b.issuedTo || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            `;
        } else if (dataType === 'students') {
            tableHtml = `
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Roll / Admission No</th>
                        <th>Student Name</th>
                        <th>Class & Division</th>
                    </tr>
                </thead>
                <tbody>
                    ${dataToExport.map((s, idx) => `
                        <tr>
                            <td>${idx + 1}</td>
                            <td><strong>${s.rollNo}</strong></td>
                            <td>${s.name}</td>
                            <td>${s.classDiv || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            `;
        } else {
            tableHtml = `
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Roll No</th>
                        <th>Student Name</th>
                        <th>Class</th>
                        <th>Book ID</th>
                        <th>Book Title</th>
                        <th>Issue Date</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${dataToExport.map((r, idx) => `
                        <tr>
                            <td>${idx + 1}</td>
                            <td>${r.rollNo}</td>
                            <td>${r.studentName}</td>
                            <td>${r.classDiv}</td>
                            <td>${r.bookId}</td>
                            <td>${r.bookTitle}</td>
                            <td>${r.issueDate}</td>
                            <td>${r.status}</td>
                        </tr>
                    `).join('')}
                </tbody>
            `;
        }

        printWin.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title} - ${dateStr}</title>
                <style>
                    body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; padding: 25px; color: #1e293b; }
                    .header { text-align: center; border-bottom: 3px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px; }
                    .header h2 { margin: 0; color: #4f46e5; font-size: 24px; font-weight: 800; }
                    .header p { margin: 6px 0 0 0; color: #475569; font-size: 15px; font-weight: 600; }
                    .meta { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 13px; color: #64748b; background: #f8fafc; padding: 10px 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
                    th, td { border: 1px solid #cbd5e1; padding: 9px 12px; text-align: left; }
                    th { background-color: #4f46e5; color: white; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
                    tr:nth-child(even) { background-color: #f8fafc; }
                    .btn-print { background: #059669; color: white; border: none; padding: 10px 20px; font-size: 14px; font-weight: bold; border-radius: 8px; cursor: pointer; margin-bottom: 20px; box-shadow: 0 4px 10px rgba(5, 150, 105, 0.2); }
                    @media print { .btn-print { display: none; } }
                </style>
            </head>
            <body>
                <button class="btn-print" onclick="window.print()">🖨️ Save as PDF / Print Document</button>
                <div class="header">
                    <h2>Kuthbukhana Anwariyya Library Management System</h2>
                    <p>${title}</p>
                </div>
                <div class="meta">
                    <span><strong>Report Date:</strong> ${dateStr}</span>
                    <span><strong>Total Exported Records:</strong> ${dataToExport.length}</span>
                </div>
                <table>
                    ${tableHtml}
                </table>
            </body>
            </html>
        `);
        printWin.document.close();
        setTimeout(() => { printWin.print(); }, 500);

        const modalEl = document.getElementById('exportModal');
        if (modalEl && typeof bootstrap !== 'undefined') {
            const instance = bootstrap.Modal.getInstance(modalEl);
            if (instance) instance.hide();
        }
        return;
    }

    let fileContent = '';
    let mimeType = 'text/plain';

    if (format === 'json') {
        fileContent = JSON.stringify(dataToExport, null, 2);
        mimeType = 'application/json';
        fileName += '.json';
    } else {
        const keys = Object.keys(dataToExport[0]);
        const header = keys.join(',') + '\n';
        const rows = dataToExport.map(obj => {
            return keys.map(k => {
                let val = obj[k] === null || obj[k] === undefined ? '' : String(obj[k]);
                val = val.replace(/"/g, '""');
                return `"${val}"`;
            }).join(',');
        }).join('\n');
        fileContent = header + rows;
        mimeType = 'text/csv';
        fileName += '.csv';
    }

    const blob = new Blob([fileContent], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showAdminToast(`Exported ${dataToExport.length} record(s) as ${fileName}`, "success", "bi-download");

    const modalEl = document.getElementById('exportModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const instance = bootstrap.Modal.getInstance(modalEl);
        if (instance) instance.hide();
    }
}

// Import Custom JSON Data Function
function processCustomImport(e) {
    if (e) e.preventDefault();
    const dataType = document.getElementById('importDataType')?.value || 'inventory';
    const fileInput = document.getElementById('importJsonFile');
    const mode = document.querySelector('input[name="importMode"]:checked')?.value || 'merge';

    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
        showAdminToast("Please select a JSON file to import!", "danger", "bi-exclamation-circle-fill");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(evt) {
        try {
            const importedData = JSON.parse(evt.target.result);
            if (!importedData || typeof importedData !== 'object') {
                showAdminToast("Invalid JSON data format!", "danger", "bi-exclamation-triangle-fill");
                return;
            }

            if (dataType === 'inventory') {
                const currentBooks = mode === 'overwrite' ? {} : fetchAdminBooks();
                const categories = fetchAdminCategories();
                let count = 0;

                if (Array.isArray(importedData)) {
                    importedData.forEach((item, idx) => {
                        const id = item.id || item.bookId || `IMP-${Date.now()}-${idx}`;
                        currentBooks[id] = {
                            title: item.title || 'Untitled Book',
                            author: item.author || 'General',
                            section: item.section || 'GEN',
                            sectionName: item.sectionName || categories[item.section] || 'General',
                            cover: item.cover || `https://covers.openlibrary.org/b/id/${id}-M.jpg`,
                            status: item.status || 'Available',
                            issuedTo: item.issuedTo || null,
                            issueDate: item.issueDate || null
                        };
                        count++;
                    });
                } else {
                    Object.keys(importedData).forEach(id => {
                        currentBooks[id] = importedData[id];
                        count++;
                    });
                }

                saveAdminBooks(currentBooks);
                showAdminToast(`Imported ${count} book records successfully!`, "success", "bi-cloud-check-fill");
            } else {
                let currentLedger = mode === 'overwrite' ? [] : fetchAdminLedger();
                const itemsToImport = Array.isArray(importedData) ? importedData : Object.values(importedData);

                if (mode === 'overwrite') {
                    currentLedger = itemsToImport;
                } else {
                    currentLedger = [...itemsToImport, ...currentLedger];
                }

                if (typeof saveLedgerData === 'function') {
                    saveLedgerData(currentLedger);
                } else {
                    localStorage.setItem('libraryLedger', JSON.stringify(currentLedger));
                }

                showAdminToast(`Imported ${itemsToImport.length} ledger records!`, "success", "bi-cloud-check-fill");
            }

            document.getElementById('importDataForm')?.reset();
            renderAdminDashboard();

            const modalEl = document.getElementById('importModal');
            if (modalEl && typeof bootstrap !== 'undefined') {
                const instance = bootstrap.Modal.getInstance(modalEl);
                if (instance) instance.hide();
            }
        } catch (err) {
            showAdminToast("Error parsing JSON file: " + err.message, "danger", "bi-exclamation-octagon-fill");
        }
    };

    reader.readAsText(file);
}

// Upload & Update Book Cover Functions

function openUpdateCoverModal(id) {
    const books = fetchAdminBooks();
    const book = books[id];
    if (!book) return;

    editCoverDataUrl = null;
    document.getElementById('editCoverBookId').value = id;
    document.getElementById('editCoverCurrentImg').src = book.cover;
    document.getElementById('editCoverBookTitle').innerText = book.title;
    document.getElementById('editCoverBookMeta').innerText = `ID: #${id} | Author: ${book.author || 'General'}`;
    document.getElementById('editBookCoverFile').value = '';
    document.getElementById('editBookCoverUrl').value = '';

    const modalEl = document.getElementById('updateCoverModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

function previewUpdateCover(input) {
    const previewImg = document.getElementById('editCoverCurrentImg');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            editCoverDataUrl = e.target.result;
            if (previewImg) previewImg.src = editCoverDataUrl;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function saveAdminBookCover(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('editCoverBookId')?.value;
    const urlInput = document.getElementById('editBookCoverUrl')?.value?.trim();

    const books = fetchAdminBooks();
    if (!books[id]) return;

    const newCover = editCoverDataUrl || urlInput;
    if (!newCover) {
        showAdminToast("Please select an image file or enter a valid URL!", "warning", "bi-image-fill");
        return;
    }

    books[id].cover = newCover;
    saveAdminBooks(books);
    showAdminToast(`Cover updated for Book #${id}!`, "success", "bi-image-fill");

    renderAdminDashboard();

    const modalEl = document.getElementById('updateCoverModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const instance = bootstrap.Modal.getInstance(modalEl);
        if (instance) instance.hide();
    }
}

// Toggle Book Stock Status (Available ↔ Issued ↔ Admin Hold)
function toggleAdminBookStatus(id) {
    const books = fetchAdminBooks();
    if (!books[id]) return;

    let msg = '';
    if (books[id].status === 'Available') {
        books[id].status = 'Issued';
        books[id].issuedTo = 'Issued (Admin Hold)';
        books[id].issueDate = new Date().toISOString().split('T')[0];
        msg = `Book #${id} marked as Issued.`;
    } else if (books[id].status === 'Issued') {
        books[id].status = 'Admin Hold';
        books[id].issuedTo = 'Admin Hold Reserved';
        books[id].issueDate = new Date().toISOString().split('T')[0];
        msg = `⛔ Admin Hold enabled for Book #${id}.`;
    } else {
        books[id].status = 'Available';
        books[id].issuedTo = null;
        books[id].issueDate = null;
        msg = `Book #${id} released to In Stock (Available).`;
    }

    saveAdminBooks(books);
    showAdminToast(msg, "info", "bi-shield-lock-fill");
    renderAdminDashboard();
}

// Delete Book from Inventory
async function deleteAdminBook(id) {
    const confirmDelete = await showPopupConfirm(
        'Delete Book',
        `Are you sure you want to delete book #${id} from inventory?`,
        'danger',
        'Delete Book',
        'Cancel'
    );
    if (!confirmDelete) return;

    const books = fetchAdminBooks();
    delete books[id];
    saveAdminBooks(books);

    const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : ((window.location.protocol && window.location.protocol.startsWith('http')) ? window.location.origin : 'http://localhost:5000');
    fetch(`${baseUrl}/api/books/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    }).catch(err => console.warn('Backend delete book endpoint warning:', err));

    showAdminToast(`Book #${id} removed from inventory.`, "danger", "bi-trash-fill");
    renderAdminDashboard();
}

// Student Data Directory Management
function fetchAdminStudents() {
    const data = localStorage.getItem('libraryStudents');
    if (!data) {
        localStorage.setItem('libraryStudents', JSON.stringify(defaultStudents));
        return defaultStudents;
    }
    return JSON.parse(data);
}

function saveAdminStudents(students) {
    localStorage.setItem('libraryStudents', JSON.stringify(students));
    const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : ((window.location.protocol && window.location.protocol.startsWith('http')) ? window.location.origin : 'http://localhost:5000');
    fetch(`${baseUrl}/api/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(students)
    }).catch(err => console.warn('Failed to sync students to backend REST API:', err));
}

// Add single student manually
function addAdminStudent(e) {
    if (e) e.preventDefault();
    const rollNo = document.getElementById('newStudentRoll')?.value?.trim();
    const name = document.getElementById('newStudentName')?.value?.trim();
    const classDiv = document.getElementById('newStudentClass')?.value?.trim();

    if (!rollNo || !name) {
        showAdminToast("Please enter both Roll No and Student Name!", "danger", "bi-exclamation-triangle-fill");
        return;
    }

    const students = fetchAdminStudents();
    const existingIdx = students.findIndex(s => String(s.rollNo) === String(rollNo));
    if (existingIdx >= 0) {
        students[existingIdx] = { rollNo, name, classDiv };
    } else {
        students.unshift({ rollNo, name, classDiv });
    }

    saveAdminStudents(students);
    showAdminToast(`Student "${name}" (Roll #${rollNo}) saved!`, "success", "bi-person-check-fill");

    document.getElementById('addStudentForm')?.reset();
    renderStudentDirectory();
}

// Bulk Upload Students via JSON or CSV
function uploadBulkStudents(e) {
    if (e) e.preventDefault();
    const fileInput = document.getElementById('bulkStudentFile');
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
        showAdminToast("Please select a student file to upload!", "warning", "bi-file-earmark-arrow-up");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(evt) {
        try {
            const content = evt.target.result;
            const students = fetchAdminStudents();
            let addedCount = 0;

            if (file.name.endsWith('.json')) {
                const parsed = JSON.parse(content);
                const list = Array.isArray(parsed) ? parsed : Object.values(parsed);
                list.forEach(st => {
                    if (st.rollNo || st.roll) {
                        const roll = String(st.rollNo || st.roll).trim();
                        const sName = st.name || st.studentName || 'Student';
                        const sClass = st.classDiv || st.class || '10-A';
                        
                        const idx = students.findIndex(s => String(s.rollNo) === String(roll));
                        if (idx >= 0) {
                            students[idx] = { rollNo: roll, name: sName, classDiv: sClass };
                        } else {
                            students.push({ rollNo: roll, name: sName, classDiv: sClass });
                        }
                        addedCount++;
                    }
                });
            } else {
                const lines = content.split(/\r?\n/);
                if (lines.length > 1) {
                    for (let i = 1; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (!line) continue;
                        const parts = line.split(',').map(p => p.replace(/^"|"$/g, '').trim());
                        if (parts.length >= 2) {
                            const roll = parts[0];
                            const sName = parts[1];
                            const sClass = parts[2] || '10-A';
                            
                            const idx = students.findIndex(s => String(s.rollNo) === String(roll));
                            if (idx >= 0) {
                                students[idx] = { rollNo: roll, name: sName, classDiv: sClass };
                            } else {
                                students.push({ rollNo: roll, name: sName, classDiv: sClass });
                            }
                            addedCount++;
                        }
                    }
                }
            }

            saveAdminStudents(students);
            showAdminToast(`Uploaded ${addedCount} student record(s)!`, "success", "bi-people-fill");
            document.getElementById('uploadStudentForm')?.reset();
            renderStudentDirectory();
        } catch (err) {
            showAdminToast("Error processing student file: " + err.message, "danger", "bi-exclamation-octagon-fill");
        }
    };

    reader.readAsText(file);
}

// Render Registered Students Directory Table
function renderStudentDirectory() {
    const tbody = document.getElementById('studentDirectoryTbody');
    if (!tbody) return;

    if (typeof populateClassFilterDropdowns === 'function') {
        populateClassFilterDropdowns();
    }

    const students = fetchAdminStudents();
    const search = document.getElementById('studentSearchInput')?.value?.toLowerCase() || '';
    const classFilter = document.getElementById('studentClassFilter')?.value || 'all';

    const filtered = students.filter(s => {
        const matchesSearch = !search ||
            String(s.rollNo).toLowerCase().includes(search) ||
            s.name.toLowerCase().includes(search) ||
            (s.classDiv && s.classDiv.toLowerCase().includes(search));

        const matchesClass = classFilter === 'all' || (s.classDiv && s.classDiv.toLowerCase() === classFilter.toLowerCase());

        return matchesSearch && matchesClass;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">No student records found.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((st, idx) => `
        <tr>
            <td class="text-muted fw-bold">${idx + 1}</td>
            <td><code>${st.rollNo}</code></td>
            <td class="fw-semibold text-dark">${st.name}</td>
            <td><span class="badge bg-secondary">${st.classDiv || '-'}</span></td>
            <td class="text-end">
                <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2" onclick="deleteAdminStudent('${st.rollNo}')">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function deleteAdminStudent(rollNo) {
    const confirmDelete = await showPopupConfirm(
        'Delete Student',
        `Are you sure you want to delete student with Roll #${rollNo}?`,
        'danger',
        'Delete Student',
        'Cancel'
    );
    if (!confirmDelete) return;

    let students = fetchAdminStudents();
    students = students.filter(s => String(s.rollNo) !== String(rollNo));
    saveAdminStudents(students);
    showAdminToast(`Student #${rollNo} deleted.`, "warning", "bi-person-x-fill");
    renderStudentDirectory();
}

async function clearAllStudents() {
    const confirmClear = await showPopupConfirm(
        'Clear Student Directory',
        'Are you sure you want to clear ALL registered student data?',
        'danger',
        'Clear Directory',
        'Cancel'
    );
    if (!confirmClear) return;

    saveAdminStudents([]);
    showAdminToast("Student directory cleared.", "danger", "bi-trash-fill");
    renderStudentDirectory();
}

// Open Manage Custom Classes Modal
function openManageClassesModal() {
    renderManageClassesModal();
    const modalEl = document.getElementById('manageClassesModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const instance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        instance.show();
        setTimeout(() => {
            const input = document.getElementById('newCustomClassNameInput');
            if (input) input.focus();
        }, 300);
    }
}

// Render active custom classes list inside Manage Classes modal
function renderManageClassesModal() {
    const container = document.getElementById('customClassesListContainer');
    const badge = document.getElementById('customClassesCountBadge');
    if (!container) return;

    const classesList = (typeof getClassesData === 'function') ? getClassesData() : [];
    if (badge) badge.innerText = `${classesList.length} Class${classesList.length !== 1 ? 'es' : ''}`;

    if (classesList.length === 0) {
        container.innerHTML = `
            <div class="w-100 text-center py-4 text-muted">
                <i class="bi bi-mortarboard fs-2 d-block mb-1 text-secondary"></i>
                <p class="mb-0 small">No custom classes added yet. Use the input field above to add your first class!</p>
            </div>
        `;
        return;
    }

    let html = '';
    classesList.forEach(clsName => {
        const safeName = clsName.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        html += `
            <div class="badge bg-white text-dark border p-2 d-inline-flex align-items-center gap-2 rounded-3 shadow-sm" style="font-size: 0.88rem;">
                <span class="fw-bold"><i class="bi bi-mortarboard text-primary me-1"></i>${clsName}</span>
                <button type="button" class="btn btn-link btn-sm p-0 text-danger" onclick="deleteCustomClass('${safeName}')" title="Delete class ${clsName}">
                    <i class="bi bi-x-circle-fill"></i>
                </button>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Handle Add Custom Class Form submit
function handleAddCustomClassForm(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('newCustomClassNameInput');
    const val = input ? input.value.trim() : '';
    if (!val) return;

    if (typeof addCustomClass === 'function' && addCustomClass(val)) {
        if (input) input.value = '';
    }
}

// Open Change Passwords Modal and Load Current Configuration
async function openChangePasswordsModal(shouldShow = true) {
    const modalEl = document.getElementById('changePasswordsModal');
    if (shouldShow && modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
    }

    try {
        const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : ((window.location.protocol && window.location.protocol.startsWith('http')) ? window.location.origin : 'http://localhost:5000');
        const res = await fetch(`${baseUrl}/api/auth/passwords-overview`);
        if (res.ok) {
            const data = await res.json();
            const pwds = data.passwords || {};
            const counts = data.counts || {};

            const adminInput = document.getElementById('newAdminPwdInput');
            if (adminInput) {
                adminInput.value = '';
                adminInput.placeholder = pwds.admin ? `Current: ${pwds.admin} (or enter new)` : 'Enter new admin password';
            }
            const adminBadge = document.getElementById('badgeAdminStatus');
            if (adminBadge) {
                adminBadge.innerText = `${counts.admins || 1} Admin Account(s)`;
            }

            const principalInput = document.getElementById('newPrincipalPwdInput');
            if (principalInput) principalInput.value = pwds.principal || '';
            const pBadge = document.getElementById('badgePrincipalStatus');
            if (pBadge) {
                pBadge.className = pwds.principal ? 'badge bg-info text-dark' : 'badge bg-secondary text-white';
                pBadge.innerText = pwds.principal ? 'Active' : 'Disabled';
            }

            const libInput = document.getElementById('newLibrarianPwdInput');
            if (libInput) libInput.value = pwds.librarian || '';
            const libBadge = document.getElementById('badgeLibrarianStatus');
            if (libBadge) {
                libBadge.className = 'badge bg-warning text-dark';
                libBadge.innerText = `${counts.librarians || 0} Registered`;
            }

            const teachInput = document.getElementById('newTeacherPwdInput');
            if (teachInput) teachInput.value = pwds.teacher || '';
            const teachBadge = document.getElementById('badgeTeacherStatus');
            if (teachBadge) {
                teachBadge.className = 'badge bg-success text-white';
                teachBadge.innerText = `${counts.teachers || 0} Registered`;
            }

            const staffInput = document.getElementById('newStaffPwdInput');
            if (staffInput) staffInput.value = pwds.staff || '';
            const staffBadge = document.getElementById('badgeStaffFastStatus');
            if (staffBadge) {
                staffBadge.className = pwds.staff ? 'badge bg-secondary text-white' : 'badge bg-light text-muted border';
                staffBadge.innerText = pwds.staff ? 'Active' : 'Disabled';
            }
        }
    } catch (err) {
        console.warn('Failed to load passwords overview:', err);
    }
}

// Handle Admin Password Change Form
async function handleAdminUpdatePasswords(e) {
    if (e && e.preventDefault) e.preventDefault();
    const newAdminPassword = document.getElementById('newAdminPwdInput')?.value?.trim();
    const newPrincipalPassword = document.getElementById('newPrincipalPwdInput')?.value?.trim();
    const newLibrarianPassword = document.getElementById('newLibrarianPwdInput')?.value?.trim();
    const newTeacherPassword = document.getElementById('newTeacherPwdInput')?.value?.trim();
    const newStaffPassword = document.getElementById('newStaffPwdInput')?.value?.trim();

    const submitBtn = document.getElementById('btnSubmitChangePasswords');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Saving...';
    }

    try {
        const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : ((window.location.protocol && window.location.protocol.startsWith('http')) ? window.location.origin : 'http://localhost:5000');
        const res = await fetch(`${baseUrl}/api/auth/update-passwords`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                newAdminPassword: newAdminPassword || undefined,
                newPrincipalPassword,
                newLibrarianPassword,
                newTeacherPassword,
                newStaffPassword
            })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showAdminToast('✅ Role passwords successfully updated!', 'success', 'bi-key-fill');
            if (newAdminPassword) {
                localStorage.setItem('library_auth_token', newAdminPassword);
            }
            openChangePasswordsModal(false);
            const modalEl = document.getElementById('changePasswordsModal');
            if (modalEl && typeof bootstrap !== 'undefined') {
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            }
            loadLibrarians();
            loadStaff();
        } else {
            showAdminToast(data.message || 'Failed to update passwords.', 'danger', 'bi-exclamation-triangle-fill');
        }
    } catch (err) {
        showAdminToast('Network error while saving passwords: ' + err.message, 'danger', 'bi-x-circle-fill');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bi bi-check2-circle me-1"></i> Save Passwords';
        }
    }
}

// Delete / Clear Principal Passcode
async function handleDeletePrincipalPassword() {
    if (!confirm('Are you sure you want to delete / clear the Principal portal passcode?\n\nPrincipal portal access will be disabled until a new passcode is configured.')) {
        return;
    }

    try {
        const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : ((window.location.protocol && window.location.protocol.startsWith('http')) ? window.location.origin : 'http://localhost:5000');
        const res = await fetch(`${baseUrl}/api/auth/principal`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showAdminToast('🗑️ Principal passcode deleted successfully!', 'info', 'bi-trash-fill');
            const input = document.getElementById('newPrincipalPwdInput');
            if (input) input.value = '';
            const pBadge = document.getElementById('badgePrincipalStatus');
            if (pBadge) {
                pBadge.className = 'badge bg-secondary text-white';
                pBadge.innerText = 'Disabled';
            }
        } else {
            showAdminToast(data.message || 'Failed to delete Principal passcode.', 'danger', 'bi-x-circle-fill');
        }
    } catch (err) {
        showAdminToast('Network error while deleting Principal passcode.', 'danger', 'bi-wifi-off');
    }
}

// Delete / Clear Staff Fast Entry Passcode
async function handleDeleteStaffPassword() {
    if (!confirm('Are you sure you want to delete / clear the Staff fast-entry passcode?')) {
        return;
    }

    try {
        const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : ((window.location.protocol && window.location.protocol.startsWith('http')) ? window.location.origin : 'http://localhost:5000');
        const res = await fetch(`${baseUrl}/api/auth/staff-password`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showAdminToast('🗑️ Staff passcode cleared successfully!', 'info', 'bi-trash-fill');
            const input = document.getElementById('newStaffPwdInput');
            if (input) input.value = '';
            const staffBadge = document.getElementById('badgeStaffFastStatus');
            if (staffBadge) {
                staffBadge.className = 'badge bg-light text-muted border';
                staffBadge.innerText = 'Disabled';
            }
        } else {
            showAdminToast(data.message || 'Failed to clear Staff passcode.', 'danger', 'bi-x-circle-fill');
        }
    } catch (err) {
        showAdminToast('Network error while clearing Staff passcode.', 'danger', 'bi-wifi-off');
    }
}

// Master Reset: Delete all current accounts (Librarian, Principal, Teachers, Admin)
async function handleDeleteAllAccounts() {
    const confirmation = prompt(
        '⚠️ DANGER ZONE: MASTER ACCOUNT DELETION\n\n' +
        'This will permanently delete:\n' +
        '• Current Librarian account (@librarian)\n' +
        '• Current Administrator account (@admin)\n' +
        '• Current Teacher accounts (@majeed, @maje, etc.)\n' +
        '• Principal portal passcode\n\n' +
        'Your catalog books, categories, and student records will NOT be lost.\n\n' +
        'Type "DELETE" to confirm:'
    );

    if (confirmation !== 'DELETE' && confirmation !== 'delete') {
        if (confirmation !== null) {
            showAdminToast('Account deletion canceled: Confirmation word did not match.', 'secondary', 'bi-x-circle');
        }
        return;
    }

    try {
        const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : ((window.location.protocol && window.location.protocol.startsWith('http')) ? window.location.origin : 'http://localhost:5000');
        const res = await fetch(`${baseUrl}/api/auth/delete-all-accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (res.ok && data.success) {
            alert('✅ All current accounts (Librarian, Principal, Teachers, Admin) have been deleted successfully!\n\nYou will now be redirected to the login page where you can create your fresh administrator account.');
            localStorage.removeItem('library_auth_role');
            localStorage.removeItem('library_auth_token');
            localStorage.removeItem('library_auth_user');
            localStorage.removeItem('library_auth_username');
            localStorage.removeItem('library_auth_name');
            sessionStorage.clear();
            window.location.replace('../../login.html');
        } else {
            showAdminToast(data.message || 'Failed to delete accounts.', 'danger', 'bi-x-circle-fill');
        }
    } catch (err) {
        showAdminToast('Network error while deleting all accounts.', 'danger', 'bi-wifi-off');
    }
}

// ==============================================================
// LIBRARIAN & ADMIN ACCOUNTS MANAGEMENT (ADMIN DASHBOARD)
// ==============================================================

// Toggle Role Pill in Librarian / Admin Creation Modal
function selectRolePill(role) {
    const roleInput = document.getElementById('newLibRole');
    if (roleInput) roleInput.value = role;

    const btnAdmin = document.getElementById('btnRolePillAdmin');
    const btnLibrarian = document.getElementById('btnRolePillLibrarian');
    const formCard = document.getElementById('libFormCard');
    const formIcon = document.getElementById('libFormIcon');
    const titleText = document.getElementById('libFormTitleText');
    const submitBtn = document.getElementById('btnSubmitNewLib');
    const submitText = document.getElementById('btnSubmitNewLibText');

    if (role === 'admin') {
        if (btnAdmin) {
            btnAdmin.className = 'btn btn-primary fw-bold py-2 active';
        }
        if (btnLibrarian) {
            btnLibrarian.className = 'btn btn-outline-warning text-dark fw-bold py-2';
        }
        if (formCard) {
            formCard.className = 'card border border-primary border-opacity-50 shadow-sm rounded-4 mb-4';
            formCard.style.background = 'rgba(238, 242, 255, 0.45)';
        }
        if (formIcon) formIcon.className = 'bi bi-shield-plus text-primary fs-5';
        if (titleText) titleText.innerText = 'Add or Update Administrator';
        if (submitBtn) {
            submitBtn.className = 'btn btn-primary fw-bold px-4 shadow-sm';
        }
        if (submitText) submitText.innerText = 'Create / Update Administrator';
    } else {
        if (btnAdmin) {
            btnAdmin.className = 'btn btn-outline-primary fw-bold py-2';
        }
        if (btnLibrarian) {
            btnLibrarian.className = 'btn btn-warning text-dark fw-bold py-2 active';
        }
        if (formCard) {
            formCard.className = 'card border border-warning border-opacity-50 shadow-sm rounded-4 mb-4';
            formCard.style.background = 'rgba(254, 243, 199, 0.3)';
        }
        if (formIcon) formIcon.className = 'bi bi-journal-bookmark-fill text-warning fs-5';
        if (titleText) titleText.innerText = 'Add or Update Desk Librarian';
        if (submitBtn) {
            submitBtn.className = 'btn btn-warning text-dark fw-bold px-4 shadow-sm';
        }
        if (submitText) submitText.innerText = 'Create / Update Librarian';
    }
}

// Open Add Administrator Modal
function openAddAdminModal() {
    selectRolePill('admin');
    const modalEl = document.getElementById('librarianModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
        setTimeout(() => {
            const input = document.getElementById('newLibName');
            if (input) {
                input.focus();
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 350);
    }
}

// Open Add Librarian Modal and Focus Form Input
function openAddLibrarianModal() {
    selectRolePill('librarian');
    const modalEl = document.getElementById('librarianModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
        setTimeout(() => {
            const input = document.getElementById('newLibName');
            if (input) {
                input.focus();
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 350);
    }
}

// Open Add Teacher / Staff Modal and Focus Form Input
function openAddStaffModal() {
    const modalEl = document.getElementById('staffAccountModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
        setTimeout(() => {
            const input = document.getElementById('newStaffName');
            if (input) {
                input.focus();
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 350);
    }
}

// Fetch and render librarians table
async function loadLibrarians() {
    const tbody = document.getElementById('librariansTableBody');
    const badge = document.getElementById('librarianCountBadge');
    const kpiBadge = document.getElementById('adminLibrarianCount');
    const dashboardBadge = document.getElementById('dashboardLibrarianBadge');
    if (!tbody) return;

    try {
        const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : ((window.location.protocol && window.location.protocol.startsWith('http')) ? window.location.origin : 'http://localhost:5000');
        const res = await fetch(`${baseUrl}/api/librarians`);
        if (!res.ok) throw new Error('Failed to fetch librarians');

        const librarians = await res.json();
        const count = librarians ? librarians.length : 0;

        if (badge) badge.innerText = count;
        if (kpiBadge) kpiBadge.innerText = count;
        if (dashboardBadge) dashboardBadge.innerText = `${count} Registered`;

        if (!librarians || librarians.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted py-4">
                        <i class="bi bi-people display-6 d-block mb-2 text-muted"></i>
                        No librarian accounts found. Create your first librarian account above!
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        librarians.forEach(lib => {
            const initial = (lib.name || lib.username || 'L').charAt(0).toUpperCase();
            const dateStr = lib.createdAt ? new Date(lib.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Default';
            const roleBadge = lib.role === 'admin'
                ? `<span class="badge bg-primary text-white fw-semibold"><i class="bi bi-shield-check me-1"></i>Chief Administrator</span>`
                : (lib.role === 'principal'
                    ? `<span class="badge bg-info text-dark fw-semibold"><i class="bi bi-mortarboard-fill me-1"></i>Principal</span>`
                    : `<span class="badge bg-warning text-dark fw-semibold"><i class="bi bi-journal-bookmark me-1"></i>Librarian (Circulation)</span>`);

            const avatarBg = lib.role === 'admin' ? 'bg-primary text-white' : (lib.role === 'principal' ? 'bg-info text-dark' : 'bg-warning text-dark');

            const safeUsername = String(lib.username).replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const safeName = String(lib.name || lib.username).replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const safeId = String(lib.id).replace(/'/g, "\\'").replace(/"/g, '&quot;');

            html += `
                <tr>
                    <td>
                        <div class="d-flex align-items-center gap-3">
                            <div class="rounded-circle ${avatarBg} fw-bold d-flex align-items-center justify-content-center shadow-sm" style="width: 38px; height: 38px; font-size: 1.05rem;">
                                ${initial}
                            </div>
                            <div>
                                <div class="fw-bold text-dark">${lib.name || lib.username}</div>
                                <small class="text-muted" style="font-size: 0.75rem;">ID: ${lib.id}</small>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="badge bg-light text-dark border px-2 py-1 fw-bold font-monospace">@${lib.username}</span>
                    </td>
                    <td>${roleBadge}</td>
                    <td><small class="text-muted">${dateStr}</small></td>
                    <td class="text-end">
                        <button class="btn btn-outline-primary btn-sm fw-semibold me-1 shadow-sm" type="button" onclick="promptChangeLibrarianPassword('${safeId}', '${safeUsername}')" title="Change Password">
                            <i class="bi bi-key-fill me-1"></i> Change Pwd
                        </button>
                        <button class="btn btn-outline-danger btn-sm shadow-sm" type="button" onclick="handleDeleteLibrarian('${safeId}', '${safeName}', '${safeUsername}')" title="Delete Librarian">
                            <i class="bi bi-trash-fill"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    } catch (err) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-danger py-3">
                    <i class="bi bi-exclamation-triangle-fill me-1"></i> Unable to load librarians: ${err.message}
                </td>
            </tr>
        `;
    }
}

// Create Librarian or Administrator from Admin Panel Form
async function handleCreateLibrarian(e) {
    if (e && e.preventDefault) e.preventDefault();

    const name = document.getElementById('newLibName')?.value?.trim();
    const username = document.getElementById('newLibUsername')?.value?.trim().toLowerCase();
    const password = document.getElementById('newLibPassword')?.value?.trim();
    const role = document.getElementById('newLibRole')?.value || 'librarian';

    if (!name || !username || !password) {
        showAdminToast('Please fill out all required fields!', 'warning', 'bi-exclamation-triangle-fill');
        return;
    }

    if (username.length < 2) {
        showAdminToast('Username must be at least 2 characters.', 'warning', 'bi-exclamation-circle');
        return;
    }

    if (password.length < 3) {
        showAdminToast('Password must be at least 3 characters.', 'warning', 'bi-key');
        return;
    }

    const roleLabel = role === 'admin' ? 'Administrator' : (role === 'principal' ? 'Principal' : 'Librarian');
    const submitBtn = document.getElementById('btnSubmitNewLib');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Saving...`;
    }

    try {
        const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : ((window.location.protocol && window.location.protocol.startsWith('http')) ? window.location.origin : 'http://localhost:5000');
        const res = await fetch(`${baseUrl}/api/librarians`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, username, password, role })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            showAdminToast(`✅ ${roleLabel} "${name}" (@${username}) saved successfully!`, 'success', 'bi-person-check-fill');
            document.getElementById('createLibrarianForm')?.reset();
            selectRolePill(role);
            loadLibrarians();
        } else {
            showAdminToast(data.message || `Failed to save ${roleLabel} account.`, 'danger', 'bi-x-circle-fill');
        }
    } catch (err) {
        showAdminToast(`Network error while saving ${roleLabel}: ` + err.message, 'danger', 'bi-wifi-off');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="bi bi-check2-circle me-1"></i> <span id="btnSubmitNewLibText">Create / Update ${roleLabel}</span>`;
        }
    }
}

// Prompt to change a librarian's password
async function promptChangeLibrarianPassword(id, username) {
    const newPassword = prompt(`Enter a new password for librarian @${username}:`);
    if (newPassword === null) return;
    const trimmed = newPassword.trim();
    if (!trimmed) {
        showAdminToast('Password cannot be empty.', 'warning', 'bi-exclamation-circle');
        return;
    }
    if (trimmed.length < 3) {
        showAdminToast('Password must be at least 3 characters long.', 'warning', 'bi-exclamation-circle');
        return;
    }

    try {
        const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : ((window.location.protocol && window.location.protocol.startsWith('http')) ? window.location.origin : 'http://localhost:5000');
        const res = await fetch(`${baseUrl}/api/librarians/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: trimmed })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showAdminToast(`✅ Password for @${username} updated!`, 'success', 'bi-key-fill');
        } else {
            showAdminToast(data.message || 'Failed to update password.', 'danger', 'bi-x-circle-fill');
        }
    } catch (err) {
        showAdminToast('Network error updating password.', 'danger', 'bi-wifi-off');
    }
}

// Delete Librarian confirmation (Unrestricted: allows deleting any librarian or admin)
async function handleDeleteLibrarian(id, name, username) {
    const activeUsername = (localStorage.getItem('library_auth_username') || '').toLowerCase();
    const isSelf = String(username || '').toLowerCase() === activeUsername;

    let confirmMsg = `Are you sure you want to delete librarian "${name}" (@${username})?\n\nThey will no longer be able to sign in.`;
    if (isSelf) {
        confirmMsg = `⚠️ WARNING: You are deleting your CURRENT logged-in account (@${username})!\n\nIf you proceed, this administrator account will be deleted immediately and you will be signed out.\n\nAre you sure you want to proceed?`;
    }

    if (!confirm(confirmMsg)) {
        return;
    }

    try {
        const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : ((window.location.protocol && window.location.protocol.startsWith('http')) ? window.location.origin : 'http://localhost:5000');
        const res = await fetch(`${baseUrl}/api/librarians/${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (res.ok && data.success) {
            if (isSelf) {
                alert(`Account "@${username}" was deleted successfully.\nYou will now be redirected to the login page.`);
                localStorage.removeItem('library_auth_role');
                localStorage.removeItem('library_auth_token');
                localStorage.removeItem('library_auth_user');
                localStorage.removeItem('library_auth_username');
                localStorage.removeItem('library_auth_name');
                sessionStorage.clear();
                window.location.replace('../../login.html');
                return;
            }
            showAdminToast(`🗑️ Account "${name}" deleted.`, 'info', 'bi-trash-fill');
            loadLibrarians();
        } else {
            showAdminToast(data.message || 'Failed to delete account.', 'danger', 'bi-exclamation-triangle-fill');
        }
    } catch (err) {
        showAdminToast('Network error while deleting account.', 'danger', 'bi-wifi-off');
    }
}

// Delete ALL Librarians & Administrators
async function handleDeleteAllLibrarians() {
    if (!confirm('⚠️ Are you sure you want to delete ALL librarian and administrator accounts?\n\nAll desk staff and admin logins will be removed. You will be signed out.')) {
        return;
    }

    try {
        const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : ((window.location.protocol && window.location.protocol.startsWith('http')) ? window.location.origin : 'http://localhost:5000');
        const res = await fetch(`${baseUrl}/api/librarians`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (res.ok && data.success) {
            alert('✅ All librarian and administrator accounts have been deleted.\nRedirecting to login page...');
            localStorage.removeItem('library_auth_role');
            localStorage.removeItem('library_auth_token');
            localStorage.removeItem('library_auth_user');
            localStorage.removeItem('library_auth_username');
            localStorage.removeItem('library_auth_name');
            sessionStorage.clear();
            window.location.replace('../../login.html');
        } else {
            showAdminToast(data.message || 'Failed to delete librarians.', 'danger', 'bi-x-circle-fill');
        }
    } catch (err) {
        showAdminToast('Network error while deleting librarians.', 'danger', 'bi-wifi-off');
    }
}

// ==============================================================
// COLLEGE TEACHERS / STAFF ACCOUNTS (ADMIN DASHBOARD)
// ==============================================================

// Fetch and render teachers/staff table
async function loadStaff() {
    const tbody = document.getElementById('staffTableBody');
    const badge = document.getElementById('staffCountBadge');
    const kpiBadge = document.getElementById('adminStaffCount');
    const dashboardBadge = document.getElementById('dashboardStaffBadge');
    if (!tbody) return;

    try {
        const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : ((window.location.protocol && window.location.protocol.startsWith('http')) ? window.location.origin : 'http://localhost:5000');
        const res = await fetch(`${baseUrl}/api/staff`);
        if (!res.ok) throw new Error('Failed to fetch teachers');

        const staffList = await res.json();
        const count = staffList ? staffList.length : 0;

        if (badge) badge.innerText = count;
        if (kpiBadge) kpiBadge.innerText = count;
        if (dashboardBadge) dashboardBadge.innerText = `${count} Registered`;

        if (!staffList || staffList.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted py-4">
                        <i class="bi bi-person-workspace display-6 d-block mb-2 text-muted"></i>
                        No college teacher accounts found. Register your first teacher account above!
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        staffList.forEach(st => {
            const initial = (st.name || st.username || 'T').charAt(0).toUpperCase();
            const safeUsername = String(st.username).replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const safeName = String(st.name || st.username).replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const safeId = String(st.id).replace(/'/g, "\\'").replace(/"/g, '&quot;');

            const takenBooksBadge = st.takenBooksCount > 0
                ? `<span class="badge bg-warning text-dark fw-bold px-2 py-1"><i class="bi bi-journal-check me-1"></i>${st.takenBooksCount} Book(s) Taken</span>`
                : `<span class="badge bg-light text-muted border px-2 py-1">0 Books</span>`;

            html += `
                <tr>
                    <td>
                        <div class="d-flex align-items-center gap-3">
                            <div class="rounded-circle bg-success text-white fw-bold d-flex align-items-center justify-content-center shadow-sm" style="width: 38px; height: 38px; font-size: 1.05rem;">
                                ${initial}
                            </div>
                            <div>
                                <div class="fw-bold text-dark">${st.name || st.username}</div>
                                <small class="text-muted" style="font-size: 0.75rem;">${st.phone ? '<i class="bi bi-telephone me-1"></i>' + st.phone : 'Faculty'}</small>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="badge bg-light text-dark border px-2 py-1 fw-bold font-monospace">@${st.username}</span>
                    </td>
                    <td>
                        <span class="badge bg-info text-dark fw-semibold">${st.department || 'General Faculty'}</span>
                    </td>
                    <td>${takenBooksBadge}</td>
                    <td class="text-end">
                        <button class="btn btn-outline-primary btn-sm fw-semibold me-1 shadow-sm" type="button" onclick="promptChangeStaffPassword('${safeId}', '${safeUsername}')" title="Change Password">
                            <i class="bi bi-key-fill me-1"></i> Change Pwd
                        </button>
                        <button class="btn btn-outline-danger btn-sm shadow-sm" type="button" onclick="handleDeleteStaff('${safeId}', '${safeName}', '${safeUsername}')" title="Delete Teacher">
                            <i class="bi bi-trash-fill"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    } catch (err) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-danger py-3">
                    <i class="bi bi-exclamation-triangle-fill me-1"></i> Unable to load teachers: ${err.message}
                </td>
            </tr>
        `;
    }
}

// Create Teacher / Staff from Admin Panel Form
async function handleCreateStaff(e) {
    if (e && e.preventDefault) e.preventDefault();

    const name = document.getElementById('newStaffName')?.value?.trim();
    const department = document.getElementById('newStaffDept')?.value?.trim() || 'General Faculty';
    const username = document.getElementById('newStaffUsername')?.value?.trim().toLowerCase();
    const password = document.getElementById('newStaffPassword')?.value?.trim();
    const phone = document.getElementById('newStaffPhone')?.value?.trim() || '';

    if (!name || !username || !password) {
        showAdminToast('Please fill out Name, Username, and Password!', 'warning', 'bi-exclamation-triangle-fill');
        return;
    }

    if (username.length < 2) {
        showAdminToast('Username must be at least 2 characters.', 'warning', 'bi-exclamation-circle');
        return;
    }

    if (password.length < 3) {
        showAdminToast('Password must be at least 3 characters.', 'warning', 'bi-key');
        return;
    }

    const submitBtn = document.getElementById('btnSubmitNewStaff');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Saving...';
    }

    try {
        const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : ((window.location.protocol && window.location.protocol.startsWith('http')) ? window.location.origin : 'http://localhost:5000');
        const res = await fetch(`${baseUrl}/api/staff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, username, password, department, phone })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            showAdminToast(`✅ Teacher "${name}" (@${username}) saved successfully!`, 'success', 'bi-person-check-fill');
            document.getElementById('createStaffForm')?.reset();
            loadStaff();
        } else {
            showAdminToast(data.message || 'Failed to save teacher account.', 'danger', 'bi-x-circle-fill');
        }
    } catch (err) {
        showAdminToast('Network error while saving teacher: ' + err.message, 'danger', 'bi-wifi-off');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bi bi-check2-circle me-1"></i> Create Teacher Account';
        }
    }
}

// Prompt to change a teacher's password
async function promptChangeStaffPassword(id, username) {
    const newPassword = prompt(`Enter a new password for teacher @${username}:`);
    if (newPassword === null) return;
    const trimmed = newPassword.trim();
    if (!trimmed) {
        showAdminToast('Password cannot be empty.', 'warning', 'bi-exclamation-circle');
        return;
    }
    if (trimmed.length < 3) {
        showAdminToast('Password must be at least 3 characters long.', 'warning', 'bi-exclamation-circle');
        return;
    }

    try {
        const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : ((window.location.protocol && window.location.protocol.startsWith('http')) ? window.location.origin : 'http://localhost:5000');
        const res = await fetch(`${baseUrl}/api/staff/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: trimmed })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showAdminToast(`✅ Password for teacher @${username} updated!`, 'success', 'bi-key-fill');
        } else {
            showAdminToast(data.message || 'Failed to update password.', 'danger', 'bi-x-circle-fill');
        }
    } catch (err) {
        showAdminToast('Network error updating password.', 'danger', 'bi-wifi-off');
    }
}

// Delete Teacher confirmation
async function handleDeleteStaff(id, name, username) {
    if (!confirm(`Are you sure you want to delete teacher "${name}" (@${username})?\n\nThey will no longer be able to log in to the Teacher Portal.`)) {
        return;
    }

    try {
        const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : ((window.location.protocol && window.location.protocol.startsWith('http')) ? window.location.origin : 'http://localhost:5000');
        const res = await fetch(`${baseUrl}/api/staff/${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showAdminToast(`🗑️ Teacher "${name}" deleted.`, 'info', 'bi-trash-fill');
            loadStaff();
        } else {
            showAdminToast(data.message || 'Failed to delete teacher.', 'danger', 'bi-exclamation-triangle-fill');
        }
    } catch (err) {
        showAdminToast('Network error while deleting teacher.', 'danger', 'bi-wifi-off');
    }
}

// Delete ALL Teachers / Staff
async function handleDeleteAllStaff() {
    if (!confirm('Are you sure you want to delete ALL college teacher / faculty accounts?\n\nTeachers will no longer be able to log in to the Teacher Portal.')) {
        return;
    }

    try {
        const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : ((window.location.protocol && window.location.protocol.startsWith('http')) ? window.location.origin : 'http://localhost:5000');
        const res = await fetch(`${baseUrl}/api/staff`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showAdminToast('🗑️ All teacher accounts deleted successfully.', 'info', 'bi-trash-fill');
            loadStaff();
        } else {
            showAdminToast(data.message || 'Failed to delete teachers.', 'danger', 'bi-x-circle-fill');
        }
    } catch (err) {
        showAdminToast('Network error while deleting teachers.', 'danger', 'bi-wifi-off');
    }
}

// Initialize Admin Dashboard on Load
// System Capacity & Real-Time Server Latency Monitor
async function refreshSystemLoad() {
    const t0 = performance.now();
    try {
        const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : ((window.location.protocol && window.location.protocol.startsWith('http')) ? window.location.origin : 'http://localhost:5000');
        const res = await fetch(`${baseUrl}/api/system/load?t=${Date.now()}`);
        const t1 = performance.now();
        const pingMs = Math.round(t1 - t0);

        if (res.ok) {
            const data = await res.json();
            const pingEl = document.getElementById('systemPingValue');
            if (pingEl) pingEl.innerText = `${pingMs} ms`;

            const ramEl = document.getElementById('systemRamValue');
            if (ramEl && data.memory) {
                ramEl.innerText = `${data.memory.heapUsedMB} MB`;
            }

            const sseEl = document.getElementById('systemSseClients');
            if (sseEl && data.capacity) {
                sseEl.innerText = `${data.capacity.sseActiveClients || 1}`;
            }
        }
    } catch (err) {
        console.warn('System load check:', err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('library_auth_role');
    const user = (localStorage.getItem('library_auth_username') || '').toLowerCase();
    if (role !== 'admin' || user === 'librarian') {
        window.location.replace('../../login.html?role=admin');
        return;
    }

    renderCategoryOptions();
    renderAdminDashboard();
    renderStudentDirectory();
    loadLibrarians();
    loadStaff();
    refreshSystemLoad();
    setInterval(refreshSystemLoad, 15000);
    if (typeof updateLoggedInUserUI === 'function') updateLoggedInUserUI();

    // Check query params to auto-open modals
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action') || '';
    const hash = window.location.hash || '';

    if (action === 'changePasswords' || hash === '#changePasswords') {
        openChangePasswordsModal();
    } else if (action === 'addAdmin' || hash === '#addAdmin') {
        openAddAdminModal();
    } else if (action === 'addLibrarian' || hash === '#addLibrarian') {
        openAddLibrarianModal();
    } else if (action === 'addStaff' || hash === '#addStaff') {
        openAddStaffModal();
    }
});
