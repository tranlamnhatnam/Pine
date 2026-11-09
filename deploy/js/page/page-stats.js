'use strict';

document.addEventListener('DOMContentLoaded', () => {
    initPineCore('stats');

    const refreshBtn = document.getElementById('btn-refresh-stats');
    const totalBookmarksEl = document.getElementById('stats-total-bookmarks');
    const totalFoldersEl = document.getElementById('stats-total-folders');
    const totalDomainsEl = document.getElementById('stats-total-domains');
    const httpsRateEl = document.getElementById('stats-https-rate');
    const domainsListEl = document.getElementById('domains-list-container');
    const foldersListEl = document.getElementById('folders-list-container');
    const chartContainerEl = document.getElementById('chart-container');
    const domainBadgeEl = document.getElementById('badge-domain-count');
    const folderBadgeEl = document.getElementById('badge-folder-count');

    window.onSortDone = () => {
        analyzeBookmarks();
    };

    window.onFolderSorted = () => {
        analyzeBookmarks();
    };

    pineState.listeners.initOptions.push(() => {
        analyzeBookmarks();
    });

    if (refreshBtn) {
        refreshBtn.onclick = async () => {
            if (refreshBtn.disabled) return;
            const unlock = PineUI.lock(refreshBtn, 'Đang làm mới...');
            if (domainsListEl) domainsListEl.innerHTML = window.PineUI.renderSkeleton('domain-rows', 5);
            if (foldersListEl) foldersListEl.innerHTML = window.PineUI.renderSkeleton('folder-rows', 5);
            try {
                await analyzeBookmarks();
            } finally {
                unlock();
            }
        };
    }

    async function analyzeBookmarks() {
        if (!browser.bookmarks || !browser.bookmarks.getTree) return;

        // Populate initial skeleton states if empty
        if (domainsListEl && !domainsListEl.querySelector('.domain-row')) {
            domainsListEl.innerHTML = window.PineUI.renderSkeleton('domain-rows', 5);
        }
        if (foldersListEl && !foldersListEl.querySelector('.folder-row')) {
            foldersListEl.innerHTML = window.PineUI.renderSkeleton('folder-rows', 5);
        }

        try {
            const tree = await browser.bookmarks.getTree();

            let totalBookmarks = 0;
            let totalFolders = 0;
            let httpsCount = 0;
            const domainCounts = {};
            const foldersList = [];
            const bookmarkTimestamps = [];

            function traverse(node, currentPath) {
                const isRoot = (node.id === '0' || !node.id);
                const path = isRoot ? '' : (currentPath ? `${currentPath} / ${node.title || 'Thư mục'}` : (node.title || 'Thư mục'));

                if (node.url) {
                    totalBookmarks++;
                    if (node.dateAdded) bookmarkTimestamps.push(node.dateAdded);

                    try {
                        const parsed = new URL(node.url);
                        if (parsed.protocol === 'https:') httpsCount++;
                        let host = parsed.hostname.toLowerCase();
                        if (host.startsWith('www.')) host = host.slice(4);
                        if (host) {
                            domainCounts[host] = (domainCounts[host] || 0) + 1;
                        }
                    } catch (err) {}
                } else {
                    if (!isRoot) {
                        totalFolders++;
                        let childrenCount = 0;
                        if (node.children) {
                            function countDescendants(children) {
                                for (const c of children) {
                                    if (c.url) childrenCount++;
                                    if (c.children) countDescendants(c.children);
                                }
                            }
                            countDescendants(node.children);
                        }
                        foldersList.push({
                            id: node.id,
                            title: node.title || 'Thư mục không tên',
                            path: currentPath || 'Gốc',
                            count: childrenCount
                        });
                    }
                }

                if (node.children) {
                    for (const child of node.children) {
                        traverse(child, path);
                    }
                }
            }

            traverse(tree[0] || tree, '');

            // 1. KPI cards
            const distinctDomains = Object.keys(domainCounts).length;
            if (totalBookmarksEl) totalBookmarksEl.textContent = totalBookmarks.toLocaleString();
            if (totalFoldersEl) totalFoldersEl.textContent = totalFolders.toLocaleString();
            if (totalDomainsEl) totalDomainsEl.textContent = distinctDomains.toLocaleString();

            const httpsRate = totalBookmarks > 0 ? Math.round((httpsCount / totalBookmarks) * 100) : 100;
            if (httpsRateEl) httpsRateEl.textContent = `${httpsRate}%`;

            // 2. Render Top Domains
            const sortedDomains = Object.entries(domainCounts)
                .sort((a, b) => b[1] - a[1]);

            if (domainBadgeEl) domainBadgeEl.textContent = `${distinctDomains} tên miền`;

            if (sortedDomains.length === 0) {
                domainsListEl.innerHTML = window.PineUI.renderEmptyState({
                    icon: 'globe',
                    type: 'info',
                    title: 'Chưa có dữ liệu tên miền',
                    desc: 'Chưa phát hiện địa chỉ website hợp lệ nào trong kho lưu trữ dấu trang.'
                });
            } else {
                domainsListEl.innerHTML = '';
                const maxCount = sortedDomains[0][1] || 1;
                const top15 = sortedDomains.slice(0, 15);

                top15.forEach(([domain, count], idx) => {
                    const percent = Math.round((count / totalBookmarks) * 100);
                    const barWidth = Math.max(4, Math.round((count / maxCount) * 100));

                    const row = document.createElement('div');
                    row.className = 'domain-row';
                    row.innerHTML = `
                        <div class="domain-left">
                            <span class="domain-rank">#${idx + 1}</span>
                            <span class="domain-name" title="${escapeHtml(domain)}">${escapeHtml(domain)}</span>
                        </div>
                        <div class="domain-bar-bg">
                            <div class="domain-bar-fill" style="width: ${barWidth}%"></div>
                        </div>
                        <span class="domain-count">${count.toLocaleString()} (${percent}%)</span>
                    `;
                    domainsListEl.appendChild(row);
                });
            }

            // 3. Render Largest Folders
            foldersList.sort((a, b) => b.count - a.count);
            if (folderBadgeEl) folderBadgeEl.textContent = `${totalFolders} thư mục`;

            if (foldersList.length === 0) {
                foldersListEl.innerHTML = window.PineUI.renderEmptyState({
                    icon: 'folder',
                    type: 'info',
                    title: 'Chưa có thư mục nào',
                    desc: 'Toàn bộ dấu trang hiện đang nằm ở thư mục gốc hoặc chưa tạo thư mục con.'
                });
            } else {
                foldersListEl.innerHTML = '';
                const top15Folders = foldersList.slice(0, 15);

                top15Folders.forEach((folder) => {
                    const row = document.createElement('div');
                    row.className = 'folder-row';
                    row.innerHTML = `
                        <div class="folder-info">
                            <div class="folder-title">${escapeHtml(folder.title)}</div>
                            <div class="folder-path">${escapeHtml(folder.path)}</div>
                        </div>
                        <span class="badge badge-neutral" style="font-weight: 700; font-size: 12px; margin-left: 12px;">
                            ${folder.count.toLocaleString()} mục
                        </span>
                    `;
                    foldersListEl.appendChild(row);
                });
            }

            // 4. Render Growth SVG Chart
            renderGrowthChart(bookmarkTimestamps, totalBookmarks);

        } catch (e) {
            console.error('Stats analysis failed:', e);
        }
    }

    function calculateNiceTicks(min, max, targetTicks = 5) {
        if (min === max) {
            if (min === 0) {
                max = 10;
            } else {
                const pad = Math.max(1, Math.ceil(min * 0.15));
                min = Math.max(0, min - pad);
                max = max + pad;
            }
        }
        const range = max - min;
        const rawStep = range / (targetTicks - 1);
        const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
        const normalizedStep = rawStep / magnitude;
        let step;
        if (normalizedStep <= 1.2) step = 1 * magnitude;
        else if (normalizedStep <= 2.5) step = 2 * magnitude;
        else if (normalizedStep <= 5) step = 5 * magnitude;
        else step = 10 * magnitude;

        let niceMin = Math.floor(min / step) * step;
        if (niceMin < 0) niceMin = 0;
        let niceMax = Math.ceil(max / step) * step;
        if (niceMax === niceMin) niceMax = niceMin + step * (targetTicks - 1);

        const ticks = [];
        for (let val = niceMin; val <= niceMax + 0.0001; val += step) {
            ticks.push(Math.round(val));
        }
        return { min: ticks[0], max: ticks[ticks.length - 1], ticks };
    }

    function renderGrowthChart(timestamps, totalCount) {
        if (!chartContainerEl) return;

        if (totalCount === 0 || timestamps.length === 0) {
            chartContainerEl.innerHTML = '<div style="color: var(--text-muted); font-size: 13px;">Chưa có đủ dữ liệu lịch sử để vẽ biểu đồ.</div>';
            return;
        }

        // Generate 7 time points (last 7 days or periods)
        const pointsCount = 7;
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        const historyData = [];

        for (let i = pointsCount - 1; i >= 0; i--) {
            const cutoff = now - (i * oneDay);
            const countAtCutoff = timestamps.filter(t => t <= cutoff).length;
            const dateObj = new Date(cutoff);
            const label = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
            historyData.push({ label, count: Math.max(0, countAtCutoff) });
        }

        // Difference badge
        const firstCount = historyData[0].count;
        const lastCount = historyData[historyData.length - 1].count;
        const diff = lastCount - firstCount;
        const diffBadge = document.getElementById('chart-diff-badge');
        if (diffBadge) {
            diffBadge.style.display = 'inline-block';
            if (diff > 0) {
                diffBadge.className = 'badge badge-success';
                diffBadge.textContent = `+${diff.toLocaleString()} dấu trang`;
            } else if (diff < 0) {
                diffBadge.className = 'badge badge-danger';
                diffBadge.textContent = `${diff.toLocaleString()} dấu trang`;
            } else {
                diffBadge.className = 'badge badge-neutral';
                diffBadge.textContent = 'Không đổi';
            }
        }

        // Calculate Y scale and nice reference ticks
        const counts = historyData.map(d => d.count);
        const minCount = Math.min(...counts);
        const maxCount = Math.max(...counts);
        const diffCount = maxCount - minCount;

        let scaleMin = 0;
        let scaleMax = maxCount;
        if (minCount > 0 && (minCount / (maxCount || 1)) > 0.4 && diffCount > 0) {
            // High baseline data: give breathing room below minCount so variations stand out
            const pad = Math.max(1, Math.ceil(diffCount * 0.25));
            scaleMin = Math.max(0, minCount - pad);
            scaleMax = maxCount + pad;
        } else if (minCount === maxCount && minCount > 0) {
            const pad = Math.max(1, Math.ceil(minCount * 0.15));
            scaleMin = Math.max(0, minCount - pad);
            scaleMax = maxCount + pad;
        } else {
            scaleMax = Math.max(10, Math.ceil(maxCount * 1.15));
        }

        const scaleInfo = calculateNiceTicks(scaleMin, scaleMax, 5);
        const niceMin = scaleInfo.min;
        const niceMax = scaleInfo.max;
        const ticks = scaleInfo.ticks;

        // Dimensions
        const svgWidth = 720;
        const svgHeight = 220;
        const marginLeft = 56;
        const marginRight = 28;
        const marginTop = 32;
        const marginBottom = 32;

        const chartWidth = svgWidth - marginLeft - marginRight;
        const chartHeight = svgHeight - marginTop - marginBottom;
        const baselineY = svgHeight - marginBottom;

        // Render dashed horizontal grid lines and Y-axis labels
        const gridLines = ticks.map(tickVal => {
            const normY = (tickVal - niceMin) / (niceMax - niceMin || 1);
            const y = baselineY - (normY * chartHeight);
            return `
                <g class="chart-grid-line">
                    <line x1="${marginLeft}" y1="${y.toFixed(1)}" x2="${svgWidth - marginRight}" y2="${y.toFixed(1)}" stroke="var(--border-color)" stroke-dasharray="4,4" stroke-width="1" opacity="0.65" />
                    <text x="${marginLeft - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--text-muted)" font-family="system-ui, -apple-system, sans-serif">${tickVal.toLocaleString()}</text>
                </g>
            `;
        }).join('');

        // Bottom baseline
        const baseLineHtml = `<line x1="${marginLeft}" y1="${baselineY}" x2="${svgWidth - marginRight}" y2="${baselineY}" stroke="var(--border-color)" stroke-width="1.5" />`;

        // Calculate points for the smooth line chart & columns
        const points = historyData.map((d, idx) => {
            const x = marginLeft + (idx / (pointsCount - 1)) * chartWidth;
            const normY = Math.max(0, Math.min(1, (d.count - niceMin) / (niceMax - niceMin || 1)));
            const y = baselineY - (normY * chartHeight);
            return { x, y, count: d.count, label: d.label };
        });

        // Area & line paths
        const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
        const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${baselineY.toFixed(1)} L ${points[0].x.toFixed(1)} ${baselineY.toFixed(1)} Z`;

        // Vertical columns & vertical dashed guide lines (Cột dọc và lưới dọc)
        const colWidth = 28;
        const verticalGuidesHtml = points.map(p => {
            const colHeight = Math.max(4, baselineY - p.y);
            return `
                <g class="chart-vertical-col">
                    <line x1="${p.x.toFixed(1)}" y1="${marginTop}" x2="${p.x.toFixed(1)}" y2="${baselineY}" stroke="var(--border-color)" stroke-dasharray="3,3" stroke-width="1" opacity="0.5" />
                    <rect class="chart-col-bar" x="${(p.x - colWidth / 2).toFixed(1)}" y="${p.y.toFixed(1)}" width="${colWidth}" height="${colHeight.toFixed(1)}" rx="4" fill="url(#columnGradient)" />
                </g>
            `;
        }).join('');

        // Point groups (Interactive circles, top values, bottom labels, hitboxes)
        const hitWidth = chartWidth / pointsCount;
        const pointGroupsHtml = points.map(p => {
            return `
                <g class="chart-point-group">
                    <title>${p.label}: ${p.count.toLocaleString()} dấu trang</title>
                    <rect x="${(p.x - hitWidth / 2).toFixed(1)}" y="${marginTop}" width="${hitWidth.toFixed(1)}" height="${chartHeight + marginBottom}" fill="transparent" />
                    <circle class="chart-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="var(--primary-blue, #1a73e8)" stroke="#ffffff" stroke-width="2.5" />
                    <text class="chart-val" x="${p.x.toFixed(1)}" y="${(p.y - 10).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" fill="var(--text-primary)">${p.count.toLocaleString()}</text>
                    <text x="${p.x.toFixed(1)}" y="${(svgHeight - 10).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="500" fill="var(--text-secondary)">${p.label}</text>
                </g>
            `;
        }).join('');

        chartContainerEl.innerHTML = `
            <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: 100%; overflow: visible;" aria-label="Biểu đồ biến động số lượng dấu trang">
                <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.28" />
                        <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.02" />
                    </linearGradient>
                    <linearGradient id="columnGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.16" />
                        <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.04" />
                    </linearGradient>
                    <linearGradient id="columnHoverGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.32" />
                        <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.10" />
                    </linearGradient>
                </defs>
                ${gridLines}
                ${baseLineHtml}
                ${verticalGuidesHtml}
                <path d="${areaPath}" fill="url(#chartGradient)" />
                <path d="${linePath}" fill="none" stroke="var(--primary-blue, #1a73e8)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                ${pointGroupsHtml}
            </svg>
        `;
    }

    analyzeBookmarks();
});
