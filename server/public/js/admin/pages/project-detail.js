/**
 * Project Detail Page Scripts
 * 專案詳情頁面專用 JavaScript
 */

// projectId is set by inline script in handlebars
const projectId = window.projectId;
let currentTab = 'participants';

$(document).ready(function() {
    // 載入初始數據
    loadProjectStats();
    loadParticipants();
    
    // 選項卡切換
    $('.tab-btn').on('click', function() {
        const tabName = $(this).data('tab');
        switchTab(tabName);
    });
    
    // 搜尋追蹤
    $('#tracking-search').on('keypress', function(e) {
        if (e.which === 13) {
            searchTracking();
        }
    });

    // 參加者搜尋 Enter 鍵支援
    $('#participants-search').on('keypress', function(e) {
        if (e.which === 13) {
            searchParticipants();
        }
    });
});

// 切換選項卡
function switchTab(tabName) {
    $('.tab-btn').removeClass('active');
    $('.tab-content').removeClass('active');
    
    $(`.tab-btn[data-tab="${tabName}"]`).addClass('active');
    $(`#${tabName}-tab`).addClass('active');
    
    currentTab = tabName;
    
    // 載入對應內容
    switch(tabName) {
        case 'participants':
            loadParticipants();
            break;
        case 'questionnaires':
            loadQuestionnaires();
            break;
        case 'checkin':
            loadCheckinData();
            break;
        case 'tracking':
            // 追蹤頁面不需要自動載入
            break;
        case 'business-cards':
            loadBusinessCards();
            break;
        case 'qr-scanner':
            // QR掃描頁面不需要自動載入
            break;
        case 'booths':
            loadProjectBooths();
            break;
        case 'games':
            loadProjectGames();
            break;
        case 'form-settings':
            loadFormConfig();
            break;
    }
}

// 載入專案統計
function loadProjectStats() {
    $.ajax({
        url: `/api/admin/projects/${projectId}/stats`,
        method: 'GET',
        success: function(response) {
            if (response.success) {
                const stats = response.data;
                const ageDist = stats.children_age_distribution || { age_0_6: 0, age_6_12: 0, age_12_18: 0 };
                const statsHtml = `
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-value">${stats.total_participants || 0}</div>
                            <div class="stat-label">總報名人數</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${stats.checked_in_count || 0}</div>
                            <div class="stat-label">已簽到人數</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${stats.total_children || 0}</div>
                            <div class="stat-label">小孩總數</div>
                            <div class="stat-detail">
                                <span class="age-tag">0-6歲: ${ageDist.age_0_6}</span>
                                <span class="age-tag">6-12歲: ${ageDist.age_6_12}</span>
                                <span class="age-tag">12-18歲: ${ageDist.age_12_18}</span>
                            </div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${stats.questionnaire_responses || 0}</div>
                            <div class="stat-label">問卷回應數</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${stats.checkin_rate || 0}%</div>
                            <div class="stat-label">簽到率</div>
                        </div>
                    </div>
                `;
                $('#project-stats').html(statsHtml);
            }
        },
        error: function() {
            $('#project-stats').html('<div class="alert alert-danger">載入統計失敗</div>');
        }
    });
}

// 參加者搜尋狀態
let currentParticipantsSearch = '';

// 載入參加者列表（支援分頁和搜尋）
function loadParticipants(page = 1, search = currentParticipantsSearch) {
    currentParticipantsSearch = search;
    $.ajax({
        url: `/api/admin/projects/${projectId}/participants`,
        method: 'GET',
        data: { page: page, limit: 20, search: search },
        success: function(response) {
            if (response.success) {
                $('#participants-list').html(response.tableHtml);
                $('#participants-pagination').html(response.paginationHtml);
            } else {
                $('#participants-list').html('<tr><td colspan="8" class="text-center text-danger">載入參加者失敗</td></tr>');
                $('#participants-pagination').empty();
            }
        },
        error: function() {
            $('#participants-list').html('<tr><td colspan="8" class="text-center text-danger">載入參加者失敗</td></tr>');
            $('#participants-pagination').empty();
        }
    });
}

// 搜尋參加者
function searchParticipants() {
    const search = $('#participants-search').val().trim();
    loadParticipants(1, search);
}

// 清除參加者搜尋
function clearParticipantsSearch() {
    $('#participants-search').val('');
    currentParticipantsSearch = '';
    loadParticipants(1, '');
}

// 載入問卷資料
function loadQuestionnaires() {
    $.ajax({
        url: `/api/admin/projects/${projectId}/questionnaires`,
        method: 'GET',
        success: function(data) {
            $('#questionnaires-content').html(data);
        },
        error: function() {
            $('#questionnaires-content').html('<div class="alert alert-danger">載入問卷資料失敗</div>');
        }
    });
}

// 載入簽到資料
function loadCheckinData() {
    // 載入簽到統計
    $.ajax({
        url: `/api/admin/projects/${projectId}/checkin-stats`,
        method: 'GET',
        success: function(data) {
            $('#checkin-stats').html(data);
        },
        error: function() {
            $('#checkin-stats').html('<div class="alert alert-danger">載入簽到統計失敗</div>');
        }
    });
    
    // 載入簽到記錄
    $.ajax({
        url: `/api/admin/projects/${projectId}/checkin-records`,
        method: 'GET',
        success: function(data) {
            $('#checkin-list').html(data);
        },
        error: function() {
            $('#checkin-list').html('<div class="alert alert-danger">載入簽到記錄失敗</div>');
        }
    });
}

