'use strict';

document.addEventListener('DOMContentLoaded', () => {
    initPineCore('rules');

    const listContainer = document.getElementById('rules-card-list');
    const summaryEl = document.getElementById('rules-summary');
    const searchInput = document.getElementById('search-rules');
    const btnSortRules = document.getElementById('btn-sort-now-rules');

    // Keep track of expanded card keys across renders
    const expandedFolders = new Set();
    let isInitialRender = true;

    function renderRules() {
        if (!listContainer) return;
        const ancestors = Object.keys(pineState.ancestor || {});
        const searchTerm = (searchInput?.value || '').toLowerCase().trim();

        let enabledCount = 0;
        listContainer.innerHTML = '';

        // By default on initial load, expand the first enabled folder or first folder
        if (isInitialRender && ancestors.length > 0) {
            const firstEnabled = ancestors.find(k => pineState.option[k] === true) || ancestors[0];
            if (firstEnabled) expandedFolders.add(firstEnabled);
            isInitialRender = false;
        }

        ancestors.forEach(prop => {
            const isEnabled = pineState.option[prop] === true;
            if (isEnabled) enabledCount++;

            const folderName = ANCESTOR_NAMES[prop] || prop.replace(/_/g, ' ');
            if (searchTerm && !folderName.toLowerCase().includes(searchTerm)) {
                return;
            }

            const sortMode = pineState.option[prop + '_sort'] || '';
            const sortLabel = SORT_LABELS[sortMode] || 'Chưa chọn kiểu';
            const subEnabled = pineState.option[prop + '_sub'] === true;
            const subSortMode = pineState.option[prop + '_sub_sort'] || '';
            const isExpanded = expandedFolders.has(prop);

            const card = document.createElement('div');
            card.className = `rule-card ${isExpanded ? '' : 'collapsed'}`;
            card.dataset.folder = prop;

            card.innerHTML = `
                <div class="rule-card-header">
                    <div class="rule-card-left">
                        <svg class="rule-chevron" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                        <div class="item-avatar">
                            <svg viewBox="0 0 24 24" fill="#3B82F6"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                        </div>
                        <div class="item-content">
                            <div class="item-title">${escapeHtml(folderName)}</div>
                            <div class="item-subtitle">
                                <span class="rule-badge-status" style="font-weight:600; color:${isEnabled ? 'var(--primary-blue)' : 'var(--text-muted)'};">${isEnabled ? 'Đã bật' : 'Chưa bật'}</span>
                                <span>•</span>
                                <span class="rule-badge-sort">${escapeHtml(sortLabel)}</span>
                                <span class="rule-badge-sub" style="display:${subEnabled ? 'inline' : 'none'};"> • Bao gồm thư mục con</span>
                            </div>
                        </div>
                    </div>
                    <div class="rule-card-right">
                        <label class="switch" title="Bật/tắt sắp xếp thư mục này">
                            <input type="checkbox" class="folder-main-toggle" ${isEnabled ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>

                <div class="rule-card-body">
                    <!-- Option 1: Main folder sort rule -->
                    <div class="rule-setting-row">
                        <div class="rule-setting-info">
                            <div class="rule-setting-title">Kiểu sắp xếp thư mục này</div>
                            <div class="rule-setting-desc">Tiêu chí ưu tiên để sắp xếp các dấu trang trong thư mục này</div>
                        </div>
                        <div class="rule-setting-action">
                            <select class="select-custom rule-select-sort">
                                <option value="" ${!sortMode ? 'selected' : ''}>Không sắp xếp</option>
                                <optgroup label="Tiêu đề">
                                    <option value="alpha" ${sortMode === 'alpha' ? 'selected' : ''}>Tên: A – Z</option>
                                    <option value="alphaReverse" ${sortMode === 'alphaReverse' ? 'selected' : ''}>Tên: Z – A</option>
                                </optgroup>
                                <optgroup label="Ngày thêm">
                                    <option value="date" ${sortMode === 'date' ? 'selected' : ''}>Mới nhất trước</option>
                                    <option value="dateReverse" ${sortMode === 'dateReverse' ? 'selected' : ''}>Cũ nhất trước</option>
                                </optgroup>
                                <optgroup label="Địa chỉ URL">
                                    <option value="url" ${sortMode === 'url' ? 'selected' : ''}>URL: A – Z</option>
                                    <option value="urlReverse" ${sortMode === 'urlReverse' ? 'selected' : ''}>URL: Z – A</option>
                                </optgroup>
                            </select>
                        </div>
                    </div>

                    <!-- Option 2: Recursive subfolders toggle -->
                    <div class="rule-setting-row">
                        <div class="rule-setting-info">
                            <div class="rule-setting-title">Áp dụng cho thư mục con (Subfolders)</div>
                            <div class="rule-setting-desc">Tự động áp dụng quy tắc sắp xếp đệ quy cho các thư mục con bên trong</div>
                        </div>
                        <div class="rule-setting-action">
                            <label class="switch">
                                <input type="checkbox" class="rule-sub-toggle" ${subEnabled ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>

                    <!-- Option 3: Subfolder specific sort rule -->
                    <div class="rule-setting-row rule-sub-sort-row" style="display:${subEnabled ? 'flex' : 'none'};">
                        <div class="rule-setting-info">
                            <div class="rule-setting-title">Kiểu sắp xếp cho thư mục con</div>
                            <div class="rule-setting-desc">Quy tắc riêng áp dụng cho các thư mục con cấp dưới</div>
                        </div>
                        <div class="rule-setting-action">
                            <select class="select-custom rule-select-sub-sort">
                                <option value="" ${!subSortMode ? 'selected' : ''}>Cùng kiểu với thư mục chính</option>
                                <optgroup label="Tiêu đề">
                                    <option value="alpha" ${subSortMode === 'alpha' ? 'selected' : ''}>Tên: A – Z</option>
                                    <option value="alphaReverse" ${subSortMode === 'alphaReverse' ? 'selected' : ''}>Tên: Z – A</option>
                                </optgroup>
                                <optgroup label="Ngày thêm">
                                    <option value="date" ${subSortMode === 'date' ? 'selected' : ''}>Mới nhất trước</option>
                                    <option value="dateReverse" ${subSortMode === 'dateReverse' ? 'selected' : ''}>Cũ nhất trước</option>
                                </optgroup>
                                <optgroup label="Địa chỉ URL">
                                    <option value="url" ${subSortMode === 'url' ? 'selected' : ''}>URL: A – Z</option>
                                    <option value="urlReverse" ${subSortMode === 'urlReverse' ? 'selected' : ''}>URL: Z – A</option>
                                </optgroup>
                            </select>
                        </div>
                    </div>
                </div>
            `;

            // Elements inside this card
            const header = card.querySelector('.rule-card-header');
            const mainToggle = card.querySelector('.folder-main-toggle');
            const selectSort = card.querySelector('.rule-select-sort');
            const subToggle = card.querySelector('.rule-sub-toggle');
            const subSortRow = card.querySelector('.rule-sub-sort-row');
            const subSortSelect = card.querySelector('.rule-select-sub-sort');
            const badgeStatus = card.querySelector('.rule-badge-status');
            const badgeSort = card.querySelector('.rule-badge-sort');
            const badgeSub = card.querySelector('.rule-badge-sub');

            // 1. Expand/Collapse toggle on header click
            header.onclick = (e) => {
                if (e.target.closest('.switch')) return; // ignore toggle switch click
                const collapsed = card.classList.toggle('collapsed');
                if (collapsed) {
                    expandedFolders.delete(prop);
                } else {
                    expandedFolders.add(prop);
                }
            };

            // 2. Main folder enable toggle
            mainToggle.onchange = (e) => {
                const checked = mainToggle.checked;
                setOption(prop, checked);

                if (checked && (!selectSort.value || selectSort.value === '')) {
                    selectSort.value = 'alpha';
                    setOption(prop + '_sort', 'alpha');
                }

                badgeStatus.textContent = checked ? 'Đã bật' : 'Chưa bật';
                badgeStatus.style.color = checked ? 'var(--primary-blue)' : 'var(--text-muted)';
                badgeSort.textContent = SORT_LABELS[selectSort.value] || 'Chưa chọn kiểu';

                // Automatically expand card when turned on so user sees options immediately
                if (checked && card.classList.contains('collapsed')) {
                    card.classList.remove('collapsed');
                    expandedFolders.add(prop);
                }

                updateSummary();
            };

            // 3. Sort Mode select change
            selectSort.onchange = () => {
                const val = selectSort.value;
                setOption(prop + '_sort', val);

                if (val && !mainToggle.checked) {
                    mainToggle.checked = true;
                    setOption(prop, true);
                    badgeStatus.textContent = 'Đã bật';
                    badgeStatus.style.color = 'var(--primary-blue)';
                    updateSummary();
                } else if (!val && mainToggle.checked) {
                    mainToggle.checked = false;
                    setOption(prop, false);
                    badgeStatus.textContent = 'Chưa bật';
                    badgeStatus.style.color = 'var(--text-muted)';
                    updateSummary();
                }

                badgeSort.textContent = SORT_LABELS[val] || 'Không sắp xếp';
            };

            // 4. Subfolders toggle change
            subToggle.onchange = () => {
                const checked = subToggle.checked;
                setOption(prop + '_sub', checked);
                subSortRow.style.display = checked ? 'flex' : 'none';
                badgeSub.style.display = checked ? 'inline' : 'none';
            };

            // 5. Subfolders sort mode change
            subSortSelect.onchange = () => {
                setOption(prop + '_sub_sort', subSortSelect.value);
            };

            listContainer.appendChild(card);
        });

        updateSummary();

        if (listContainer.children.length === 0) {
            listContainer.innerHTML = '<div class="empty-state" style="padding:32px 16px;"><p>Không tìm thấy thư mục nào phù hợp.</p></div>';
        }
    }

    function updateSummary() {
        if (!summaryEl) return;
        const ancestors = Object.keys(pineState.ancestor || {});
        let enabled = 0;
        ancestors.forEach(k => {
            if (pineState.option[k] === true) enabled++;
        });
        summaryEl.textContent = `${ancestors.length} thư mục dấu trang • ${enabled} đã kích hoạt`;
    }

    if (searchInput) {
        searchInput.oninput = renderRules;
    }

    if (btnSortRules) {
        btnSortRules.onclick = () => triggerSortNow(btnSortRules);
    }

    // Listen to background sync & updates
    pineState.listeners.initOptions.push(renderRules);
    pineState.listeners.optionSet.push(renderRules);
});
