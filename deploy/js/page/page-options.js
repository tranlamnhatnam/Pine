'use strict';

document.addEventListener('DOMContentLoaded', () => {
    initPineCore('options');

    const autoSortEl = document.getElementById('opt-automatic-sorting');
    const groupFoldersEl = document.getElementById('opt-group-folders');
    const btnDashboardSort = document.getElementById('btn-dashboard-sort');

    async function loadStatsOverview() {
        const bookmarksEl = document.getElementById('stat-total-bookmarks');
        const foldersEl = document.getElementById('stat-total-folders');
        const lastSortedEl = document.getElementById('stat-last-sorted');

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
                if (bookmarksEl) bookmarksEl.textContent = bookmarkCount.toLocaleString();
                if (foldersEl) foldersEl.textContent = folderCount.toLocaleString();
            }
        } catch (e) {
            console.warn('Error loading bookmark stats:', e);
        }

        if (lastSortedEl) {
            const lastTime = pineState.preference.last_sort_time;
            if (lastTime) {
                const diffMin = Math.round((Date.now() - lastTime) / 60000);
                if (diffMin < 1) lastSortedEl.textContent = 'Vừa xong';
                else if (diffMin < 60) lastSortedEl.textContent = `${diffMin} phút trước`;
                else lastSortedEl.textContent = new Date(lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
                lastSortedEl.textContent = 'Vừa xong';
            }
        }
    }

    function renderOptionsUI() {
        // Theme
        const theme = pineState.preference.theme || 'automatic';
        updateSegmentedActive('seg-theme', theme);

        // Icon color
        updateSegmentedActive('seg-icon-color', pineState.preference.icon_color || 'automatic');

        // Auto sorting
        if (autoSortEl) autoSortEl.checked = pineState.option.automatic_sorting === true;

        // Group folders
        if (groupFoldersEl) groupFoldersEl.checked = pineState.option.group_folders !== false;
    }

    function updateSegmentedActive(containerId, value) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.querySelectorAll('.segmented-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === value);
        });
    }

    function setupSegmentedHandler(containerId, callback) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.querySelectorAll('.segmented-btn').forEach(btn => {
            btn.onclick = () => {
                const val = btn.dataset.value;
                updateSegmentedActive(containerId, val);
                if (callback) callback(val);
            };
        });
    }

    // Bind change events
    if (autoSortEl) {
        autoSortEl.onchange = () => setOption('automatic_sorting', autoSortEl.checked);
    }

    if (groupFoldersEl) {
        groupFoldersEl.onchange = () => setOption('group_folders', groupFoldersEl.checked);
    }

    setupSegmentedHandler('seg-theme', val => {
        applyTheme(val);
        setPreference('theme', val);
    });

    setupSegmentedHandler('seg-icon-color', val => {
        setPreference('icon_color', val);
    });

    if (btnDashboardSort) {
        btnDashboardSort.onclick = () => {
            triggerSortNow(btnDashboardSort);
            setPreference('last_sort_time', Date.now());
            setTimeout(loadStatsOverview, 1200);
        };
    }

    // Initial stats load
    loadStatsOverview();

    // Listen to background sync updates
    pineState.listeners.initOptions.push(() => {
        renderOptionsUI();
        loadStatsOverview();
    });
    pineState.listeners.optionSet.push((name, value) => {
        if (name === 'automatic_sorting' && autoSortEl) autoSortEl.checked = value;
        if (name === 'group_folders' && groupFoldersEl) groupFoldersEl.checked = value;
    });
    pineState.listeners.preferenceSet.push((name, value) => {
        if (name === 'theme') updateSegmentedActive('seg-theme', value);
        if (name === 'icon_color') updateSegmentedActive('seg-icon-color', value);
    });
});
