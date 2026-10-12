/**
 * Multi-Device Fast Data Entry Logic
 * Supports simultaneous input from multiple smartphones and PCs
 */

let sessionBooks = [];
let uploadedCoverBase64 = null;
let currentNetworkUrl = '';

// Toast notification helper
function showToast(message, type = 'success', icon = 'bi-check-circle-fill') {
    const container = document.getElementById('dataEntryToastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `alert alert-${type} shadow-lg rounded-3 d-flex align-items-center gap-2 mb-2 py-2 px-3`;
    toast.style.minWidth = '280px';
    toast.innerHTML = `<i class="bi ${icon} fs-5"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'opacity 0.4s ease';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    }, 2800);
}

// Fetch categories from backend or local cache
async function loadCategories() {
    const sectionSelect = document.getElementById('entrySection');
    if (!sectionSelect) return;

    let categories = {};
    try {
        const res = await fetch(`${API_BASE_URL}/api/categories`);
        if (res.ok) {
            categories = await res.json();
            localStorage.setItem('libraryCategories', JSON.stringify(categories));
        } else {
            categories = typeof getCategoriesData === 'function' ? getCategoriesData() : {};
        }
    } catch (e) {
        categories = typeof getCategoriesData === 'function' ? getCategoriesData() : {};
    }

    const keys = Object.keys(categories);
    if (keys.length === 0) {
        // Fallback standard sections if none exist
        categories = {
            'GEN': 'General Knowledge',
            'ISL': 'Islamic Studies',
            'MAL': 'Malayalam Literature',
            'ENG': 'English Literature',
            'SCI': 'Science & Tech',
            'HIS': 'History & Geography'
        };
    }

    const currentVal = sectionSelect.value;
    sectionSelect.innerHTML = `<option value="" disabled ${!currentVal ? 'selected' : ''}>Select Category / Section...</option>` +
        Object.entries(categories).map(([code, name]) => `<option value="${code}">${name} (${code})</option>`).join('');

    if (currentVal && categories[currentVal]) {
        sectionSelect.value = currentVal;
    } else if (keys.length > 0) {
        sectionSelect.value = keys[0];
        autoSuggestBookId(keys[0]);
    }
}

// Auto-suggest next sequential Book ID for chosen category
async function autoSuggestBookId(forceSection = null) {
    const section = forceSection || document.getElementById('entrySection')?.value;
    if (!section) return;

    const idInput = document.getElementById('entryId');
    if (!idInput) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/books`);
        const books = res.ok ? await res.json() : (typeof getBooksData === 'function' ? getBooksData() : {});

        const prefix = section.toUpperCase();
        let maxNum = 0;

        Object.keys(books).forEach(id => {
            const upper = id.toUpperCase();
            if (upper.startsWith(prefix)) {
                const numPart = upper.replace(prefix, '').replace(/[^0-9]/g, '');
                const n = parseInt(numPart, 10);
                if (!isNaN(n) && n > maxNum) {
                    maxNum = n;
                }
            }
        });

        const nextNum = maxNum + 1;
        const padded = String(nextNum).padStart(3, '0');
        idInput.value = `${prefix}${padded}`;
    } catch (e) {
        console.warn('Auto-suggest fallback:', e);
    }
}

function handleSectionChange() {
    const section = document.getElementById('entrySection')?.value;
    if (section) {
        autoSuggestBookId(section);
    }
}

// Handle Photo / File Cover Upload
function handleCoverUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = function (e) {
            uploadedCoverBase64 = e.target.result;
            showCoverPreview(uploadedCoverBase64);
        };
        reader.readAsDataURL(file);
    }
}

function showCoverPreview(dataUrl) {
    const wrap = document.getElementById('coverPreviewWrap');
    const img = document.getElementById('coverPreviewImg');
    if (wrap && img) {
        img.src = dataUrl;
        wrap.style.display = 'block';
    }
}

function removeCoverPreview() {
    uploadedCoverBase64 = null;
    const wrap = document.getElementById('coverPreviewWrap');
    if (wrap) wrap.style.display = 'none';
    const fileInput = document.getElementById('entryCoverFile');
    if (fileInput) fileInput.value = '';
}

