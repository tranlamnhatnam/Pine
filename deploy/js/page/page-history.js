'use strict';

document.addEventListener('DOMContentLoaded', () => {
    initPineCore('history');

    const container = document.getElementById('history-container');
    const filterSelect = document.getElementById('select-history-filter');
    const clearHistoryBtn = document.getElementById('btn-clear-history');

    // Show initial loading state
    if (container) {
        container.innerHTML = '<div class="empty-state"><p>Đang tải lịch sử phiên bản...</p></div>';
    }

    async function fetchDirectStorageFallback() {
        if (!pineState.tools.bookmark_history || pineState.tools.bookmark_history.length === 0) {
            try {
                if (browser.storage && browser.storage.local) {
                    const res = await browser.storage.local.get('bookmark_history');
                    if (res && res.bookmark_history && Array.isArray(res.bookmark_history)) {
                        pineState.tools.bookmark_history = res.bookmark_history;
                        renderHistory();
                    }
                }
            } catch (e) {
                console.warn('Fallback history load error:', e);
            }
        }
    }

    function renderHistory() {
        if (!container) return;

        const filterVal = filterSelect ? filterSelect.value : 'all';
        const rawHistory = pineState.tools.bookmark_history;
        let historyList = Array.isArray(rawHistory) ? [...rawHistory] : (rawHistory && typeof rawHistory === 'object' ? Object.values(rawHistory) : []);

        // Sort by timestamp descending (newest first)
        historyList.sort((a, b) => (b.when || 0) - (a.when || 0));

        const filtered = historyList.filter(item => {
            if (!item || typeof item !== 'object') return false;
            if (filterVal === 'all') return true;
            if (filterVal === 'modified') return item.activity === 'modified' || item.activity === 'changed';
            if (filterVal === 'sorted') return item.activity === 'sorted' || item.activity === 'cleaned';
            return item.activity === filterVal;
        });

        if (filtered.length === 0) {
            container.innerHTML = PineUI ? PineUI.renderEmptyState({
                icon: 'history',
                type: 'info',
                title: 'Chưa có lịch sử thay đổi',
                description: 'Mọi thao tác thêm mới, chỉnh sửa, di chuyển hoặc sắp xếp dấu trang sẽ tự động lưu lại tại đây.'
            }) : `
                <div class="empty-state">
                    <div class="empty-state-icon info"><span data-icon="history" data-size="20"></span></div>
                    <div class="empty-state-title">Chưa có lịch sử thay đổi</div>
                    <div class="empty-state-desc">Mọi thao tác thêm mới, chỉnh sửa, di chuyển hoặc sắp xếp dấu trang sẽ tự động lưu lại tại đây.</div>
                </div>
            `;
            if (window.PineIcons && typeof PineIcons.renderAll === 'function') {
                PineIcons.renderAll(container);
            } else if (window.PineIcons && typeof PineIcons.applyIcons === 'function') {
                PineIcons.applyIcons(container);
            }
            return;
        }

        const grouped = {};
        filtered.forEach(item => {
            const dateStr = formatDateGroup(item.when);
            if (!grouped[dateStr]) grouped[dateStr] = [];
            grouped[dateStr].push(item);
        });

        container.innerHTML = '';

        for (const [dateGroup, items] of Object.entries(grouped)) {
            if (!Array.isArray(items)) continue;
            const header = document.createElement('div');
            header.className = 'history-date-header';
            header.textContent = dateGroup;
            container.appendChild(header);

            items.forEach((item) => {
                const row = document.createElement('div');
                row.className = 'history-item';

                const badgeClass = getBadgeClass(item.activity);
                const badgeText = getBadgeText(item.activity);
                const diffSign = getDiffSign(item.activity);
                const diffColor = getDiffColor(item.activity);
                const timeStr = formatTime(item.when);

                const isFolder = item.type === 'folder' || (!item.url && item.type !== 'system');
                let iconSvg = '';
                if (item.type === 'system' || item.activity === 'sorted') {
                    iconSvg = `<svg viewBox="0 0 24 24" fill="#188038"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>`;
                } else if (isFolder) {
                    iconSvg = `<svg viewBox="0 0 24 24" fill="#F59E0B"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;
                } else {
                    iconSvg = `<svg viewBox="0 0 24 24" fill="#3B82F6"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`;
                }

                row.innerHTML = `
                    <div class="history-item-left">
                        <div class="item-avatar">${iconSvg}</div>
                        <div class="item-content">
                            <div class="item-title">${escapeHtml(item.title || item.url || 'Thao tác dấu trang')}</div>
                            <div class="item-subtitle">
                                <span class="badge ${badgeClass}">${badgeText}</span>
                                <span class="badge badge-neutral">${escapeHtml(item.location || 'Hệ thống')}</span>
                            </div>
                        </div>
                    </div>
                    <div class="history-item-right">
                        <span class="badge-counter ${diffColor}">${diffSign}</span>
                        <span>${timeStr}</span>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                    </div>
                `;

                const details = document.createElement('div');
                details.className = 'history-details';
                details.innerHTML = `
                    <div><strong>Tiêu đề:</strong> ${escapeHtml(item.title || '(Trống)')}</div>
                    ${item.url ? `<div><strong>URL:</strong> <code>${escapeHtml(item.url)}</code></div>` : ''}
                    <div><strong>Vị trí:</strong> ${escapeHtml(item.location || 'Gốc')}</div>
                    <div><strong>Loại:</strong> ${escapeHtml(item.type || 'bookmark')}</div>
                    <div><strong>Thời gian:</strong> ${new Date(item.when).toLocaleString('vi-VN')}</div>
                `;

                row.onclick = () => {
                    const isOpen = details.classList.contains('open');
                    details.classList.toggle('open', !isOpen);
                };

                container.appendChild(row);
                container.appendChild(details);
            });
        }
    }

    function formatDateGroup(timestamp) {
        if (!timestamp) return 'Gần đây';
        const date = new Date(timestamp);
        const now = new Date();

        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        if (diffDays === 0 && date.getDate() === now.getDate()) return 'Hôm nay';
        if (diffDays <= 1) return 'Hôm qua';

        const daysOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        const dayName = daysOfWeek[date.getDay()];
        return `${dayName}, ${date.getDate()} thg ${date.getMonth() + 1}`;
    }

    function formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const hours = String(date.getHours()).padStart(2, '0');
        const mins = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${mins}`;
    }

    function getBadgeClass(activity) {
        switch (activity) {
            case 'created': return 'badge-add';
            case 'modified':
            case 'changed': return 'badge-mod';
            case 'removed': return 'badge-del';
            case 'sorted': return 'badge-add';
            case 'cleaned': return 'badge-del';
            case 'moved': return 'badge-neutral';
            default: return 'badge-neutral';
        }
    }

    function getBadgeText(activity) {
        switch (activity) {
            case 'created': return 'Đã thêm';
            case 'modified':
            case 'changed': return 'Đã sửa';
            case 'removed': return 'Đã xóa';
            case 'moved': return 'Đã di chuyển';
            case 'sorted': return 'Đã sắp xếp';
            case 'cleaned': return 'Đã dọn dẹp';
            default: return activity || 'Thay đổi';
        }
    }

    function getDiffSign(activity) {
        switch (activity) {
            case 'created': return '+1';
            case 'removed': return '-1';
            case 'sorted': return '⚡';
            case 'cleaned': return '🧹';
            case 'moved': return '↔';
            default: return '~';
        }
    }

    function getDiffColor(activity) {
        switch (activity) {
            case 'created':
            case 'sorted': return 'green';
            case 'removed':
            case 'cleaned': return 'red';
            default: return '';
        }
    }

    if (filterSelect) {
        filterSelect.onchange = renderHistory;
    }

    if (clearHistoryBtn) {
        clearHistoryBtn.onclick = () => {
            if (confirm('Bạn có chắc chắn muốn xóa toàn bộ nhật ký lịch sử không?')) {
                safePostMessage({ subject: 'tool-bookmark-history-clear' });
                pineState.tools.bookmark_history = [];
                renderHistory();
            }
        };
    }

    pineState.listeners.initHistory.push(renderHistory);
    pineState.listeners.initTools.push(renderHistory);

    // Initial load check
    fetchDirectStorageFallback();
    if (pineState.tools.bookmark_history && pineState.tools.bookmark_history.length > 0) {
        renderHistory();
    }
});