// 手動簽到
function manualCheckin(participantId) {
    if (confirm('確定要為此參加者辦理簽到嗎？')) {
        $.ajax({
            url: `/api/admin/participants/${participantId}/checkin`,
            method: 'POST',
            data: { project_id: projectId },
            success: function(response) {
                if (response.success) {
                    showNotification('簽到成功', 'success');
                    if (currentTab === 'participants') {
                        loadParticipants();
                    } else if (currentTab === 'checkin') {
                        loadCheckinData();
                    }
                    loadProjectStats();
                } else {
                    showNotification(response.message || '簽到失敗', 'error');
                }
            },
            error: function() {
                showNotification('簽到失敗，請稍後再試', 'error');
            }
        });
    }
}

// 取消簽到
function cancelCheckin(participantId) {
    if (confirm('確定要取消此參加者的簽到狀態嗎？')) {
        $.ajax({
            url: `/api/admin/participants/${participantId}/cancel-checkin`,
            method: 'POST',
            success: function(response) {
                if (response.success) {
                    showNotification('取消簽到成功', 'success');
                    if (currentTab === 'participants') {
                        loadParticipants();
                    } else if (currentTab === 'checkin') {
                        loadCheckinData();
                    }
                    loadProjectStats();
                } else {
                    showNotification(response.message || '取消簽到失敗', 'error');
                }
            },
            error: function() {
                showNotification('取消簽到失敗，請稍後再試', 'error');
            }
        });
    }
}

// 查看參加者追蹤
function viewParticipantTracking(traceId) {
    // 切換到追蹤選項卡
    switchTab('tracking');
    
    // 設置搜尋框值並執行搜尋
    $('#tracking-search').val(traceId);
    searchTracking();
}

// 搜尋追蹤
function searchTracking() {
    const searchTerm = $('#tracking-search').val().trim();
    if (!searchTerm) {
        showNotification('請輸入搜尋條件', 'warning');
        return;
    }
    
    $.ajax({
        url: `/api/admin/projects/${projectId}/tracking`,
        method: 'GET',
        data: { search: searchTerm },
        success: function(data) {
            $('#tracking-results').html(data);
        },
        error: function() {
            $('#tracking-results').html('<div class="alert alert-danger">搜尋失敗</div>');
        }
    });
}

// 開啟QR掃描視窗
function openScannerWindow() {
    const scannerUrl = `/admin/qr-scanner?project_id=${projectId}`;
    window.open(scannerUrl, 'qr-scanner', 'width=800,height=600,resizable=yes,scrollbars=yes');
}

// 開啟QR掃描器（嵌入式）
function openQRScanner() {
    switchTab('qr-scanner');
}

// 重新整理功能
function refreshStats() {
    loadProjectStats();
}

function refreshParticipants() {
    loadParticipants();
    showNotification('參加者資料已更新', 'info');
}

// 匯出功能
function exportParticipants() {
    window.open(`/api/admin/projects/${projectId}/export-participants`, '_blank');
}

// 批量簽到
function bulkCheckin() {
    if (confirm('確定要為所有未簽到的參加者批量辦理簽到嗎？')) {
        $.ajax({
            url: `/api/admin/projects/${projectId}/bulk-checkin`,
            method: 'POST',
            success: function(response) {
                if (response.success) {
                    showNotification(`成功為 ${response.data.count} 位參加者辦理簽到`, 'success');
                    loadCheckinData();
                    loadProjectStats();
                } else {
                    showNotification(response.message || '批量簽到失敗', 'error');
                }
            },
            error: function() {
                showNotification('批量簽到失敗，請稍後再試', 'error');
            }
        });
    }
}

// 創建問卷
function createQuestionnaire() {
    window.location.href = `/admin/questionnaire/new?project_id=${projectId}`;
}

// 查看問卷
function viewQuestionnaire(questionnaireId) {
    window.open(`/questionnaire/${questionnaireId}`, '_blank');
}

// 編輯問卷
function editQuestionnaire(questionnaireId) {
    window.location.href = `/admin/questionnaire/design?id=${questionnaireId}`;
}

// 查看問卷統計
function viewQuestionnaireStats(questionnaireId) {
    window.location.href = `/admin/questionnaire/stats?id=${questionnaireId}`;
}

// 格式化日期時間
function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// QR Code 名片管理功能
let currentBusinessCardsPage = 1;
let businessCardsSearch = '';

// 載入名片列表
function loadBusinessCards(page = 1, search = '') {
    currentBusinessCardsPage = page;
    businessCardsSearch = search;

    $('#business-cards-loading').show();
    $('#business-cards-table tbody').empty();

    $.ajax({
        url: `/api/admin/business-cards/project/${projectId}`,
        method: 'GET',
        data: {
            page: page,
            limit: 20,
            search: search
        },
        success: function(response) {
            $('#business-cards-loading').hide();

            if (response.success) {
                renderBusinessCards(response.data.cards);
                renderBusinessCardsPagination(response.data.pagination);
            } else {
                showNotification(response.message || '載入名片失敗', 'error');
            }
        },
        error: function() {
            $('#business-cards-loading').hide();
            showNotification('載入名片失敗，請稍後再試', 'error');
        }
    });
}

