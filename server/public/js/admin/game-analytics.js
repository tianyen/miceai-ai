let allUsers = [];
let allProjects = [];
let allGames = [];
let sessionDepthChart = null;
let durationDistributionChart = null;
let hourlyActivityChart = null;
let retentionChart = null;
let usersPagination = {
    page: 1,
    limit: 50,
    total_items: 0,
    total_pages: 1
};

// 使用共用 Utils.formatDate（從 admin layout 引入）
// 輔助函式：簡化呼叫
function formatDateTimeGMT8(dateString) {
    return Utils.formatDate(dateString, 'datetime');
}

function hasValue(value) {
    return value !== null && value !== undefined && String(value).trim() !== '' && String(value).trim() !== '-';
}

function getAnonymousLabel(name, traceId) {
    if (hasValue(name) && String(name).trim() !== '匿名玩家') {
        return String(name).trim();
    }

    const suffix = String(traceId || '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(-6)
        .toUpperCase();

    return suffix ? `匿名玩家 #${suffix}` : '匿名玩家';
}

function buildInfoLine(label, value) {
    if (!hasValue(value)) {
        return '';
    }
    return `<p><strong>${label}：</strong>${value}</p>`;
}

function formatDateDisplay(dateString) {
    return String(dateString || '').replace(/-/g, '/');
}

function formatDateTimeInputDisplay(value) {
    if (!value) {
        return '';
    }

    const normalized = String(value).replace('T', ' ');
    const [datePart, timePart = ''] = normalized.split(' ');
    const trimmedTime = timePart.slice(0, 5);

    return `${formatDateDisplay(datePart)} ${trimmedTime}`.trim();
}

function updateDataWindowIndicators() {
    const date = document.getElementById('date-filter').value;
    const startAt = document.getElementById('start-at-filter').value;
    const endAt = document.getElementById('end-at-filter').value;
    const projectLabel = document.getElementById('project-filter').selectedOptions[0]?.textContent || '全部專案';

    const analyticsPrimary = document.getElementById('analytics-window-primary');
    const analyticsSecondary = document.getElementById('analytics-window-secondary');
    const leaderboardSecondary = document.getElementById('leaderboard-window-secondary');

    if (!analyticsPrimary || !analyticsSecondary || !leaderboardSecondary) {
        return;
    }

    let analyticsWindow = '全期間資料（GMT+8）';
    if (startAt && endAt) {
        analyticsWindow = `自訂時間區間 ${formatDateTimeInputDisplay(startAt)} 至 ${formatDateTimeInputDisplay(endAt)}（GMT+8）`;
    } else if (startAt) {
        analyticsWindow = `自訂時間區間自 ${formatDateTimeInputDisplay(startAt)} 起（GMT+8）`;
    } else if (endAt) {
        analyticsWindow = `自訂時間區間至 ${formatDateTimeInputDisplay(endAt)} 止（GMT+8）`;
    } else if (date) {
        analyticsWindow = `${formatDateDisplay(date)} 單日資料（GMT+8）`;
    }

    const leaderboardWindow = date
        ? `${formatDateDisplay(date)} 單日資料（GMT+8）`
        : '全期間資料（GMT+8）';

    analyticsPrimary.textContent = `${analyticsWindow} | ${projectLabel}`;
    analyticsSecondary.textContent = '總用戶數、遊戲會話、用戶列表、Session 深度、時長分佈、每小時遊玩與留存圖表會依這個資料視窗更新。';
    leaderboardSecondary.textContent = `排行榜目前使用：${leaderboardWindow}。開始時間 / 結束時間只影響用戶列表與互動圖表，不影響排行榜。`;
}

// 頁面載入時執行
document.addEventListener('DOMContentLoaded', function() {
    // 設定今天的日期
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date-filter').value = today;
    document.getElementById('page-size-filter').value = '50';
    updateDataWindowIndicators();
    
    loadProjects();
    loadGames();
    loadData();
    
    // 篩選器變更事件
    ['date-filter', 'project-filter', 'start-at-filter', 'end-at-filter'].forEach((id) => {
        document.getElementById(id).addEventListener('change', () => {
            usersPagination.page = 1;
            updateDataWindowIndicators();
            loadData();
        });
    });
    document.getElementById('page-size-filter').addEventListener('change', () => {
        usersPagination.page = 1;
        usersPagination.limit = parseInt(document.getElementById('page-size-filter').value, 10) || 50;
        updateDataWindowIndicators();
        loadUsers();
    });
    document.getElementById('game-filter').addEventListener('change', () => {
        updateDataWindowIndicators();
        loadLeaderboard();
    });
});

// 載入專案列表
async function loadProjects() {
    try {
        const response = await fetch('/api/admin/projects');
        const data = await response.json();

        if (data.success && data.data && data.data.projects) {
            allProjects = data.data.projects;

            const select = document.getElementById('project-filter');
            select.innerHTML = '<option value="">全部專案</option>';

            if (allProjects && allProjects.length > 0) {
                allProjects.forEach(project => {
                    const option = document.createElement('option');
                    option.value = project.id;
                    option.textContent = project.project_name;
                    select.appendChild(option);
                });
            }

            updateDataWindowIndicators();
        }
    } catch (error) {
        console.error('載入專案列表失敗:', error);
    }
}

// 載入遊戲列表
async function loadGames() {
    try {
        const response = await fetch('/admin/games/api/list');
        const data = await response.json();

        if (data.success && data.data) {
            allGames = data.data;

            const select = document.getElementById('game-filter');
            select.innerHTML = '<option value="">全部遊戲</option>';

            if (allGames && allGames.length > 0) {
                allGames.forEach(game => {
                    const option = document.createElement('option');
                    option.value = game.id;
                    option.textContent = game.game_name_zh;
                    select.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('載入遊戲列表失敗:', error);
    }
}

// 載入所有資料
async function loadData() {
    await Promise.all([
        loadUsers(),
        loadLeaderboard(),
        loadEngagementAnalytics()
    ]);
}

// 載入用戶列表
async function loadUsers() {
    try {
        const date = document.getElementById('date-filter').value;
        const projectId = document.getElementById('project-filter').value;
        const startAt = document.getElementById('start-at-filter').value;
        const endAt = document.getElementById('end-at-filter').value;
        const params = new URLSearchParams({
            date,
            page: String(usersPagination.page || 1),
            limit: String(usersPagination.limit || 50)
        });
        if (projectId) params.set('project_id', projectId);
        if (startAt) params.set('start_at', startAt);
        if (endAt) params.set('end_at', endAt);

        const response = await fetch(`/admin/game-analytics/api/daily-users?${params.toString()}`);
        const data = await response.json();

        if (data.success && data.data && data.data.users) {
            allUsers = data.data.users;
            usersPagination = data.data.pagination || usersPagination;
            renderUsersTable(allUsers);
            updateStats(data.data.summary || null);
            renderUsersPagination();
        } else {
            // 沒有資料時顯示空狀態
            allUsers = [];
            usersPagination = { page: 1, limit: usersPagination.limit || 50, total_items: 0, total_pages: 1 };
            renderUsersTable([]);
            updateStats(null);
            renderUsersPagination();
        }
    } catch (error) {
        console.error('載入用戶列表失敗:', error);
        // 錯誤時也顯示空狀態
        allUsers = [];
        usersPagination = { page: 1, limit: usersPagination.limit || 50, total_items: 0, total_pages: 1 };
        renderUsersTable([]);
        updateStats(null);
        renderUsersPagination();
    }
}

// 載入排行榜
async function loadLeaderboard() {
    try {
        const date = document.getElementById('date-filter').value;
        const projectId = document.getElementById('project-filter').value;
        const gameId = document.getElementById('game-filter').value;

        let url = `/admin/game-analytics/api/leaderboard?date=${date}&limit=10`;
        if (projectId) url += `&project_id=${projectId}`;
        if (gameId) url += `&game_id=${gameId}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.success && data.data && data.data.leaderboard) {
            renderLeaderboard(data.data.leaderboard);
        } else {
            // 沒有資料時顯示空狀態
            renderLeaderboard([]);
        }
    } catch (error) {
        console.error('載入排行榜失敗:', error);
        // 錯誤時也顯示空狀態
        renderLeaderboard([]);
    }
}

// 更新統計卡片
function updateStats(summary) {
    document.getElementById('total-users').textContent = summary?.total_users || 0;
    document.getElementById('total-sessions').textContent = summary?.total_sessions || 0;
    document.getElementById('total-vouchers').textContent = summary?.total_vouchers || 0;
    document.getElementById('highest-score').textContent = summary?.highest_score || 0;
}

function renderUsersPagination() {
    const container = document.getElementById('users-pagination');
    if (!container) return;

    const totalItems = usersPagination.total_items || 0;
    const currentPage = usersPagination.page || 1;
    const totalPages = usersPagination.total_pages || 1;
    const limit = usersPagination.limit || 50;
    const from = totalItems === 0 ? 0 : ((currentPage - 1) * limit) + 1;
    const to = Math.min(currentPage * limit, totalItems);

    container.innerHTML = `
        <div class="pagination-summary">
            顯示 ${from}-${to} / 共 ${totalItems} 位用戶
        </div>
        <div class="pagination-actions">
            <button class="btn btn-secondary btn-sm" ${currentPage <= 1 ? 'disabled' : ''} onclick="changeUsersPage(${currentPage - 1})">上一頁</button>
            <span>第 ${currentPage} / ${totalPages} 頁</span>
            <button class="btn btn-secondary btn-sm" ${currentPage >= totalPages ? 'disabled' : ''} onclick="changeUsersPage(${currentPage + 1})">下一頁</button>
        </div>
    `;
}

function changeUsersPage(page) {
    const totalPages = usersPagination.total_pages || 1;
    if (page < 1 || page > totalPages) return;
    usersPagination.page = page;
    loadUsers();
}

async function loadEngagementAnalytics() {
    try {
        const date = document.getElementById('date-filter').value;
        const projectId = document.getElementById('project-filter').value;

        let url = `/admin/game-analytics/api/engagement?date=${date}`;
        if (projectId) url += `&project_id=${projectId}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.success && data.data) {
            renderEngagementCharts(data.data);
        } else {
            renderEngagementCharts(null);
        }
    } catch (error) {
        console.error('載入玩家行為分析失敗:', error);
        renderEngagementCharts(null);
    }
}

function destroyAnalyticsCharts() {
    [sessionDepthChart, durationDistributionChart, hourlyActivityChart, retentionChart]
        .forEach((chart) => {
            if (chart) {
                chart.destroy();
            }
        });
    sessionDepthChart = null;
    durationDistributionChart = null;
    hourlyActivityChart = null;
    retentionChart = null;
}

function renderEngagementCharts(analytics) {
    destroyAnalyticsCharts();

    renderSessionDepthChart(analytics?.session_depth || []);
    renderDurationDistributionChart(analytics?.duration_distribution || []);
    renderHourlyActivityChart(analytics?.hourly_activity || []);
    renderRetentionChart(analytics?.retention || [], analytics?.cohort_size || 0);
}

function renderSessionDepthChart(sessionDepth) {
    const ctx = document.getElementById('session-depth-chart').getContext('2d');
    sessionDepthChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sessionDepth.map((item) => item.label),
            datasets: [{
                label: '唯一玩家數',
                data: sessionDepth.map((item) => item.user_count),
                backgroundColor: 'rgba(33, 150, 243, 0.65)',
                borderColor: '#2196F3',
                borderWidth: 1
            }]
        },
        options: buildBarChartOptions('玩家數')
    });
}

function renderDurationDistributionChart(durationDistribution) {
    const ctx = document.getElementById('duration-distribution-chart').getContext('2d');
    durationDistributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: durationDistribution.map((item) => item.label),
            datasets: [{
                label: '唯一玩家數',
                data: durationDistribution.map((item) => item.user_count),
                backgroundColor: 'rgba(255, 152, 0, 0.65)',
                borderColor: '#FF9800',
                borderWidth: 1
            }]
        },
        options: buildBarChartOptions('玩家數')
    });
}

