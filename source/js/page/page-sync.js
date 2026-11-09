'use strict';

document.addEventListener('DOMContentLoaded', () => {
    initPineCore('sync');

    const exportBtn = document.getElementById('btn-export-settings');
    const importBtn = document.getElementById('btn-trigger-import');
    const fileInput = document.getElementById('file-import-settings');
    const resetBtn = document.getElementById('btn-reset-defaults');
    const snapshotContainer = document.getElementById('snapshot-list-container');
    const createManualSnapshotBtn = document.getElementById('btn-create-manual-snapshot');

    // Format relative time helper
    function formatTime(ts) {
        if (!ts) return '';
        const now = Date.now();
        const diff = Math.floor((now - ts) / 1000); // in seconds
        const d = new Date(ts);
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = d.toLocaleDateString();

        if (diff < 60) return 'Vừa xong';
        if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
        if (diff < 86400) {
            const today = new Date();
            if (today.toDateString() === d.toDateString()) {
                return `Hôm nay, ${timeStr}`;
            }
            return `Hôm qua, ${timeStr}`;
        }
        return `${dateStr}, ${timeStr}`;
    }

    // Render snapshot restore points
    async function renderSnapshots() {
        if (!snapshotContainer) return;
        snapshotContainer.innerHTML = PineUI.renderSkeleton('list', 3);

        try {
            const snapshots = await getRestorePoints();

            if (!snapshots || snapshots.length === 0) {
                snapshotContainer.innerHTML = window.PineUI.renderEmptyState({
                    icon: 'history',
                    type: 'info',
                    title: 'Chưa có điểm khôi phục nào',
                    desc: 'Pine sẽ tự động tạo điểm khôi phục khi bạn thực hiện dọn dẹp hoặc thay thế URL. Bạn cũng có thể bấm nút bên trên để tạo ngay điểm khôi phục đầu tiên.'
                });
                return;
            }

            let html = '<div class="snapshot-list" style="display:flex; flex-direction:column; gap:10px;">';
            snapshots.forEach((snap, idx) => {
                const totalB = snap.totalBookmarks ?? 0;
                const totalF = snap.totalFolders ?? 0;
                const timeText = formatTime(snap.timestamp);
                const exactDate = new Date(snap.timestamp).toLocaleString();

                html += `
                    <div class="snapshot-item" data-id="${snap.id}" style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-radius:8px; border:1px solid var(--border-color); background-color:var(--bg-page); gap:12px; flex-wrap:wrap;">
                        <div style="flex:1; min-width:240px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-weight:600; color:var(--text-primary); font-size:14px;">${escapeHtml(snap.reason || 'Bản chụp an toàn')}</span>
                                ${idx === 0 ? '<span class="badge" style="background:#e6f4ea; color:#137333; font-size:11px; padding:2px 6px; border-radius:4px;">Mới nhất</span>' : ''}
                            </div>
                            <div style="display:flex; align-items:center; gap:12px; margin-top:4px; font-size:12px; color:var(--text-secondary);">
                                <span title="${escapeHtml(exactDate)}">🕒 ${timeText}</span>
                                <span>•</span>
                                <span>🔖 <b>${totalB}</b> dấu trang</span>
                                <span>•</span>
                                <span>📁 <b>${totalF}</b> thư mục</span>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <button type="button" class="btn btn-secondary btn-download-snap" data-id="${snap.id}" title="Tải file JSON dự phòng" style="padding:6px 10px; font-size:12px;">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                                <span>Tải JSON</span>
                            </button>
                            <button type="button" class="btn btn-primary btn-restore-snap" data-id="${snap.id}" style="padding:6px 12px; font-size:12px;">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
                                <span>Khôi phục</span>
                            </button>
                            <button type="button" class="btn btn-secondary btn-delete-snap" data-id="${snap.id}" title="Xóa bản chụp này" style="padding:6px 8px; color:var(--danger-color);">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                            </button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            snapshotContainer.innerHTML = html;

            // Wire actions
            // 1. Download
            snapshotContainer.querySelectorAll('.btn-download-snap').forEach(btn => {
                btn.onclick = () => {
                    const snapId = btn.dataset.id;
                    const snap = snapshots.find(s => s.id === snapId);
                    if (!snap) return;

                    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `pine-snapshot-${snap.id}-${new Date(snap.timestamp).toISOString().slice(0, 10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast('Đã tải xuống file bản chụp!', 'success');
                };
            });

            // 2. Restore
            snapshotContainer.querySelectorAll('.btn-restore-snap').forEach(btn => {
                btn.onclick = async () => {
                    if (btn.disabled) return;
                    const snapId = btn.dataset.id;
                    const snap = snapshots.find(s => s.id === snapId);
                    if (!snap) return;

                    const msg = `⚠️ XÁC NHẬN KHÔI PHỤC DẤU TRANG\n\nBạn có chắc chắn muốn khôi phục lại dấu trang từ điểm khôi phục:\n"${snap.reason}"\nThời điểm: ${new Date(snap.timestamp).toLocaleString()} (${snap.totalBookmarks} dấu trang, ${snap.totalFolders} thư mục)?\n\nToàn bộ dấu trang hiện tại sẽ được đồng bộ chính xác theo bản này.`;
                    if (!confirm(msg)) return;

                    const unlockBtn = PineUI.lock(btn, 'Đang khôi phục...');
                    const unlockContainer = PineUI.lock(snapshotContainer);
                    const globalBtns = [createManualSnapshotBtn, exportBtn, importBtn, resetBtn];
                    globalBtns.forEach(b => { if (b) b.disabled = true; });

                    try {
                        await restoreFromSnapshot(snap);
                        showToast('Khôi phục toàn bộ dấu trang thành công!', 'success');
                        await renderSnapshots();
                        // Trigger background rescan of tools
                        safePostMessage({ subject: 'init-tools' });
                    } catch (err) {
                        alert('Lỗi khi khôi phục dấu trang: ' + err.message);
                    } finally {
                        unlockBtn();
                        unlockContainer();
                        globalBtns.forEach(b => { if (b) b.disabled = false; });
                    }
                };
            });

            // 3. Delete
            snapshotContainer.querySelectorAll('.btn-delete-snap').forEach(btn => {
                btn.onclick = async () => {
                    if (btn.disabled) return;
                    const snapId = btn.dataset.id;
                    if (!confirm('Bạn có chắc chắn muốn xóa điểm khôi phục này không?')) return;
                    const unlockBtn = PineUI.lock(btn);
                    try {
                        await deleteRestorePoint(snapId);
                        showToast('Đã xóa điểm khôi phục.', 'info');
                        await renderSnapshots();
                    } finally {
                        unlockBtn();
                    }
                };
            });
        } catch (err) {
            console.error('Error rendering snapshots:', err);
            snapshotContainer.innerHTML = '<div style="color:var(--danger-color); padding:16px;">Lỗi khi tải danh sách điểm khôi phục.</div>';
        }
    }

    // Manual snapshot creation
    if (createManualSnapshotBtn) {
        createManualSnapshotBtn.onclick = async () => {
            if (createManualSnapshotBtn.disabled) return;
            const defaultName = 'Bản chụp thủ công ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const label = prompt('Nhập ghi chú cho điểm khôi phục mới:', defaultName);
            if (label === null) return; // User cancelled

            const unlockBtn = PineUI.lock(createManualSnapshotBtn, 'Đang chụp...');

            try {
                const snap = await createAutoRestorePoint(label.trim() || defaultName);
                if (snap) {
                    showToast('Đã tạo điểm khôi phục an toàn thành công!', 'success');
                } else {
                    showToast('Không thể tạo điểm khôi phục.', 'error');
                }
                await renderSnapshots();
            } finally {
                unlockBtn();
            }
        };
    }

    // Initial render of snapshots
    renderSnapshots();

    // Export JSON
    if (exportBtn) {
        exportBtn.onclick = () => {
            const data = {
                pine_version: '2026.11.1',
                exported_at: new Date().toISOString(),
                option: pineState.option,
                preference: pineState.preference
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pine-settings-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Đã tải xuống file sao lưu cài đặt!', 'success');
        };
    }

    // Import JSON
    if (importBtn && fileInput) {
        importBtn.onclick = () => fileInput.click();

        fileInput.onchange = (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const parsed = JSON.parse(event.target.result);
                    if (!parsed || (!parsed.option && !parsed.preference)) {
                        alert('File sao lưu không hợp lệ.');
                        return;
                    }

                    if (confirm('Khôi phục các cài đặt từ file này? Các cài đặt hiện tại sẽ được thay thế.')) {
                        if (pineState.port) {
                            safePostMessage({
                                subject: 'import-settings',
                                option: parsed.option || {},
                                preference: parsed.preference || {}
                            });
                        }
                    }
                } catch (err) {
                    alert('Lỗi đọc file JSON: ' + err.message);
                }
            };
            reader.readAsText(file);
        };
    }

    // Reset Defaults
    if (resetBtn) {
        resetBtn.onclick = () => {
            if (confirm('Bạn có chắc chắn muốn đặt lại tất cả cài đặt và quy tắc sắp xếp về mặc định ban đầu không?')) {
                const defaultOptions = {
                    automatic_sorting: false,
                    group_folders: true
                };
                for (const prop in pineState.ancestor) {
                    defaultOptions[prop] = false;
                    defaultOptions[prop + '_sort'] = '';
                    defaultOptions[prop + '_sub'] = false;
                    defaultOptions[prop + '_sub_sort'] = '';
                }

                if (pineState.port) {
                    safePostMessage({
                        subject: 'import-settings',
                        option: defaultOptions,
                        preference: {
                            cloud_sync: true,
                            theme: 'automatic',
                            icon_color: 'automatic',
                            icon_action: 'options'
                        }
                    });
                }
            }
        };
    }

    // --- CHROMIUM CLOUD SYNC & QUICK CODE ---
    const inputCloudSync = document.getElementById('input-cloud-sync');
    const cloudSyncBadge = document.getElementById('cloud-sync-status-badge');
    const btnCopyCode = document.getElementById('btn-copy-code');
    const btnPasteCode = document.getElementById('btn-paste-code');

    function updateCloudSyncUI() {
        if (!inputCloudSync) return;
        const isEnabled = pineState.preference.cloud_sync !== false;
        inputCloudSync.checked = isEnabled;
        if (cloudSyncBadge) {
            cloudSyncBadge.textContent = isEnabled ? 'Đang hoạt động' : 'Đã tạm dừng';
            cloudSyncBadge.className = isEnabled ? 'badge badge-add' : 'badge badge-neutral';
        }
    }

    if (inputCloudSync) {
        inputCloudSync.onchange = () => {
            const enabled = inputCloudSync.checked;
            setPreference('cloud_sync', enabled);
            updateCloudSyncUI();
            showToast(enabled ? 'Đã bật tự động đồng bộ đám mây!' : 'Đã tạm dừng đồng bộ đám mây.', 'info');
        };
    }

    // Quick Code Export (Base64)
    if (btnCopyCode) {
        btnCopyCode.onclick = () => {
            const data = {
                pine: 'sync_v1',
                exported_at: Date.now(),
                option: pineState.option,
                preference: pineState.preference
            };
            try {
                const jsonStr = JSON.stringify(data);
                const base64Code = btoa(unescape(encodeURIComponent(jsonStr)));
                navigator.clipboard.writeText(base64Code).then(() => {
                    showToast('Đã sao chép mã cấu hình vào clipboard!', 'success');
                }).catch(() => {
                    prompt('Mã cấu hình của bạn (nhấn Ctrl+C để sao chép):', base64Code);
                });
            } catch (err) {
                console.error('Error generating quick code:', err);
                showToast('Lỗi khi tạo mã cấu hình.', 'error');
            }
        };
    }

    // Quick Code Import (Base64)
    if (btnPasteCode) {
        btnPasteCode.onclick = () => {
            const code = prompt('Dán chuỗi mã cấu hình Pine của bạn vào đây:');
            if (!code || !code.trim()) return;

            try {
                const decodedJson = decodeURIComponent(escape(atob(code.trim())));
                const parsed = JSON.parse(decodedJson);
                if (!parsed || (!parsed.option && !parsed.preference)) {
                    alert('Mã cấu hình không hợp lệ.');
                    return;
                }

                if (confirm('Áp dụng các cài đặt và quy tắc sắp xếp từ mã cấu hình này?')) {
                    if (pineState.port) {
                        safePostMessage({
                            subject: 'import-settings',
                            option: parsed.option || {},
                            preference: parsed.preference || {}
                        });
                        showToast('Đang áp dụng mã cấu hình...', 'info');
                    }
                }
            } catch (err) {
                alert('Mã cấu hình không đúng định dạng: ' + err.message);
            }
        };
    }

    pineState.listeners.initOptions.push(updateCloudSyncUI);
    if (pineState.preference && pineState.preference.cloud_sync !== undefined) {
        updateCloudSyncUI();
    }
});
