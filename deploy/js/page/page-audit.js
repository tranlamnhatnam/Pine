'use strict';

document.addEventListener('DOMContentLoaded', () => {
    initPineCore('audit');

    const btnRefresh = document.getElementById('btn-refresh-audit');
    const btnSortAll = document.getElementById('btn-sort-now-audit');
    const inputFilter = document.getElementById('input-filter-unsorted');
    const cardUnsorted = document.getElementById('card-unsorted-folders');

    // Overview DOM elements
    const auditMainIcon = document.getElementById('audit-main-icon');
    const titleText = document.getElementById('audit-title-text');
    const descText = document.getElementById('audit-summary-desc');
    const scoreCircle = document.getElementById('audit-score-circle');
    const scoreVal = document.getElementById('audit-score-val');
    const statusBadge = document.getElementById('audit-status-badge');
    const progressFill = document.getElementById('audit-progress-fill');
    const progressText = document.getElementById('audit-progress-text');

    // Metrics DOM elements
    const statSortedFolders = document.getElementById('audit-stat-sorted-folders');
    const statUnsortedFolders = document.getElementById('audit-stat-unsorted-folders');
    const statMisplacedItems = document.getElementById('audit-stat-misplaced-items');
    const statHealth = document.getElementById('audit-stat-health');

    // Unsorted list DOM elements
    const unsortedList = document.getElementById('audit-unsorted-list');
    const unsortedBadge = document.getElementById('audit-unsorted-badge');

    let currentAudit = null;
    let filterQuery = '';

    // Handle sort completed triggers
    window.onSortDone = () => {
        runAudit();
    };

    window.onFolderSorted = () => {
        runAudit();
    };

    // Re-run audit when background options arrive or change
    if (window.pineState && window.pineState.listeners) {
        pineState.listeners.initOptions.push(() => {
            runAudit();
        });
        pineState.listeners.optionSet.push(() => {
            runAudit();
        });
    }

    if (btnSortAll) {
        btnSortAll.onclick = () => {
            triggerSortNow(btnSortAll);
        };
    }

    if (btnRefresh) {
        btnRefresh.onclick = async () => {
            if (btnRefresh.disabled) return;
            const unlock = PineUI.lock(btnRefresh, 'Đang quét...');
            try {
                await runAudit();
            } finally {
                unlock();
            }
        };
    }

    if (inputFilter) {
        inputFilter.oninput = (e) => {
            filterQuery = e.target.value.trim().toLowerCase();
            renderUnsortedFolders();
        };
    }

    async function runAudit() {
        if (!window.PineCore || !window.PineCore.evaluateBookmarkOrganization) return;

        // Display skeleton loading in unsorted list if visible
        if (unsortedList && cardUnsorted && cardUnsorted.style.display !== 'none') {
            unsortedList.innerHTML = PineUI.renderSkeleton('audit-rows', 3);
        }

        try {
            const tree = await window.PineCore.getBookmarkTreeAsync();
            const audit = await window.PineCore.evaluateBookmarkOrganization(tree);
            currentAudit = audit;
            renderAuditHero(audit);
            renderUnsortedFolders();
        } catch (err) {
            console.error('Audit evaluation error:', err);
            if (descText) {
                descText.textContent = 'Có lỗi xảy ra khi kiểm tra trật tự dấu trang.';
                descText.style.color = 'var(--danger-color)';
            }
        }
    }

    function renderAuditHero(audit) {
        if (!scoreVal) return;

        scoreVal.textContent = `${audit.sortRate}%`;

        // Update score circle & badge styles
        const level = audit.statusLevel; // 'excellent' | 'warning' | 'critical'
        if (scoreCircle) scoreCircle.className = `audit-circle-gauge ${level}`;
        if (auditMainIcon) {
            auditMainIcon.className = `audit-icon ${level}`;
            const iconName = (level === 'excellent') ? 'check-circle' : (level === 'warning' ? 'alert-triangle' : 'alert-circle');
            auditMainIcon.innerHTML = PineIcons.get(iconName, { size: 24 });
        }

        if (statusBadge) {
            statusBadge.className = `audit-status-pill ${level}`;
            let badgeLabel = 'Hoàn hảo';
            if (level === 'warning') badgeLabel = 'Cần tối ưu';
            else if (level === 'critical') badgeLabel = 'Chưa sắp xếp';
            statusBadge.textContent = badgeLabel;
        }

        if (titleText) titleText.textContent = audit.statusTitle;
        if (descText) {
            descText.textContent = audit.statusDescription;
            descText.style.color = 'var(--text-secondary)';
        }

        if (progressFill) {
            progressFill.className = `audit-progress-bar ${level}`;
            progressFill.style.width = `${audit.sortRate}%`;
        }
        if (progressText) {
            progressText.textContent = `${audit.sortRate}%`;
        }

        if (statSortedFolders) {
            statSortedFolders.textContent = `${audit.sortedFoldersCount} / ${audit.evaluableFoldersCount}`;
        }
        if (statUnsortedFolders) {
            statUnsortedFolders.textContent = audit.unsortedFoldersCount;
            statUnsortedFolders.style.color = audit.unsortedFoldersCount > 0 ? 'var(--danger-color)' : 'var(--success-color)';
        }
        if (statMisplacedItems) {
            statMisplacedItems.textContent = audit.totalMisplacedBookmarks;
        }
        if (statHealth) {
            statHealth.textContent = `${audit.healthScore}/100`;
        }
    }

    function renderUnsortedFolders() {
        if (!currentAudit) return;

        const allUnsorted = currentAudit.unsortedFolders || [];

        // If 100% sorted: HIDE Card 2 completely to avoid duplicate redundant boxes!
        if (allUnsorted.length === 0) {
            if (cardUnsorted) cardUnsorted.style.display = 'none';
            return;
        }

        // If there ARE unsorted folders: SHOW Card 2
        if (cardUnsorted) cardUnsorted.style.display = 'block';

        if (unsortedBadge) {
            unsortedBadge.textContent = `${allUnsorted.length} thư mục`;
            unsortedBadge.className = 'badge badge-warning';
        }

        // Apply filter
        const filtered = filterQuery
            ? allUnsorted.filter(f => (f.title && f.title.toLowerCase().includes(filterQuery)) || (f.path && f.path.toLowerCase().includes(filterQuery)))
            : allUnsorted;

        if (!unsortedList) return;

        if (filtered.length === 0) {
            unsortedList.innerHTML = PineUI.renderEmptyState({
                icon: 'search',
                type: 'info',
                title: 'Không tìm thấy thư mục khớp',
                desc: `Không có thư mục chưa sắp xếp nào khớp với từ khóa "${escapeHtml(filterQuery)}".`
            });
            return;
        }

        unsortedList.innerHTML = '';
        filtered.forEach(folder => {
            const item = document.createElement('div');
            item.className = 'audit-folder-row';
            item.innerHTML = `
                <div class="audit-folder-left">
                    <div class="audit-folder-icon-box">
                        ${PineIcons.get('folder', { size: 22, color: '#f59e0b' })}
                    </div>
                    <div class="audit-folder-meta">
                        <div class="audit-folder-name" title="${escapeHtml(folder.title)}">${escapeHtml(folder.title)}</div>
                        <div class="audit-folder-path" title="${escapeHtml(folder.path)}">${escapeHtml(folder.path)} • Quy tắc: <strong>${escapeHtml(folder.ruleLabel)}</strong></div>
                    </div>
                </div>
                <div class="audit-folder-right">
                    <span class="badge badge-warning" style="font-size: 11.5px; font-weight: 600;">
                        ${folder.misplacedCount.toLocaleString('vi-VN')} / ${folder.totalItems.toLocaleString('vi-VN')} mục lệch
                    </span>
                    <button type="button" class="btn btn-sm btn-secondary btn-sort-single-folder" data-folder-id="${folder.id}">
                        ${PineIcons.get('sort', { size: 12 })}
                        <span>Sắp xếp</span>
                    </button>
                </div>
            `;

            const sortBtn = item.querySelector('.btn-sort-single-folder');
            if (sortBtn) {
                sortBtn.onclick = () => {
                    window.PineCore.triggerSortFolder(folder.id, sortBtn);
                };
            }

            unsortedList.appendChild(item);
        });

        if (window.PineIcons && typeof PineIcons.renderAll === 'function') {
            PineIcons.renderAll(unsortedList);
        } else if (window.PineIcons && typeof PineIcons.applyIcons === 'function') {
            PineIcons.applyIcons(unsortedList);
        }
    }

    // Initial run
    runAudit();
});
