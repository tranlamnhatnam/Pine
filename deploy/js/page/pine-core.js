'use strict';

// Shared state for Pine extension pages
const pineState = {
    ancestor: {},
    option: {},
    preference: {},
    setting: {},
    tools: {
        bookmark_history: [],
        duplicate_bookmarks: {},
        empty_folders: {},
        similar_bookmarks: {}
    },
    port: null,
    listeners: {
        initOptions: [],
        initTools: [],
        initHistory: [],
        optionSet: [],
        preferenceSet: []
    }
};

const ANCESTOR_NAMES = {
    bookmarks_bar: 'Thanh dấu trang (Bookmarks Bar)',
    favorites_bar: 'Thanh mục yêu thích (Favorites Bar)',
    other_bookmarks: 'Dấu trang khác (Other Bookmarks)',
    other_favorites: 'Mục yêu thích khác (Other Favorites)',
    mobile_bookmarks: 'Dấu trang di động (Mobile Bookmarks)',
    mobile_favorites: 'Mục yêu thích di động (Mobile Favorites)',
    bookmarks_menu: 'Menu dấu trang (Bookmarks Menu)',
    bookmarks_toolbar: 'Thanh công cụ dấu trang',
    imported_bookmarks: 'Dấu trang đã nhập (Imported)',
    speed_dials: 'Quay số nhanh (Speed Dials)',
    unsorted_bookmarks: 'Dấu trang chưa phân loại',
    trash: 'Thùng rác (Trash)'
};

const SORT_LABELS = {
    alpha: 'Tên A – Z',
    alphaReverse: 'Tên Z – A',
    date: 'Mới nhất trước',
    dateReverse: 'Cũ nhất trước',
    url: 'URL A – Z',
    urlReverse: 'URL Z – A',
    '': 'Chưa chọn kiểu'
};

// Toast notification
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(12px)';
        setTimeout(() => toast.remove(), 250);
    }, 3200);
}

// Escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}


// Dynamic browser tab favicon updater
function updateTabFavicon(iconColor) {
    let iconName = 'icon-default-32.png';
    if (iconColor === 'green') {
        iconName = 'icon-green-32.png';
    } else if (iconColor === 'dark') {
        iconName = 'icon-dark-32.png';
    } else if (iconColor === 'light') {
        iconName = 'icon-light-32.png';
    } else if (iconColor === 'automatic') {
        const isDarkOS = window.matchMedia('(prefers-color-scheme: dark)').matches;
        iconName = isDarkOS ? 'icon-light-32.png' : 'icon-dark-32.png';
    }

    let link = document.querySelector("link[rel*='icon']");
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/png';
        document.head.appendChild(link);
    }
    link.href = '/images/icon/' + iconName;
}

// Theme handling
function applyTheme(theme) {
    const isDarkOS = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let isDark = false;

    if (theme === 'dark') {
        isDark = true;
    } else if (theme === 'light') {
        isDark = false;
    } else {
        isDark = isDarkOS;
    }

    document.documentElement.classList.toggle('dark', isDark);
    document.body.classList.toggle('dark', isDark);
}

// Safe send message to background
function safePostMessage(msg) {
    if (pineState.port) {
        try {
            pineState.port.postMessage(msg);
        } catch (e) {
            console.warn('Pine port message failed:', e);
        }
    }
}

// Send option to background
function setOption(name, value) {
    pineState.option[name] = value;
    safePostMessage({
        subject: 'option-set',
        name: name,
        value: value
    });
}

// Send preference to background
function setPreference(name, value) {
    pineState.preference[name] = value;
    safePostMessage({
        subject: 'preference-set',
        name: name,
        value: value
    });
}

