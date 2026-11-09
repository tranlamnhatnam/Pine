'use strict';

document.addEventListener('DOMContentLoaded', () => {
    initPineCore('tools-similar');

    const refreshBtn = document.getElementById('btn-refresh-tools');
    const selectAllBtn = document.getElementById('btn-select-all-similar');
    const deselectAllBtn = document.getElementById('btn-deselect-all-similar');
    const collapseAllBtn = document.getElementById('btn-collapse-all-similar');
    const expandAllBtn = document.getElementById('btn-expand-all-similar');
    const removeBtn = document.getElementById('btn-remove-similar');
    const list = document.getElementById('similar-bookmarks-list');

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
            const cbs = list.querySelectorAll('.similar-cb');
            cbs.forEach(cb => { cb.checked = true; });
            updateRemoveBtnState();
        };
    }

    if (deselectAllBtn) {
        deselectAllBtn.onclick = () => {
            const cbs = list.querySelectorAll('.similar-cb');
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
        const checkedCount = list.querySelectorAll('.similar-cb:checked').length;
        removeBtn.disabled = (checkedCount === 0);
        removeBtn.textContent = checkedCount > 0 ? `Xóa ${checkedCount} mục tương tự đã chọn` : 'Xóa mục tương tự đã chọn';
    }

    function renderSimilarBookmarks() {
        if (!list) return;

        const raw = pineState.tools.similar_bookmarks;
        let groups = [];
        if (Array.isArray(raw)) {
            groups = [raw];
        } else if (raw && typeof raw === 'object') {
            groups = Object.values(raw).filter(arr => Array.isArray(arr) && arr.length > 1);
        }

        const countBadge = document.getElementById('count-similar');
        let totalSimilar = 0;
        groups.forEach(arr => {
            if (arr.length > 1) totalSimilar += (arr.length - 1);
        });
        if (countBadge) countBadge.textContent = totalSimilar;

        if (groups.length === 0) {
            list.innerHTML = window.PineUI.renderEmptyState({
                icon: 'check-circle',
                type: 'success',
                title: 'Không có dấu trang tương tự!',
                desc: 'Bộ sưu tập của bạn rất tinh gọn, không có liên kết nào bị lưu lặp phân nhánh.'
            });
            if (removeBtn) {
                removeBtn.disabled = true;
                removeBtn.textContent = 'Xóa mục tương tự đã chọn';
            }
            return;
        }

        list.innerHTML = '';
        groups.forEach((group) => {
            const groupSimilarCount = Math.max(0, group.length - 1);
            const targetUrl = group[0].url || '';

            const groupCard = document.createElement('div');
            groupCard.className = 'dup-group-card';

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
                    <span class="dup-badge similar">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                        <span>${groupSimilarCount} tương tự</span>
                    </span>
                    <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">(Tổng ${group.length})</span>
                </div>
            `;

            header.onclick = (e) => {
                if (e.target.closest('.link-external')) return;
                groupCard.classList.toggle('collapsed');
            };

            groupCard.appendChild(header);

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
                        <input type="checkbox" class="checkbox-custom similar-cb" data-id="${item.id}" ${isOriginal ? '' : 'checked'}>
                        <div class="item-content">
                            <div class="item-title" style="display:flex; align-items:center; gap:8px;">
                                <span>${escapeHtml(item.title || 'Dấu trang không tên')}</span>
                                <a href="${escapeHtml(item.url || targetUrl)}" target="_blank" rel="noopener noreferrer" class="link-external" title="Mở trang trong tab mới">
                                    <svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
                                </a>
                                ${isOriginal ? '<span class="badge" style="background:#e8f0fe; color:#1a73e8; font-size:10px; padding:2px 6px; border-radius:4px;">Gốc (Giữ lại)</span>' : '<span class="badge" style="background:#fff3e0; color:#e65100; font-size:10px; padding:2px 6px; border-radius:4px;">Tương tự (Sẽ xóa)</span>'}
                            </div>
                            <div class="item-subtitle">${escapeHtml(item.url || '')} &bull; ${escapeHtml(item.location || 'Vị trí')}</div>
                        </div>
                    </div>
                `;
                body.appendChild(row);
            });

            groupCard.appendChild(body);
            list.appendChild(groupCard);
        });

        list.querySelectorAll('.similar-cb').forEach(cb => {
            cb.onchange = updateRemoveBtnState;
        });

        updateRemoveBtnState();

        if (removeBtn) {
            removeBtn.onclick = async () => {
                if (removeBtn.disabled) return;
                const selectedIds = Array.from(list.querySelectorAll('.similar-cb:checked')).map(cb => cb.dataset.id);
                if (selectedIds.length === 0) return;
                if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} dấu trang tương tự đã chọn không?`)) return;

                const unlockBtn = PineUI.lock(removeBtn, 'Đang xóa...');
                const unlockList = PineUI.lock(list);
                [selectAllBtn, deselectAllBtn, refreshBtn, collapseAllBtn, expandAllBtn].forEach(b => { if (b) b.disabled = true; });

                try {
                    if (typeof createAutoRestorePoint === 'function') {
                        try {
                            await createAutoRestorePoint(`Trước khi xóa ${selectedIds.length} dấu trang tương tự`);
                        } catch (e) { /* ignore */ }
                    }
                    safePostMessage({
                        subject: 'tool-similar-bookmarks-remove',
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

    pineState.listeners.initTools.push(renderSimilarBookmarks);

    // Initial render if data already exists in pineState, else show skeleton
    if (pineState.tools.similar_bookmarks) {
        renderSimilarBookmarks();
    } else if (list) {
        list.innerHTML = PineUI.renderSkeleton('list', 5);
    }
});
