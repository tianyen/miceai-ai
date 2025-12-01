/**
 * Projects Page Scripts
 * 專案管理頁面專用 JavaScript
 */

$(document).ready(function () {
    // 載入專案數據和分頁
    loadProjects();
    loadProjectsPagination();

    // 搜尋輸入框事件 (debounce)
    $('#search-input').on('keyup', function () {
        clearTimeout(window.searchTimeout);
        window.searchTimeout = setTimeout(function () {
            searchProjects();
        }, 300);
    });

    // Enter 鍵搜索
    $('#search-input').on('keypress', function (e) {
        if (e.which === 13) {
            searchProjects();
        }
    });

    // 處理表格排序
    $('th[data-sortable]').on('click', function () {
        const column = $(this).attr('data-sortable');
        const currentSort = $(this).hasClass('sort-asc') ? 'desc' : 'asc';

        // 清除其他排序標記
        $('th[data-sortable]').removeClass('sort-asc sort-desc');

        // 添加當前排序標記
        $(this).addClass(`sort-${currentSort}`);

        // 載入排序後的資料
        loadProjects(1, column, currentSort);
    });
});

// ========== 專案列表載入 ==========

function loadProjects(page = 1, sort = null, order = null) {
    const status = $('#status-filter').val();

    const params = {
        page: page,
        format: 'html'
    };

    if (status) params.status = status;
    if (sort) params.sort = sort;
    if (order) params.order = order;

    $.ajax({
        url: '/api/admin/projects',
        method: 'GET',
        data: params,
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        },
        success: function (html) {
            $('#projects-table-body').html(html);
        },
        error: function (xhr) {
            console.error('載入專案失敗:', xhr);
            $('#projects-table-body').html(`
                <tr>
                    <td colspan="8" class="text-center text-danger">
                        <i class="fas fa-exclamation-triangle"></i>
                        載入專案失敗，請稀後重試
                    </td>
                </tr>
            `);
        }
    });
}

function searchProjects() {
    const search = $('#search-input').val().trim();
    const status = $('#status-filter').val();

    $.ajax({
        url: '/api/admin/projects/search',
        method: 'GET',
        data: {
            search: search,
            status: status
        },
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        },
        success: function (html) {
            $('#projects-table-body').html(html);
        },
        error: function (xhr) {
            console.error('搜索專案失敗:', xhr);
            $('#projects-table-body').html(`
                <tr>
                    <td colspan="7" class="text-center text-danger">
                        <i class="fas fa-exclamation-triangle"></i>
                        搜索失敗，請稍後重試
                    </td>
                </tr>
            `);
        }
    });
}

function loadProjectsPagination(page = 1) {
    $.ajax({
        url: '/api/admin/projects/pagination',
        method: 'GET',
        data: { page: page },
        success: function (html) {
            $('#pagination-container').html(html);
        },
        error: function (xhr) {
            console.error('載入分頁失敗:', xhr);
            $('#pagination-container').html('<div class="pagination-info"><span class="text-danger">載入分頁失敗</span></div>');
        }
    });
}

function refreshProjects() {
    loadProjects();
    loadProjectsPagination();
}

// ========== 專案操作 ==========

function viewProject(id) {
    window.location.href = `/admin/projects/${id}/detail`;
}

function editProject(id) {
    $.ajax({
        url: `/admin/projects/${id}/edit`,
        method: 'GET',
        success: function (html) {
            $('#modal-container').html(html);
            const modal = $('#modal-container .modal')[0];
            if (modal) {
                $(modal).addClass('show');
                $('body').addClass('modal-open');
            }
        },
        error: function (xhr) {
            console.error('載入編輯專案失敗:', xhr);
            showAlert('載入編輯專案失敗', 'danger');
        }
    });
}

function deleteProject(id) {
    if (!confirm('確定要刪除此專案嗎？此操作無法復原。')) return;

    $.ajax({
        url: `/api/admin/projects/${id}`,
        method: 'DELETE',
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        },
        success: function (response) {
            if (response.success) {
                showAlert('專案刪除成功', 'success');
                loadProjects();
            } else {
                showAlert(response.message || '刪除專案失敗', 'danger');
            }
        },
        error: function (xhr) {
            console.error('刪除專案失敗:', xhr);
            showAlert('刪除專案失敗', 'danger');
        }
    });
}

function duplicateProject(id) {
    if (!confirm('確定要複製此專案嗎？')) return;

    $.ajax({
        url: `/api/admin/projects/${id}/duplicate`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        success: function (response) {
            if (response.success) {
                showAlert('專案複製成功', 'success');
                loadProjects();
            } else {
                showAlert(response.message || '複製專案失敗', 'danger');
            }
        },
        error: function (xhr) {
            console.error('複製專案失敗:', xhr);
            showAlert('複製專案失敗', 'danger');
        }
    });
}

function exportProject(id) {
    window.open(`/api/admin/projects/${id}/export`, '_blank');
}

// ========== 新增專案 ==========