// Trigger manual sort
function triggerSortNow(btnEl) {
    if (!pineState.port || pineState.isSorting) return;
    pineState.isSorting = true;
    const btns = document.querySelectorAll('.btn-sort-now, #btn-popup-sort, #btn-sort-now');
    btns.forEach(btn => {
        btn.disabled = true;
        btn.classList.add('btn-loading');
        if (!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
        btn.innerHTML = '<span class="spinner" style="width:13px;height:13px;margin-right:6px;"></span> <span>Đang sắp xếp...</span>';
    });

    safePostMessage({ subject: 'sort-now' });
}

function resetSortButtons() {
    pineState.isSorting = false;
    const btns = document.querySelectorAll('.btn-sort-now, #btn-popup-sort, #btn-sort-now');
    btns.forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('btn-loading');
        if (btn.dataset.originalHtml) {
            btn.innerHTML = btn.dataset.originalHtml;
        } else {
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
                <span>Sắp xếp ngay</span>
            `;
        }
    });
}

function updateToolBadges() {
    const emptyFolders = pineState.tools.empty_folders || {};
    const emptyCount = Array.isArray(emptyFolders) ? emptyFolders.length : Object.keys(emptyFolders).length;

    const dup = pineState.tools.duplicate_bookmarks || {};
    let dupCount = 0;
    if (Array.isArray(dup)) {
        dupCount = dup.length;
    } else if (dup && typeof dup === 'object') {
        Object.values(dup).forEach(arr => {
            if (Array.isArray(arr)) dupCount += (arr.length > 1 ? arr.length - 1 : arr.length);
        });
    }

    const sim = pineState.tools.similar_bookmarks || {};
    let simCount = 0;
    if (Array.isArray(sim)) {
        simCount = sim.length;
    } else if (sim && typeof sim === 'object') {
        Object.values(sim).forEach(arr => {
            if (Array.isArray(arr)) simCount += (arr.length > 1 ? arr.length - 1 : arr.length);
        });
    }

    const emptyBadges = document.querySelectorAll('#count-empty-folders, .badge-count-empty');
    emptyBadges.forEach(b => { b.textContent = emptyCount; });

    const dupBadges = document.querySelectorAll('#count-duplicates, .badge-count-duplicates');
    dupBadges.forEach(b => { b.textContent = dupCount; });

    const simBadges = document.querySelectorAll('#count-similar, .badge-count-similar');
    simBadges.forEach(b => { b.textContent = simCount; });
}

// ==========================================================================
// Pine Duotone Icon System
// ==========================================================================
const PineIcons = {
    icons: {
        'options': '<svg viewBox="0 0 24 24"><circle class="duotone-secondary" cx="12" cy="12" r="3.5"/><path class="duotone-primary" d="M19.4 13c.04-.32.06-.66.06-1s-.02-.68-.07-1l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65A.488.488 0 0 0 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.05.32-.07.65-.07 1s.02.68.07 1l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64L19.4 13zm-7.4 2.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>',

        'rules': '<svg viewBox="0 0 24 24"><path class="duotone-secondary" d="M3 4h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path class="duotone-primary" d="M7 8h10M7 12h10M7 16h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle class="duotone-primary" cx="15" cy="8" r="2"/><circle class="duotone-primary" cx="9" cy="12" r="2"/><circle class="duotone-primary" cx="13" cy="16" r="2"/></svg>',

        'stats': '<svg viewBox="0 0 24 24"><rect class="duotone-secondary" x="3" y="12" width="4" height="9" rx="1"/><rect class="duotone-secondary" x="10" y="8" width="4" height="13" rx="1"/><rect class="duotone-secondary" x="17" y="4" width="4" height="17" rx="1"/><path class="duotone-primary" d="M3 21h18v2H2a1 1 0 0 1-1-1V3h2v18zm2-8l5-5 4 4 6-7 1.4 1.4-7.4 8.6-4-4-3.6 3.6L5 13z"/></svg>',

        'history': '<svg viewBox="0 0 24 24"><circle class="duotone-secondary" cx="12" cy="12" r="9"/><path class="duotone-primary" d="M12.5 7v5l3.5 2.1-.8 1.3-4.2-2.5V7h1.5z"/><path class="duotone-primary" d="M3.05 11a9 9 0 0 1 15.9-4.9L21 4v6h-6l2.5-2.5A7 7 0 1 0 19 12h2a9 9 0 0 1-17.95-1z"/></svg>',

        'cleanup': '<svg viewBox="0 0 24 24"><path class="duotone-secondary" d="M5 8l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12H5z"/><path class="duotone-primary" d="M3 6h18v2H3V6zm5-4h8v2H8V2zm2 8h2v8h-2v-8zm4 0h2v8h-2v-8z"/></svg>',

        'tools-empty': '<svg viewBox="0 0 24 24"><path class="duotone-secondary" d="M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z"/><path class="duotone-primary" d="M4 6h5l2 2h9v2H4V6zm5 7h6v2H9v-2z"/></svg>',

        'tools-duplicates': '<svg viewBox="0 0 24 24"><rect class="duotone-secondary" x="7" y="3" width="14" height="15" rx="2"/><path class="duotone-primary" d="M3 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zm5 3h5v5l-2.5-1.5L8 15v-5z"/></svg>',

        'tools-similar': '<svg viewBox="0 0 24 24"><circle class="duotone-secondary" cx="6" cy="12" r="4"/><circle class="duotone-secondary" cx="18" cy="6" r="4"/><circle class="duotone-secondary" cx="18" cy="18" r="4"/><path class="duotone-primary" d="M6 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm12-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-8-3l6-3m-6 2l6 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',

        'tools-broken': '<svg viewBox="0 0 24 24"><circle class="duotone-secondary" cx="12" cy="12" r="10"/><path class="duotone-primary" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',

        'tools-dormant': '<svg viewBox="0 0 24 24"><path class="duotone-secondary" d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8A9 9 0 0 0 12 3z"/><path class="duotone-primary" d="M15 4h4v1.5h-2.5l2.5 3V10h-4V8.5h2.5l-2.5-3V4zm-3 5h3v1.5h-1.8l1.8 2.2V14h-3v-1.5h1.8l-1.8-2.2V9z"/></svg>',

        'tools-replace': '<svg viewBox="0 0 24 24"><circle class="duotone-secondary" cx="10" cy="10" r="7"/><path class="duotone-primary" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zm7-2l3-3-3-3v2h-4v2h4v2zm-2 5l-3 3 3 3v-2h4v-2h-4v-2z"/></svg>',

        'tools-favicons': '<svg viewBox="0 0 24 24"><path class="duotone-secondary" d="M4 14l2-4 2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/><path class="duotone-primary" d="M14 2l2.5 5.5L22 10l-5.5 2.5L14 18l-2.5-5.5L6 10l5.5-2.5L14 2z"/></svg>',

        'sync': '<svg viewBox="0 0 24 24"><path class="duotone-secondary" d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/><path class="duotone-primary" d="M12 9v2.5l2.5-2.5L12 6.5V9a4 4 0 0 0-4 4h1.5a2.5 2.5 0 0 1 2.5-2.5zm0 6v-2.5L9.5 15l2.5 2.5V15a4 4 0 0 0 4-4h-1.5a2.5 2.5 0 0 1-2.5 2.5z"/></svg>',

        'audit': '<svg viewBox="0 0 24 24"><path class="duotone-secondary" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/><path class="duotone-primary" d="M10 15.5l-3.5-3.5 1.4-1.4 2.1 2.1 5.6-5.6 1.4 1.4-7 7z"/></svg>',

        'sort': '<svg viewBox="0 0 24 24"><path class="duotone-secondary" d="M3 6h10v2H3V6zm0 5h8v2H3v-2zm0 5h6v2H3v-2z"/><path class="duotone-primary" d="M17 4l4 4h-3v7h-2V8h-3l4-4zm0 16l-4-4h3V9h2v7h3l-4 4z"/></svg>',

        'folder': '<svg viewBox="0 0 24 24"><path class="duotone-secondary" d="M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z"/><path class="duotone-primary" d="M2 9h20v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9z"/></svg>',

        'bookmark': '<svg viewBox="0 0 24 24"><path class="duotone-secondary" d="M5 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v17l-7-3.5L5 21V4z"/><path class="duotone-primary" d="M12 14.5l-5 2.5V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v13l-5-2.5z"/></svg>',

        'globe': '<svg viewBox="0 0 24 24"><circle class="duotone-secondary" cx="12" cy="12" r="10"/><path class="duotone-primary" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2c1.7 2.4 2.7 5.1 2.9 8H9.1c.2-2.9 1.2-5.6 2.9-8zm0 16c-1.7-2.4-2.7-5.1-2.9-8h5.8c-.2 2.9-1.2 5.6-2.9 8zm-4.9-8c.2-2.5 1-4.7 2.3-6.6A8.02 8.02 0 0 0 4.1 12h3zm9.8 0h3a8.02 8.02 0 0 0-5.3-6.6c1.3 1.9 2.1 4.1 2.3 6.6z"/></svg>',

        'lock': '<svg viewBox="0 0 24 24"><rect class="duotone-secondary" x="4" y="10" width="16" height="12" rx="3"/><path class="duotone-primary" d="M8 10V7a4 4 0 0 1 8 0v3h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2zm2-3a2 2 0 1 1 4 0v3h-4V7zm2 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>',

        'refresh': '<svg viewBox="0 0 24 24"><circle class="duotone-secondary" cx="12" cy="12" r="8"/><path class="duotone-primary" d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',

        'check-circle': '<svg viewBox="0 0 24 24"><circle class="duotone-secondary" cx="12" cy="12" r="10"/><path class="duotone-primary" d="M10 15.5l-3.5-3.5 1.4-1.4 2.1 2.1 5.6-5.6 1.4 1.4-7 7z"/></svg>',

        'alert-triangle': '<svg viewBox="0 0 24 24"><path class="duotone-secondary" d="M12 2L1 21h22L12 2z"/><path class="duotone-primary" d="M11 9h2v5h-2zm0 6h2v2h-2z"/></svg>',

        'alert-circle': '<svg viewBox="0 0 24 24"><circle class="duotone-secondary" cx="12" cy="12" r="10"/><path class="duotone-primary" d="M11 7h2v6h-2zm0 8h2v2h-2z"/></svg>',

        'search': '<svg viewBox="0 0 24 24"><circle class="duotone-secondary" cx="10" cy="10" r="6"/><path class="duotone-primary" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',

        'trash': '<svg viewBox="0 0 24 24"><path class="duotone-secondary" d="M5 8l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12H5z"/><path class="duotone-primary" d="M3 6h18v2H3V6zm5-4h8v2H8V2zm2 8h2v8h-2v-8zm4 0h2v8h-2v-8z"/></svg>'
    },

    get(name, options = {}) {
        const size = options.size || 18;
        const className = options.className || '';
        const color = options.color ? `color: ${options.color};` : '';
        const iconSvg = this.icons[name] || this.icons['bookmark'];
        return `<span class="pine-icon pine-icon-${name} ${className}" style="width:${size}px; height:${size}px; ${color}" aria-hidden="true">${iconSvg}</span>`;
    },

    renderAll(root = document) {
        if (!root || !root.querySelectorAll) return;
        const elements = root.querySelectorAll('[data-icon]');
        elements.forEach(el => {
            const name = el.getAttribute('data-icon');
            const size = el.getAttribute('data-size') || 18;
            const extraClass = el.getAttribute('data-class') || '';
            const color = el.getAttribute('data-color') || '';
            el.innerHTML = this.get(name, { size, className: extraClass, color });
        });
    },

    applyIcons(root = document) {
        this.renderAll(root);
    }
};

// ==========================================================================
// Pine UI Component Helpers (Skeletons, Empty & Loading States)
// ==========================================================================
const PineUI = {
    renderSkeleton(type = 'list', count = 5) {
        let html = '';
        if (type === 'list' || type === 'items') {
            for (let i = 0; i < count; i++) {
                const titleWidth = Math.max(30, Math.floor(75 - (i % 3) * 15));
                const subWidth = Math.max(40, Math.floor(88 - (i % 4) * 12));
                html += `
                    <div class="skeleton-row" style="padding: 12px 14px; gap: 12px; align-items: center;">
                        <div class="skeleton skeleton-box" style="width: 16px; height: 16px; border-radius: 4px; flex-shrink: 0;"></div>
                        <div class="skeleton skeleton-circle" style="width: 22px; height: 22px; flex-shrink: 0;"></div>
                        <div style="flex: 1; min-width: 0;">
                            <div class="skeleton skeleton-text" style="width: ${titleWidth}%; margin-bottom: 6px;"></div>
                            <div class="skeleton skeleton-text sm" style="width: ${subWidth}%;"></div>
                        </div>
                        <div class="skeleton skeleton-pill" style="width: 65px; height: 20px; flex-shrink: 0;"></div>
                    </div>
                `;
            }
        } else if (type === 'grid') {
            html += '<div class="skeleton-grid">';
            for (let i = 0; i < count; i++) {
                const w = Math.max(40, Math.floor(80 - (i % 3) * 16));
                html += `
                    <div class="skeleton-grid-card">
                        <div class="skeleton skeleton-circle" style="width: 24px; height: 24px; flex-shrink: 0;"></div>
                        <div style="flex: 1; min-width: 0;">
                            <div class="skeleton skeleton-text" style="width: ${w}%; margin-bottom: 5px;"></div>
                            <div class="skeleton skeleton-text sm" style="width: 45%;"></div>
                        </div>
                    </div>
                `;
            }
            html += '</div>';
        } else if (type === 'domain-rows') {
            for (let i = 0; i < count; i++) {
                const widthPercent = Math.max(35, Math.floor(95 - i * 12));
                html += `
                    <div class="skeleton-row">
                        <div class="skeleton skeleton-circle" style="width: 20px; height: 20px; flex-shrink: 0;"></div>
                        <div style="flex: 1; min-width: 0;">
                            <div class="skeleton skeleton-text" style="width: ${widthPercent}%;"></div>
                        </div>
                        <div class="skeleton skeleton-pill" style="width: 70px; height: 18px;"></div>
                    </div>
                `;
            }
        } else if (type === 'folder-rows') {
            for (let i = 0; i < count; i++) {
                html += `
                    <div class="skeleton-row">
                        <div class="skeleton skeleton-circle" style="width: 24px; height: 24px; flex-shrink: 0;"></div>
                        <div style="flex: 1; min-width: 0;">
                            <div class="skeleton skeleton-text" style="width: 50%;"></div>
                            <div class="skeleton skeleton-text sm" style="width: 75%;"></div>
                        </div>
                        <div class="skeleton skeleton-pill" style="width: 60px; height: 20px;"></div>
                    </div>
                `;
            }
        } else if (type === 'audit-rows') {
            for (let i = 0; i < count; i++) {
                html += `
                    <div class="skeleton-row" style="background-color: var(--bg-page); border-radius: 8px; margin-bottom: 8px;">
                        <div class="skeleton skeleton-circle" style="width: 22px; height: 22px;"></div>
                        <div style="flex: 1;">
                            <div class="skeleton skeleton-text" style="width: 45%;"></div>
                            <div class="skeleton skeleton-text sm" style="width: 65%;"></div>
                        </div>
                        <div class="skeleton skeleton-pill" style="width: 75px; height: 24px;"></div>
                    </div>
                `;
            }
        }
        return html;
    },

    /**
     * Lock button or container during async waiting/operations
     * @param {HTMLElement} target Button or container to lock
     * @param {string} [loadingText] Optional text to display on button with spinner
     * @returns {Function} unlock function
     */
    lock(target, loadingText) {
        if (!target) return () => {};
        const isButton = target.tagName === 'BUTTON' || target.classList.contains('btn');
        let originalText = '';
        let originalDisabled = false;

        if (isButton) {
            originalText = target.innerHTML;
            originalDisabled = target.disabled;
            target.disabled = true;
            target.classList.add('btn-loading');
            if (loadingText) {
                target.innerHTML = `<span class="spinner" style="width:13px;height:13px;margin-right:6px;border-width:2px;"></span><span>${escapeHtml(loadingText)}</span>`;
            }
        } else {
            target.dataset.busy = 'true';
            target.classList.add('ui-locked');
            const elements = target.querySelectorAll('button, input, select, textarea');
            elements.forEach(el => {
                el.dataset.prevDisabled = el.disabled ? 'true' : 'false';
                el.disabled = true;
            });
        }

        let unlocked = false;
        return function unlock() {
            if (unlocked) return;
            unlocked = true;
            if (isButton) {
                target.disabled = originalDisabled;
                target.classList.remove('btn-loading');
                if (loadingText) {
                    target.innerHTML = originalText;
                }
            } else {
                delete target.dataset.busy;
                target.classList.remove('ui-locked');
                const elements = target.querySelectorAll('button, input, select, textarea');
                elements.forEach(el => {
                    if (el.dataset.prevDisabled !== undefined) {
                        el.disabled = el.dataset.prevDisabled === 'true';
                        delete el.dataset.prevDisabled;
                    }
                });
            }
        };
    },

    /**
     * Execute an asynchronous task safely wrapped with UI operation locking
     */
    async withLock(target, loadingText, asyncFn) {
        const unlock = PineUI.lock(target, loadingText);
        try {
            return await asyncFn();
        } finally {
            unlock();
        }
    },

    renderEmptyState(opts = {}) {
        const iconName = opts.icon || 'check-circle';
        const type = opts.type || '';
        const title = opts.title || 'Không có dữ liệu';
        const desc = opts.desc || '';
        const actionHtml = opts.actionHtml || '';

        return `
            <div class="empty-state ${type ? 'empty-state-' + type : ''}">
                <div class="empty-state-icon ${type}">
                    ${PineIcons.get(iconName, { size: 20 })}
                </div>
                <div class="empty-state-title">${escapeHtml(title)}</div>
                ${desc ? `<div class="empty-state-desc">${escapeHtml(desc)}</div>` : ''}
                ${actionHtml ? `<div class="empty-state-action">${actionHtml}</div>` : ''}
            </div>
        `;
    },

    renderLoadingState(message = 'Đang tải dữ liệu...') {
        return `
            <div class="loading-state">
                <div class="loading-state-icon">
                    ${PineIcons.get('refresh', { size: 24, className: 'spinner spinner-blue' })}
                </div>
                <div class="loading-state-text">${escapeHtml(message)}</div>
            </div>
        `;
    }
};

function upgradeSidebarIcons() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const navMappings = {
        'options': 'options',
        'rules': 'rules',
        'audit': 'audit',
        'stats': 'stats',
        'history': 'history',
        'cleanup': 'cleanup',
        'tools-empty': 'tools-empty',
        'tools-duplicates': 'tools-duplicates',
        'tools-similar': 'tools-similar',
        'tools-broken': 'tools-broken',
        'tools-dormant': 'tools-dormant',
        'utilities': 'tools-replace',
        'tools-replace': 'tools-replace',
        'tools-favicons': 'tools-favicons',
        'sync': 'sync'
    };

    sidebar.querySelectorAll('[data-page]').forEach(link => {
        const page = link.getAttribute('data-page');
        const iconName = navMappings[page];
        if (!iconName) return;

        const existingSvg = link.querySelector('svg:not(.chevron-icon)');
        if (existingSvg) {
            existingSvg.outerHTML = PineIcons.get(iconName, { size: 18 });
        }
    });
}

// Connect to background service worker
function initPineCore(currentPageKey) {
    // Render Duotone Icons & upgrade sidebar
    PineIcons.renderAll();
    upgradeSidebarIcons();
    // Highlight sidebar active item and subitem
    const navLinks = document.querySelectorAll('.nav-item, .nav-subitem, .tool-subnav-link');
    navLinks.forEach(link => {
        const page = link.dataset.page || link.dataset.subpage;
        link.classList.toggle('active', page === currentPageKey);
    });

    // Expand matching tool group submenu
    const isCleanup = ['tools-empty', 'tools-duplicates', 'tools-similar', 'tools-broken', 'tools-dormant'].includes(currentPageKey);
    const isUtility = ['tools-replace', 'tools-favicons'].includes(currentPageKey);

    const cleanupGroup = document.getElementById('nav-group-cleanup');
    if (cleanupGroup) {
        cleanupGroup.classList.toggle('expanded', isCleanup);
        const pLink = cleanupGroup.querySelector('.nav-parent');
        if (pLink) pLink.classList.toggle('active', isCleanup);
    }

    const utilityGroup = document.getElementById('nav-group-utilities');
    if (utilityGroup) {
        utilityGroup.classList.toggle('expanded', isUtility);
        const pLink = utilityGroup.querySelector('.nav-parent');
        if (pLink) pLink.classList.toggle('active', isUtility);
    }

    // Version label
    const versionEl = document.getElementById('app-version');
    if (versionEl && browser.runtime.getManifest) {
        versionEl.textContent = 'v' + browser.runtime.getManifest().version;
    }

    // Support link
    const supportLink = document.getElementById('link-support');
    if (supportLink) {
        supportLink.onclick = (e) => {
            e.preventDefault();
            showToast('Cảm ơn bạn đã đồng hành và ủng hộ Pine!');
        };
    }

    // Connect port
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) { /* consume */ }
        let isUnloading = false;
        window.addEventListener('beforeunload', () => {
            isUnloading = true;
        });

        const port = browser.runtime.connect({ name: 'options' });
        pineState.port = port;

        port.onMessage.addListener(handlePortMessage);
        port.onDisconnect.addListener(() => {
            // Check and consume lastError to prevent "Receiving end does not exist" console noise
            const lastErr = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) || (typeof browser !== 'undefined' && browser.runtime && browser.runtime.lastError);
            pineState.port = null;
            if (!isUnloading) {
                setTimeout(() => {
                    if (!isUnloading) initPineCore(currentPageKey);
                }, 2000);
            }
        });

        // Request initial states
        safePostMessage({ subject: 'init-options' });
        if (currentPageKey === 'history') {
            safePostMessage({ subject: 'init-history' });
        } else if (currentPageKey && currentPageKey.startsWith('tools')) {
            safePostMessage({ subject: 'init-tools' });
        }
    } catch (err) {
        console.error('Failed to connect to background:', err);
    }
}

function handlePortMessage(msg) {
    if (!msg || !msg.subject) return;

    switch (msg.subject) {
        case 'init-history':
            if (msg.bookmark_history) pineState.tools.bookmark_history = msg.bookmark_history;
            pineState.listeners.initHistory.forEach(fn => fn(pineState));
            break;

        case 'init-options':
            pineState.ancestor = msg.ancestor || {};
            pineState.option = msg.option || {};
            pineState.preference = msg.preference || {};
            pineState.setting = msg.setting || {};

            applyTheme(pineState.preference.theme);
            updateTabFavicon(pineState.preference.icon_color);
            pineState.listeners.initOptions.forEach(fn => fn(pineState));
            break;

        case 'init-tools':
            if (msg.bookmark_history) pineState.tools.bookmark_history = msg.bookmark_history;
            if (msg.duplicate_bookmarks) pineState.tools.duplicate_bookmarks = msg.duplicate_bookmarks;
            if (msg.empty_folders) pineState.tools.empty_folders = msg.empty_folders;
            if (msg.similar_bookmarks) pineState.tools.similar_bookmarks = msg.similar_bookmarks;

            updateToolBadges();
            pineState.listeners.initTools.forEach(fn => fn(pineState));
            break;

        case 'option-set':
            if (msg.name) {
                pineState.option[msg.name] = msg.value;
                pineState.listeners.optionSet.forEach(fn => fn(msg.name, msg.value));
            }
            break;

        case 'preference-set':
            if (msg.name) {
                pineState.preference[msg.name] = msg.value;
                if (msg.name === 'theme') applyTheme(msg.value);
                if (msg.name === 'icon_color') updateTabFavicon(msg.value);
                pineState.listeners.preferenceSet.forEach(fn => fn(msg.name, msg.value));
            }
            break;

        case 'ancestor-and-option':
            pineState.ancestor = msg.ancestor || {};
            pineState.option = msg.option || {};
            pineState.listeners.initOptions.forEach(fn => fn(pineState));
            break;

        case 'sort-now-done':
            resetSortButtons();
            showToast('Đã sắp xếp lại toàn bộ dấu trang thành công!', 'success');
            safePostMessage({ subject: 'init-tools' });
            if (typeof window.onSortDone === 'function') {
                window.onSortDone();
            }
            break;

        case 'sort-folder-done':
            showToast('Đã sắp xếp lại thư mục thành công!', 'success');
            if (typeof window.onFolderSorted === 'function') {
                window.onFolderSorted(msg.id);
            }
            break;

        case 'tool-empty-folders-removed':
        case 'tool-duplicate-bookmarks-removed':
        case 'tool-similar-bookmarks-removed':
        case 'tool-bookmark-history-cleared':
            showToast('Thao tác dọn dẹp hoàn tất thành công!', 'success');
            safePostMessage({ subject: 'init-tools' });
            break;

        case 'import-settings-done':
            showToast('Khôi phục cấu hình thành công!', 'success');
            setTimeout(() => window.location.reload(), 1000);
            break;

        case 'cloud-sync-status':
            showToast('Đã tự động cập nhật cài đặt mới nhất từ đám mây Chrome Sync!', 'info');
            break;
    }
}

// --- SNAPSHOT & RESTORE ENGINE ---
function countBookmarkTree(nodes) {
    let bookmarks = 0;
    let folders = 0;
    function traverse(list) {
        if (!list || !Array.isArray(list)) return;
        for (const node of list) {
            if (node.url) {
                bookmarks++;
            } else {
                folders++;
                if (node.children) traverse(node.children);
            }
        }
    }
    traverse(nodes);
    return { bookmarks, folders };
}

async function getBookmarkTreeAsync() {
    return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.bookmarks && chrome.bookmarks.getTree) {
            chrome.bookmarks.getTree(resolve);
        } else if (typeof browser !== 'undefined' && browser.bookmarks && browser.bookmarks.getTree) {
            browser.bookmarks.getTree().then(resolve).catch(() => resolve([]));
        } else {
            resolve([]);
        }
    });
}

async function getRestorePoints() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['pine_restore_points'], (res) => {
            const list = (res && Array.isArray(res.pine_restore_points)) ? res.pine_restore_points : [];
            resolve(list);
        });
    });
}

async function createAutoRestorePoint(reason) {
    try {
        const tree = await getBookmarkTreeAsync();
        if (!tree || tree.length === 0) return null;

        const stats = countBookmarkTree(tree);
        const existing = await getRestorePoints();

        const newSnapshot = {
            id: 'snap_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            timestamp: Date.now(),
            reason: reason || 'Bản chụp thủ công',
            totalBookmarks: stats.bookmarks,
            totalFolders: stats.folders,
            tree: tree
        };

        const updated = [newSnapshot, ...existing].slice(0, 10);
        await new Promise((resolve) => {
            chrome.storage.local.set({ pine_restore_points: updated }, resolve);
        });

        if (window.shared && window.shared.setting && window.shared.setting.log) console.log('Snapshot created successfully:', newSnapshot.reason);
        return newSnapshot;
    } catch (err) {
        console.error('Failed to create snapshot:', err);
        return null;
    }
}

async function deleteRestorePoint(id) {
    const existing = await getRestorePoints();
    const updated = existing.filter(s => s.id !== id);
    await new Promise((resolve) => {
        chrome.storage.local.set({ pine_restore_points: updated }, resolve);
    });
    return updated;
}

async function restoreFromSnapshot(snapshot) {
    if (!snapshot || !snapshot.tree) {
        throw new Error('Dữ liệu snapshot không hợp lệ');
    }

    // 1. Take safety snapshot before restoring
    await createAutoRestorePoint('Trước khi khôi phục từ snapshot ' + new Date(snapshot.timestamp).toLocaleString());

    // 2. Perform restoration
    const rootNodes = snapshot.tree[0] && snapshot.tree[0].children ? snapshot.tree[0].children : snapshot.tree;

    for (const snapRootFolder of rootNodes) {
        if (!snapRootFolder.id) continue;

        // Fetch current children in this root container
        const currentChildren = await new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.bookmarks && chrome.bookmarks.getChildren) {
                chrome.bookmarks.getChildren(snapRootFolder.id, (children) => resolve(children || []));
            } else if (typeof browser !== 'undefined' && browser.bookmarks && browser.bookmarks.getChildren) {
                browser.bookmarks.getChildren(snapRootFolder.id).then(resolve).catch(() => resolve([]));
            } else {
                resolve([]);
            }
        });

        // Remove existing children inside this container
        for (const child of currentChildren) {
            await new Promise((resolve) => {
                if (typeof chrome !== 'undefined' && chrome.bookmarks && chrome.bookmarks.removeTree) {
                    chrome.bookmarks.removeTree(child.id, () => resolve());
                } else if (typeof browser !== 'undefined' && browser.bookmarks && browser.bookmarks.removeTree) {
                    browser.bookmarks.removeTree(child.id).then(resolve).catch(() => resolve());
                } else {
                    resolve();
                }
            });
        }

        // Recreate hierarchy from snapshot
        async function restoreNode(node, parentId) {
            if (node.url) {
                await new Promise((resolve) => {
                    const createData = {
                        parentId: parentId,
                        title: node.title || '',
                        url: node.url
                    };
                    if (typeof chrome !== 'undefined' && chrome.bookmarks && chrome.bookmarks.create) {
                        chrome.bookmarks.create(createData, resolve);
                    } else {
                        browser.bookmarks.create(createData).then(resolve).catch(resolve);
                    }
                });
            } else {
                const createdFolder = await new Promise((resolve) => {
                    const createData = {
                        parentId: parentId,
                        title: node.title || 'Thư mục'
                    };
                    if (typeof chrome !== 'undefined' && chrome.bookmarks && chrome.bookmarks.create) {
                        chrome.bookmarks.create(createData, resolve);
                    } else {
                        browser.bookmarks.create(createData).then(resolve).catch(resolve);
                    }
                });

                if (node.children && node.children.length > 0 && createdFolder) {
                    for (const child of node.children) {
                        await restoreNode(child, createdFolder.id);
                    }
                }
            }
        }

        if (snapRootFolder.children && snapRootFolder.children.length > 0) {
            for (const child of snapRootFolder.children) {
                await restoreNode(child, snapRootFolder.id);
            }
        }
    }
}

function formatDate(timestamp) {
    if (!timestamp) return '';
    try {
        return new Date(timestamp).toLocaleString('vi-VN');
    } catch {
        return String(timestamp);
    }
}

// Trigger single folder sorting
function triggerSortFolder(folderId, btnEl) {
    if (!pineState.port || !folderId) return;
    if (btnEl) {
        if (btnEl.disabled) return;
        btnEl.disabled = true;
        btnEl.classList.add('btn-loading');
        btnEl.dataset.originalHtml = btnEl.innerHTML;
        btnEl.innerHTML = '<span class="spinner" style="width:12px;height:12px;margin-right:4px;"></span> <span>Đang xếp...</span>';
    }
    safePostMessage({ subject: 'sort-folder', id: folderId });
}

// Evaluate bookmark organization and sort alignment
async function evaluateBookmarkOrganization(customTree, customOptions, customAncestors) {
    const tree = customTree || (await getBookmarkTreeAsync());
    let options = customOptions || (pineState.option && Object.keys(pineState.option).length > 0 ? pineState.option : null);
    let ancestors = customAncestors || (pineState.ancestor && Object.keys(pineState.ancestor).length > 0 ? pineState.ancestor : null);

    // If options are not yet loaded in pineState, read them from browser.storage.local
    if (!options) {
        options = {};
        try {
            if (browser.storage && browser.storage.local) {
                const allStorage = await browser.storage.local.get(null);
                for (const key in allStorage) {
                    if (key.startsWith('option_')) {
                        options[key.replace('option_', '')] = allStorage[key];
                    }
                }
                if (Object.keys(options).length > 0) {
                    pineState.option = { ...options, ...pineState.option };
                }
            }
        } catch (e) {}
    }

    // If ancestors are not yet loaded, detect them directly from the root tree
    if (!ancestors || Object.keys(ancestors).length === 0) {
        ancestors = {};
        const rootChildren = (tree && tree[0] && tree[0].children) ? tree[0].children : [];
        for (const item of rootChildren) {
            const property = (item.title || '').toLowerCase().replace(/ /g, '_');
            if (property) {
                ancestors[property] = [item.id];
            }
        }
        if (Object.keys(ancestors).length > 0) {
            pineState.ancestor = { ...ancestors, ...pineState.ancestor };
        }
    }

    const collator = new Intl.Collator('en-US', {
        caseFirst: 'upper',
        ignorePunctuation: false,
        localeMatcher: 'best fit',
        numeric: true,
        sensitivity: 'variant',
        usage: 'sort'
    });

    function cleanUrl(url) {
        let result = url || '';
        if (result !== '') {
            result = result.toLowerCase()
                .replace(/^about:/, '')
                .replace('chrome://', '')
                .replace('chrome-extension://', '')
                .replace('moz-extension://', '')
                .replace('edge://', '')
                .replace('ftp://', '')
                .replace('http://', '')
                .replace('https://', '')
                .replace('www.', '');
        }
        return result;
    }

    function compareTwoBookmarks(a, b, parentId, ancestorId) {
        let sort_result = 0;
        const isFolderA = (a.url === undefined);
        const isFolderB = (b.url === undefined);
        const groupFolders = (options.group_folders !== false);

        if (groupFolders) {
            if (isFolderA && !isFolderB) return -1;
            if (!isFolderA && isFolderB) return 1;
        }

        if (groupFolders && isFolderA && isFolderB) {
            const res = collator.compare(a.title || '', b.title || '');
            if (res < 0) return -1;
            if (res > 0) return 1;
        } else {
            let sortOrder = '';
            for (const prop in ancestors) {
                const ids = ancestors[prop] || [];
                if (ids.indexOf(parentId) >= 0) {
                    sortOrder = options[prop + '_sort'];
                    break;
                } else if (ancestorId !== parentId && ids.indexOf(ancestorId) >= 0) {
                    sortOrder = options[prop + '_sub_sort'] || options[prop + '_sort'];
                    break;
                }
            }

            if (!sortOrder) sortOrder = 'alpha';

            let valA = '', valB = '';
            if (sortOrder === 'alpha') {
                const res = collator.compare(a.title || '', b.title || '');
                if (res < 0) { valA = '0'; valB = '1'; }
                else if (res > 0) { valA = '1'; valB = '0'; }
                else { valA = '0'; valB = '0'; }
            } else if (sortOrder === 'alphaReverse') {
                const res = collator.compare(b.title || '', a.title || '');
                if (res < 0) { valA = '0'; valB = '1'; }
                else if (res > 0) { valA = '1'; valB = '0'; }
                else { valA = '0'; valB = '0'; }
            } else if (sortOrder === 'date') {
                valA = (typeof b.dateAdded === 'number') ? b.dateAdded : 0;
                valB = (typeof a.dateAdded === 'number') ? a.dateAdded : 0;
            } else if (sortOrder === 'dateReverse') {
                valA = (typeof a.dateAdded === 'number') ? a.dateAdded : 0;
                valB = (typeof b.dateAdded === 'number') ? b.dateAdded : 0;
            } else if (sortOrder === 'url') {
                valA = cleanUrl(a.url);
                valB = cleanUrl(b.url);
            } else if (sortOrder === 'urlReverse') {
                valA = cleanUrl(b.url);
                valB = cleanUrl(a.url);
            } else {
                const res = collator.compare(a.title || '', b.title || '');
                if (res < 0) { valA = '0'; valB = '1'; }
                else if (res > 0) { valA = '1'; valB = '0'; }
                else { valA = '0'; valB = '0'; }
            }

            if (valA < valB) return -1;
            if (valA > valB) return 1;
        }

        // Secondary / tie breaks
        if ((a.title || '') < (b.title || '')) return -1;
        if ((a.title || '') > (b.title || '')) return 1;
        if ((a.url || '') < (b.url || '')) return -1;
        if ((a.url || '') > (b.url || '')) return 1;
        if (a.id < b.id) return -1;
        return 1;
    }

    let totalFolders = 0;
    let totalBookmarks = 0;
    let evaluableFoldersCount = 0;
    let sortedFoldersCount = 0;
    let unsortedFolders = [];
    let totalMisplacedBookmarks = 0;
    let emptyFoldersCount = 0;
    const urlMap = {};
    let duplicateCount = 0;

    function getSortRuleLabel(folderId, ancestorId) {
        let sortOrder = '';
        for (const prop in ancestors) {
            const ids = ancestors[prop] || [];
            if (ids.indexOf(folderId) >= 0) {
                sortOrder = options[prop + '_sort'];
                break;
            } else if (ancestorId !== folderId && ids.indexOf(ancestorId) >= 0) {
                sortOrder = options[prop + '_sub_sort'] || options[prop + '_sort'];
                break;
            }
        }
        if (!sortOrder) sortOrder = 'alpha';
        return SORT_LABELS[sortOrder] || 'Tên A – Z';
    }

    function checkFolder(node, currentPath, ancestorId) {
        const isRoot = (node.id === '0' || !node.id);
        const folderTitle = node.title || (isRoot ? 'Gốc' : 'Thư mục');
        const path = isRoot ? '' : (currentPath ? `${currentPath} / ${folderTitle}` : folderTitle);

        let currentAncestor = ancestorId;
        if (!isRoot) {
            totalFolders++;
            for (const prop in ancestors) {
                if ((ancestors[prop] || []).indexOf(node.id) >= 0) {
                    currentAncestor = node.id;
                    break;
                }
            }
        }

        const children = node.children || [];
        if (!isRoot && children.length === 0) {
            emptyFoldersCount++;
        }

        if (!isRoot && children.length >= 2) {
            evaluableFoldersCount++;

            const sorted = [...children].sort((a, b) => compareTwoBookmarks(a, b, node.id, currentAncestor || node.id));

            let misplacedInFolder = 0;
            for (let i = 0; i < children.length; i++) {
                if (children[i].id !== sorted[i].id) {
                    misplacedInFolder++;
                }
            }

            if (misplacedInFolder === 0) {
                sortedFoldersCount++;
            } else {
                totalMisplacedBookmarks += misplacedInFolder;
                unsortedFolders.push({
                    id: node.id,
                    title: folderTitle,
                    path: currentPath || 'Thanh dấu trang',
                    totalItems: children.length,
                    misplacedCount: misplacedInFolder,
                    ruleLabel: getSortRuleLabel(node.id, currentAncestor || node.id)
                });
            }
        } else if (!isRoot && children.length === 1) {
            evaluableFoldersCount++;
            sortedFoldersCount++;
        }

        for (const child of children) {
            if (child.url) {
                totalBookmarks++;
                try {
                    const clean = child.url.trim().toLowerCase();
                    if (urlMap[clean]) {
                        duplicateCount++;
                    } else {
                        urlMap[clean] = true;
                    }
                } catch (e) {}
            } else if (child.children) {
                checkFolder(child, path, currentAncestor);
            }
        }
    }

    const rootNodes = (tree && tree[0] && tree[0].children) ? tree[0].children : (tree || []);
    for (const r of rootNodes) {
        checkFolder(r, '', r.id);
    }

    unsortedFolders.sort((a, b) => b.misplacedCount - a.misplacedCount);
    const unsortedFoldersCount = unsortedFolders.length;

    const sortRate = evaluableFoldersCount > 0 
        ? Math.round((sortedFoldersCount / evaluableFoldersCount) * 100) 
        : 100;

    let healthScore = 100;
    if (totalBookmarks > 0 || totalFolders > 0) {
        const sortComponent = sortRate * 0.70;
        const emptyPenalty = totalFolders > 0 ? Math.min(15, Math.round((emptyFoldersCount / totalFolders) * 50)) : 0;
        const dupPenalty = totalBookmarks > 0 ? Math.min(15, Math.round((duplicateCount / totalBookmarks) * 50)) : 0;
        healthScore = Math.max(0, Math.min(100, Math.round(sortComponent + (15 - emptyPenalty) + (15 - dupPenalty))));
    }

    let statusLevel = 'excellent';
    let statusTitle = 'Hệ thống đã được sắp xếp hoàn hảo';
    let statusDescription = 'Tất cả các thư mục dấu trang đều tuân thủ chính xác quy tắc sắp xếp.';

    if (sortRate < 60 || unsortedFoldersCount > 5) {
        statusLevel = 'critical';
        statusTitle = 'Cần sắp xếp lại hệ thống dấu trang';
        statusDescription = `Phát hiện ${unsortedFoldersCount} thư mục với ${totalMisplacedBookmarks} dấu trang đang nằm sai vị trí.`;
    } else if (sortRate < 95 || unsortedFoldersCount > 0) {
        statusLevel = 'warning';
        statusTitle = 'Còn một số thư mục chưa sắp xếp';
        statusDescription = `Có ${unsortedFoldersCount} thư mục (${totalMisplacedBookmarks} mục) chưa đúng theo quy tắc đã thiết lập.`;
    }

    return {
        sortRate,
        healthScore,
        statusLevel,
        statusTitle,
        statusDescription,
        totalFolders,
        totalBookmarks,
        evaluableFoldersCount,
        sortedFoldersCount,
        unsortedFoldersCount,
        totalMisplacedBookmarks,
        emptyFoldersCount,
        duplicateCount,
        unsortedFolders
    };
}

// Global PineCore namespace export
window.PineIcons = PineIcons;
window.PineUI = PineUI;

window.PineCore = {
    getBookmarkTreeAsync,
    createAutoRestorePoint,
    getRestorePoints,
    deleteRestorePoint,
    restoreFromSnapshot,
    countBookmarkTree,
    formatDate,
    showToast,
    initPineCore,
    triggerSortNow,
    triggerSortFolder,
    evaluateBookmarkOrganization,
    icons: PineIcons,
    ui: PineUI,
    state: pineState
};