function renderHourlyActivityChart(hourlyActivity) {
    const ctx = document.getElementById('hourly-activity-chart').getContext('2d');
    hourlyActivityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: hourlyActivity.map((item) => item.hour),
            datasets: [
                {
                    label: '唯一玩家數',
                    data: hourlyActivity.map((item) => item.unique_players),
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.15)',
                    tension: 0.2,
                    fill: true
                },
                {
                    label: 'Session 數',
                    data: hourlyActivity.map((item) => item.total_sessions),
                    borderColor: '#42A5F5',
                    backgroundColor: 'rgba(66, 165, 245, 0.1)',
                    tension: 0.2,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function renderRetentionChart(retention, cohortSize) {
    const ctx = document.getElementById('retention-chart').getContext('2d');
    retentionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: retention.map((item) => item.label),
            datasets: [{
                label: `留存率 %${cohortSize ? `（cohort ${cohortSize}）` : ''}`,
                data: retention.map((item) => item.retention_rate),
                backgroundColor: 'rgba(156, 39, 176, 0.65)',
                borderColor: '#9C27B0',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: (value) => `${value}%`
                    }
                }
            }
        }
    });
}

function buildBarChartOptions(yTitle) {
    return {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                position: 'top'
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: yTitle
                },
                ticks: {
                    stepSize: 1
                }
            }
        }
    };
}