// 渲染名片列表
function renderBusinessCards(cards) {
    const tbody = $('#business-cards-tbody');
    tbody.empty();

    if (cards.length === 0) {
        tbody.append(`
            <tr>
                <td colspan="8" class="text-center">
                    <div class="empty-state">
                        <i class="fas fa-address-card fa-3x text-muted"></i>
                        <p class="mt-3 text-muted">尚無名片資料</p>
                    </div>
                </td>
            </tr>
        `);
        return;
    }

    cards.forEach(card => {
        const statusBadge = card.is_active ?
            '<span class="badge badge-success">啟用</span>' :
            '<span class="badge badge-secondary">停用</span>';

        const contactInfo = [
            card.email ? `<div><i class="fas fa-envelope"></i> ${card.email}</div>` : '',
            card.phone ? `<div><i class="fas fa-phone"></i> ${card.phone}</div>` : ''
        ].filter(info => info).join('');

        const row = `
            <tr>
                <td>
                    <strong>${card.name}</strong>
                    ${card.social_media.linkedin ? '<i class="fab fa-linkedin text-primary ml-2"></i>' : ''}
                    ${card.social_media.wechat ? '<i class="fab fa-weixin text-success ml-1"></i>' : ''}
                </td>
                <td>${card.title || '-'}</td>
                <td>${card.company || '-'}</td>
                <td class="contact-info">${contactInfo || '-'}</td>
                <td>
                    <span class="badge badge-info">${card.scan_count}</span>
                    ${card.last_scanned_at ? `<small class="text-muted d-block">最後掃描: ${formatDateTime(card.last_scanned_at)}</small>` : ''}
                </td>
                <td>${formatDateTime(card.created_at)}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="viewBusinessCard('${card.card_id}')" title="查看詳情">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-info" onclick="downloadQRCode('${card.card_id}')" title="下載 QR Code">
                            <i class="fas fa-qrcode"></i>
                        </button>
                        <button class="btn btn-outline-${card.is_active ? 'warning' : 'success'}"
                                onclick="toggleBusinessCardStatus('${card.card_id}', ${card.is_active})"
                                title="${card.is_active ? '停用' : '啟用'}">
                            <i class="fas fa-${card.is_active ? 'pause' : 'play'}"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteBusinessCard('${card.card_id}', '${card.name}')" title="刪除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        tbody.append(row);
    });
}

// 渲染分頁
function renderBusinessCardsPagination(pagination) {
    const container = $('#business-cards-pagination');
    container.empty();

    if (pagination.total_pages <= 1) return;

    let paginationHtml = '<nav><ul class="pagination justify-content-center">';

    // 上一頁
    if (pagination.has_prev) {
        paginationHtml += `<li class="page-item">
            <a class="page-link" href="#" onclick="loadBusinessCards(${pagination.current_page - 1}, '${businessCardsSearch}')">上一頁</a>
        </li>`;
    }

    // 頁碼
    for (let i = 1; i <= pagination.total_pages; i++) {
        const active = i === pagination.current_page ? 'active' : '';
        paginationHtml += `<li class="page-item ${active}">
            <a class="page-link" href="#" onclick="loadBusinessCards(${i}, '${businessCardsSearch}')">${i}</a>
        </li>`;
    }

    // 下一頁
    if (pagination.has_next) {
        paginationHtml += `<li class="page-item">
            <a class="page-link" href="#" onclick="loadBusinessCards(${pagination.current_page + 1}, '${businessCardsSearch}')">下一頁</a>
        </li>`;
    }

    paginationHtml += '</ul></nav>';
    container.html(paginationHtml);
}

// 搜尋名片
function searchBusinessCards() {
    const search = $('#business-card-search').val().trim();
    loadBusinessCards(1, search);
}

// 重新整理名片
function refreshBusinessCards() {
    loadBusinessCards(currentBusinessCardsPage, businessCardsSearch);
    showNotification('名片資料已更新', 'info');
}

// 匯出名片
function exportBusinessCards() {
    window.open(`/api/admin/business-cards/project/${projectId}/export`, '_blank');
}

// 查看名片詳情
function viewBusinessCard(cardId) {
    // 使用 API 獲取名片詳情並顯示在模態框中
    $.ajax({
        url: `/api/v1/business-cards/${cardId}`,
        method: 'GET',
        success: function(response) {
            if (response.success) {
                showBusinessCardModal(response.data);
            } else {
                showNotification(response.message || '獲取名片詳情失敗', 'error');
            }
        },
        error: function() {
            showNotification('獲取名片詳情失敗，請稍後再試', 'error');
        }
    });
}

// 顯示名片詳情模態框
function showBusinessCardModal(card) {
    const socialMediaLinks = [];
    if (card.social_media.website) {
        socialMediaLinks.push(`<a href="${card.social_media.website}" target="_blank"><i class="fas fa-globe"></i> 網站</a>`);
    }
    if (card.social_media.linkedin) {
        socialMediaLinks.push(`<a href="${card.social_media.linkedin}" target="_blank"><i class="fab fa-linkedin"></i> LinkedIn</a>`);
    }
    if (card.social_media.wechat) {
        socialMediaLinks.push(`<span><i class="fab fa-weixin"></i> 微信: ${card.social_media.wechat}</span>`);
    }

    const modalContent = `
        <div class="modal fade" id="businessCardModal" tabindex="-1" role="dialog">
            <div class="modal-dialog modal-lg" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-address-card"></i> 名片詳情 - ${card.name}
                        </h5>
                        <button type="button" class="close" data-dismiss="modal">
                            <span>&times;</span>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-8">
                                <div class="card-info">
                                    <h6><i class="fas fa-user"></i> 基本資訊</h6>
                                    <table class="table table-borderless">
                                        <tr>
                                            <td><strong>姓名:</strong></td>
                                            <td>${card.name}</td>
                                        </tr>
                                        <tr>
                                            <td><strong>職稱:</strong></td>
                                            <td>${card.title || '-'}</td>
                                        </tr>
                                        <tr>
                                            <td><strong>公司:</strong></td>
                                            <td>${card.company || '-'}</td>
                                        </tr>
                                    </table>

                                    <h6><i class="fas fa-phone"></i> 聯絡資訊</h6>
                                    <table class="table table-borderless">
                                        <tr>
                                            <td><strong>電話:</strong></td>
                                            <td>${card.contact_info.phone || '-'}</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Email:</strong></td>
                                            <td>${card.contact_info.email || '-'}</td>
                                        </tr>
                                        <tr>
                                            <td><strong>地址:</strong></td>
                                            <td>${card.contact_info.address || '-'}</td>
                                        </tr>
                                    </table>

                                    ${socialMediaLinks.length > 0 ? `
                                    <h6><i class="fas fa-share-alt"></i> 社群媒體</h6>
                                    <div class="social-links">
                                        ${socialMediaLinks.join('<br>')}
                                    </div>
                                    ` : ''}

                                    <h6><i class="fas fa-chart-bar"></i> 統計資訊</h6>
                                    <table class="table table-borderless">
                                        <tr>
                                            <td><strong>掃描次數:</strong></td>
                                            <td><span class="badge badge-info">${card.statistics.scan_count}</span></td>
                                        </tr>
                                        <tr>
                                            <td><strong>最後掃描:</strong></td>
                                            <td>${card.statistics.last_scanned_at ? formatDateTime(card.statistics.last_scanned_at) : '尚未掃描'}</td>
                                        </tr>
                                        <tr>
                                            <td><strong>建立時間:</strong></td>
                                            <td>${formatDateTime(card.created_at)}</td>
                                        </tr>
                                    </table>
                                </div>
                            </div>
                            <div class="col-md-4 text-center">
                                <h6><i class="fas fa-qrcode"></i> QR Code</h6>
                                <img src="${card.qr_code.base64}" alt="QR Code" class="img-fluid" style="max-width: 200px;">
                                <div class="mt-3">
                                    <button class="btn btn-primary btn-sm" onclick="downloadQRCodeFromModal('${card.card_id}')">
                                        <i class="fas fa-download"></i> 下載 QR Code
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">關閉</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 移除現有的模態框
    $('#businessCardModal').remove();

    // 添加新的模態框
    $('body').append(modalContent);

    // 顯示模態框
    const modal = document.getElementById('businessCardModal');
    if (modal) {
        modal.style.display = 'block';
        modal.classList.add('show');
        document.body.classList.add('modal-open');

        // 添加背景遮罩
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop fade show';
        backdrop.id = 'businessCardBackdrop';
        document.body.appendChild(backdrop);

        // 綁定關閉事件
        const closeButtons = modal.querySelectorAll('[data-dismiss="modal"], .close');
        closeButtons.forEach(button => {
            button.addEventListener('click', closeBusinessCardModal);
        });

        // 點擊背景關閉
        backdrop.addEventListener('click', closeBusinessCardModal);
    }
}

// 關閉名片詳情模態框
function closeBusinessCardModal() {
    const modal = document.getElementById('businessCardModal');
    const backdrop = document.getElementById('businessCardBackdrop');

    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
        modal.remove();
    }

    if (backdrop) {
        backdrop.remove();
    }

    document.body.classList.remove('modal-open');
}

// 從模態框下載 QR Code
function downloadQRCodeFromModal(cardId) {
    downloadQRCode(cardId);
}

// 下載 QR Code
function downloadQRCode(cardId) {
    // 獲取名片資料並下載 QR Code
    $.ajax({
        url: `/api/v1/business-cards/${cardId}`,
        method: 'GET',
        success: function(response) {
            if (response.success && response.data.qr_code.base64) {
                // 創建下載連結
                const link = document.createElement('a');
                link.href = response.data.qr_code.base64;
                link.download = `${response.data.name}_QRCode.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                showNotification('QR Code 下載成功', 'success');
            } else {
                showNotification('獲取 QR Code 失敗', 'error');
            }
        },
        error: function() {
            showNotification('下載 QR Code 失敗，請稍後再試', 'error');
        }
    });
}

// 切換名片狀態
function toggleBusinessCardStatus(cardId, currentStatus) {
    const action = currentStatus ? '停用' : '啟用';

    if (confirm(`確定要${action}這張名片嗎？`)) {
        $.ajax({
            url: `/api/admin/business-cards/${cardId}/status`,
            method: 'PATCH',
            data: { is_active: !currentStatus },
            success: function(response) {
                if (response.success) {
                    showNotification(response.message, 'success');
                    loadBusinessCards(currentBusinessCardsPage, businessCardsSearch);
                } else {
                    showNotification(response.message || '操作失敗', 'error');
                }
            },
            error: function() {
                showNotification('操作失敗，請稍後再試', 'error');
            }
        });
    }
}

// 刪除名片
function deleteBusinessCard(cardId, cardName) {
    if (confirm(`確定要刪除「${cardName}」的名片嗎？此操作無法復原。`)) {
        $.ajax({
            url: `/api/admin/business-cards/${cardId}`,
            method: 'DELETE',
            success: function(response) {
                if (response.success) {
                    showNotification(response.message, 'success');
                    loadBusinessCards(currentBusinessCardsPage, businessCardsSearch);
                } else {
                    showNotification(response.message || '刪除失敗', 'error');
                }
            },
            error: function() {
                showNotification('刪除失敗，請稍後再試', 'error');
            }
        });
    }
}

// ========== 攤位設定相關函數 ==========

// 載入專案攤位列表
function loadProjectBooths() {
    $.ajax({
        url: `/admin/projects/${projectId}/booths`,
        method: 'GET',
        success: function(html) {
            $('#project-booths-table').html(html);
        },
        error: function() {
            $('#project-booths-table').html('<tr><td colspan="7" class="text-center text-danger">載入失敗</td></tr>');
        }
    });
}

// 重新整理攤位列表
function refreshBooths() {
    loadProjectBooths();
    showNotification('攤位列表已更新', 'info');
}

// 新增攤位模態框
function addBoothModal() {
    const modalHtml = `
        <div class="modal-overlay" id="add-booth-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>新增攤位</h3>
                    <button class="close-btn" onclick="closeAddBoothModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="add-booth-form">
                        <div class="form-group">
                            <label>攤位名稱 <span class="required">*</span></label>
                            <input type="text" name="booth_name" class="form-control" required placeholder="例如：A區攤位">
                        </div>
                        <div class="form-group">
                            <label>攤位代碼 <span class="required">*</span></label>
                            <input type="text" name="booth_code" class="form-control" required placeholder="例如：BOOTH-A1">
                        </div>
                        <div class="form-group">
                            <label>位置</label>
                            <input type="text" name="location" class="form-control" placeholder="例如：展場 A 區入口處">
                        </div>
                        <div class="form-group">
                            <label>說明</label>
                            <textarea name="description" class="form-control" rows="3" placeholder="攤位說明..."></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeAddBoothModal()">取消</button>
                    <button class="btn btn-primary" onclick="submitAddBooth()">新增</button>
                </div>
            </div>
        </div>
    `;
    $('#modal-container').html(modalHtml);
}

function closeAddBoothModal() {
    $('#add-booth-modal').remove();
}

function submitAddBooth() {
    const formData = {
        booth_name: $('input[name="booth_name"]').val(),
        booth_code: $('input[name="booth_code"]').val(),
        location: $('input[name="location"]').val(),
        description: $('textarea[name="description"]').val()
    };

    if (!formData.booth_name || !formData.booth_code) {
        showNotification('請填寫必填欄位', 'error');
        return;
    }

    $.ajax({
        url: `/admin/projects/${projectId}/booths`,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(formData),
        success: function(response) {
            if (response.success) {
                showNotification('攤位新增成功', 'success');
                closeAddBoothModal();
                loadProjectBooths();
            } else {
                showNotification(response.message || '新增失敗', 'error');
            }
        },
        error: function() {
            showNotification('新增失敗，請稍後再試', 'error');
        }
    });
}

// 刪除攤位
function deleteBooth(boothId) {
    if (!confirm('確定要刪除此攤位嗎？')) return;

    $.ajax({
        url: `/admin/projects/${projectId}/booths/${boothId}`,
        method: 'DELETE',
        success: function(response) {
            if (response.success) {
                showNotification('攤位已刪除', 'success');
                loadProjectBooths();
            } else {
                showNotification(response.message || '刪除失敗', 'error');
            }
        },
        error: function() {
            showNotification('刪除失敗，請稍後再試', 'error');
        }
    });
}

// ========== 遊戲設定相關函數 ==========

// 載入專案遊戲列表
function loadProjectGames() {
    $.ajax({
        url: `/admin/projects/${projectId}/games`,
        method: 'GET',
        success: function(html) {
            $('#project-games-table').html(html);
        },
        error: function() {
            $('#project-games-table').html('<tr><td colspan="6" class="text-center text-danger">載入失敗</td></tr>');
        }
    });
}

// 重新整理專案遊戲列表
function refreshProjectGames() {
    loadProjectGames();
    showNotification('遊戲列表已更新', 'info');
}

// 綁定遊戲模態框
function bindGameModal() {
    // 先載入可用的遊戲和兌換券列表
    Promise.all([
        $.ajax({ url: '/admin/games/api/list?is_active=1&limit=100', method: 'GET' }),
        $.ajax({ url: '/admin/vouchers/api/list?is_active=1&limit=100', method: 'GET' })
    ]).then(([gamesResponse, vouchersResponse]) => {
        if (!gamesResponse.success || !vouchersResponse.success) {
            showNotification('載入資料失敗', 'error');
            return;
        }

        const games = gamesResponse.data;
        const vouchers = vouchersResponse.data;

        let gamesOptions = '<option value="">請選擇遊戲</option>';
        games.forEach(game => {
            gamesOptions += `<option value="${game.id}">${game.game_name_zh} (${game.game_name_en})</option>`;
        });

        let vouchersOptions = '<option value="">無兌換券</option>';
        vouchers.forEach(voucher => {
            vouchersOptions += `<option value="${voucher.id}">${voucher.voucher_name} ($${voucher.voucher_value})</option>`;
        });

        const modalHtml = `
            <div class="modal-overlay" id="bind-game-modal">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3>綁定遊戲</h3>
                        <button class="modal-close" onclick="closeBindGameModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="bind-game-form">
                            <div class="form-group">
                                <label for="game_id">選擇遊戲 <span class="required">*</span></label>
                                <select id="game_id" name="game_id" class="form-control" required>
                                    ${gamesOptions}
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="voucher_id">關聯兌換券</label>
                                <select id="voucher_id" name="voucher_id" class="form-control">
                                    ${vouchersOptions}
                                </select>
                                <small class="form-text text-muted">選擇後，玩家達成條件即可獲得兌換券</small>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="closeBindGameModal()">取消</button>
                        <button class="btn btn-primary" onclick="bindGame()">綁定</button>
                    </div>
                </div>
            </div>
        `;

        $('body').append(modalHtml);
    }).catch(() => {
        showNotification('載入資料失敗', 'error');
    });
}

// 關閉綁定遊戲模態框
function closeBindGameModal() {
    $('#bind-game-modal').remove();
}

// 綁定遊戲
function bindGame() {
    const gameId = $('#game_id').val();
    const voucherId = $('#voucher_id').val();

    if (!gameId) {
        showNotification('請選擇遊戲', 'error');
        return;
    }

    $.ajax({
        url: `/admin/projects/${projectId}/games`,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            game_id: parseInt(gameId),
            voucher_id: voucherId ? parseInt(voucherId) : null
        }),
        success: function(response) {
            if (response.success) {
                showNotification(response.message, 'success');
                closeBindGameModal();
                loadProjectGames();
            } else {
                showNotification(response.message || '綁定失敗', 'error');
            }
        },
        error: function() {
            showNotification('綁定失敗，請稍後再試', 'error');
        }
    });
}

// 解除遊戲綁定
function unbindGame(bindingId) {
    if (confirm('確定要解除此遊戲綁定嗎？')) {
        $.ajax({
            url: `/admin/projects/${projectId}/games/${bindingId}`,
            method: 'DELETE',
            success: function(response) {
                if (response.success) {
                    showNotification(response.message, 'success');
                    loadProjectGames();
                } else {
                    showNotification(response.message || '解除綁定失敗', 'error');
                }
            },
            error: function() {
                showNotification('解除綁定失敗，請稍後再試', 'error');
            }
        });
    }
}

// 查看遊戲 QR Code
function viewGameQR(bindingId) {
    $.ajax({
        url: `/admin/projects/${projectId}/games/${bindingId}/qr`,
        method: 'GET',
        success: function(response) {
            if (response.success) {
                const data = response.data;

                // 檢查 QR Code 是否存在
                if (!data.qr_code_base64) {
                    showNotification('QR Code 尚未生成，請稍後再試', 'warning');
                    return;
                }

                const modalHtml = `
                    <div class="modal-overlay" id="qr-modal">
                        <div class="modal-dialog">
                            <div class="modal-header">
                                <h3>遊戲 QR Code</h3>
                                <button class="modal-close" onclick="closeQRModal()">&times;</button>
                            </div>
                            <div class="modal-body" style="text-align: center;">
                                <h4>${data.game_name_zh}</h4>
                                <p class="text-muted">${data.game_name_en || ''}</p>
                                <p class="text-info">攤位：${data.booth_name || ''}</p>
                                ${data.voucher_name ? `<p class="text-success">兌換券：${data.voucher_name}</p>` : ''}
                                <div style="margin: 20px 0;">
                                    <img src="${data.qr_code_base64}" alt="QR Code" style="max-width: 300px; width: 100%;">
                                </div>
                                <button class="btn btn-primary" onclick="downloadGameQR('${data.qr_code_base64}', '${data.game_name_zh}')">
                                    <i class="fas fa-download"></i> 下載 QR Code
                                </button>
                            </div>
                            <div class="modal-footer">
                                <button class="btn btn-secondary" onclick="closeQRModal()">關閉</button>
                            </div>
                        </div>
                    </div>
                `;
                $('body').append(modalHtml);
            } else {
                showNotification('獲取 QR Code 失敗', 'error');
            }
        },
        error: function() {
            showNotification('獲取 QR Code 失敗，請稍後再試', 'error');
        }
    });
}

// 關閉 QR Code 模態框
function closeQRModal() {
    $('#qr-modal').remove();
}

// 下載遊戲 QR Code
function downloadGameQR(base64, gameName) {
    const link = document.createElement('a');
    link.href = base64;
    link.download = `${gameName}_QRCode.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('QR Code 下載成功', 'success');
}

// 編輯專案遊戲綁定
function editProjectGame(bindingId) {
    // 先載入當前綁定資訊和可用的兌換券列表
    Promise.all([
        $.ajax({ url: `/admin/projects/${projectId}/games/${bindingId}/qr`, method: 'GET' }),
        $.ajax({ url: '/admin/vouchers/api/list?is_active=1&limit=100', method: 'GET' })
    ]).then(([bindingResponse, vouchersResponse]) => {
        if (!bindingResponse.success || !vouchersResponse.success) {
            showNotification('載入資料失敗', 'error');
            return;
        }

        const binding = bindingResponse.data;
        const vouchers = vouchersResponse.data.vouchers || vouchersResponse.data;

        let vouchersOptions = '<option value="">無兌換券</option>';
        vouchers.forEach(voucher => {
            const selected = binding.voucher_id === voucher.id ? 'selected' : '';
            vouchersOptions += `<option value="${voucher.id}" ${selected}>${voucher.voucher_name} ($${voucher.voucher_value})</option>`;
        });

        const modalHtml = `
            <div class="modal-overlay" id="edit-game-modal">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3>編輯遊戲綁定</h3>
                        <button class="modal-close" onclick="closeEditGameModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="edit-game-form">
                            <div class="form-group">
                                <label>遊戲名稱</label>
                                <input type="text" class="form-control" value="${binding.game_name_zh}" disabled>
                            </div>
                            <div class="form-group">
                                <label for="edit_voucher_id">關聯兌換券</label>
                                <select id="edit_voucher_id" name="voucher_id" class="form-control">
                                    ${vouchersOptions}
                                </select>
                                <small class="form-text text-muted">選擇後，玩家達成條件即可獲得兌換券</small>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="closeEditGameModal()">取消</button>
                        <button class="btn btn-primary" onclick="updateProjectGame(${bindingId})">儲存</button>
                    </div>
                </div>
            </div>
        `;

        $('body').append(modalHtml);
    }).catch(() => {
        showNotification('載入資料失敗', 'error');
    });
}

// 關閉編輯遊戲模態框
function closeEditGameModal() {
    $('#edit-game-modal').remove();
}

// 更新專案遊戲綁定
function updateProjectGame(bindingId) {
    const voucherId = $('#edit_voucher_id').val();

    $.ajax({
        url: `/admin/projects/${projectId}/games/${bindingId}`,
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify({
            voucher_id: voucherId ? parseInt(voucherId) : null
        }),
        success: function(response) {
            if (response.success) {
                showNotification(response.message, 'success');
                closeEditGameModal();
                loadProjectGames();
            } else {
                showNotification(response.message || '更新失敗', 'error');
            }
        },
        error: function() {
            showNotification('更新失敗，請稍後再試', 'error');
        }
    });
}

// 查看遊戲統計
function viewGameStats(gameId) {
    window.location.href = `/admin/games/${gameId}/stats?project_id=${projectId}`;
}

// ========== 許願樹功能 ==========
// 載入許願樹統計
async function loadWishTreeStats() {
    try {
        const response = await fetch(`/api/v1/wish-tree/stats?project_id=${projectId}`);
        const result = await response.json();

        if (result.success) {
            const data = result.data;

            // 更新統計卡片
            $('#wish-total').text(data.total_wishes);

            // 計算今日許願數
            const today = new Date().toISOString().split('T')[0];
            const todayData = data.daily_distribution.find(d => d.date === today);
            $('#wish-today').text(todayData ? todayData.count : 0);

            // 顯示最高峰時段
            if (data.peak_hours.length > 0) {
                $('#wish-peak-hour').text(data.peak_hours[0].hour);
            } else {
                $('#wish-peak-hour').text('-');
            }

            // 計算平均每小時
            const avgPerHour = data.total_wishes > 0 && data.hourly_distribution.length > 0
                ? Math.round(data.total_wishes / data.hourly_distribution.length)
                : 0;
            $('#wish-avg').text(avgPerHour);
        }
    } catch (error) {
        console.error('載入許願樹統計失敗:', error);
        $('#wish-total, #wish-today, #wish-peak-hour, #wish-avg').text('錯誤');
    }
}

// 載入最近許願
async function loadRecentWishes() {
    try {
        const response = await fetch(`/api/v1/wish-tree/recent?project_id=${projectId}&limit=10`);
        const result = await response.json();

        if (result.success) {
            const tbody = $('#wish-tree-table');
            tbody.empty();

            if (result.data.length === 0) {
                tbody.html('<tr><td colspan="4" class="text-center text-muted">暫無許願記錄</td></tr>');
                return;
            }

            result.data.forEach(wish => {
                const row = `
                    <tr>
                        <td>${wish.id}</td>
                        <td class="wish-text-truncate">${escapeHtml(wish.wish_text)}</td>
                        <td class="text-muted small">${wish.created_at}</td>
                        <td class="text-muted small">${wish.ip_address || '-'}</td>
                    </tr>
                `;
                tbody.append(row);
            });
        }
    } catch (error) {
        console.error('載入最近許願失敗:', error);
        $('#wish-tree-table').html('<tr><td colspan="4" class="text-center text-danger">載入失敗</td></tr>');
    }
}

// HTML 轉義函數
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== 報名表單配置 =====

// 載入報名表單配置
function loadFormConfig() {
    $.ajax({
        url: `/admin/projects/${projectId}/form-config`,
        method: 'GET',
        success: function(response) {
            if (response.success) {
                const config = response.data.form_config;

                // 設置選填欄位
                const optionalFields = config.optional_fields || [];
                $('#field_company').prop('checked', optionalFields.includes('company'));
                $('#field_position').prop('checked', optionalFields.includes('position'));
                $('#field_gender').prop('checked', optionalFields.includes('gender'));
                $('#field_title').prop('checked', optionalFields.includes('title'));
                $('#field_notes').prop('checked', optionalFields.includes('notes'));
                $('#field_adult_age').prop('checked', optionalFields.includes('adult_age'));
                $('#field_children_count').prop('checked', optionalFields.includes('children_count'));
                $('#field_children_ages').prop('checked', optionalFields.includes('children_ages'));

                // 設置選項
                if (config.gender_options) {
                    $('#gender_options').val(config.gender_options.join(', '));
                }
                if (config.title_options) {
                    $('#title_options').val(config.title_options.join(', '));
                }
            }
        },
        error: function(xhr) {
            console.error('載入報名配置失敗:', xhr);
        }
    });
}

// 儲存報名表單配置
function saveFormConfig() {
    // 收集選填欄位
    const optionalFields = [];
    if ($('#field_company').is(':checked')) optionalFields.push('company');
    if ($('#field_position').is(':checked')) optionalFields.push('position');
    if ($('#field_gender').is(':checked')) optionalFields.push('gender');
    if ($('#field_title').is(':checked')) optionalFields.push('title');
    if ($('#field_notes').is(':checked')) optionalFields.push('notes');
    if ($('#field_adult_age').is(':checked')) optionalFields.push('adult_age');
    if ($('#field_children_count').is(':checked')) optionalFields.push('children_count');
    if ($('#field_children_ages').is(':checked')) optionalFields.push('children_ages');

    // 收集選項
    const genderOptions = $('#gender_options').val().split(',').map(s => s.trim()).filter(s => s);
    const titleOptions = $('#title_options').val().split(',').map(s => s.trim()).filter(s => s);

    const formConfig = {
        required_fields: ['name', 'email', 'phone'],
        optional_fields: optionalFields,
        field_labels: {
            name: '姓名',
            email: '電子郵件',
            phone: '手機號碼',
            company: '公司名稱',
            position: '職位',
            gender: '性別',
            title: '尊稱',
            notes: '留言備註',
            adult_age: '成人年齡',
            children_count: '小孩人數（自動計算）',
            children_ages: '小孩年齡區間'
        },
        gender_options: genderOptions,
        title_options: titleOptions
    };

    // 收集人數限制設定
    const maxParticipants = parseInt($('#max_participants').val()) || 0;
    const registrationDeadline = $('#registration_deadline').val() || null;

    // 同時更新表單配置和專案設定
    const requests = [
        // 1. 更新表單配置
        $.ajax({
            url: `/admin/projects/${projectId}/form-config`,
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({ form_config: formConfig })
        }),
        // 2. 更新人數限制
        $.ajax({
            url: `/api/admin/projects/${projectId}`,
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({
                max_participants: maxParticipants,
                registration_deadline: registrationDeadline
            })
        })
    ];

    Promise.all(requests)
        .then(function(responses) {
            const allSuccess = responses.every(r => r.success !== false);
            if (allSuccess) {
                alert('報名設定已儲存');
                // 更新頁面顯示
                updateParticipantStats();
            } else {
                alert('部分設定儲存失敗');
            }
        })
        .catch(function(error) {
            console.error('儲存失敗:', error);
            alert('儲存失敗：' + (error.responseJSON?.message || '系統錯誤'));
        });
}

/**
 * 更新參加者統計數字
 */
function updateParticipantStats() {
    const maxParticipants = parseInt($('#max_participants').val()) || 0;
    const displayMax = maxParticipants > 0 ? maxParticipants : '∞';
    $('.stat-label').text('/ ' + displayMax);
}

// 當切換到許願樹 Tab 時載入數據
$(document).ready(function() {
    // ... 現有的程式碼 ...

    // 監聽 Tab 切換
    $('.tab-btn').on('click', function() {
        const tabName = $(this).data('tab');
        if (tabName === 'wish-tree') {
            // 首次載入時才載入數據
            if ($('#wish-total').text() === '-') {
                loadWishTreeStats();
                loadRecentWishes();
            }
        }
    });
});
