/**
 * Checkin Management Page Scripts
 * 報到管理頁面專用 JavaScript
 * 使用安全 DOM 操作避免 XSS 風險
 */

// ========== 初始化 ==========
$(document).ready(function () {
    // 初始載入數據
    loadCheckinStats();
    loadParticipants();
    loadPagination();

    // 專案選擇器變更事件
    $('#project-select').on('change', function () {
        loadParticipants(null, 1);
        loadPagination(1);
        loadCheckinStats();
    });

    // 報到狀態選擇器變更事件
    $('#status-filter').on('change', function () {
        loadParticipants(null, 1);
        loadPagination(1);
    });

    // 搜尋功能 - 使用防抖動
    var searchTimeout;
    $('#search-participants').on('keyup', function () {
        var searchTerm = $(this).val();
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(function() {
            searchParticipants(searchTerm);
        }, 300);
    });

    // 手動報到功能
    window.manualCheckin = function (participantId) {
        if (confirm('確定要手動為此參與者辦理報到嗎？')) {
            $.ajax({
                url: '/api/admin/checkin/' + participantId + '/checkin',
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-Token': getCsrfToken()
                },
                success: function (response) {
                    if (response.success) {
                        showNotification('報到成功', 'success');
                        loadParticipants();
                        loadCheckinStats();
                    } else {
                        showNotification(response.message || '報到失敗', 'error');
                    }
                },
                error: function () {
                    showNotification('操作失敗，請稍後再試', 'error');
                }
            });
        }
    };

    // 取消報到功能
    window.cancelCheckin = function (participantId) {
        if (confirm('確定要取消此參與者的報到狀態嗎？')) {
            $.ajax({
                url: '/api/admin/checkin/' + participantId + '/cancel',
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-Token': getCsrfToken()
                },
                success: function (response) {
                    if (response.success) {
                        showNotification('取消報到成功', 'success');
                        loadParticipants();
                        loadCheckinStats();
                    } else {
                        showNotification(response.message || '取消報到失敗', 'error');
                    }
                },
                error: function () {
                    showNotification('操作失敗，請稍後再試', 'error');
                }
            });
        }
    };

    // 顯示 QR Code
    window.showQRCode = function (qrToken) {
        var modalContainer = document.getElementById('modal-container');
        modalContainer.textContent = '';

        var modal = document.createElement('div');
        modal.className = 'modal show';
        modal.style.display = 'flex';
        modal.id = 'qr-modal';

        var modalDialog = document.createElement('div');
        modalDialog.className = 'modal-dialog';

        var modalContent = document.createElement('div');
        modalContent.className = 'modal-content';

        // Modal header
        var modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';

        var modalTitle = document.createElement('h4');
        modalTitle.className = 'modal-title';
        modalTitle.textContent = 'QR Code';

        var closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'close';
        closeButton.setAttribute('aria-label', 'Close');
        closeButton.addEventListener('click', closeModal);
        var closeSpan = document.createElement('span');
        closeSpan.setAttribute('aria-hidden', 'true');
        closeSpan.textContent = '\u00D7';
        closeButton.appendChild(closeSpan);

        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(closeButton);

        // Modal body
        var modalBody = document.createElement('div');
        modalBody.className = 'modal-body text-center';

        var qrcodeContainer = document.createElement('div');
        qrcodeContainer.id = 'qrcode-container';

        var tokenText = document.createElement('p');
        tokenText.className = 'mt-2';
        tokenText.textContent = 'QR Token: ' + qrToken;

        modalBody.appendChild(qrcodeContainer);
        modalBody.appendChild(tokenText);

        // Modal footer
        var modalFooter = document.createElement('div');
        modalFooter.className = 'modal-footer';

        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'btn btn-secondary';
        closeBtn.textContent = '關閉';
        closeBtn.addEventListener('click', closeModal);

        modalFooter.appendChild(closeBtn);

        // Assemble modal
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        modalContent.appendChild(modalFooter);
        modalDialog.appendChild(modalContent);
        modal.appendChild(modalDialog);
        modalContainer.appendChild(modal);

        // 動態載入 QR Code 庫並生成 QR Code
        if (typeof QRCode === 'undefined') {
            var script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
            script.onload = function() {
                generateQRInModal(qrToken);
            };
            document.head.appendChild(script);
        } else {
            generateQRInModal(qrToken);
        }
    };

    // 查看參與者詳情
    window.viewParticipant = function (participantId) {
        $.ajax({
            url: '/admin/submissions/' + participantId,
            method: 'GET',
            success: function (data) {
                $('#modal-container').html(data);
                var modal = $('#modal-container .modal')[0];
                if (modal) {
                    $(modal).addClass('show');
                    $('body').addClass('modal-open');
                }
            },
            error: function () {
                showNotification('載入參與者詳情失敗', 'error');
            }
        });
    };

    // 關閉模態框
    window.closeModal = function () {
        var modalContainer = document.getElementById('modal-container');
        if (modalContainer) {
            modalContainer.textContent = '';
        }
        $('body').removeClass('modal-open');
    };

    // 匯出報到記錄
    window.exportCheckinRecords = function () {
        var projectId = $('#project-select').val();

        if (!projectId) {
            showNotification('請先選擇專案', 'error');
            return;
        }

        window.location.href = '/api/admin/checkin/export?project_id=' + projectId;
        showNotification('正在匯出報到記錄...', 'info');
    };

    // 重新整理參與者列表
    window.refreshParticipants = function () {
        var projectId = $('#project-select').val();
        loadParticipants(projectId, 1);
        loadPagination(1);
        loadCheckinStats();
        showNotification('數據已更新', 'info');
    };
});

