let allUsers = [];
let allProjects = [];
let allGames = [];
let userSessionsChart = null;

// 使用共用 Utils.formatDate（從 admin layout 引入）
// 輔助函式：簡化呼叫
function formatDateTimeGMT8(dateString) {
    return Utils.formatDate(dateString, 'datetime');
}

// 頁面載入時執行
document.addEventListener('DOMContentLoaded', function() {
    // 設定今天的日期
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date-filter').value = today;
    
    loadProjects();
    loadGames();
    loadData();
    
    // 篩選器變更事件
    document.getElementById('date-filter').addEventListener('change', loadData);
    document.getElementById('project-filter').addEventListener('change', loadData);
    document.getElementById('game-filter').addEventListener('change', loadLeaderboard);
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
        loadLeaderboard()
    ]);
}

// 載入用戶列表
async function loadUsers() {
    try {
        const date = document.getElementById('date-filter').value;
        const projectId = document.getElementById('project-filter').value;

        let url = `/admin/game-analytics/api/daily-users?date=${date}`;
        if (projectId) url += `&project_id=${projectId}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.success && data.data && data.data.users) {
            allUsers = data.data.users;
            renderUsersTable(allUsers);
            updateStats(allUsers);
        } else {
            // 沒有資料時顯示空狀態
            allUsers = [];
            renderUsersTable([]);
            updateStats([]);
        }
    } catch (error) {
        console.error('載入用戶列表失敗:', error);
        // 錯誤時也顯示空狀態
        allUsers = [];
        renderUsersTable([]);
        updateStats([]);
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
function updateStats(users) {
    const totalUsers = users.length;
    const totalSessions = users.reduce((sum, u) => sum + (u.game_sessions || 0), 0);
    const totalVouchers = users.reduce((sum, u) => sum + (u.vouchers_redeemed || 0), 0);
    const highestScore = Math.max(...users.map(u => u.highest_score || 0), 0);

    document.getElementById('total-users').textContent = totalUsers;
    document.getElementById('total-sessions').textContent = totalSessions;
    document.getElementById('total-vouchers').textContent = totalVouchers;
    document.getElementById('highest-score').textContent = highestScore;

    // 更新用戶遊戲會話圖表
    updateUserSessionsChart(users);
}

// 更新用戶遊戲會話圖表
function updateUserSessionsChart(users) {
    // 只顯示有遊戲會話的用戶，最多顯示前 20 名
    const usersWithSessions = users
        .filter(u => u.game_sessions > 0)
        .sort((a, b) => b.game_sessions - a.game_sessions)
        .slice(0, 20);

    const labels = usersWithSessions.map(u => u.submitter_name || u.user_id);
    const sessionCounts = usersWithSessions.map(u => u.game_sessions || 0);
    const voucherCounts = usersWithSessions.map(u => u.vouchers_redeemed || 0);

    if (userSessionsChart) {
        userSessionsChart.destroy();
    }

    const ctx = document.getElementById('user-sessions-chart').getContext('2d');
    userSessionsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '遊戲會話',
                    data: sessionCounts,
                    backgroundColor: 'rgba(33, 150, 243, 0.6)',
                    borderColor: '#2196F3',
                    borderWidth: 1
                },
                {
                    label: '兌換券',
                    data: voucherCounts,
                    backgroundColor: 'rgba(255, 152, 0, 0.6)',
                    borderColor: '#FF9800',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
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

    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>姓名</th>
                    <th>Email</th>
                    <th>公司</th>
                    <th>電話</th>
                    <th>專案</th>
                    <th style="width: 150px;">報名時間</th>
                    <th style="width: 150px;">報到時間</th>
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

        html += `
            <tr>
                <td>
                    <a href="javascript:void(0)" class="user-link" onclick="viewUserJourney('${user.trace_id}')">
                        ${user.submitter_name || '未提供'}
                    </a>
                </td>
                <td>${user.submitter_email || '-'}</td>
                <td>${user.submitter_company || '-'}</td>
                <td>${user.submitter_phone || '-'}</td>
                <td>${user.project_name || '-'}</td>
                <td>${registrationTime}</td>
                <td>${checkinTime}</td>
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
    
    let modalHtml = `
        <div class="modal-overlay" id="journey-modal" onclick="closeJourneyModal(event)">
            <div class="modal-dialog-large" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3><i class="fas fa-route"></i> ${user_info.submitter_name} 的活動軌跡</h3>
                    <button class="modal-close" onclick="closeJourneyModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <!-- 用戶基本資訊 -->
                    <div class="journey-section">
                        <h4><i class="fas fa-user"></i> 基本資訊</h4>
                        <div class="row">
                            <div class="col-md-6">
                                <p><strong>姓名：</strong>${user_info.submitter_name || '-'}</p>
                                <p><strong>Email：</strong>${user_info.submitter_email || '-'}</p>
                                <p><strong>電話：</strong>${user_info.submitter_phone || '-'}</p>
                            </div>
                            <div class="col-md-6">
                                <p><strong>公司：</strong>${user_info.submitter_company || '-'}</p>
                                <p><strong>職稱：</strong>${user_info.submitter_title || '-'}</p>
                                <p><strong>專案：</strong>${user_info.project_name || '-'}</p>
                            </div>
                        </div>
                        <p><strong>報名時間：</strong>${formatDateTimeGMT8(user_info.registration_time)}</p>
                        <p><strong>報到時間：</strong>${formatDateTimeGMT8(user_info.checked_in_at) !== '-' ? formatDateTimeGMT8(user_info.checked_in_at) : '未報到'}</p>
                    </div>
                    
                    <!-- 遊戲會話 -->
                    <div class="journey-section">
                        <h4><i class="fas fa-gamepad"></i> 遊戲記錄 (${game_sessions.length})</h4>
                        ${renderGameSessions(game_sessions)}
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
