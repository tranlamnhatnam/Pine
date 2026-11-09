// Pine - Page Tools Dormant Bookmarks Engine
// Manifest V3 & ES6 Compliant with Anti-Lag Chunked Infinite Rendering

document.addEventListener('DOMContentLoaded', async () => {
    initPineCore('tools-dormant');

    // DOM Elements
    const statTotalBookmarks = document.getElementById('stat-total-bookmarks');
    const statDormantCount = document.getElementById('stat-dormant-count');
    const statDormantPercent = document.getElementById('stat-dormant-percent');
    const statAvgAge = document.getElementById('stat-avg-age');
    const statOldestDate = document.getElementById('stat-oldest-date');
    const statOldestTitle = document.getElementById('stat-oldest-title');

    const badgeCount3y = document.getElementById('badge-count-3y');
    const badgeCount2y = document.getElementById('badge-count-2y');
    const badgeCount1y = document.getElementById('badge-count-1y');
    const badgeCount6m = document.getElementById('badge-count-6m');
    const badgeCountAll = document.getElementById('badge-count-all');

    const filterPills = document.getElementById('filter-pills');
    const selectSort = document.getElementById('select-sort');
    const inputSearch = document.getElementById('input-search');

    const cbSelectAll = document.getElementById('cb-select-all');
    const labelSelectAll = document.getElementById('label-select-all');
    const btnArchiveSelected = document.getElementById('btn-archive-selected');
    const btnRemoveSelected = document.getElementById('btn-remove-selected');
    const btnRefresh = document.getElementById('btn-refresh');
    const btnExportHtml = document.getElementById('btn-export-html');

    const dormantList = document.getElementById('dormant-list');
    const dormantEmptyState = document.getElementById('dormant-empty-state');
    const dormantActionBar = document.getElementById('dormant-action-bar');

    // Safe Global Helpers
    const getTree = () => (window.PineCore?.getBookmarkTreeAsync ? window.PineCore.getBookmarkTreeAsync() : getBookmarkTreeAsync());
    const notify = (msg, type) => (window.PineCore?.showToast ? window.PineCore.showToast(msg, type) : showToast(msg, type));
    const createSnapshot = (reason) => (window.PineCore?.createAutoRestorePoint ? window.PineCore.createAutoRestorePoint(reason) : createAutoRestorePoint(reason));
    const formatDateTime = (ts) => (window.PineCore?.formatDate ? window.PineCore.formatDate(ts) : formatDate(ts));

    // Performance & State Configuration
    const CHUNK_SIZE = 50; // Render 50 items per chunk to prevent DOM lag (60 FPS)
    let allBookmarks = [];
    let filteredBookmarks = [];
    let renderedCount = 0;
    let currentFilter = '1y'; // Default > 1 year
    let currentSort = 'oldest';
    let searchQuery = '';
    let searchDebounceTimer = null;
    let intersectionObserver = null;
    const selectedIds = new Set();
    const now = Date.now();

    // Escape HTML helper
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Extract Domain
    function extractDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return '';
        }
    }

    // Format Relative Time in Vietnamese
    function formatRelativeTime(dateAdded) {
        if (!dateAdded) return 'Không rõ ngày';
        const ageMs = now - dateAdded;
        const days = Math.max(0, Math.floor(ageMs / (86400 * 1000)));
        if (days >= 365) {
            const years = (days / 365.25).toFixed(1);
            return `${years} năm trước`;
        }
        if (days >= 30) {
            const months = Math.floor(days / 30.4375);
            return `${months} tháng trước`;
        }
        if (days >= 1) {
            return `${days} ngày trước`;
        }
        return 'Hôm nay';
    }

    // Collect all bookmarks recursively
    async function collectAllBookmarks() {
        const tree = await getTree();
        const list = [];

        function traverse(node, currentPath) {
            const nodeTitle = node.title || (node.id === '0' ? '' : 'Thư mục');
            const path = currentPath ? `${currentPath} / ${nodeTitle}` : (node.id === '0' ? '' : nodeTitle);

            if (node.url) {
                const u = node.url.trim();
                if (u.startsWith('http://') || u.startsWith('https://')) {
                    const dateAdded = node.dateAdded || 0;
                    const ageDays = Math.max(0, Math.floor((now - dateAdded) / (86400 * 1000)));

                    list.push({
                        id: node.id,
                        title: node.title || 'Dấu trang không tên',
                        url: node.url,
                        dateAdded: dateAdded,
                        ageDays: ageDays,
                        path: currentPath || 'Gốc',
                        domain: extractDomain(node.url),
                        parentId: node.parentId
                    });
                }
            }

            if (node.children) {
                for (const child of node.children) {
                    traverse(child, path);
                }
            }
        }

        if (Array.isArray(tree)) {
            for (const rootNode of tree) {
                traverse(rootNode, '');
            }
        }
        return list;
    }

    // Compute Filtered and Sorted Array
    function computeFilteredList() {
        let list = allBookmarks.filter(b => {
            if (currentFilter === '3y') return b.ageDays >= 365 * 3;
            if (currentFilter === '2y') return b.ageDays >= 365 * 2;
            if (currentFilter === '1y') return b.ageDays >= 365 * 1;
            if (currentFilter === '6m') return b.ageDays >= 180;
            return true; // 'all'
        });

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(b =>
                b.title.toLowerCase().includes(q) ||
                b.url.toLowerCase().includes(q) ||
                b.domain.toLowerCase().includes(q) ||
                b.path.toLowerCase().includes(q)
            );
        }

        // Sorting
        list.sort((a, b) => {
            if (currentSort === 'oldest') return (a.dateAdded || 0) - (b.dateAdded || 0);
            if (currentSort === 'newest') return (b.dateAdded || 0) - (a.dateAdded || 0);
            if (currentSort === 'title') return a.title.localeCompare(b.title, 'vi');
            if (currentSort === 'folder') return a.path.localeCompare(b.path, 'vi');
            return 0;
        });

        return list;
    }

    // Update Counts and Stats Badges
    function updateStats() {
        const total = allBookmarks.length;
        statTotalBookmarks.textContent = total.toLocaleString('vi-VN');

        const count3y = allBookmarks.filter(b => b.ageDays >= 365 * 3).length;
        const count2y = allBookmarks.filter(b => b.ageDays >= 365 * 2).length;
        const count1y = allBookmarks.filter(b => b.ageDays >= 365 * 1).length;
        const count6m = allBookmarks.filter(b => b.ageDays >= 180).length;

        badgeCount3y.textContent = count3y.toLocaleString('vi-VN');
        badgeCount2y.textContent = count2y.toLocaleString('vi-VN');
        badgeCount1y.textContent = count1y.toLocaleString('vi-VN');
        badgeCount6m.textContent = count6m.toLocaleString('vi-VN');
        badgeCountAll.textContent = total.toLocaleString('vi-VN');

        const totalFiltered = filteredBookmarks.length;
        statDormantCount.textContent = totalFiltered.toLocaleString('vi-VN');
        const percent = total > 0 ? ((totalFiltered / total) * 100).toFixed(1) : '0';
        statDormantPercent.textContent = `Chiếm ${percent}% bộ sưu tập (${currentFilter === 'all' ? 'Tất cả' : '> ' + currentFilter})`;

        // Average Age
        if (totalFiltered > 0) {
            const sumDays = filteredBookmarks.reduce((acc, cur) => acc + cur.ageDays, 0);
            const avgDays = sumDays / totalFiltered;
            if (avgDays >= 365) {
                statAvgAge.textContent = `${(avgDays / 365.25).toFixed(1)} năm`;
            } else if (avgDays >= 30) {
                statAvgAge.textContent = `${Math.floor(avgDays / 30.4375)} tháng`;
            } else {
                statAvgAge.textContent = `${Math.floor(avgDays)} ngày`;
            }
        } else {
            statAvgAge.textContent = '0 năm';
        }

        // Oldest bookmark
        if (allBookmarks.length > 0) {
            const validAdded = allBookmarks.filter(b => b.dateAdded > 0);
            if (validAdded.length > 0) {
                validAdded.sort((a, b) => a.dateAdded - b.dateAdded);
                const oldest = validAdded[0];
                const d = new Date(oldest.dateAdded);
                statOldestDate.textContent = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
                statOldestTitle.textContent = oldest.title.slice(0, 28) + (oldest.title.length > 28 ? '...' : '');
                statOldestTitle.title = oldest.title;
            }
        }
    }

    // Update Action Buttons State based on selectedIds Set
    function updateActionButtonsState() {
        const count = selectedIds.size;
        const total = filteredBookmarks.length;

        btnArchiveSelected.disabled = (count === 0);
        btnRemoveSelected.disabled = (count === 0);

        if (count > 0) {
            btnArchiveSelected.querySelector('span').textContent = `Lưu trữ (${count.toLocaleString('vi-VN')}) mục`;
            btnRemoveSelected.querySelector('span').textContent = `Xóa vĩnh viễn (${count.toLocaleString('vi-VN')}) mục`;
        } else {
            btnArchiveSelected.querySelector('span').textContent = 'Lưu trữ vào thư mục Archive';
            btnRemoveSelected.querySelector('span').textContent = 'Xóa vĩnh viễn đã chọn';
        }

        labelSelectAll.textContent = `Chọn tất cả (${total.toLocaleString('vi-VN')})`;
        cbSelectAll.checked = total > 0 && count === total;
        cbSelectAll.indeterminate = count > 0 && count < total;

        // Sync visible checkboxes with selectedIds
        dormantList.querySelectorAll('.dormant-cb').forEach(cb => {
            cb.checked = selectedIds.has(cb.dataset.id);
        });
    }

    // Create a DOM row for a bookmark item
    function createItemRow(item) {
        const row = document.createElement('div');
        row.className = 'dormant-item-row';
        row.dataset.id = item.id;

        let badgeClass = 'age-badge-recent';
        if (item.ageDays >= 365 * 3) {
            badgeClass = 'age-badge-deep';
        } else if (item.ageDays >= 365 * 2) {
            badgeClass = 'age-badge-medium';
        } else if (item.ageDays >= 365 * 1) {
            badgeClass = 'age-badge-moderate';
        }

        const relativeTime = formatRelativeTime(item.dateAdded);
        const exactDate = item.dateAdded ? new Date(item.dateAdded).toLocaleDateString('vi-VN') : 'Không rõ';
        const faviconUrl = item.domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(item.domain)}&sz=32` : '/images/icon/icon-default-16.png';
        const isChecked = selectedIds.has(item.id);

        row.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 12px; min-width: 0; flex: 1;">
                <input type="checkbox" class="checkbox-custom dormant-cb" data-id="${item.id}" ${isChecked ? 'checked' : ''} style="margin-top: 3px;">
                <img class="bookmark-icon" src="${faviconUrl}" alt="" loading="lazy">
                <div style="min-width: 0; flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="font-weight: 600; font-size: 13px; color: var(--text-primary); word-break: break-word;">${escapeHtml(item.title)}</span>
                        <span class="age-badge ${badgeClass}" title="Lưu ngày: ${exactDate}">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                            ${relativeTime}
                        </span>
                        <span class="badge badge-neutral" style="font-size: 11px;">${escapeHtml(item.path)}</span>
                    </div>
                    <div style="color: var(--text-secondary); font-size: 12px; margin-top: 4px; word-break: break-all; opacity: 0.85;">
                        ${escapeHtml(item.url)}
                    </div>
                </div>
            </div>

            <div class="dormant-actions">
                <button type="button" class="icon-btn btn-open-link" data-url="${escapeHtml(item.url)}" title="Mở trang trong tab mới">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
                </button>
                <button type="button" class="icon-btn btn-archive-single" data-id="${item.id}" data-title="${escapeHtml(item.title)}" title="Di chuyển vào thư mục Archive">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z"/></svg>
                </button>
                <button type="button" class="icon-btn danger btn-delete-single" data-id="${item.id}" data-title="${escapeHtml(item.title)}" title="Xóa vĩnh viễn dấu trang này">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
            </div>
        `;
        return row;
    }

    // Append next chunk of items smoothly via DocumentFragment
    function renderNextChunk() {
        if (renderedCount >= filteredBookmarks.length) {
            removeScrollObserver();
            updateFooterBar();
            return;
        }

        const fragment = document.createDocumentFragment();
        const nextBatch = filteredBookmarks.slice(renderedCount, renderedCount + CHUNK_SIZE);

        for (const item of nextBatch) {
            fragment.appendChild(createItemRow(item));
        }

        // Remove old sentinel and footer before appending
        const oldSentinel = document.getElementById('dormant-sentinel');
        if (oldSentinel) oldSentinel.remove();
        const oldFooter = document.getElementById('dormant-footer-bar');
        if (oldFooter) oldFooter.remove();

        dormantList.appendChild(fragment);
        renderedCount += nextBatch.length;

        updateFooterBar();
        setupScrollObserver();
    }

    // Footer bar showing progress & Load More controls
    function updateFooterBar() {
        const total = filteredBookmarks.length;
        if (total === 0) return;

        let footer = document.getElementById('dormant-footer-bar');
        if (!footer) {
            footer = document.createElement('div');
            footer.id = 'dormant-footer-bar';
            footer.style.cssText = 'padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-color); background: var(--bg-card); flex-wrap: wrap; gap: 10px; font-size: 13px;';
            dormantList.appendChild(footer);
        }

        if (renderedCount < total) {
            footer.innerHTML = `
                <div style="color: var(--text-secondary);">
                    Đang hiển thị <b>${renderedCount.toLocaleString('vi-VN')}</b> / <b>${total.toLocaleString('vi-VN')}</b> dấu trang
                </div>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-load-more">Tải thêm (+${CHUNK_SIZE})</button>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-load-all">Hiển thị tất cả (${(total - renderedCount).toLocaleString('vi-VN')})</button>
                </div>
            `;
            const btnMore = footer.querySelector('#btn-load-more');
            if (btnMore) btnMore.onclick = renderNextChunk;
            const btnAll = footer.querySelector('#btn-load-all');
            if (btnAll) {
                btnAll.onclick = () => {
                    while (renderedCount < filteredBookmarks.length) {
                        renderNextChunk();
                    }
                };
            }
        } else {
            footer.innerHTML = `
                <div style="color: var(--text-secondary); width: 100%; text-align: center;">
                    Đã hiển thị toàn bộ <b>${total.toLocaleString('vi-VN')}</b> dấu trang.
                </div>
            `;
        }
    }

    // Sentinel for Infinite Scrolling
    function setupScrollObserver() {
        if (renderedCount >= filteredBookmarks.length) return;

        let sentinel = document.getElementById('dormant-sentinel');
        if (!sentinel) {
            sentinel = document.createElement('div');
            sentinel.id = 'dormant-sentinel';
            sentinel.style.cssText = 'height: 20px; width: 100%;';
            dormantList.appendChild(sentinel);
        }

        if (intersectionObserver) intersectionObserver.disconnect();

        intersectionObserver = new IntersectionObserver((entries) => {
            if (entries[0] && entries[0].isIntersecting) {
                requestAnimationFrame(renderNextChunk);
            }
        }, { rootMargin: '300px' });

        intersectionObserver.observe(sentinel);
    }

    function removeScrollObserver() {
        if (intersectionObserver) {
            intersectionObserver.disconnect();
            intersectionObserver = null;
        }
        const sentinel = document.getElementById('dormant-sentinel');
        if (sentinel) sentinel.remove();
    }

    // Full Reset and Render (Non-blocking)
    function resetAndRender() {
        removeScrollObserver();
        filteredBookmarks = computeFilteredList();
        updateStats();

        dormantList.innerHTML = '';
        renderedCount = 0;

        if (filteredBookmarks.length === 0) {
            dormantList.style.display = 'none';
            dormantEmptyState.style.display = 'block';
            dormantEmptyState.innerHTML = window.PineUI.renderEmptyState({
                icon: 'check-circle',
                type: 'success',
                title: 'Không có dấu trang ngủ đông nào!',
                desc: 'Bộ sưu tập của bạn không có dấu trang nào thỏa mãn tiêu chí lọc này.'
            });
            updateActionButtonsState();
            return;
        }

        dormantEmptyState.style.display = 'none';
        dormantList.style.display = 'block';

        // Select all filtered items by default
        selectedIds.clear();
        filteredBookmarks.forEach(b => selectedIds.add(b.id));

        renderNextChunk();
        updateActionButtonsState();
    }

    // Capture Favicon load errors cleanly without inline handlers
    dormantList.addEventListener('error', (e) => {
        if (e.target && e.target.classList.contains('bookmark-icon')) {
            e.target.src = '/images/icon/icon-default-16.png';
        }
    }, true);

    // Filter pill click handlers
    filterPills.querySelectorAll('.filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentFilter = pill.dataset.filter;
            resetAndRender();
        });
    });

    // Sort Handler
    selectSort.addEventListener('change', () => {
        currentSort = selectSort.value;
        resetAndRender();
    });

    // Debounced Search Handler (150ms) to prevent keystroke lag
    inputSearch.addEventListener('input', () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            searchQuery = inputSearch.value.trim();
            resetAndRender();
        }, 150);
    });

    // Select All Checkbox Handler
    cbSelectAll.addEventListener('change', () => {
        const isChecked = cbSelectAll.checked;
        if (isChecked) {
            filteredBookmarks.forEach(b => selectedIds.add(b.id));
        } else {
            selectedIds.clear();
        }
        updateActionButtonsState();
    });

    // Individual checkbox change event delegation
    dormantList.addEventListener('change', (e) => {
        if (e.target && e.target.classList.contains('dormant-cb')) {
            const id = e.target.dataset.id;
            if (e.target.checked) {
                selectedIds.add(id);
            } else {
                selectedIds.delete(id);
            }
            updateActionButtonsState();
        }
    });

    // Helper: Find or Create Archive Folder
    async function getOrCreateArchiveFolder() {
        const ARCHIVE_TITLE = '_Lưu trữ [Pine Archive]';
        const tree = await getTree();
        let archiveFolder = null;

        function findFolder(node) {
            if (node.title === ARCHIVE_TITLE && !node.url) {
                archiveFolder = node;
                return;
            }
            if (node.children) {
                for (const child of node.children) {
                    findFolder(child);
                    if (archiveFolder) return;
                }
            }
        }

        if (Array.isArray(tree)) {
            for (const r of tree) findFolder(r);
        }

        if (archiveFolder) return archiveFolder.id;

        // Try creating under "Other Bookmarks" (id '2') or Bookmarks Bar (id '1')
        return new Promise((resolve) => {
            chrome.bookmarks.create({ parentId: '2', title: ARCHIVE_TITLE }, (res) => {
                if (chrome.runtime.lastError || !res) {
                    chrome.bookmarks.create({ parentId: '1', title: ARCHIVE_TITLE }, (res2) => {
                        resolve(res2 ? res2.id : null);
                    });
                } else {
                    resolve(res.id);
                }
            });
        });
    }

    // Action: Archive selected bookmarks in non-blocking batches
    btnArchiveSelected.addEventListener('click', async () => {
        const targetIds = Array.from(selectedIds);
        if (targetIds.length === 0) return;

        const count = targetIds.length;
        const confirmed = window.confirm(`Bạn có chắc chắn muốn chuyển ${count.toLocaleString('vi-VN')} dấu trang ngủ đông vào thư mục "_Lưu trữ [Pine Archive]"?`);
        if (!confirmed) return;

        btnArchiveSelected.disabled = true;
        btnRemoveSelected.disabled = true;
        if (btnRefresh) btnRefresh.disabled = true;
        const unlockList = PineUI.lock(dormantList);
        const labelSpan = btnArchiveSelected.querySelector('span');

        try {
            labelSpan.textContent = 'Đang tạo điểm khôi phục...';
            await createSnapshot(`Lưu trữ ${count} dấu trang ngủ đông vào Archive`);

            const archiveId = await getOrCreateArchiveFolder();
            if (!archiveId) {
                notify('Không thể tạo thư mục lưu trữ.', 'error');
                updateActionButtonsState();
                return;
            }

            // Chunked processing to keep UI 100% responsive
            const BATCH_SIZE = 30;
            for (let i = 0; i < targetIds.length; i += BATCH_SIZE) {
                const batch = targetIds.slice(i, i + BATCH_SIZE);
                labelSpan.textContent = `Đang lưu trữ (${Math.min(i + BATCH_SIZE, count)}/${count})...`;

                await Promise.all(batch.map(bmId =>
                    new Promise(resolve => {
                        chrome.bookmarks.move(bmId, { parentId: archiveId }, () => {
                            if (chrome.runtime.lastError) { /* ignore single move error */ }
                            resolve();
                        });
                    })
                ));

                // Yield to main thread
                await new Promise(r => setTimeout(r, 0));
            }

            notify(`Đã chuyển thành công ${count.toLocaleString('vi-VN')} dấu trang vào thư mục Archive!`, 'success');
            await reloadData();
        } catch (err) {
            console.error('Failed to archive bookmarks:', err);
            notify('Có lỗi xảy ra khi di chuyển dấu trang.', 'error');
            updateActionButtonsState();
        } finally {
            unlockList();
            if (btnRefresh) btnRefresh.disabled = false;
        }
    });

    // Action: Delete selected bookmarks in non-blocking batches
    btnRemoveSelected.addEventListener('click', async () => {
        const targetIds = Array.from(selectedIds);
        if (targetIds.length === 0) return;

        const count = targetIds.length;
        const confirmed = window.confirm(`CẢNH BÁO: Bạn có chắc chắn muốn XÓA VĨNH VIỄN ${count.toLocaleString('vi-VN')} dấu trang ngủ đông này?\n\n(Hệ thống sẽ tự động tạo 1 Bản sao lưu tức thì trước khi xóa).`);
        if (!confirmed) return;

        btnArchiveSelected.disabled = true;
        btnRemoveSelected.disabled = true;
        if (btnRefresh) btnRefresh.disabled = true;
        const unlockList = PineUI.lock(dormantList);
        const labelSpan = btnRemoveSelected.querySelector('span');

        try {
            labelSpan.textContent = 'Đang tạo điểm khôi phục...';
            await createSnapshot(`Xóa vĩnh viễn ${count} dấu trang ngủ đông`);

            // Chunked processing to keep UI 100% responsive
            const BATCH_SIZE = 30;
            for (let i = 0; i < targetIds.length; i += BATCH_SIZE) {
                const batch = targetIds.slice(i, i + BATCH_SIZE);
                labelSpan.textContent = `Đang xóa (${Math.min(i + BATCH_SIZE, count)}/${count})...`;

                await Promise.all(batch.map(bmId =>
                    new Promise(resolve => {
                        chrome.bookmarks.remove(bmId, () => {
                            if (chrome.runtime.lastError) { /* ignore */ }
                            resolve();
                        });
                    })
                ));

                // Yield to main thread
                await new Promise(r => setTimeout(r, 0));
            }

            notify(`Đã xóa thành công ${count.toLocaleString('vi-VN')} dấu trang ngủ đông!`, 'success');
            await reloadData();
        } catch (err) {
            console.error('Failed to remove bookmarks:', err);
            notify('Có lỗi xảy ra khi xóa dấu trang.', 'error');
            updateActionButtonsState();
        } finally {
            unlockList();
            if (btnRefresh) btnRefresh.disabled = false;
        }
    });

    // Action: Export HTML
    btnExportHtml.addEventListener('click', () => {
        const list = filteredBookmarks;
        if (list.length === 0) {
            notify('Không có dấu trang nào trong bộ lọc hiện tại để xuất.', 'warning');
            return;
        }

        const dateStr = new Date().toISOString().slice(0, 10);
        let htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Dấu trang ngủ đông - Pine Export (${dateStr})</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 32px; background: #f8fafc; color: #1e293b; max-width: 900px; margin: 0 auto; }
        h1 { font-size: 24px; color: #0f172a; margin-bottom: 8px; }
        .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
        .item { background: #fff; padding: 12px 16px; border-radius: 8px; margin-bottom: 8px; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; }
        .link { font-weight: 600; color: #2563eb; text-decoration: none; font-size: 14px; }
        .link:hover { text-decoration: underline; }
        .url { font-size: 12px; color: #64748b; margin-top: 3px; word-break: break-all; }
        .badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; background: #f1f5f9; color: #475569; }
    </style>
</head>
<body>
    <h1>Dấu trang ngủ đông (Pine Export)</h1>
    <div class="meta">Tổng cộng ${list.length.toLocaleString('vi-VN')} dấu trang | Ngày xuất: ${new Date().toLocaleString('vi-VN')}</div>
`;

        list.forEach(item => {
            const addedDate = item.dateAdded ? new Date(item.dateAdded).toLocaleDateString('vi-VN') : 'N/A';
            htmlContent += `
    <div class="item">
        <div style="min-width:0; flex:1; margin-right:16px;">
            <a class="link" href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.title)}</a>
            <div class="url">${escapeHtml(item.url)}</div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0;">
            <span class="badge">${escapeHtml(item.path)}</span>
            <span style="font-size:11px; color:#94a3b8;">Lưu ngày: ${addedDate}</span>
        </div>
    </div>`;
        });

        htmlContent += `
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pine-dormant-bookmarks-${dateStr}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        notify(`Đã xuất ${list.length.toLocaleString('vi-VN')} dấu trang ra tệp HTML thành công!`, 'success');
    });

    // Row Actions Delegator (Open link, Archive single, Delete single)
    dormantList.addEventListener('click', async (e) => {
        const btnOpen = e.target.closest('.btn-open-link');
        const btnArchive = e.target.closest('.btn-archive-single');
        const btnDelete = e.target.closest('.btn-delete-single');

        if (btnOpen) {
            const url = btnOpen.dataset.url;
            if (url) window.open(url, '_blank');
            return;
        }

        if (btnArchive) {
            const id = btnArchive.dataset.id;
            const title = btnArchive.dataset.title;
            const confirmed = window.confirm(`Di chuyển "${title}" vào thư mục "_Lưu trữ [Pine Archive]"?`);
            if (!confirmed) return;

            await createSnapshot(`Lưu trữ dấu trang: ${title}`);
            const archiveId = await getOrCreateArchiveFolder();
            if (archiveId) {
                await new Promise(resolve => chrome.bookmarks.move(id, { parentId: archiveId }, resolve));
                notify(`Đã lưu trữ "${title}"!`, 'success');
                await reloadData();
            }
            return;
        }

        if (btnDelete) {
            const id = btnDelete.dataset.id;
            const title = btnDelete.dataset.title;
            const confirmed = window.confirm(`Xóa vĩnh viễn dấu trang "${title}"?`);
            if (!confirmed) return;

            await createSnapshot(`Xóa dấu trang: ${title}`);
            await new Promise(resolve => chrome.bookmarks.remove(id, resolve));
            notify(`Đã xóa "${title}"!`, 'success');
            await reloadData();
            return;
        }
    });

    // Refresh Button
    btnRefresh.addEventListener('click', async () => {
        await reloadData();
        notify('Đã làm mới danh sách dấu trang!', 'info');
    });

    // Master reload function
    async function reloadData() {
        const unlock = PineUI.lock(btnRefresh, 'Đang quét...');
        [selectSort, inputSearch, btnArchiveSelected, btnRemoveSelected].forEach(el => {
            if (el) el.disabled = true;
        });
        dormantEmptyState.style.display = 'none';
        dormantList.style.display = 'block';
        dormantList.innerHTML = PineUI.renderSkeleton('list', 6);

        try {
            allBookmarks = await collectAllBookmarks();
            resetAndRender();
        } finally {
            unlock();
            [selectSort, inputSearch].forEach(el => {
                if (el) el.disabled = false;
            });
            updateActionButtonsState();
        }
    }

    // Initial load
    await reloadData();
});
