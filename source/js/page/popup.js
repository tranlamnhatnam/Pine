'use strict';

document.addEventListener('DOMContentLoaded', () => {
    initPineCore('popup');

    const autoSortCb = document.getElementById('popup-opt-auto-sort');
    const groupFoldersCb = document.getElementById('popup-opt-group-folders');
    const sortBtn = document.getElementById('btn-popup-sort');
    const openOptionsBtn = document.getElementById('btn-open-options');
    const bookmarksNumEl = document.getElementById('popup-stat-bookmarks');
    const foldersNumEl = document.getElementById('popup-stat-folders');

    // Audit indicator elements
    const auditStrip = document.getElementById('popup-audit-strip');
    const auditDot = document.getElementById('popup-audit-dot');
    const auditText = document.getElementById('popup-audit-text');
    const auditBadge = document.getElementById('popup-audit-badge');

    if (auditStrip) {
        auditStrip.onclick = () => {
            browser.tabs.create({ url: browser.runtime.getURL('/page/audit.html') });
        };
    }

    window.onSortDone = () => {
        if (autoSortCb) autoSortCb.disabled = false;
        if (groupFoldersCb) groupFoldersCb.disabled = false;
        if (openOptionsBtn) openOptionsBtn.disabled = false;
        loadMiniStats();
    };

    function syncPopupUI() {
        if (autoSortCb) autoSortCb.checked = (pineState.option.automatic_sorting === true);
        if (groupFoldersCb) groupFoldersCb.checked = (pineState.option.group_folders !== false);
    }

    if (autoSortCb) {
        autoSortCb.onchange = () => {
            if (pineState.isSorting) return;
            setOption('automatic_sorting', autoSortCb.checked);
        };
    }

    if (groupFoldersCb) {
        groupFoldersCb.onchange = () => {
            if (pineState.isSorting) return;
            setOption('group_folders', groupFoldersCb.checked);
        };
    }

    if (sortBtn) {
        sortBtn.onclick = () => {
            if (pineState.isSorting) return;
            if (autoSortCb) autoSortCb.disabled = true;
            if (groupFoldersCb) groupFoldersCb.disabled = true;
            if (openOptionsBtn) openOptionsBtn.disabled = true;
            triggerSortNow(sortBtn);
        };
    }

    if (openOptionsBtn) {
        openOptionsBtn.onclick = () => {
            if (browser.runtime.openOptionsPage) {
                browser.runtime.openOptionsPage();
            } else {
                browser.tabs.create({ url: browser.runtime.getURL('/page/options.html') });
            }
        };
    }

    // Quick nav links click
    document.querySelectorAll('.popup-nav-link').forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            const target = link.dataset.url;
            if (target) {
                browser.tabs.create({ url: browser.runtime.getURL(target) });
            }
        };
    });

    // Count bookmarks and folders
    async function loadMiniStats() {
        try {
            if (browser.bookmarks && browser.bookmarks.getTree) {
                const tree = await browser.bookmarks.getTree();
                let bookmarkCount = 0;
                let folderCount = 0;

                function traverse(nodes) {
                    for (const node of nodes) {
                        if (node.url) {
                            bookmarkCount++;
                        } else {
                            if (node.id !== '0') folderCount++;
                        }
                        if (node.children) traverse(node.children);
                    }
                }

                traverse(tree);
                if (bookmarksNumEl) bookmarksNumEl.textContent = bookmarkCount.toLocaleString();
                if (foldersNumEl) foldersNumEl.textContent = folderCount.toLocaleString();

                // Quick Audit Assessment
                if (window.PineCore && window.PineCore.evaluateBookmarkOrganization) {
                    const audit = await window.PineCore.evaluateBookmarkOrganization(tree);
                    if (auditText && auditBadge && auditDot) {
                        auditBadge.textContent = `${audit.sortRate}%`;
                        auditBadge.className = `popup-audit-badge ${audit.statusLevel}`;
                        auditDot.className = `audit-mini-dot ${audit.statusLevel}`;
                        if (audit.statusLevel === 'excellent') {
                            auditText.textContent = 'Đã sắp xếp chuẩn 100%';
                        } else if (audit.unsortedFoldersCount > 0) {
                            auditText.textContent = `Cần xếp ${audit.unsortedFoldersCount} thư mục`;
                        } else {
                            auditText.textContent = 'Trật tự cần tối ưu';
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('Error loading mini stats:', e);
        }
    }

    loadMiniStats();

    pineState.listeners.initOptions.push(() => {
        syncPopupUI();
        loadMiniStats();
    });
    pineState.listeners.optionSet.push((name, value) => {
        if (name === 'automatic_sorting' && autoSortCb) autoSortCb.checked = value;
        if (name === 'group_folders' && groupFoldersCb) groupFoldersCb.checked = value;
    });
});