// Fetch Cover via OpenLibrary API by Title
async function fetchCoverByTitle() {
    const title = document.getElementById('entryTitle')?.value?.trim();
    if (!title) {
        showToast('Please type a book title first!', 'warning', 'bi-exclamation-circle');
        return;
    }

    showToast(`Searching cover for "${title}"...`, 'info', 'bi-search');
    try {
        const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(title)}&limit=1`);
        if (res.ok) {
            const data = await res.json();
            if (data.docs && data.docs.length > 0 && data.docs[0].cover_i) {
                const coverUrl = `https://covers.openlibrary.org/b/id/${data.docs[0].cover_i}-M.jpg`;
                uploadedCoverBase64 = coverUrl;
                showCoverPreview(coverUrl);
                showToast('Book cover found and attached!', 'success', 'bi-check-circle-fill');
                return;
            }
        }
        showToast('No cover found online. You can take a photo or use default cover.', 'secondary', 'bi-info-circle');
    } catch (e) {
        showToast('Online search unavailable. Using standard cover.', 'secondary', 'bi-info-circle');
    }
}

// Handle Fast Book Form Submission
async function handleFastBookSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    const id = document.getElementById('entryId')?.value?.trim();
    const title = document.getElementById('entryTitle')?.value?.trim();
    const section = document.getElementById('entrySection')?.value || 'GEN';
    const author = document.getElementById('entryAuthor')?.value?.trim() || 'General';
    const rack = document.getElementById('entryRack')?.value?.trim() || '';
    const pages = document.getElementById('entryPages')?.value || '';
    const price = document.getElementById('entryPrice')?.value || '';

    if (!id || !title) {
        showToast('Book ID and Title are required!', 'danger', 'bi-exclamation-triangle-fill');
        return;
    }

    const categories = typeof getCategoriesData === 'function' ? getCategoriesData() : {};
    const sectionName = categories[section] || section;

    const defaultCover = `https://covers.openlibrary.org/b/id/${encodeURIComponent(id)}-M.jpg`;
    const finalCover = uploadedCoverBase64 || defaultCover;

    const bookPayload = {
        id: id,
        title: title,
        author: author,
        section: section,
        sectionName: sectionName,
        rack: rack,
        pages: pages,
        price: price,
        cover: finalCover,
        status: 'Available',
        issuedTo: null,
        issueDate: null,
        addedAt: new Date().toISOString()
    };

    const saveBtn = document.getElementById('btnSaveBook');
    if (saveBtn) saveBtn.disabled = true;

    try {
        // Atomic Upsert to Server API
        const response = await fetch(`${API_BASE_URL}/api/books/upsert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, book: bookPayload })
        });

        if (response.ok) {
            const data = await response.json();
            showToast(`✅ "${title}" (${id}) saved successfully!`, 'success', 'bi-check-circle-fill');

            // Add to session list
            sessionBooks.unshift(bookPayload);
            updateSessionUI(data.totalBooks);

            // Clear inputs for next book
            document.getElementById('entryTitle').value = '';
            document.getElementById('entryAuthor').value = '';
            // keep the same section and rack for fast repetitive entries!
            document.getElementById('entryPages').value = '';
            document.getElementById('entryPrice').value = '';
            removeCoverPreview();

            // Auto-calculate next sequential ID
            autoSuggestBookId(section);

            // Re-focus title for instant next entry
            setTimeout(() => {
                document.getElementById('entryTitle')?.focus();
            }, 100);
        } else {
            showToast('Failed to save to server. Check server connection.', 'danger', 'bi-x-circle-fill');
        }
    } catch (err) {
        console.error('Error saving book:', err);
        // Fallback local save if server fails
        if (typeof saveBooksData === 'function') {
            const books = typeof getBooksData === 'function' ? getBooksData() : {};
            books[id] = bookPayload;
            saveBooksData(books);
            showToast(`Saved locally ("${title}"). Server offline.`, 'warning', 'bi-cloud-slash');
            sessionBooks.unshift(bookPayload);
            updateSessionUI();
            autoSuggestBookId(section);
        }
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}

// Update Session Counters & Recent Books List
function updateSessionUI(totalFromServer = null) {
    const sessionCountEl = document.getElementById('sessionAddedCount');
    const totalCountEl = document.getElementById('totalLibraryCount');
    const recentBadge = document.getElementById('recentBadge');
    const recentList = document.getElementById('recentBooksList');

    if (sessionCountEl) sessionCountEl.innerText = sessionBooks.length;
    if (recentBadge) recentBadge.innerText = `${sessionBooks.length} books added`;

    if (totalFromServer !== null && totalCountEl) {
        totalCountEl.innerText = totalFromServer;
    }

    if (!recentList) return;

    if (sessionBooks.length === 0) {
        recentList.innerHTML = `
            <div class="col-12 text-center text-muted py-4">
                <i class="bi bi-inbox fs-2 d-block mb-1 opacity-50"></i>
                No books entered in this session yet.
            </div>`;
        return;
    }

    recentList.innerHTML = sessionBooks.slice(0, 10).map((b, idx) => `
        <div class="col-12 col-md-6">
            <div class="recent-book-card p-2 d-flex align-items-center gap-3">
                <img src="${b.cover}" alt="Cover" style="width: 40px; height: 52px; object-fit: cover; border-radius: 6px; background: #e2e8f0;">
                <div class="overflow-hidden flex-grow-1">
                    <div class="fw-bold text-dark text-truncate small">${b.title}</div>
                    <div class="text-muted d-flex align-items-center gap-2" style="font-size: 0.75rem;">
                        <span class="badge bg-primary bg-opacity-10 text-primary py-0 px-2 fw-semibold">${b.id}</span>
                        <span>${b.sectionName || b.section}</span>
                    </div>
                </div>
                <span class="text-success small fw-bold"><i class="bi bi-check-circle-fill"></i></span>
            </div>
        </div>
    `).join('');
}

// Clear form
function clearEntryForm() {
    document.getElementById('fastBookForm')?.reset();
    removeCoverPreview();
    handleSectionChange();
}

// Fetch network & QR code info from server
async function initNetworkInfo() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/network-info`);
        if (res.ok) {
            const data = await res.json();
            currentNetworkUrl = data.networkUrl;

            const hostDisplay = document.getElementById('hostIpDisplay');
            if (hostDisplay) {
                hostDisplay.innerText = data.networkUrl;
            }

            const input = document.getElementById('networkUrlInput');
            if (input) {
                input.value = `${data.networkUrl}/assets/subpages/data-entry.html`;
            }

            const qrImg = document.getElementById('modalQrCodeImg');
            if (qrImg) {
                const targetUrl = `${data.networkUrl}/assets/subpages/data-entry.html`;
                qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(targetUrl)}`;
            }
        }
    } catch (e) {
        console.warn('Network info error:', e);
    }
}

// Open Connect Devices Modal
function openConnectDevicesModal() {
    initNetworkInfo();
    const modalEl = document.getElementById('connectDevicesModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

function copyNetworkUrl() {
    const input = document.getElementById('networkUrlInput');
    if (!input) return;
    input.select();
    navigator.clipboard.writeText(input.value).then(() => {
        showToast('Link copied to clipboard!', 'info', 'bi-clipboard-check');
    }).catch(() => {
        document.execCommand('copy');
        showToast('Link copied!', 'info', 'bi-clipboard-check');
    });
}

// Background sync loop for live book stock counts
async function pollTotalBooks() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/version`);
        if (res.ok) {
            const data = await res.json();
            const totalCountEl = document.getElementById('totalLibraryCount');
            if (totalCountEl) totalCountEl.innerText = data.bookCount;
        }
    } catch (e) {}
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadCategories();
    await initNetworkInfo();
    await pollTotalBooks();

    setInterval(pollTotalBooks, 4000);

    // Auto-focus title field
    setTimeout(() => {
        document.getElementById('entryTitle')?.focus();
    }, 400);
});
