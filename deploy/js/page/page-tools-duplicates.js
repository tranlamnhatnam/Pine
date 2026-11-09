'use strict';

document.addEventListener('DOMContentLoaded', () => {
    initPineCore('tools-duplicates');

    const refreshBtn = document.getElementById('btn-refresh-tools');
    const selectAllBtn = document.getElementById('btn-select-all-duplicates');
    const deselectAllBtn = document.getElementById('btn-deselect-all-duplicates');
    const collapseAllBtn = document.getElementById('btn-collapse-all');
    const expandAllBtn = document.getElementById('btn-expand-all');
    const removeBtn = document.getElementById('btn-remove-duplicates');
    const list = document.getElementById('duplicate-bookmarks-list');

    if (refreshBtn) {
        refreshBtn.onclick = () => {
            if (refreshBtn.disabled) return;
            const unlock = PineUI.lock(refreshBtn, 'Đang quét...');
            [selectAllBtn, deselectAllBtn, removeBtn, collapseAllBtn, expandAllBtn].forEach(b => { if (b) b.disabled = true; });
            list.innerHTML = PineUI.renderSkeleton('list', 5);
            safePostMessage({ subject: 'init-tools' });
            setTimeout(() => {
                unlock();
                [selectAllBtn, deselectAllBtn, collapseAllBtn, expandAllBtn].forEach(b => { if (b) b.disabled = false; });
                updateRemoveBtnState();
            }, 800);
        };
    }

    if (selectAllBtn) {
        selectAllBtn.onclick = () => {
            const cbs = list.querySelectorAll('.duplicate-cb');
            cbs.forEach(cb => { cb.checked = true; });
            updateRemoveBtnState();
        };
    }

    if (deselectAllBtn) {
        deselectAllBtn.onclick = () => {
            const cbs = list.querySelectorAll('.duplicate-cb');
            cbs.forEach(cb => { cb.checked = false; });
            updateRemoveBtnState();
        };
    }

    if (collapseAllBtn) {
        collapseAllBtn.onclick = () => {
            const cards = list.querySelectorAll('.dup-group-card');
            cards.forEach(card => card.classList.add('collapsed'));
        };
    }

    if (expandAllBtn) {
        expandAllBtn.onclick = () => {
            const cards = list.querySelectorAll('.dup-group-card');
            cards.forEach(card => card.classList.remove('collapsed'));
        };
    }

    function updateRemoveBtnState() {
        if (!removeBtn) return;
        const checkedCount = list.querySelectorAll('.duplicate-cb:checked').length;
        removeBtn.disabled = (checkedCount === 0);
        removeBtn.textContent = checkedCount > 0 ? `Xóa ${checkedCount} bản sao đã chọn` : 'Xóa bản sao đã chọn';
    }

    function renderDuplicateBookmarks() {
        if (!list) return;

        const raw = pineState.tools.duplicate_bookmarks;
        let groups = [];
        if (Array.isArray(raw)) {
            groups = [raw];
        } else if (raw && typeof raw === 'object') {
            groups = Object.values(raw).filter(arr => Array.isArray(arr) && arr.length > 1);
        }

        const countBadge = document.getElementById('count-duplicates');
        let totalDuplicates = 0;
        groups.forEach(arr => {
            if (arr.length > 1) totalDuplicates += (arr.length - 1);
        });
        if (countBadge) countBadge.textContent = totalDuplicates;

        if (groups.length === 0) {
            list.innerHTML = window.PineUI.renderEmptyState({
                icon: 'check-circle',
                type: 'success',
                title: 'Không có dấu trang trùng lặp!',
                desc: 'Tất cả các liên kết trong kho dấu trang của bạn đều là duy nhất.'
            });
            if (removeBtn) {
                removeBtn.disabled = true;
                removeBtn.textContent = 'Xóa bản sao đã chọn';
            }
            return;
        }

        list.innerHTML = '';
        groups.forEach((group) => {
            const groupDuplicatesCount = Math.max(0, group.length - 1);
            const targetUrl = group[0].url || '';

            const groupCard = document.createElement('div');
            groupCard.className = 'dup-group-card';

            // Collapsible header
            const header = document.createElement('div');
            header.className = 'dup-group-header';
            header.innerHTML = `
                <div class="dup-group-header-left">
                    <svg class="dup-group-chevron" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                    <span class="dup-group-url" title="${escapeHtml(targetUrl)}">${escapeHtml(targetUrl)}</span>
                    <a href="${escapeHtml(targetUrl)}" target="_blank" rel="noopener noreferrer" class="link-external" title="Mở trang trong tab mới">
                        <svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
                    </a>
                </div>
                <div class="dup-group-header-right">
                    <span class="dup-badge">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                        <span>${groupDuplicatesCount} trùng lặp</span>
                    </span>
                    <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">(Tổng ${group.length})</span>
                </div>
            `;

            // Toggle collapse/expand on header click (ignore clicks on external links)
            header.onclick = (e) => {
                if (e.target.closest('.link-external')) return;
                groupCard.classList.toggle('collapsed');
            };

            groupCard.appendChild(header);

            // Body list of bookmarks in this group
            const body = document.createElement('div');
            body.className = 'dup-group-body';

            group.forEach((item, idx) => {
                const isOriginal = (idx === 0);
                const row = document.createElement('div');
                row.className = 'list-item';
                row.style.padding = '8px 0';
                row.style.border = 'none';

                row.innerHTML = `
                    <div class="list-item-left">
                        <input type="checkbox" class="checkbox-custom duplicate-cb" data-id="${item.id}" ${isOriginal ? '' : 'checked'}>
                        <div class="item-content">
                            <div class="item-title" style="display:flex; align-items:center; gap:8px;">
                                <span>${escapeHtml(item.title || 'Dấu trang không tên')}</span>
                                <a href="${escapeHtml(item.url || targetUrl)}" target="_blank" rel="noopener noreferrer" class="link-external" title="Mở trang trong tab mới">
                                    <svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
                                </a>
                                ${isOriginal ? '<span class="badge" style="background:#e8f0fe; color:#1a73e8; font-size:10px; padding:2px 6px; border-radius:4px;">Gốc (Giữ lại)</span>' : '<span class="badge" style="background:#fce8e6; color:#c5221f; font-size:10px; padding:2px 6px; border-radius:4px;">Bản sao (Sẽ xóa)</span>'}
                            </div>
                            <div class="item-subtitle">${escapeHtml(item.location || 'Vị trí')}</div>
                        </div>
                    </div>
                `;
                body.appendChild(row);
            });

            groupCard.appendChild(body);
            list.appendChild(groupCard);
        });

        list.querySelectorAll('.duplicate-cb').forEach(cb => {
            cb.onchange = updateRemoveBtnState;
        });

        updateRemoveBtnState();

        if (removeBtn) {
            removeBtn.onclick = async () => {
                if (removeBtn.disabled) return;
                const selectedIds = Array.from(list.querySelectorAll('.duplicate-cb:checked')).map(cb => cb.dataset.id);
                if (selectedIds.length === 0) return;
                if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} bản sao dấu trang đã chọn không?`)) return;

                const unlockBtn = PineUI.lock(removeBtn, 'Đang xóa...');
                const unlockList = PineUI.lock(list);
                [selectAllBtn, deselectAllBtn, refreshBtn, collapseAllBtn, expandAllBtn].forEach(b => { if (b) b.disabled = true; });

                try {
                    if (typeof createAutoRestorePoint === 'function') {
                        try {
                            await createAutoRestorePoint(`Trước khi xóa ${selectedIds.length} bản sao trùng lặp`);
                        } catch (e) { /* ignore */ }
                    }
                    safePostMessage({
                        subject: 'tool-duplicate-bookmarks-remove',
                        bookmarks: selectedIds
                    });
                } finally {
                    unlockBtn();
                    unlockList();
                    [selectAllBtn, deselectAllBtn, refreshBtn, collapseAllBtn, expandAllBtn].forEach(b => { if (b) b.disabled = false; });
                }
            };
        }
    }

    pineState.listeners.initTools.push(renderDuplicateBookmarks);

    // Initial render if data already exists in pineState, else show skeleton
    if (pineState.tools.duplicate_bookmarks) {
        renderDuplicateBookmarks();
    } else if (list) {
        list.innerHTML = PineUI.renderSkeleton('list', 5);
    }
});