function openNewProjectModal() {
    $.ajax({
        url: '/admin/projects/new',
        method: 'GET',
        success: function (html) {
            $('#modal-container').html(html);
            const modal = $('#modal-container .modal')[0];
            if (modal) {
                $(modal).addClass('show');
                $('body').addClass('modal-open');
            }
        },
        error: function (xhr) {
            console.error('載入新增專案表單失敗:', xhr);
            showAlert('載入新增專案表單失敗', 'danger');
        }
    });
}

// ========== 報名連結 ==========

function getRegistrationLinks(projectId) {
    $.ajax({
        url: `/admin/projects/${projectId}/registration-urls`,
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        },
        success: function(response) {
            if (response.success) {
                showRegistrationModal(response.data);
            } else {
                showAlert(response.message || '獲取報名連結失敗', 'danger');
            }
        },
        error: function(xhr) {
            console.error('獲取報名連結失敗:', xhr);
            showAlert('獲取報名連結失敗，請稍後重試', 'danger');
        }
    });
}

function showRegistrationModal(data) {
    const { project, registration_urls, statistics, is_open_for_registration } = data;

    const modalHtml = `
        <div class="modal show" style="display: flex;">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h4 class="modal-title">
                            <i class="fas fa-qrcode me-2"></i>
                            ${project.name} - 報名連結
                        </h4>
                        <button type="button" class="close" onclick="closeModal()" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div class="modal-body">
                        <!-- 專案信息 -->
                        <div class="project-info-banner">
                            <div class="d-flex justify-content-between align-items-start mb-3">
                                <div>
                                    <h5>${project.name}</h5>
                                    <p class="text-muted mb-1">
                                        <i class="fas fa-calendar me-1"></i>
                                        ${project.event_date ? new Date(project.event_date).toLocaleDateString('zh-TW') : '未設定'}
                                    </p>
                                    <p class="text-muted mb-0">
                                        <i class="fas fa-map-marker-alt me-1"></i>
                                        ${project.event_location || '未設定地點'}
                                    </p>
                                </div>
                                <div class="text-end">
                                    <span class="badge ${is_open_for_registration ? 'badge-success' : 'badge-secondary'} mb-2">
                                        ${is_open_for_registration ? '開放報名' : '未開放'}
                                    </span>
                                    <div class="stats-mini">
                                        <small class="text-muted">
                                            總報名: <strong>${statistics.total_submissions || 0}</strong> |
                                            待審核: <strong>${statistics.pending_submissions || 0}</strong> |
                                            已報到: <strong>${statistics.checked_in_count || 0}</strong>
                                        </small>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 主要報名連結 -->
                        <div class="registration-link-section mb-4">
                            <h6 class="mb-3">
                                <i class="fas fa-link me-2 text-primary"></i>
                                主要報名連結
                            </h6>
                            <div class="input-group mb-2">
                                <input type="text" class="form-control font-monospace"
                                       id="primary-link"
                                       value="${registration_urls.primary}"
                                       readonly>
                                <button class="btn btn-outline-primary"
                                        onclick="copyToClipboard('primary-link')"
                                        title="複製連結">
                                    <i class="fas fa-copy"></i> 複製
                                </button>
                                <button class="btn btn-outline-success"
                                        onclick="openLink('${registration_urls.primary}')"
                                        title="在新頁面開啟">
                                    <i class="fas fa-external-link-alt"></i>
                                </button>
                            </div>
                            <small class="text-muted">
                                建議使用此連結分享給用戶，提供最佳的報名體驗
                            </small>
                        </div>

                        <!-- QR 碼 -->
                        <div class="qr-code-section mb-4">
                            <h6 class="mb-3">
                                <i class="fas fa-qrcode me-2 text-info"></i>
                                QR 碼
                            </h6>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="qr-code-container text-center p-3 border rounded">
                                        <div id="qr-code-display" class="mb-2">
                                            <!-- QR 碼將在這裡生成 -->
                                        </div>
                                        <small class="text-muted">掃描 QR 碼快速報名</small>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="qr-actions">
                                        <button class="btn btn-outline-primary mb-2 w-100"
                                                onclick="downloadQRCode('${project.name}')"
                                                title="下載 QR 碼">
                                            <i class="fas fa-download me-2"></i>下載 QR 碼
                                        </button>
                                        <button class="btn btn-outline-info mb-2 w-100"
                                                onclick="printQRCode()"
                                                title="列印 QR 碼">
                                            <i class="fas fa-print me-2"></i>列印 QR 碼
                                        </button>
                                        <small class="text-muted d-block">
                                            QR 碼可用於海報、傳單或現場展示
                                        </small>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 其他連結選項 -->
                        <div class="other-links-section">
                            <h6 class="mb-3">
                                <i class="fas fa-cogs me-2 text-secondary"></i>
                                其他連結選項
                            </h6>
                            <div class="row">
                                <div class="col-md-6">
                                    <label class="form-label small">舊版兼容連結</label>
                                    <div class="input-group input-group-sm mb-2">
                                        <input type="text" class="form-control font-monospace"
                                               id="legacy-link"
                                               value="${registration_urls.legacy}"
                                               readonly>
                                        <button class="btn btn-outline-secondary btn-sm"
                                                onclick="copyToClipboard('legacy-link')">
                                            <i class="fas fa-copy"></i>
                                        </button>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label small">QR 直連</label>
                                    <div class="input-group input-group-sm mb-2">
                                        <input type="text" class="form-control font-monospace"
                                               id="qr-direct-link"
                                               value="${registration_urls.qr_direct}"
                                               readonly>
                                        <button class="btn btn-outline-secondary btn-sm"
                                                onclick="copyToClipboard('qr-direct-link')">
                                            <i class="fas fa-copy"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()">
                            關閉
                        </button>
                        <button type="button" class="btn btn-primary" onclick="copyAllLinks()">
                            <i class="fas fa-copy me-2"></i>複製所有連結
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    $('#modal-container').html(modalHtml);
    $('body').addClass('modal-open');

    // 延遲生成 QR 碼，確保 DOM 已經更新
    setTimeout(() => {
        generateQRCode(registration_urls.primary);
    }, 100);
}

// ========== QR 碼功能 ==========

function generateQRCode(url) {
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;

    $('#qr-code-display').html(`
        <img src="${qrCodeUrl}"
             alt="QR Code"
             class="img-fluid"
             style="max-width: 200px; max-height: 200px;"
             id="qr-code-image">
    `);
}

function downloadQRCode(projectName) {
    const img = document.getElementById('qr-code-image');
    if (img) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);

        const link = document.createElement('a');
        link.download = `${projectName}_QRCode.png`;
        link.href = canvas.toDataURL();
        link.click();
    }
}

function printQRCode() {
    const img = document.getElementById('qr-code-image');
    if (!img) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showAlert('無法開啟列印視窗，請檢查彈出視窗設定', 'warning');
        return;
    }

    // 使用 DOM 操作代替 document.write
    const doc = printWindow.document;

    // 創建 HTML 結構
    const html = doc.createElement('html');
    const head = doc.createElement('head');
    const title = doc.createElement('title');
    title.textContent = 'QR Code';

    const style = doc.createElement('style');
    style.textContent = `
        body { text-align: center; padding: 20px; font-family: Arial, sans-serif; }
        img { max-width: 300px; }
        .info { margin-top: 20px; }
    `;

    head.appendChild(title);
    head.appendChild(style);

    const body = doc.createElement('body');

    const qrImg = doc.createElement('img');
    qrImg.src = img.src;
    qrImg.alt = 'QR Code';

    const infoDiv = doc.createElement('div');
    infoDiv.className = 'info';

    const h3 = doc.createElement('h3');
    h3.textContent = '活動報名 QR Code';

    const p = doc.createElement('p');
    p.textContent = '掃描此 QR 碼進行活動報名';

    infoDiv.appendChild(h3);
    infoDiv.appendChild(p);

    body.appendChild(qrImg);
    body.appendChild(infoDiv);

    html.appendChild(head);
    html.appendChild(body);

    doc.appendChild(html);
    doc.close();

    // 等待圖片載入後再列印
    qrImg.onload = function() {
        printWindow.print();
    };
}

// ========== 剪貼板功能 ==========

function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    element.select();
    element.setSelectionRange(0, 99999);

    try {
        document.execCommand('copy');
        showAlert('連結已複製到剪貼板', 'success');
    } catch (err) {
        console.error('複製失敗:', err);
        showAlert('複製失敗，請手動複製', 'warning');
    }
}

function copyAllLinks() {
    const primaryLink = document.getElementById('primary-link').value;
    const legacyLink = document.getElementById('legacy-link').value;
    const qrDirectLink = document.getElementById('qr-direct-link').value;

    const allLinks = `主要報名連結: ${primaryLink}\n舊版兼容連結: ${legacyLink}\nQR 直連: ${qrDirectLink}`;

    navigator.clipboard.writeText(allLinks).then(() => {
        showAlert('所有連結已複製到剪貼板', 'success');
    }).catch(err => {
        console.error('複製失敗:', err);
        showAlert('複製失敗，請手動複製', 'warning');
    });
}

function openLink(url) {
    window.open(url, '_blank');
}

// ========== 模態框和提示 ==========

function closeModal() {
    $('#modal-container').empty();
    $('body').removeClass('modal-open');
}

function showAlert(message, type = 'info') {
    const alertClass = type === 'success' ? 'alert-success' :
        type === 'danger' ? 'alert-danger' :
            type === 'warning' ? 'alert-warning' : 'alert-info';

    const alertHtml = `
        <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;

    // 將提示添加到頁面頂部
    $('.content-header').after(alertHtml);

    // 自動消失
    setTimeout(() => {
        $('.alert').fadeOut();
    }, 3000);
}