// 渲染排行榜
function renderLeaderboard(leaderboard) {
    const container = document.getElementById('leaderboard-container');

    if (leaderboard.length === 0) {
        container.innerHTML = '<tr><td colspan="7" class="text-center">目前沒有排行榜資料</td></tr>';
        return;
    }

    let html = '';

    leaderboard.forEach((item, index) => {
        const rank = index + 1;

        // 排名圖示
        let rankIcon = '';
        if (rank === 1) rankIcon = '🥇';
        else if (rank === 2) rankIcon = '🥈';
        else if (rank === 3) rankIcon = '🥉';
        else rankIcon = `${rank}`;

        html += `
            <tr>
                <td class="text-center">${rankIcon}</td>
                <td>
                    <a href="javascript:void(0)" class="user-link" onclick="viewUserJourney('${item.trace_id}')">
                        ${item.submitter_name || '未提供'}
                    </a>
                </td>
                <td>${item.submitter_company || '-'}</td>
                <td>${item.game_name_zh || '-'}</td>
                <td>${item.booth_name || '-'}</td>
                <td class="text-center">
                    <strong>${item.highest_score || 0}</strong>
                    ${item.source_type === 'flow' ? '<br><span class="badge-info">手機流程</span>' : ''}
                </td>
                <td class="text-center">${item.total_play_time || 0} 秒</td>
            </tr>
        `;
    });

    container.innerHTML = html;
}