// ========== 輔助函數 ==========

/**
 * QR Code 生成函數
 */
function generateQRInModal(qrToken) {
    try {
        var container = document.getElementById('qrcode-container');
        if (container) {
            container.textContent = '';

            // 生成 JSON 格式的 QR Code 數據
            var qrData = JSON.stringify({
                traceId: qrToken
            });

            new QRCode(container, {
                text: qrData,
                width: 200,
                height: 200,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    } catch (error) {
        console.error('QR Code 生成失敗:', error);
        var container = document.getElementById('qrcode-container');
        if (container) {
            container.textContent = '';
            var alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-danger';
            alertDiv.textContent = 'QR Code 生成失敗';
            container.appendChild(alertDiv);
        }
    }
}

// ========== 數據載入函數 ==========

/**
 * 載入統計數據
 */
function loadCheckinStats() {
    var projectId = $('#project-select').val();
    var params = {};
    if (projectId) params.project_id = projectId;

    $.ajax({
        url: '/api/admin/checkin/stats',
        method: 'GET',
        data: params,
        success: function (response) {
            if (response && response.success) {
                var stats = response.data;
                renderStatsGrid(stats);
            } else {
                showStatsError();
            }
        },
        error: function (xhr) {
            console.error('載入統計失敗:', xhr);
            if (xhr.status === 401) {
                showStatsAuthError();
            } else {
                showStatsError();
            }
        }
    });
}

/**
 * 渲染統計卡片 (使用安全 DOM 操作)
 */
function renderStatsGrid(stats) {
    var statsGrid = document.getElementById('stats-grid');
    if (!statsGrid) return;

    statsGrid.textContent = '';

    var statItems = [
        { icon: 'fa-users', value: stats.total_submissions, label: '總報名人數' },
        { icon: 'fa-check-circle', value: stats.total_checkins, label: '已報到人數' },
        { icon: 'fa-calendar-check', value: stats.today_checkins, label: '今日報到' },
        { icon: 'fa-chart-pie', value: stats.checkin_rate + '%', label: '報到率' }
    ];

    statItems.forEach(function(item) {
        var card = document.createElement('div');
        card.className = 'stat-card';

        var iconDiv = document.createElement('div');
        iconDiv.className = 'stat-icon';
        var icon = document.createElement('i');
        icon.className = 'fas ' + item.icon;
        iconDiv.appendChild(icon);

        var detailsDiv = document.createElement('div');
        detailsDiv.className = 'stat-details';
        var valueH3 = document.createElement('h3');
        valueH3.textContent = item.value;
        var labelP = document.createElement('p');
        labelP.textContent = item.label;
        detailsDiv.appendChild(valueH3);
        detailsDiv.appendChild(labelP);

        card.appendChild(iconDiv);
        card.appendChild(detailsDiv);
        statsGrid.appendChild(card);
    });
}

/**
 * 顯示統計錯誤
 */
function showStatsError() {
    var statsGrid = document.getElementById('stats-grid');
    if (statsGrid) {
        statsGrid.textContent = '';
        var alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-danger';
        alertDiv.textContent = '載入統計數據失敗';
        statsGrid.appendChild(alertDiv);
    }
}

/**
 * 顯示認證錯誤
 */
function showStatsAuthError() {
    var statsGrid = document.getElementById('stats-grid');
    if (statsGrid) {
        statsGrid.textContent = '';
        var alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-warning';
        alertDiv.textContent = '認證已過期，請重新登錄';
        statsGrid.appendChild(alertDiv);
    }
}

/**
 * 載入參與者列表
 */
function loadParticipants(projectId, page) {
    page = page || 1;

    var params = {
        page: page,
        format: 'html'
    };

    // 專案篩選
    var selectedProject = projectId || $('#project-select').val();
    if (selectedProject) {
        params.project_id = selectedProject;
    }

    // 狀態篩選
    var status = $('#status-filter').val();
    if (status) {
        params.status = status;
    }

    // 搜尋關鍵字
    var searchTerm = $('#search-participants').val();
    if (searchTerm && searchTerm.trim()) {
        params.search = searchTerm.trim();
    }

    $.ajax({
        url: '/api/admin/checkin/participants',
        method: 'GET',
        data: params,
        success: function (data) {
            // 檢查是否返回了HTML重定向內容
            if (typeof data === 'string' && data.indexOf('<!DOCTYPE html>') !== -1) {
                console.error('API返回了HTML頁面而非預期數據，可能是認證問題');
                showParticipantsAuthError();
                return;
            }
            $('#participants-table-body').html(data);
        },
        error: function (xhr) {
            console.error('載入參與者失敗:', xhr);
            if (xhr.status === 401) {
                showParticipantsAuthError();
            } else {
                showParticipantsError();
            }
        }
    });
}

/**
 * 顯示參與者載入錯誤
 */
function showParticipantsError() {
    var tbody = document.getElementById('participants-table-body');
    if (tbody) {
        tbody.textContent = '';
        var tr = document.createElement('tr');
        var td = document.createElement('td');
        td.setAttribute('colspan', '8');
        td.className = 'text-center text-danger';
        td.textContent = '載入參與者數據失敗';
        tr.appendChild(td);
        tbody.appendChild(tr);
    }
}

/**
 * 顯示參與者認證錯誤
 */
function showParticipantsAuthError() {
    var tbody = document.getElementById('participants-table-body');
    if (tbody) {
        tbody.textContent = '';
        var tr = document.createElement('tr');
        var td = document.createElement('td');
        td.setAttribute('colspan', '8');
        td.className = 'text-center text-warning';
        td.textContent = '認證已過期，請重新登錄';
        tr.appendChild(td);
        tbody.appendChild(tr);
    }
}

/**
 * 載入分頁
 */
function loadPagination(page) {
    page = page || 1;
    var projectId = $('#project-select').val();
    var searchTerm = $('#search-participants').val();
    var status = $('#status-filter').val();

    var params = { page: page };
    if (projectId) params.project_id = projectId;
    if (searchTerm && searchTerm.trim()) params.search = searchTerm.trim();
    if (status) params.status = status;

    $.ajax({
        url: '/api/admin/checkin/pagination',
        method: 'GET',
        data: params,
        success: function (data) {
            $('#pagination-container').html(data);
            // 從分頁 HTML 中讀取總數並更新 #total-count
            var totalSpan = $('#pagination-total');
            if (totalSpan.length > 0) {
                var total = totalSpan.data('total');
                $('#total-count').text('總計：' + total + ' 位參與者');
            }
        },
        error: function () {
            console.log('載入分頁失敗');
        }
    });
}

/**
 * 搜尋參與者
 */
function searchParticipants(searchTerm) {
    var projectId = $('#project-select').val();
    var params = {
        format: 'html',
        search: searchTerm
    };

    if (projectId) {
        params.project_id = projectId;
    }

    $.ajax({
        url: '/api/admin/checkin/participants',
        method: 'GET',
        data: params,
        success: function (data) {
            $('#participants-table-body').html(data);
            loadPagination(1);
        },
        error: function () {
            showParticipantsError();
        }
    });
}

/**
 * 載入指定頁面的參與者
 */
function loadParticipantsPage(page) {
    var projectId = $('#project-select').val();
    loadParticipants(projectId, page);
    loadPagination(page);
}

/**
 * 為參與者生成 QR Code
 */
window.generateQRForParticipant = function(participantId) {
    $.ajax({
        url: '/api/admin/participants/' + participantId + '/generate-qr',
        method: 'POST',
        headers: { 'X-CSRF-Token': getCsrfToken() },
        success: function(response) {
            if (response.success) {
                showNotification('QR Code 生成成功', 'success');
                var projectId = $('#project-select').val();
                loadParticipants(projectId, 1);
            } else {
                showNotification(response.message || 'QR Code 生成失敗', 'error');
            }
        },
        error: function(xhr) {
            console.error('生成 QR Code 失敗:', xhr);
            var errorMessage = 'QR Code 生成失敗';
            if (xhr.responseJSON && xhr.responseJSON.message) {
                errorMessage = xhr.responseJSON.message;
            }
            showNotification(errorMessage, 'error');
        }
    });
};

/**
 * 開啟 Webcam 掃描器（獨立視窗）
 */
window.openCameraScanner = function() {
    var width = 800;
    var height = 700;
    var left = (screen.width - width) / 2;
    var top = (screen.height - height) / 2;

    var features = 'width=' + width + ',height=' + height + ',left=' + left + ',top=' + top + ',resizable=yes,scrollbars=yes';
    var scannerWindow = window.open('/admin/checkin-management/camera-scanner', 'CheckinCameraScanner', features);

    if (!scannerWindow) {
        showNotification('無法開啟掃描視窗，請檢查瀏覽器彈出視窗設定', 'error');
        return;
    }

    // 監聽來自掃描視窗的訊息
    window.addEventListener('message', function(event) {
        if (event.origin !== window.location.origin) {
            return;
        }

        if (event.data.type === 'CHECKIN_SUCCESS') {
            showNotification('報到成功！', 'success');
            var projectId = $('#project-select').val();
            if (projectId) {
                loadParticipants(projectId, 1);
            }
        }
    });
};

// ========== 通知系統 ==========

/**
 * 顯示通知 (使用安全的 DOM 操作)
 */
function showNotification(message, type) {
    type = type || 'success';

    var container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999;';
        document.body.appendChild(container);
    }

    var notification = document.createElement('div');
    notification.className = 'notification notification-' + type;

    var bgColor = type === 'success' ? '#d4edda' : (type === 'error' ? '#f8d7da' : '#cce5ff');
    var textColor = type === 'success' ? '#155724' : (type === 'error' ? '#721c24' : '#004085');
    notification.style.cssText = 'padding: 12px 20px; margin-bottom: 10px; border-radius: 4px; ' +
        'background: ' + bgColor + '; color: ' + textColor + '; ' +
        'box-shadow: 0 2px 8px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 10px;';

    var messageSpan = document.createElement('span');
    messageSpan.textContent = message;

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00D7';
    closeBtn.style.cssText = 'background: none; border: none; font-size: 18px; cursor: pointer; margin-left: auto;';
    closeBtn.addEventListener('click', function() {
        notification.remove();
    });

    notification.appendChild(messageSpan);
    notification.appendChild(closeBtn);
    container.appendChild(notification);

    // 3秒後自動移除
    setTimeout(function() {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}
