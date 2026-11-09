'use strict';

document.addEventListener('DOMContentLoaded', () => {
    initPineCore('tools-broken');

    const btnStartScan = document.getElementById('btn-start-scan');
    const btnStopScan = document.getElementById('btn-stop-scan');
    const scanStatusText = document.getElementById('scan-status-text');
    const scanStatsText = document.getElementById('scan-stats-text');
    const scanProgressBar = document.getElementById('scan-progress-bar');
    const filterPills = document.querySelectorAll('.filter-pill');
    const pillCountAll = document.getElementById('pill-count-all');
    const pillCount404 = document.getElementById('pill-count-404');
    const pillCountDns = document.getElementById('pill-count-dns');
    const pillCountTimeout = document.getElementById('pill-count-timeout');
    const brokenActionBar = document.getElementById('broken-action-bar');
    const cbSelectAll = document.getElementById('cb-select-all');
    const labelSelectAll = document.getElementById('label-select-all');
    const inputSearch = document.getElementById('input-search-broken');
    const btnRemoveBroken = document.getElementById('btn-remove-broken');
    const brokenEmptyState = document.getElementById('broken-empty-state');
    const brokenList = document.getElementById('broken-list');
    const countBrokenBadge = document.getElementById('count-broken');

    let isScanning = false;
    let shouldAbort = false;
    let brokenBookmarks = [];
    let currentFilter = 'all';
    let searchQuery = '';

    // Check single URL status
    async function checkUrl(url) {
        const timeoutMs = 8000;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            // First attempt: HEAD
            let res;
            try {
                res = await fetch(url, {
                    method: 'HEAD',
                    signal: controller.signal,
                    cache: 'no-store'
                });
            } catch (headErr) {
                if (headErr.name === 'AbortError') {
                    throw headErr;
                }
                // Fallback to GET probe with no-cors
                res = await fetch(url, {
                    method: 'GET',
                    mode: 'no-cors',
                    signal: controller.signal,
                    cache: 'no-store'
                });
            }

            clearTimeout(timer);

            // If response is opaque (no-cors probe succeeded), host is responsive
            if (res.type === 'opaque') {
                return { alive: true };
            }

            // If response is normal CORS
            if (res.status >= 400) {
                const is404 = (res.status === 404 || res.status === 410);
                return {
                    alive: false,
                    errorType: is404 ? '404' : (res.status >= 500 ? 'dns' : '404'),
                    statusText: `Lỗi HTTP ${res.status}`
                };
            }

            return { alive: true };
        } catch (err) {
            clearTimeout(timer);
            if (err.name === 'AbortError') {
                return {
                    alive: false,
                    errorType: 'timeout',
                    statusText: 'Hết thời gian chờ (>8s)'
                };
            }
            return {
                alive: false,
                errorType: 'dns',
                statusText: 'Lỗi DNS / Hết hạn tên miền'
            };
        }
    }

    // Extract all valid web bookmarks
    async function collectWebBookmarks() {
        const tree = await getBookmarkTreeAsync();
        const list = [];

        function traverse(node, currentPath) {
            const nodeTitle = node.title || (node.id === '0' ? 'Gốc' : 'Thư mục');
            const path = currentPath ? `${currentPath} / ${nodeTitle}` : (node.id === '0' ? '' : nodeTitle);

            if (node.url) {
                const u = node.url.trim();
                // Filter out browser internal URLs or non-web schemes
                if (u.startsWith('http://') || u.startsWith('https://')) {
                    // Skip local development URLs
                    if (!u.includes('localhost') && !u.includes('127.0.0.1')) {
                        list.push({
                            id: node.id,
                            title: node.title || 'Dấu trang không tên',
                            url: node.url,
                            location: currentPath || 'Gốc'
                        });
                    }
                }
            }

            if (node.children) {
                for (const child of node.children) {
                    traverse(child, path);
                }
            }
        }

        traverse(tree[0] || tree, '');
        return list;
    }

    // Update filter counts
    function updateCounts() {
        const total = brokenBookmarks.length;
        const count404 = brokenBookmarks.filter(b => b.errorType === '404').length;
        const countDns = brokenBookmarks.filter(b => b.errorType === 'dns').length;
        const countTimeout = brokenBookmarks.filter(b => b.errorType === 'timeout').length;

        if (pillCountAll) pillCountAll.textContent = total;
        if (pillCount404) pillCount404.textContent = count404;
        if (pillCountDns) pillCountDns.textContent = countDns;
        if (pillCountTimeout) pillCountTimeout.textContent = countTimeout;

        if (countBrokenBadge) {
            countBrokenBadge.textContent = total;
            countBrokenBadge.style.display = total > 0 ? 'inline-block' : 'none';
        }
    }

    // Update Remove Button State
    function updateRemoveBtnState() {
        if (!btnRemoveBroken) return;
        const checked = brokenList.querySelectorAll('.broken-cb:checked');
        const count = checked.length;
        btnRemoveBroken.disabled = (count === 0);
        btnRemoveBroken.textContent = count > 0 ? `Xóa ${count} liên kết hỏng đã chọn` : 'Xóa liên kết hỏng đã chọn';
        if (labelSelectAll) {
            const visibleCbs = brokenList.querySelectorAll('.broken-cb');
            labelSelectAll.textContent = `Chọn tất cả (${visibleCbs.length})`;
            if (cbSelectAll) {
                cbSelectAll.checked = visibleCbs.length > 0 && checked.length === visibleCbs.length;
            }
        }
    }

    // Render broken list
    function renderBrokenList() {
        if (!brokenList) return;

        let filtered = brokenBookmarks;
        if (currentFilter !== 'all') {
            filtered = filtered.filter(b => b.errorType === currentFilter);
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(b =>
                (b.title && b.title.toLowerCase().includes(q)) ||
                (b.url && b.url.toLowerCase().includes(q)) ||
                (b.location && b.location.toLowerCase().includes(q))
            );
        }

        if (filtered.length === 0) {
            brokenList.style.display = 'none';
            brokenEmptyState.style.display = 'block';
            if (brokenBookmarks.length > 0) {
                brokenEmptyState.innerHTML = window.PineUI.renderEmptyState({
                    icon: 'search',
                    type: 'info',
                    title: 'Không có dấu trang phù hợp',
                    desc: 'Không tìm thấy dấu trang nào khớp với bộ lọc hiện tại.'
                });
            }
            updateRemoveBtnState();
            return;
        }

        brokenEmptyState.style.display = 'none';
        brokenList.style.display = 'block';
        brokenActionBar.style.display = 'flex';

        brokenList.innerHTML = '';
        filtered.forEach(item => {
            const row = document.createElement('div');
            row.className = 'list-item';
            row.style.padding = '12px 16px';

            let badgeHtml = '';
            if (item.errorType === '404') {
                badgeHtml = '<span class="badge" style="background:#fce8e6; color:#c5221f;">404 Not Found</span>';
            } else if (item.errorType === 'dns') {
                badgeHtml = '<span class="badge" style="background:#fef3c7; color:#b45309;">Lỗi DNS / Hết hạn</span>';
            } else if (item.errorType === 'timeout') {
                badgeHtml = '<span class="badge" style="background:#f3f4f6; color:#4b5563;">Timeout (>8s)</span>';
            } else {
                badgeHtml = `<span class="badge" style="background:#fce8e6; color:#c5221f;">${escapeHtml(item.statusText || 'Lỗi')}</span>`;
            }

            row.innerHTML = `
                <div class="list-item-left" style="cursor: default; width: 100%; display: flex; align-items: flex-start; gap: 12px;">
                    <input type="checkbox" class="checkbox-custom broken-cb" data-id="${item.id}" checked style="margin-top: 3px;">
                    <div class="item-content" style="flex: 1; min-width: 0;">
                        <div class="item-title" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="font-weight: 600;">${escapeHtml(item.title)}</span>
                            ${badgeHtml}
                            <span class="badge badge-neutral" style="font-size: 11px;">${escapeHtml(item.location)}</span>
                            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="link-external" title="Mở liên kết trong tab mới để kiểm tra">
                                <svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
                            </a>
                        </div>
                        <div class="item-url" style="color: var(--text-secondary); font-size: 12px; margin-top: 4px; word-break: break-all;">
                            ${escapeHtml(item.url)}
                        </div>
                    </div>
                </div>
            `;
            brokenList.appendChild(row);
        });

        brokenList.querySelectorAll('.broken-cb').forEach(cb => {
            cb.onchange = updateRemoveBtnState;
        });

        updateRemoveBtnState();
    }

    // Scan Engine with Concurrency Pool
    async function startScan() {
        if (isScanning) return;
        isScanning = true;
        shouldAbort = false;

        btnStartScan.style.display = 'none';
        btnStopScan.style.display = 'inline-flex';
        brokenBookmarks = [];
        updateCounts();

        // Lock UI controls during scan
        filterPills.forEach(p => p.classList.add('disabled', 'ui-locked'));
        if (inputSearch) inputSearch.disabled = true;

        scanStatusText.textContent = 'Đang quét liên kết...';
        scanProgressBar.style.width = '0%';
        brokenActionBar.style.display = 'none';
        brokenEmptyState.style.display = 'none';
        brokenList.style.display = 'block';
        brokenList.innerHTML = PineUI.renderSkeleton('list', 5);

        const bookmarks = await collectWebBookmarks();
        const total = bookmarks.length;

        if (total === 0) {
            isScanning = false;
            btnStartScan.style.display = 'inline-flex';
            btnStopScan.style.display = 'none';
            filterPills.forEach(p => p.classList.remove('disabled', 'ui-locked'));
            if (inputSearch) inputSearch.disabled = false;
            scanStatusText.textContent = 'Không có dấu trang web nào';
            brokenList.style.display = 'none';
            brokenEmptyState.style.display = 'block';
            brokenEmptyState.innerHTML = '<p>Không tìm thấy dấu trang web nào để kiểm tra.</p>';
            return;
        }

        let scannedCount = 0;
        let index = 0;
        const CONCURRENCY = 10;

        async function worker() {
            while (index < bookmarks.length && !shouldAbort) {
                const item = bookmarks[index++];
                try {
                    const result = await checkUrl(item.url);
                    if (!result.alive) {
                        brokenBookmarks.push({
                            id: item.id,
                            title: item.title,
                            url: item.url,
                            location: item.location,
                            errorType: result.errorType,
                            statusText: result.statusText
                        });
                        updateCounts();
                    }
                } catch (e) {
                    console.warn('Check failed:', item.url, e);
                } finally {
                    scannedCount++;
                    const percent = Math.min(100, Math.floor((scannedCount / total) * 100));
                    scanProgressBar.style.width = `${percent}%`;
                    scanStatsText.textContent = `Đang quét: ${scannedCount} / ${total} (${percent}%) • Phát hiện ${brokenBookmarks.length} lỗi`;
                }
            }
        }

        // Launch worker pool
        const workers = [];
        for (let i = 0; i < Math.min(CONCURRENCY, total); i++) {
            workers.push(worker());
        }

        await Promise.all(workers);

        isScanning = false;
        btnStartScan.style.display = 'inline-flex';
        btnStopScan.style.display = 'none';
        filterPills.forEach(p => p.classList.remove('disabled', 'ui-locked'));
        if (inputSearch) inputSearch.disabled = false;
        btnStartScan.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
            <span>Quét lại toàn bộ</span>
        `;

        if (shouldAbort) {
            scanStatusText.textContent = 'Đã dừng quét';
            showToast('Đã dừng kiểm tra liên kết.', 'info');
        } else {
            scanStatusText.textContent = 'Quét hoàn tất';
            scanStatsText.textContent = `Đã kiểm tra xong ${total} dấu trang • Tìm thấy ${brokenBookmarks.length} lỗi`;
            showToast(`Kiểm tra xong! Phát hiện ${brokenBookmarks.length} liên kết hỏng.`, brokenBookmarks.length > 0 ? 'info' : 'success');
        }

        if (brokenBookmarks.length === 0) {
            brokenActionBar.style.display = 'none';
            brokenList.style.display = 'none';
            brokenEmptyState.style.display = 'block';
            brokenEmptyState.innerHTML = window.PineUI.renderEmptyState({
                icon: 'check-circle',
                type: 'success',
                title: 'Tất cả liên kết đều hoạt động tốt!',
                desc: 'Không phát hiện bất kỳ liên kết chết hoặc lỗi kết nối nào trong bộ sưu tập dấu trang.'
            });
        } else {
            renderBrokenList();
        }
    }

    if (btnStartScan) {
        btnStartScan.onclick = startScan;
    }

    if (btnStopScan) {
        btnStopScan.onclick = () => {
            shouldAbort = true;
            btnStopScan.disabled = true;
            btnStopScan.textContent = 'Đang dừng...';
        };
    }

    // Filter Pills click
    filterPills.forEach(pill => {
        pill.onclick = () => {
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentFilter = pill.dataset.filter;
            renderBrokenList();
        };
    });

    // Search filter input
    if (inputSearch) {
        inputSearch.oninput = (e) => {
            searchQuery = e.target.value.trim();
            renderBrokenList();
        };
    }

    // Select All Checkbox
    if (cbSelectAll) {
        cbSelectAll.onchange = (e) => {
            const isChecked = e.target.checked;
            brokenList.querySelectorAll('.broken-cb').forEach(cb => {
                cb.checked = isChecked;
            });
            updateRemoveBtnState();
        };
    }

    // Remove Selected Broken Bookmarks
    if (btnRemoveBroken) {
        btnRemoveBroken.onclick = async () => {
            if (btnRemoveBroken.disabled) return;
            const selectedCbs = Array.from(brokenList.querySelectorAll('.broken-cb:checked'));
            if (selectedCbs.length === 0) return;

            const count = selectedCbs.length;
            if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn ${count} liên kết hỏng đã chọn không?`)) {
                return;
            }

            const unlockBtn = PineUI.lock(btnRemoveBroken, 'Đang xóa...');
            const unlockList = PineUI.lock(brokenList);
            [btnSelectAllBroken, btnDeselectAllBroken, btnStartScan].forEach(b => { if (b) b.disabled = true; });

            const removedIds = new Set();
            try {
                // Auto create snapshot before destructive action
                if (typeof createAutoRestorePoint === 'function') {
                    try {
                        await createAutoRestorePoint(`Trước khi xóa ${count} liên kết hỏng`);
                    } catch (e) { /* ignore */ }
                }

                for (const cb of selectedCbs) {
                    const id = cb.dataset.id;
                    try {
                        await new Promise(resolve => {
                            if (typeof chrome !== 'undefined' && chrome.bookmarks && chrome.bookmarks.remove) {
                                chrome.bookmarks.remove(id, resolve);
                            } else if (browser.bookmarks && browser.bookmarks.remove) {
                                browser.bookmarks.remove(id).then(resolve).catch(resolve);
                            } else {
                                resolve();
                            }
                        });
                        removedIds.add(id);
                    } catch (err) { /* ignore */ }
                }
            } finally {
                unlockBtn();
                unlockList();
                [btnSelectAllBroken, btnDeselectAllBroken, btnStartScan].forEach(b => { if (b) b.disabled = false; });
            }

            brokenBookmarks = brokenBookmarks.filter(b => !removedIds.has(b.id));
            updateCounts();
            showToast(`Đã xóa thành công ${removedIds.size} liên kết hỏng!`, 'success');
            renderBrokenList();
        };
    }
});