// 渲染用戶表格
function renderUsersTable(users) {
    const container = document.getElementById('users-table-container');

    if (users.length === 0) {
        container.innerHTML = '<div class="text-center">目前沒有用戶資料</div>';
        return;
    }

    const visibleColumns = {
        email: users.some((user) => hasValue(user.submitter_email)),
        company: users.some((user) => hasValue(user.submitter_company)),
        phone: users.some((user) => hasValue(user.submitter_phone)),
        checkin: users.some((user) => hasValue(user.checked_in_at))
    };

    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>姓名</th>
                    ${visibleColumns.email ? '<th>Email</th>' : ''}
                    ${visibleColumns.company ? '<th>公司</th>' : ''}
                    ${visibleColumns.phone ? '<th>電話</th>' : ''}
                    <th>專案</th>
                    <th style="width: 150px;">報名時間</th>
                    ${visibleColumns.checkin ? '<th style="width: 150px;">報到時間</th>' : ''}
                    <th style="width: 100px;">遊戲會話</th>
                    <th style="width: 100px;">最高分數</th>
                    <th style="width: 100px;">兌換券</th>
                    <th style="width: 100px;">操作</th>
                </tr>
            </thead>
            <tbody>
    `;

    users.forEach(user => {
        const registrationTime = formatDateTimeGMT8(user.registration_time);
        const checkinTime = formatDateTimeGMT8(user.checked_in_at);
        const displayName = getAnonymousLabel(user.submitter_name, user.trace_id);

        html += `
            <tr>
                <td>
                    <a href="javascript:void(0)" class="user-link" onclick="viewUserJourney('${user.trace_id}')">
                        ${displayName}
                    </a>
                </td>
                ${visibleColumns.email ? `<td>${user.submitter_email || '-'}</td>` : ''}
                ${visibleColumns.company ? `<td>${user.submitter_company || '-'}</td>` : ''}
                ${visibleColumns.phone ? `<td>${user.submitter_phone || '-'}</td>` : ''}
                <td>${user.project_name || '-'}</td>
                <td>${registrationTime}</td>
                ${visibleColumns.checkin ? `<td>${checkinTime}</td>` : ''}
                <td class="text-center">${user.game_sessions || 0}</td>
                <td class="text-center"><strong>${user.highest_score || 0}</strong></td>
                <td class="text-center">${user.vouchers_redeemed || 0}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-info" onclick="viewUserJourney('${user.trace_id}')" style="padding: 4px 8px; font-size: 12px;">
                        <i class="fas fa-route"></i> 軌跡
                    </button>
                </td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

// 查看用戶軌跡
async function viewUserJourney(traceId) {
    try {
        const response = await fetch(`/admin/game-analytics/api/user-journey/${traceId}`);
        const data = await response.json();
        
        if (data.success) {
            showJourneyModal(data.data);
        } else {
            showNotification(data.message || '載入用戶軌跡失敗', 'error');
        }
    } catch (error) {
        console.error('載入用戶軌跡失敗:', error);
        showNotification('載入用戶軌跡失敗', 'error');
    }
}

// 顯示用戶軌跡模態框
function showJourneyModal(journeyData) {
    const { user_info, game_sessions, redemptions, interactions, game_logs } = journeyData;
    const displayName = getAnonymousLabel(user_info.submitter_name, user_info.trace_id);
    const basicInfoLeft = [
        buildInfoLine('姓名', displayName),
        buildInfoLine('Email', user_info.submitter_email),
        buildInfoLine('電話', user_info.submitter_phone)
    ].filter(Boolean).join('');
    const basicInfoRight = [
        buildInfoLine('公司', user_info.submitter_company),
        buildInfoLine('職稱', user_info.submitter_title),
        buildInfoLine('專案', user_info.project_name)
    ].filter(Boolean).join('');
    const registrationLine = buildInfoLine('報名時間', formatDateTimeGMT8(user_info.registration_time));
    const checkinLine = hasValue(user_info.checked_in_at)
        ? buildInfoLine('報到時間', formatDateTimeGMT8(user_info.checked_in_at))
        : '';
    
    let modalHtml = `
        <div class="modal-overlay" id="journey-modal" onclick="closeJourneyModal(event)">
            <div class="modal-dialog-large" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3><i class="fas fa-route"></i> ${displayName} 的活動軌跡</h3>
                    <button class="modal-close" onclick="closeJourneyModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <!-- 用戶基本資訊 -->
                    <div class="journey-section">
                        <h4><i class="fas fa-user"></i> 基本資訊</h4>
                        <div class="row">
                            <div class="col-md-6">
                                ${basicInfoLeft || '<p class="text-muted">無可顯示資料</p>'}
                            </div>
                            <div class="col-md-6">
                                ${basicInfoRight || ''}
                            </div>
                        </div>
                        ${registrationLine}
                        ${checkinLine}
                    </div>
                    
                    <!-- 遊戲會話 -->
                    <div class="journey-section">
                        <h4><i class="fas fa-gamepad"></i> 遊戲記錄 (${game_sessions.length})</h4>
                        ${renderGameSessions(game_sessions)}
                    </div>

                    <div class="journey-section">
                        <h4><i class="fas fa-list-ol"></i> 流程事件 (${game_logs.length})</h4>
                        ${renderGameLogs(game_logs)}
                    </div>
                    
                    <!-- 兌換記錄 -->
                    <div class="journey-section">
                        <h4><i class="fas fa-ticket-alt"></i> 兌換記錄 (${redemptions.length})</h4>
                        ${renderRedemptions(redemptions)}
                    </div>
                    
                    <!-- 互動記錄 -->
                    ${interactions.length > 0 ? `
                    <div class="journey-section">
                        <h4><i class="fas fa-hand-pointer"></i> 互動記錄 (${interactions.length})</h4>
                        ${renderInteractions(interactions)}
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('journey-modal-container').innerHTML = modalHtml;
}

// 渲染遊戲會話
function renderGameSessions(sessions) {
    if (sessions.length === 0) {
        return '<p class="text-muted">無遊戲記錄</p>';
    }
    
    let html = '<div class="timeline">';
    sessions.forEach(session => {
        const startTime = formatDateTimeGMT8(session.session_start);
        const duration = session.total_play_time || 0;
        const score = session.final_score || 0;
        const isFlowSession = session.source_type === 'flow';
        const sessionStatus = session.session_status || 'active';
        const completionStage = session.completion_stage_id || session.exit_stage_id || session.entry_stage_id || '-';
        
        html += `
            <div class="timeline-item">
                <div class="timeline-time">${startTime}</div>
                <div class="timeline-content">
                    <strong>${session.game_name_zh}</strong>
                    ${session.booth_name ? `<span class="badge-info">${session.booth_name}</span>` : ''}
                    ${isFlowSession ? '<span class="badge-warning">手機流程</span>' : ''}
                    <br>
                    ${isFlowSession
                        ? `狀態: <strong>${sessionStatus}</strong> | 完成階段: ${completionStage} | 時長: ${duration} 秒`
                        : `分數: <strong>${score}</strong> | 時長: ${duration} 秒`}
                    ${session.voucher_earned && session.voucher_name ? `<br><span class="badge-success">獲得兌換券: ${session.voucher_name}</span>` : ''}
                </div>
            </div>
        `;
    });
    html += '</div>';
    return html;
}

// 渲染兌換記錄
function renderRedemptions(redemptions) {
    if (redemptions.length === 0) {
        return '<p class="text-muted">無兌換記錄</p>';
    }
    
    let html = '<div class="timeline">';
    redemptions.forEach(redemption => {
        const redeemedTime = formatDateTimeGMT8(redemption.redeemed_at);
        const usedTime = redemption.used_at ? formatDateTimeGMT8(redemption.used_at) : null;
        
        html += `
            <div class="timeline-item">
                <div class="timeline-time">${redeemedTime}</div>
                <div class="timeline-content">
                    <strong>${redemption.voucher_name}</strong> (${redemption.vendor_name})
                    ${redemption.booth_name ? `<span class="badge-info">${redemption.booth_name}</span>` : ''}
                    <br>
                    價值: NT$ ${redemption.voucher_value} | 兌換碼: <code>${redemption.redemption_code}</code>
                    <br>
                    ${redemption.is_used ? 
                        `<span class="badge-success">已使用 (${usedTime})</span>` : 
                        '<span class="badge-warning">未使用</span>'}
                </div>
            </div>
        `;
    });
    html += '</div>';
    return html;
}

// 渲染互動記錄
function renderInteractions(interactions) {
    let html = '<div class="timeline">';
    interactions.forEach(interaction => {
        const time = formatDateTimeGMT8(interaction.timestamp);
        
        html += `
            <div class="timeline-item">
                <div class="timeline-time">${time}</div>
                <div class="timeline-content">
                    <strong>${interaction.interaction_type}</strong>
                    <br>
                    ${interaction.interaction_data || ''}
                </div>
            </div>
        `;
    });
    html += '</div>';
    return html;
}

function renderGameLogs(gameLogs) {
    if (gameLogs.length === 0) {
        return '<p class="text-muted">無流程事件記錄</p>';
    }

    let html = '<div class="timeline">';
    gameLogs.forEach((log) => {
        const time = formatDateTimeGMT8(log.created_at);
        const sourceBadge = log.source_type === 'flow'
            ? '<span class="badge-warning">手機流程</span>'
            : '<span class="badge-info">舊版遊戲</span>';

        html += `
            <div class="timeline-item">
                <div class="timeline-time">${time}</div>
                <div class="timeline-content">
                    <strong>${log.game_name_zh || '遊戲事件'}</strong>
                    ${log.booth_name ? `<span class="badge-info">${log.booth_name}</span>` : ''}
                    ${sourceBadge}
                    <br>
                    <strong>${log.user_action || log.log_level || 'event'}</strong>
                    ${log.message ? `<br>${log.message}` : ''}
                </div>
            </div>
        `;
    });
    html += '</div>';
    return html;
}

// 關閉模態框
function closeJourneyModal(event) {
    if (!event || event.target.id === 'journey-modal') {
        document.getElementById('journey-modal-container').innerHTML = '';
    }
}

// 顯示通知
function showNotification(message, type = 'info') {
    alert(message);
}
