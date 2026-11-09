'use strict';

document.addEventListener('DOMContentLoaded', () => {
    initPineCore('tools-favicons');

    const btnStartRefresh = document.getElementById('btn-start-favicon-refresh');
    const statTotalBookmarks = document.getElementById('stat-total-bookmarks');
    const statTotalDomains = document.getElementById('stat-total-domains');
    const statCacheStatus = document.getElementById('stat-cache-status');
    const progressCard = document.getElementById('favicon-progress-card');
    const progressText = document.getElementById('favicon-progress-text');
    const progressDetail = document.getElementById('favicon-progress-detail');
    const progressFill = document.getElementById('favicon-progress-fill');
    const inputFilterDomains = document.getElementById('input-filter-domains');
    const domainsGrid = document.getElementById('domains-grid');
    const cacheWarmer = document.getElementById('favicon-cache-warmer');

    let domainList = [];
    let isRefreshing = false;
    let searchQuery = '';

    // Extract domain cleanly
    function getDomain(url) {
        try {
            const parsed = new URL(url);
            return parsed.hostname.replace(/^www\./, '').toLowerCase();
        } catch (e) {
            return '';
        }
    }

    // Google Favicon URL helper
    function getFaviconUrl(domain) {
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
    }

    // Load and group bookmarks by domain
    async function loadDomainStats() {
        if (domainsGrid) domainsGrid.innerHTML = PineUI.renderSkeleton('grid', 8);
        if (statTotalBookmarks) statTotalBookmarks.innerHTML = '<span class="skeleton skeleton-pill" style="width: 40px; height: 18px;"></span>';
        if (statTotalDomains) statTotalDomains.innerHTML = '<span class="skeleton skeleton-pill" style="width: 35px; height: 18px;"></span>';

        try {
            const tree = await getBookmarkTreeAsync();
            const map = new Map();
            let totalWebBookmarks = 0;

            function traverse(node) {
                if (node.url) {
                    const u = node.url.trim();
                    if (u.startsWith('http://') || u.startsWith('https://')) {
                        totalWebBookmarks++;
                        const d = getDomain(u);
                        if (d && !d.includes('localhost') && !d.includes('127.0.0.1')) {
                            map.set(d, (map.get(d) || 0) + 1);
                        }
                    }
                }
                if (node.children) {
                    for (const child of node.children) {
                        traverse(child);
                    }
                }
            }

            traverse(tree[0] || tree);

            domainList = Array.from(map.entries())
                .map(([domain, count]) => ({ domain, count }))
                .sort((a, b) => b.count - a.count);

            if (statTotalBookmarks) statTotalBookmarks.textContent = totalWebBookmarks.toLocaleString();
            if (statTotalDomains) statTotalDomains.textContent = domainList.length.toLocaleString();

            renderDomainsGrid();
        } catch (err) {
            console.error('Failed to load domains:', err);
            if (domainsGrid) domainsGrid.innerHTML = '<div style="color:var(--danger-color); padding:16px;">Lỗi khi tải danh sách tên miền.</div>';
        }
    }

    // Render domains gallery
    function renderDomainsGrid() {
        if (!domainsGrid) return;

        let filtered = domainList;
        if (searchQuery) {
            filtered = filtered.filter(d => d.domain.includes(searchQuery.toLowerCase()));
        }

        if (filtered.length === 0) {
            domainsGrid.innerHTML = PineUI ? PineUI.renderEmptyState({
                icon: 'globe',
                type: 'info',
                title: 'Không tìm thấy tên miền',
                description: 'Không có tên miền nào khớp với từ khóa tìm kiếm.'
            }) : '<div class="empty-state" style="grid-column: 1 / -1; padding:32px 16px;"><p>Không tìm thấy tên miền nào.</p></div>';
            if (window.PineIcons && typeof PineIcons.renderAll === 'function') {
                PineIcons.renderAll(domainsGrid);
            } else if (window.PineIcons && typeof PineIcons.applyIcons === 'function') {
                PineIcons.applyIcons(domainsGrid);
            }
            return;
        }

        let html = '';
        filtered.forEach(item => {
            const faviconUrl = getFaviconUrl(item.domain);
            html += `
                <div class="domain-card" style="display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:8px; border:1px solid var(--border-color); background-color:var(--bg-page); transition:border-color 0.15s ease;">
                    <div style="width:36px; height:36px; border-radius:8px; background-color:var(--bg-card); border:1px solid var(--border-subtle); display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden;">
                        <img src="${faviconUrl}" alt="${escapeHtml(item.domain)}" width="24" height="24" style="object-fit:contain;">
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:600; font-size:13px; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;" title="${escapeHtml(item.domain)}">
                            ${escapeHtml(item.domain)}
                        </div>
                        <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">
                            ${item.count} dấu trang
                        </div>
                    </div>
                </div>
            `;
        });

        domainsGrid.innerHTML = html;
    }

    // Refresh Favicon Engine
    async function startFaviconRefresh() {
        if (isRefreshing || domainList.length === 0) return;
        isRefreshing = true;

        const unlockBtn = PineUI.lock(btnStartRefresh, 'Đang làm mới...');
        if (inputFilterDomains) inputFilterDomains.disabled = true;
        progressCard.style.display = 'block';
        statCacheStatus.textContent = 'Đang nạp...';
        statCacheStatus.style.color = 'var(--primary-blue)';

        let completed = 0;
        const total = domainList.length;
        const CONCURRENCY = 15;
        let index = 0;

        if (cacheWarmer) cacheWarmer.innerHTML = '';

        async function worker() {
            while (index < domainList.length) {
                const item = domainList[index++];
                await new Promise(resolve => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => resolve();
                    img.onerror = () => resolve(); // continue even if 404
                    img.src = getFaviconUrl(item.domain) + '&t=' + Date.now();
                    if (cacheWarmer) cacheWarmer.appendChild(img);
                });

                completed++;
                const percent = Math.min(100, Math.floor((completed / total) * 100));
                progressFill.style.width = `${percent}%`;
                progressDetail.textContent = `${completed} / ${total} (${percent}%)`;
                progressText.textContent = `Đang nạp biểu tượng: ${item.domain}`;
            }
        }

        const workers = [];
        for (let i = 0; i < Math.min(CONCURRENCY, total); i++) {
            workers.push(worker());
        }

        try {
            await Promise.all(workers);
        } finally {
            isRefreshing = false;
            unlockBtn();
            if (inputFilterDomains) inputFilterDomains.disabled = false;
        }

        progressText.textContent = 'Đã hoàn tất nạp bộ nhớ đệm favicon!';
        statCacheStatus.textContent = 'Đã tối ưu';
        statCacheStatus.style.color = 'var(--success-color)';

        showToast(`Đã làm mới thành công Favicon cho ${total} tên miền!`, 'success');
        renderDomainsGrid();
    }

    if (btnStartRefresh) {
        btnStartRefresh.onclick = startFaviconRefresh;
    }

    if (inputFilterDomains) {
        inputFilterDomains.oninput = (e) => {
            searchQuery = e.target.value.trim();
            renderDomainsGrid();
        };
    }

    if (domainsGrid) {
        // Fallback for broken favicons without violating CSP
        domainsGrid.addEventListener('error', (e) => {
            if (e.target && e.target.tagName === 'IMG') {
                e.target.src = '/images/icon/icon-default-24.png';
            }
        }, true);
    }

    // Initial load
    loadDomainStats();
});
