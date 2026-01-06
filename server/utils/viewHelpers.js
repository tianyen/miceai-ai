/**
 * View Helpers - HTML 生成工具
 *
 * 職責：
 * - 提供可重用的 HTML 生成函數
 * - 統一 HTML 模式和樣式
 * - 將 HTML 生成從路由中分離
 *
 * @description 從 admin-extended.js 抽取的 HTML 生成邏輯
 */

const { formatGMT8Time } = require('./timezone');

// ============================================================================
// 通用組件
// ============================================================================

/**
 * 生成狀態標籤
 * @param {string} status - 狀態值
 * @param {Object} config - 狀態配置 { [status]: { class, text } }
 * @returns {string} HTML
 */
function statusBadge(status, config = {}) {
    const defaultConfig = {
        active: { class: 'success', text: '進行中' },
        draft: { class: 'secondary', text: '草稿' },
        completed: { class: 'info', text: '已完成' },
        pending: { class: 'warning', text: '待處理' },
        approved: { class: 'success', text: '已核准' },
        rejected: { class: 'danger', text: '已拒絕' },
        confirmed: { class: 'primary', text: '已確認' },
        cancelled: { class: 'secondary', text: '已取消' }
    };

    const merged = { ...defaultConfig, ...config };
    const cfg = merged[status] || { class: 'secondary', text: status };

    return `<span class="badge badge-${cfg.class}">${cfg.text}</span>`;
}

/**
 * 生成簽到狀態標籤
 * @param {string|null} checkedInAt - 簽到時間
 * @returns {string} HTML
 */
function checkinStatusBadge(checkedInAt) {
    return checkedInAt
        ? '<span class="badge badge-success">已報到</span>'
        : '<span class="badge badge-warning">未報到</span>';
}

/**
 * 生成 ID 標籤
 * @param {number} id - ID
 * @param {string} type - 類型 ('secondary' | 'info')
 * @param {string} prefix - 前綴
 * @returns {string} HTML
 */
function idBadge(id, type = 'secondary', prefix = '#') {
    return `<span class="badge badge-${type}">${prefix}${id}</span>`;
}

/**
 * 格式化日期 (GMT+8 台北時區)
 * 使用共用的 timezone.js 模組處理 UTC 時間解析
 * @param {string|Date} date - 日期
 * @param {string} format - 格式 ('date' | 'datetime')
 * @returns {string} 格式化的日期字串
 */
function formatDate(date, format = 'date') {
    return formatGMT8Time(date, format);
}

/**
 * 安全輸出文字（防止 XSS）
 * @param {string} text - 文字
 * @param {string} fallback - 預設值
 * @returns {string} 安全的文字
 */
function safeText(text, fallback = '-') {
    if (!text) return fallback;
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================================================
// 按鈕組件
// ============================================================================

/**
 * 生成動作按鈕
 * @param {Object} options - 選項
 * @returns {string} HTML
 */
function actionButton({ icon, onclick, title, btnClass = 'primary', size = 'sm' }) {
    return `<button class="btn btn-${size} btn-${btnClass}" onclick="${onclick}" title="${title}">
        <i class="fas fa-${icon}"></i>
    </button>`;
}

/**
 * 生成操作按鈕組
 * @param {Array} buttons - 按鈕配置陣列
 * @returns {string} HTML
 */
function actionButtonGroup(buttons) {
    const buttonsHtml = buttons.map(btn => actionButton(btn)).join('\n');
    return `<div class="action-buttons">${buttonsHtml}</div>`;
}

// ============================================================================
// 分頁組件
// ============================================================================

/**
 * 生成分頁 HTML
 * @param {Object} options - 分頁選項
 * @returns {string} HTML
 */
function pagination({
    total,
    currentPage,
    pages,
    hasPrev,
    hasNext,
    loadFunction,
    itemName = '項目'
}) {
    let html = '<div class="pagination-info">';
    html += `<span>共 ${total} 個${itemName}，第 ${currentPage} 頁 / 共 ${pages} 頁</span>`;
    html += '</div>';

    if (pages > 1) {
        html += '<div class="pagination-buttons">';

        if (hasPrev) {
            html += `<button class="btn btn-sm btn-outline-primary" onclick="${loadFunction}(${currentPage - 1})">上一頁</button>`;
        }

        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(pages, currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === currentPage ? 'btn-primary' : 'btn-outline-primary';
            html += `<button class="btn btn-sm ${activeClass}" onclick="${loadFunction}(${i})">${i}</button>`;
        }

        if (hasNext) {
            html += `<button class="btn btn-sm btn-outline-primary" onclick="${loadFunction}(${currentPage + 1})">下一頁</button>`;
        }

        html += '</div>';
    }

    return html;
}

// ============================================================================
// 表格列組件
// ============================================================================

/**
 * 生成專案表格列
 * @param {Object} project - 專案資料
 * @returns {string} HTML
 */
function projectTableRow(project) {
    const status = statusBadge(project.status, {
        active: { class: 'success', text: '進行中' },
        draft: { class: 'secondary', text: '已結束' }
    });
    const createdDate = formatDate(project.created_at);
    const eventDate = formatDate(project.event_date);

    return `
        <tr>
            <td>${idBadge(project.id)}</td>
            <td>${safeText(project.project_name)}</td>
            <td>${safeText(project.project_code)}</td>
            <td>${eventDate}</td>
            <td>${status}</td>
            <td>${project.submission_count || 0}</td>
            <td>${createdDate}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-primary" onclick="viewProject(${project.id})" title="專案管理">
                        <i class="fas fa-cogs"></i>
                    </button>
                    ${project.status === 'active' ? `
                    <button class="btn btn-sm btn-info" onclick="getRegistrationLinks(${project.id})" title="獲取報名連結">
                        <i class="fas fa-qrcode"></i>
                    </button>
                    ` : ''}
                    <button class="btn btn-sm btn-success" onclick="editProject(${project.id})" title="編輯專案">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="duplicateProject(${project.id})" title="複製專案">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProject(${project.id})" title="刪除專案">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

/**
 * 生成表單提交表格列
 * @param {Object} submission - 提交資料
 * @param {Object} statusConfig - 狀態配置
 * @returns {string} HTML
 */
function submissionTableRow(submission, statusConfig = {}) {
    const submittedAt = formatDate(submission.created_at, 'datetime');
    const status = statusBadge(submission.status || 'pending', statusConfig);

    return `
        <tr>
            <td>${idBadge(submission.id)}</td>
            <td>${safeText(submission.submitter_name)}</td>
            <td>${safeText(submission.submitter_email)}</td>
            <td>${safeText(submission.submitter_phone)}</td>
            <td>${submission.participation_level || 50}%</td>
            <td>${safeText(submission.project_name)}</td>
            <td>${status}</td>
            <td>${submittedAt}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="viewSubmission(${submission.id})" title="查看詳情">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline-info" onclick="generateQRCode(${submission.id})" title="生成 QR Code">
                    <i class="fas fa-qrcode"></i>
                </button>
                <button class="btn btn-sm btn-outline-success" onclick="editSubmission(${submission.id})" title="編輯">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteSubmission(${submission.id})" title="刪除">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `;
}

/**
 * 生成參與者（報到）表格列
 * @param {Object} participant - 參與者資料
 * @returns {string} HTML
 */
function participantCheckinRow(participant) {
    const checkinStatus = checkinStatusBadge(participant.checked_in_at);
    const checkinTime = participant.checked_in_at
        ? formatDate(participant.checked_in_at, 'datetime')
        : '-';

    return `
        <tr>
            <td>${safeText(participant.submitter_name)}</td>
            <td>${safeText(participant.submitter_email)}</td>
            <td>${safeText(participant.submitter_phone)}</td>
            <td>${checkinStatus}</td>
            <td>${checkinTime}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="showQRCode(${participant.id})">
                    <i class="fas fa-qrcode"></i>
                </button>
            </td>
            <td>
                ${!participant.checked_in_at
                    ? `<button class="btn btn-sm btn-success" onclick="manualCheckin(${participant.id})">
                        <i class="fas fa-check"></i> 報到
                    </button>`
                    : `<button class="btn btn-sm btn-warning" onclick="cancelCheckin(${participant.id})">
                        <i class="fas fa-times"></i> 取消
                    </button>`
                }
                <button class="btn btn-sm btn-info" onclick="viewCheckinDetails(${participant.id})">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        </tr>
    `;
}

/**
 * 生成專案參與者表格列
 * @param {Object} participant - 參與者資料
 * @returns {string} HTML
 */
function projectParticipantRow(participant) {
    const checkinStatus = checkinStatusBadge(participant.checked_in_at);
    const idDisplay = participant.user_id
        ? idBadge(participant.user_id, 'info', 'User #')
        : idBadge(participant.id, 'secondary', '#');

    // 團體報名標記
    let groupBadge = '';
    if (participant.group_id) {
        if (participant.parent_submission_id) {
            // 團體成員（隨同報名）
            groupBadge = `<div class="group-badge group-member" title="團體報名成員">
                <i class="fas fa-user-friends"></i>
                <span class="group-label">隨 ${safeText(participant.parent_name)} 報名</span>
            </div>`;
        } else {
            // 主報名人
            groupBadge = `<div class="group-badge group-leader" title="團體報名主報名人">
                <i class="fas fa-users"></i>
                <span class="group-label">團體報名</span>
            </div>`;
        }
    }

    // 貴賓標記（備註包含「貴賓」關鍵字）
    let vipBadge = '';
    if (participant.notes && participant.notes.includes('貴賓')) {
        vipBadge = `<span class="badge badge-warning" style="margin-left: 0.3rem;" title="備註: ${safeText(participant.notes)}">
            <i class="fas fa-star"></i> 貴賓
        </span>`;
    }

    // 處理小孩資訊（新格式：年齡區間人數物件）
    // 顯示邏輯：
    // - 附屬報名人（小孩）：顯示自己的年齡區間標籤（如「7-12歲」）
    // - 舊格式團體小孩（有 group_id 但無 parent_submission_id 且非主報名人）：顯示自己的年齡區間
    // - 獨立報名者（無 group_id，後台手動登記）：顯示 children_ages 統計
    let childrenDisplay = '-';
    const isDependent = participant.parent_submission_id != null;
    const isGroupMember = participant.group_id != null;
    // 舊格式團體小孩：有 group_id 但沒有 parent_submission_id 連結，且不是主報名人
    const isOldFormatGroupChild = isGroupMember && !isDependent && participant.is_primary === 0;

    if ((isDependent || isOldFormatGroupChild) && participant.children_ages) {
        // 附屬報名人或舊格式團體小孩：顯示自己的年齡區間
        try {
            const ages = typeof participant.children_ages === 'string'
                ? JSON.parse(participant.children_ages)
                : (participant.children_ages || {});
            if (ages && typeof ages === 'object') {
                const parts = [];
                if (ages.age_0_6) parts.push(`<span class="age-tag age-0-6">0-6歲</span>`);
                if (ages.age_6_12) parts.push(`<span class="age-tag age-6-12">7-12歲</span>`);
                if (ages.age_12_18) parts.push(`<span class="age-tag age-12-18">13-18歲</span>`);
                if (parts.length > 0) {
                    childrenDisplay = `<div class="age-distribution">${parts.join('')}</div>`;
                }
            }
        } catch (e) {
            // ignore parse error
        }
    } else if (!isGroupMember && participant.children_count && participant.children_count > 0) {
        // 獨立報名者（無 group_id，後台手動登記）：顯示 children_ages 統計
        let agesHtml = '';
        try {
            const ages = typeof participant.children_ages === 'string'
                ? JSON.parse(participant.children_ages)
                : (participant.children_ages || {});
            if (ages && typeof ages === 'object') {
                const parts = [];
                if (ages.age_0_6) parts.push(`<span class="age-tag age-0-6">0-6歲:${ages.age_0_6}</span>`);
                if (ages.age_6_12) parts.push(`<span class="age-tag age-6-12">7-12歲:${ages.age_6_12}</span>`);
                if (ages.age_12_18) parts.push(`<span class="age-tag age-12-18">13-18歲:${ages.age_12_18}</span>`);
                if (parts.length > 0) {
                    agesHtml = `<div class="age-distribution">${parts.join('')}</div>`;
                }
            }
        } catch (e) {
            // ignore parse error
        }
        childrenDisplay = `<span class="badge badge-info">${participant.children_count}人</span>${agesHtml}`;
    }

    // 將參加者資料編碼為 JSON 供編輯使用
    const participantJson = safeText(JSON.stringify({
        id: participant.id,
        submitter_name: participant.submitter_name || '',
        submitter_email: participant.submitter_email || '',
        submitter_phone: participant.submitter_phone || '',
        company_name: participant.company_name || '',
        position: participant.position || '',
        gender: participant.gender || '',
        children_count: participant.children_count || 0,
        children_ages: participant.children_ages || {},
        participation_level: participant.participation_level || 50,
        notes: participant.notes || ''
    }));

    // 報名時間 - GMT+8 格式
    const createdAtDisplay = participant.created_at
        ? formatDate(participant.created_at, 'datetime')
        : '-';

    // 報到時間 - GMT+8 格式
    const checkedInAtDisplay = participant.checked_in_at
        ? formatDate(participant.checked_in_at, 'datetime')
        : '<span class="text-muted">未報到</span>';

    return `
        <tr class="participant-row" data-participant-id="${participant.id}" ${participant.group_id ? `data-group-id="${safeText(participant.group_id)}"` : ''}>
            <td data-label="ID">${idDisplay}</td>
            <td data-label="姓名">
                <div class="participant-name-cell">
                    <strong>${safeText(participant.submitter_name)}</strong>${vipBadge}
                    ${groupBadge}
                </div>
            </td>
            <td data-label="Email">${safeText(participant.submitter_email)}</td>
            <td data-label="電話">${safeText(participant.submitter_phone)}</td>
            <td data-label="小孩">${childrenDisplay}</td>
            <td data-label="報名時間"><small>${createdAtDisplay}</small></td>
            <td data-label="報到時間"><small>${checkedInAtDisplay}</small></td>
            <td data-label="操作" class="actions-cell">
                <div class="btn-group">
                    ${!participant.checked_in_at
                        ? `<button class="btn btn-sm btn-success" onclick="manualCheckin(${participant.id})" title="簽到">
                            <i class="fas fa-check"></i>
                        </button>`
                        : `<button class="btn btn-sm btn-warning" onclick="cancelCheckin(${participant.id})" title="取消簽到">
                            <i class="fas fa-times"></i>
                        </button>`
                    }
                    <button class="btn btn-sm btn-secondary" onclick='addDependentParticipant(${participantJson})' title="新增附屬報名人">
                        <i class="fas fa-user-plus"></i>
                    </button>
                    <button class="btn btn-sm btn-info" onclick="viewParticipantTracking('${participant.trace_id}')" title="追蹤">
                        <i class="fas fa-search"></i>
                    </button>
                    <button class="btn btn-sm btn-primary" onclick='editParticipant(${participantJson})' title="編輯">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteParticipant(${participant.id}, '${safeText(participant.submitter_name)}')" title="刪除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

/**
 * 操作類型對應表（用於日誌顯示）
 */
const ACTION_LABELS = {
    // 登入相關
    admin_login_success: '登入成功',
    admin_login_failed: '登入失敗',
    admin_logout: '登出',
    // 用戶管理
    user_created: '新增用戶',
    user_updated: '更新用戶',
    user_deleted: '刪除用戶',
    user_status_changed: '變更用戶狀態',
    user_marked_for_deletion: '標記刪除用戶',
    password_reset: '重設密碼',
    users_imported: '批量匯入用戶',
    create_user: '新增用戶',
    update_user: '更新用戶',
    delete_user: '刪除用戶',
    change_role: '變更權限',
    reset_password: '重設密碼',
    // 參加者管理
    create_participant: '新增參加者',
    update_participant: '更新參加者',
    delete_participant: '刪除參加者',
    // 簽到管理
    checkin_created: '報到成功',
    checkin_data_exported: '匯出報到數據',
    manual_checkin: '手動簽到',
    cancel_checkin: '取消簽到',
    qr_checkin: 'QR 碼簽到',
    bulk_checkin: '批量簽到',
    // 專案管理
    project_created: '新增專案',
    project_updated: '更新專案',
    project_deleted: '刪除專案',
    project_duplicated: '複製專案',
    project_status_changed: '變更專案狀態',
    project_permission_added: '新增專案權限',
    project_permission_updated: '更新專案權限',
    project_permission_removed: '移除專案權限',
    create_project: '新增專案',
    update_project: '更新專案',
    delete_project: '刪除專案',
    // 問卷管理
    questionnaire_created: '新增問卷',
    questionnaire_updated: '更新問卷',
    questionnaire_deleted: '刪除問卷',
    questionnaire_exported: '匯出問卷',
    // 模板管理
    template_created: '新增模板',
    template_updated: '更新模板',
    template_deleted: '刪除模板',
    // 提交管理
    submission_created: '新增提交',
    submission_updated: '更新提交',
    submission_deleted: '刪除提交',
    submission_bulk_deleted: '批量刪除提交',
    // Email 相關
    send_email: '發送郵件',
    email_sent: '發送郵件',
    invitation_email_resent: '重寄邀請信',
    pre_event_email_sent: '發送行前通知',
    // 其他
    generate_qrcode: '生成 QR Code'
};

/**
 * 欄位名稱對應表
 */
const FIELD_LABELS = {
    submitter_name: '姓名',
    submitter_email: '電子郵件',
    submitter_phone: '電話',
    company_name: '公司',
    position: '職稱',
    gender: '性別',
    participation_level: '參與程度',
    children_count: '兒童人數',
    children_ages: '兒童年齡',
    notes: '備註',
    role: '角色',
    status: '狀態',
    name: '名稱',
    email: '電子郵件',
    phone: '電話'
};

/**
 * 格式化操作類型為中文
 * @param {string} action - 操作類型
 * @returns {string} 中文操作名稱
 */
function formatActionLabel(action) {
    return ACTION_LABELS[action] || action;
}

/**
 * 格式化日誌詳情為易讀的中文
 * @param {string} action - 操作類型
 * @param {string|null} detailsJson - JSON 格式的詳情
 * @returns {string} 易讀的詳情文字
 */
function formatLogDetails(action, detailsJson) {
    if (!detailsJson) return '無詳細資訊';

    try {
        const details = typeof detailsJson === 'string' ? JSON.parse(detailsJson) : detailsJson;
        const parts = [];

        // 根據操作類型格式化
        switch (action) {
            // 登入相關
            case 'admin_login_success':
            case 'admin_login_failed':
                if (details.login_method) {
                    parts.push(`登入方式: ${details.login_method === 'admin_panel' ? '管理後台' : details.login_method}`);
                }
                break;

            // 參加者管理
            case 'create_participant':
                if (details.name) parts.push(`姓名: ${details.name}`);
                if (details.email) parts.push(`Email: ${details.email}`);
                if (details.isDependent) parts.push('(附屬報名人)');
                break;

            case 'update_participant':
                if (details.updatedFields && Array.isArray(details.updatedFields)) {
                    const fieldLabels = details.updatedFields.map(f => FIELD_LABELS[f] || f);
                    parts.push(`更新欄位: ${fieldLabels.join('、')}`);
                }
                if (details.updated_fields && Array.isArray(details.updated_fields)) {
                    const fieldLabels = details.updated_fields.map(f => FIELD_LABELS[f] || f);
                    parts.push(`更新欄位: ${fieldLabels.join('、')}`);
                }
                if (details.name) parts.push(`姓名: ${details.name}`);
                break;

            case 'delete_participant':
                if (details.participantName) parts.push(`刪除: ${details.participantName}`);
                if (details.participantEmail) parts.push(`(${details.participantEmail})`);
                break;

            // 簽到管理
            case 'manual_checkin':
            case 'qr_checkin':
                if (details.participantName) parts.push(`報到: ${details.participantName}`);
                if (details.method) parts.push(`方式: ${details.method}`);
                break;

            case 'cancel_checkin':
                if (details.participantName) parts.push(`取消報到: ${details.participantName}`);
                break;

            case 'bulk_checkin':
                if (details.count) parts.push(`簽到人數: ${details.count}`);
                break;

            // 用戶管理
            case 'user_created':
                if (details.username) parts.push(`用戶: ${details.username}`);
                if (details.role) parts.push(`角色: ${details.role}`);
                if (details.expires_at) parts.push(`到期: ${details.expires_at}`);
                break;

            case 'user_updated':
                if (details.target_user) parts.push(`用戶: ${details.target_user}`);
                if (details.updated_fields && Array.isArray(details.updated_fields)) {
                    const fieldLabels = details.updated_fields.map(f => FIELD_LABELS[f] || f);
                    parts.push(`更新欄位: ${fieldLabels.join('、')}`);
                }
                break;

            case 'user_deleted':
            case 'user_marked_for_deletion':
                if (details.target_user) parts.push(`用戶: ${details.target_user}`);
                break;

            case 'user_status_changed':
                if (details.target_user) parts.push(`用戶: ${details.target_user}`);
                if (details.old_status && details.new_status) {
                    parts.push(`狀態: ${details.old_status} → ${details.new_status}`);
                }
                if (details.reason) parts.push(`原因: ${details.reason}`);
                break;

            case 'password_reset':
                if (details.target_user) parts.push(`用戶: ${details.target_user}`);
                break;

            case 'users_imported':
                if (details.total) parts.push(`總數: ${details.total}`);
                if (details.success) parts.push(`成功: ${details.success}`);
                if (details.failures) parts.push(`失敗: ${details.failures}`);
                break;

            case 'create_user':
            case 'update_user':
            case 'delete_user':
                if (details.username) parts.push(`用戶: ${details.username}`);
                if (details.role) parts.push(`角色: ${details.role}`);
                break;

            case 'change_role':
                if (details.username) parts.push(`用戶: ${details.username}`);
                if (details.oldRole && details.newRole) {
                    parts.push(`${details.oldRole} → ${details.newRole}`);
                }
                break;

            // 簽到管理（擴展）
            case 'checkin_created':
                if (details.attendee_name) parts.push(`報到: ${details.attendee_name}`);
                if (details.project_id) parts.push(`專案ID: ${details.project_id}`);
                if (details.scanner_location) parts.push(`地點: ${details.scanner_location}`);
                break;

            case 'checkin_data_exported':
                if (details.count) parts.push(`匯出筆數: ${details.count}`);
                break;

            // 專案管理
            case 'project_created':
                if (details.project_name) parts.push(`專案: ${details.project_name}`);
                if (details.project_code) parts.push(`代碼: ${details.project_code}`);
                break;

            case 'project_updated':
            case 'project_deleted':
                if (details.project_name) parts.push(`專案: ${details.project_name}`);
                if (details.name) parts.push(`專案: ${details.name}`);
                break;

            case 'project_duplicated':
                if (details.from_project_id) parts.push(`原專案ID: ${details.from_project_id}`);
                if (details.new_project_id) parts.push(`新專案ID: ${details.new_project_id}`);
                break;

            case 'project_status_changed':
                if (details.project_name) parts.push(`專案: ${details.project_name}`);
                if (details.old_status && details.new_status) {
                    parts.push(`狀態: ${details.old_status} → ${details.new_status}`);
                }
                break;

            case 'project_permission_added':
            case 'project_permission_updated':
            case 'project_permission_removed':
                if (details.user_id) parts.push(`用戶ID: ${details.user_id}`);
                if (details.permission_level) parts.push(`權限: ${details.permission_level}`);
                break;

            // 問卷管理
            case 'questionnaire_created':
            case 'questionnaire_updated':
            case 'questionnaire_deleted':
                if (details.questionnaire_title) parts.push(`問卷: ${details.questionnaire_title}`);
                if (details.title) parts.push(`問卷: ${details.title}`);
                break;

            case 'questionnaire_exported':
                if (details.questionnaire_title) parts.push(`匯出問卷: ${details.questionnaire_title}`);
                if (details.count) parts.push(`回覆數: ${details.count}`);
                break;

            // Email 相關
            case 'send_email':
            case 'email_sent':
                if (details.recipientCount) parts.push(`收件人數: ${details.recipientCount}`);
                if (details.emailType) parts.push(`類型: ${details.emailType}`);
                if (details.recipient) parts.push(`收件人: ${details.recipient}`);
                break;

            case 'invitation_email_resent':
                if (details.projectId) parts.push(`專案ID: ${details.projectId}`);
                if (details.successCount !== undefined) parts.push(`成功: ${details.successCount}`);
                if (details.failCount !== undefined) parts.push(`失敗: ${details.failCount}`);
                if (details.total) parts.push(`總數: ${details.total}`);
                if (details.count) parts.push(`重寄數量: ${details.count}`);
                // 顯示成功的 traceId（前 5 筆）
                if (details.successTraceIds && details.successTraceIds.length > 0) {
                    const preview = details.successTraceIds.slice(0, 5).join(', ');
                    const more = details.successTraceIds.length > 5 ? `... 等 ${details.successTraceIds.length} 筆` : '';
                    parts.push(`✓ ${preview}${more}`);
                }
                // 顯示失敗的項目（含錯誤訊息）
                if (details.failedItems && details.failedItems.length > 0) {
                    const failedPreview = details.failedItems.slice(0, 3).map(f => `${f.traceId}(${f.error})`).join(', ');
                    parts.push(`✗ ${failedPreview}`);
                }
                break;

            case 'pre_event_email_sent':
                if (details.projectId) parts.push(`專案ID: ${details.projectId}`);
                if (details.successCount !== undefined) parts.push(`成功: ${details.successCount}`);
                if (details.failCount !== undefined) parts.push(`失敗: ${details.failCount}`);
                if (details.total) parts.push(`總數: ${details.total}`);
                if (details.count) parts.push(`發送數量: ${details.count}`);
                // 顯示成功的收件人（前 5 筆）
                if (details.successRecipients && details.successRecipients.length > 0) {
                    const preview = details.successRecipients.slice(0, 5).map(r => r.name || r.email).join(', ');
                    const more = details.successRecipients.length > 5 ? `... 等 ${details.successRecipients.length} 人` : '';
                    parts.push(`✓ ${preview}${more}`);
                }
                // 顯示失敗的收件人（含錯誤訊息）
                if (details.failedRecipients && details.failedRecipients.length > 0) {
                    const failedPreview = details.failedRecipients.slice(0, 3).map(f => `${f.name || f.email}(${f.error})`).join(', ');
                    parts.push(`✗ ${failedPreview}`);
                }
                break;

            // 提交管理
            case 'submission_created':
            case 'submission_updated':
            case 'submission_deleted':
                if (details.submitter_name) parts.push(`提交者: ${details.submitter_name}`);
                if (details.name) parts.push(`提交者: ${details.name}`);
                break;

            case 'submission_bulk_deleted':
                if (details.count) parts.push(`刪除數量: ${details.count}`);
                break;

            // 模板管理
            case 'template_created':
            case 'template_updated':
            case 'template_deleted':
                if (details.template_name) parts.push(`模板: ${details.template_name}`);
                if (details.name) parts.push(`模板: ${details.name}`);
                break;

            default:
                // 通用處理：顯示所有鍵值對
                for (const [key, value] of Object.entries(details)) {
                    const label = FIELD_LABELS[key] || key;
                    if (typeof value === 'object') {
                        parts.push(`${label}: ${JSON.stringify(value)}`);
                    } else {
                        parts.push(`${label}: ${value}`);
                    }
                }
        }

        return parts.length > 0 ? parts.join(' | ') : '無詳細資訊';
    } catch (e) {
        // JSON 解析失敗，返回原始內容
        return safeText(detailsJson, '無詳細資訊');
    }
}

/**
 * 生成日誌表格列
 * @param {Object} log - 日誌資料
 * @returns {string} HTML
 */
function logTableRow(log) {
    const timestamp = formatDate(log.created_at, 'datetime');
    const displayName = log.displayName || log.username || '系統';
    const initial = displayName.charAt(0);
    const actionLabel = formatActionLabel(log.action);
    const detailsText = formatLogDetails(log.action, log.details);

    return `
        <tr>
            <td><span class="log-level ${log.level}">${log.level}</span></td>
            <td class="log-timestamp">${timestamp}</td>
            <td class="log-user">
                <div class="log-user-avatar">${initial}</div>
                <span>${safeText(displayName)}</span>
            </td>
            <td class="log-action">${safeText(actionLabel)}</td>
            <td class="log-details" onclick="viewLogDetails(${log.id})" title="${safeText(log.details || '')}">${safeText(detailsText)}</td>
            <td class="log-ip">${safeText(log.ip_address, '未知')}</td>
            <td class="log-actions">
                <button class="btn btn-sm btn-outline-primary" onclick="viewLogDetails(${log.id})">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteLog(${log.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `;
}

/**
 * 生成簽到記錄表格列
 * @param {Object} record - 簽到記錄
 * @returns {string} HTML
 */
function checkinRecordRow(record) {
    const checkinTime = formatDate(record.checked_in_at, 'datetime');
    const method = record.checkin_method === 'qr_scanner' ? 'QR掃描' : '手動簽到';

    return `
        <tr>
            <td>
                <div>${safeText(record.submitter_name)}</div>
                <small class="text-muted">${safeText(record.submitter_email)}</small>
            </td>
            <td>${checkinTime}</td>
            <td>${method}</td>
            <td>
                <button class="btn btn-sm btn-info" onclick="viewParticipantTracking('${record.trace_id}')">
                    <i class="fas fa-search"></i> 追蹤
                </button>
            </td>
        </tr>
    `;
}

// ============================================================================
// 統計卡片組件
// ============================================================================

/**
 * 生成統計卡片
 * @param {Object} options - 選項
 * @returns {string} HTML
 */
function statCard({ value, label, variant = '' }) {
    const variantClass = variant ? ` ${variant}` : '';
    return `
        <div class="stat-card${variantClass}">
            <div class="stat-value">${value}</div>
            <div class="stat-label">${label}</div>
        </div>
    `;
}

/**
 * 生成統計卡片網格
 * @param {Array} stats - 統計資料陣列
 * @returns {string} HTML
 */
function statsGrid(stats) {
    const cards = stats.map(stat => statCard(stat)).join('\n');
    return `<div class="stats-grid">${cards}</div>`;
}

/**
 * 生成簽到統計 HTML
 * @param {Object} stats - 統計資料
 * @returns {string} HTML
 */
function checkinStatsGrid(stats) {
    return `
        <div class="checkin-stats-grid">
            ${statCard({ value: stats.totalParticipants, label: '總參加者' })}
            ${statCard({ value: stats.checkedInCount, label: '已簽到', variant: 'success' })}
            ${statCard({ value: stats.notCheckedInCount, label: '未簽到', variant: 'warning' })}
            ${statCard({ value: `${stats.checkinRate}%`, label: '簽到率', variant: 'info' })}
        </div>
    `;
}

/**
 * 生成今日統計 HTML (QR Scanner)
 * @param {Object} stats - 統計資料
 * @returns {string} HTML
 */
function todayStatsGrid(stats) {
    return `
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-value">${stats.todayCheckins}</div>
                <div class="stat-label">今日報到</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stats.todayScans}</div>
                <div class="stat-label">掃描次數</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stats.totalParticipants}</div>
                <div class="stat-label">總參與者</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stats.checkinRate}%</div>
                <div class="stat-label">報到率</div>
            </div>
        </div>
    `;
}

// ============================================================================
// 空狀態和錯誤訊息
// ============================================================================

/**
 * 生成空表格列
 * @param {string} message - 訊息
 * @param {number} colspan - 欄位數
 * @returns {string} HTML
 */
function emptyTableRow(message, colspan = 7) {
    return `<tr><td colspan="${colspan}" class="text-center">${message}</td></tr>`;
}

/**
 * 生成錯誤表格列
 * @param {string} message - 錯誤訊息
 * @param {number} colspan - 欄位數
 * @returns {string} HTML
 */
function errorTableRow(message, colspan = 7) {
    return `<tr><td colspan="${colspan}" class="text-center text-danger">${message}</td></tr>`;
}

/**
 * 生成警告提示
 * @param {string} message - 訊息
 * @param {string} type - 類型 ('warning' | 'danger' | 'info' | 'success')
 * @returns {string} HTML
 */
function alert(message, type = 'warning') {
    return `<div class="alert alert-${type}">${message}</div>`;
}

/**
 * 生成空狀態訊息
 * @param {string} message - 訊息
 * @returns {string} HTML
 */
function emptyState(message) {
    return `<p class="text-center text-muted">${message}</p>`;
}

// ============================================================================
// 問卷相關組件
// ============================================================================

/**
 * 生成問卷項目
 * @param {Object} questionnaire - 問卷資料
 * @returns {string} HTML
 */
function questionnaireItem(questionnaire) {
    const status = questionnaire.is_active
        ? '<span class="badge badge-success">啟用中</span>'
        : '<span class="badge badge-secondary">已停用</span>';
    const createdDate = formatDate(questionnaire.created_at);

    return `
        <div class="questionnaire-item">
            <div class="questionnaire-header">
                <h4>${safeText(questionnaire.title)}</h4>
                ${status}
            </div>
            <div class="questionnaire-stats">
                <span class="stat">回應數：${questionnaire.response_count || 0}</span>
                <span class="stat">建立時間：${createdDate}</span>
            </div>
            <div class="questionnaire-actions">
                <button class="btn btn-sm btn-primary" onclick="viewQuestionnaire(${questionnaire.id})">
                    <i class="fas fa-eye"></i> 查看
                </button>
                <button class="btn btn-sm btn-secondary" onclick="editQuestionnaire(${questionnaire.id})">
                    <i class="fas fa-edit"></i> 編輯
                </button>
                <button class="btn btn-sm btn-info" onclick="viewQuestionnaireStats(${questionnaire.id})">
                    <i class="fas fa-chart-bar"></i> 統計
                </button>
            </div>
        </div>
    `;
}

/**
 * 生成問卷概覽統計
 * @param {Object} overview - 概覽資料
 * @returns {string} HTML
 */
function questionnaireOverviewStats(overview) {
    return `
        <div class="overview-stats">
            <div class="stat-card">
                <h4>總問卷數</h4>
                <div class="stat-number">${overview.totalQuestionnaires}</div>
            </div>
            <div class="stat-card">
                <h4>總回應數</h4>
                <div class="stat-number">${overview.totalSubmissions}</div>
            </div>
        </div>
        <p class="text-center text-muted">請選擇問卷查看詳細統計</p>
    `;
}

// ============================================================================
// 掃描歷史組件
// ============================================================================

/**
 * 生成掃描歷史項目
 * @param {Object} scan - 掃描記錄
 * @returns {string} HTML
 */
function scanHistoryItem(scan) {
    const scanTime = formatDate(scan.scan_time, 'datetime');
    const status = scan.checked_in_at ? '已報到' : '掃描失敗';
    const statusClass = scan.checked_in_at ? 'success' : 'danger';

    return `
        <div class="scan-item">
            <div class="scan-info">
                <strong>${safeText(scan.submitter_name, '未知參與者')}</strong>
                <small>${safeText(scan.submitter_email, '')}</small>
            </div>
            <div class="scan-meta">
                <span class="scan-time">${scanTime}</span>
                <span class="badge badge-${statusClass}">${status}</span>
            </div>
        </div>
    `;
}

/**
 * 生成掃描歷史列表
 * @param {Array} scans - 掃描記錄陣列
 * @returns {string} HTML
 */
function scanHistoryList(scans) {
    if (scans.length === 0) {
        return emptyState('暫無掃描記錄');
    }
    const items = scans.map(scan => scanHistoryItem(scan)).join('\n');
    return `<div class="scan-history-list">${items}</div>`;
}

// ============================================================================
// 登入記錄組件
// ============================================================================

/**
 * 生成登入記錄項目
 * @param {Object} record - 登入記錄
 * @returns {string} HTML
 */
function loginHistoryItem(record) {
    const date = formatDate(record.created_at, 'datetime');
    return `
        <div class="login-record">
            <div class="login-time">${date}</div>
            <div class="login-ip">IP: ${safeText(record.ip_address)}</div>
            <div class="login-action">${safeText(record.action)}</div>
        </div>
    `;
}

/**
 * 生成登入記錄列表
 * @param {Array} history - 登入記錄陣列
 * @returns {string} HTML
 */
function loginHistoryList(history) {
    if (!history || history.length === 0) {
        return emptyState('暫無登入記錄');
    }
    return history.map(record => loginHistoryItem(record)).join('\n');
}

// ============================================================================
// 追蹤結果組件
// ============================================================================

/**
 * 生成參與者追蹤結果
 * @param {Object} participant - 參與者資料
 * @param {Array} interactions - 互動記錄
 * @returns {string} HTML
 */
function trackingResult(participant, interactions) {
    let html = `
        <div class="tracking-result">
            <div class="participant-info">
                <h4>${safeText(participant.submitter_name)}</h4>
                <p>Trace ID: ${safeText(participant.trace_id)}</p>
                <p>電子郵件: ${safeText(participant.submitter_email)}</p>
                <p>狀態: ${participant.checked_in_at ? '已簽到' : '未簽到'}</p>
            </div>
            <div class="interactions-timeline">
                <h5>互動記錄</h5>
    `;

    if (interactions.length === 0) {
        html += '<p class="text-muted">暫無互動記錄</p>';
    } else {
        interactions.forEach(interaction => {
            const time = formatDate(interaction.timestamp, 'datetime');
            html += `
                <div class="interaction-item">
                    <div class="interaction-time">${time}</div>
                    <div class="interaction-type">${safeText(interaction.interaction_type)}</div>
                    <div class="interaction-target">${safeText(interaction.interaction_target)}</div>
                </div>
            `;
        });
    }

    html += '</div></div>';
    return html;
}

// ============================================================================
// 問卷統計組件
// ============================================================================

/**
 * 生成問卷統計詳情 HTML
 * @param {Object} stats - 問卷統計資料
 * @returns {string} HTML
 */
function questionnaireStatsDetail(stats) {
    const { questionnaire, responses: qResponses, responseCount } = stats;

    let html = `
        <div class="questionnaire-header">
            <h3>${safeText(questionnaire.title)}</h3>
            <p>${safeText(questionnaire.description, '')}</p>
        </div>
        <div class="stats-summary">
            <div class="stat-card">
                <h4>總回應數</h4>
                <div class="stat-number">${responseCount}</div>
            </div>
            <div class="stat-card">
                <h4>問卷狀態</h4>
                <div class="stat-text">${questionnaire.status === 'active' ? '進行中' : '已結束'}</div>
            </div>
        </div>
    `;

    if (responseCount > 0) {
        html += '<div class="responses-list"><h4>最新回應</h4>';
        qResponses.slice(0, 10).forEach(response => {
            const submittedAt = formatDate(response.submitted_at, 'datetime');
            const dataPreview = JSON.stringify(response.response_data).substring(0, 100);
            html += `
                <div class="response-item">
                    <div class="response-time">${submittedAt}</div>
                    <div class="response-data">${safeText(dataPreview)}...</div>
                </div>
            `;
        });
        html += '</div>';
    } else {
        html += alert('尚無回應數據', 'info');
    }

    return html;
}

/**
 * 生成問卷 QR Code 區塊 HTML
 * @param {Object} questionnaire - 問卷資料
 * @param {string} baseUrl - 基礎 URL
 * @returns {string} HTML
 */
function questionnaireQrCodeSection(questionnaire, baseUrl) {
    const questionnaireUrl = `${baseUrl}/questionnaire/${questionnaire.id}`;

    return `
        <div class="questionnaire-info">
            <h3>${safeText(questionnaire.title)}</h3>
            <p>${safeText(questionnaire.description, '')}</p>
            <p class="text-muted">問卷 ID: ${questionnaire.id}</p>
        </div>
        <div class="qr-code-section">
            <h4>問卷 QR Code</h4>
            <div class="qr-code-display" id="qr-code-${questionnaire.id}"></div>
            <div class="qr-url">
                <strong>問卷連結:</strong>
                <input type="text" class="form-control" value="${questionnaireUrl}" readonly onclick="this.select()">
                <button class="btn btn-sm btn-secondary" onclick="copyQRUrl('${questionnaireUrl}')">
                    <i class="fas fa-copy"></i> 複製
                </button>
            </div>
            <div class="qr-actions">
                <button class="btn btn-primary" onclick="downloadQR(${questionnaire.id}, 'questionnaire')">
                    <i class="fas fa-download"></i> 下載 QR Code
                </button>
            </div>
        </div>
        <script>
            (function() {
                const container = document.getElementById('qr-code-${questionnaire.id}');
                if (container && typeof QRCode !== 'undefined') {
                    new QRCode(container, {
                        text: '${questionnaireUrl}',
                        width: 300, height: 300,
                        colorDark: '#000000', colorLight: '#ffffff',
                        correctLevel: QRCode.CorrectLevel.H
                    });
                }
            })();
        </script>
    `;
}

/**
 * 生成參與者 QR Code Modal HTML
 * @param {Object} participant - 參與者資料
 * @param {Object} qrCode - QR Code 資料
 * @param {number} participantId - 參與者 ID
 * @returns {string} HTML
 */
function participantQrCodeModal(participant, qrCode, participantId) {
    return `
        <div class="modal fade show" style="display: block;">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-qrcode"></i>
                            ${safeText(participant.name)} 的 QR Code
                        </h5>
                        <button type="button" class="btn-close" onclick="closeModal()"></button>
                    </div>
                    <div class="modal-body">
                        <div class="participant-info">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6>參與者資訊</h6>
                                    <p><strong>姓名：</strong>${safeText(participant.name)}</p>
                                    <p><strong>電子郵件：</strong>${safeText(participant.email)}</p>
                                    <p><strong>電話：</strong>${safeText(participant.phone)}</p>
                                    <p><strong>專案：</strong>${safeText(participant.projectName)}</p>
                                </div>
                                <div class="col-md-6">
                                    <div class="qr-code-container text-center">
                                        ${qrCode.hasQrCode
                                            ? `<div id="qr-code-display" class="qr-code-display"></div>
                                               <p class="text-muted mt-2">掃描此 QR Code 進行報到</p>`
                                            : `<div class="alert alert-warning">
                                                   <i class="fas fa-exclamation-triangle"></i>
                                                   尚未生成 QR Code
                                               </div>`
                                        }
                                    </div>
                                </div>
                            </div>
                        </div>
                        ${qrCode.hasQrCode
                            ? `<div class="qr-actions mt-3">
                                   <button class="btn btn-primary" onclick="downloadQRCode(${participantId})">
                                       <i class="fas fa-download"></i> 下載 QR Code
                                   </button>
                                   <button class="btn btn-secondary" onclick="printQRCode()">
                                       <i class="fas fa-print"></i> 列印 QR Code
                                   </button>
                                   <button class="btn btn-info" onclick="regenerateQRCode(${participantId})">
                                       <i class="fas fa-sync"></i> 重新生成
                                   </button>
                               </div>`
                            : `<div class="qr-actions mt-3">
                                   <button class="btn btn-primary" onclick="generateNewQRCode(${participantId})">
                                       <i class="fas fa-plus"></i> 生成 QR Code
                                   </button>
                               </div>`
                        }
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()">關閉</button>
                    </div>
                </div>
            </div>
        </div>
        <div class="modal-backdrop fade show"></div>
        ${qrCode.hasQrCode
            ? `<script>
                   document.addEventListener('DOMContentLoaded', function() {
                       const qrData = ${JSON.stringify(qrCode.data)};
                       const container = document.getElementById('qr-code-display');
                       if (typeof QRCode !== 'undefined') {
                           new QRCode(container, {
                               text: qrData, width: 200, height: 200,
                               colorDark: '#000000', colorLight: '#ffffff'
                           });
                       } else {
                           const qr = qrcode(0, 'M');
                           qr.addData(qrData); qr.make();
                           container.insertAdjacentHTML('beforeend', qr.createSvgTag(4));
                       }
                   });
               </script>`
            : ''
        }
    `;
}

// ============================================================================
// 模組匯出
// ============================================================================

module.exports = {
    // 通用
    statusBadge,
    checkinStatusBadge,
    idBadge,
    formatDate,
    safeText,
    escapeHtml: safeText,  // 別名，兼容舊代碼

    // 按鈕
    actionButton,
    actionButtonGroup,

    // 分頁
    pagination,

    // 表格列
    projectTableRow,
    submissionTableRow,
    participantCheckinRow,
    projectParticipantRow,
    logTableRow,
    checkinRecordRow,

    // 統計
    statCard,
    statsGrid,
    checkinStatsGrid,
    todayStatsGrid,

    // 空狀態
    emptyTableRow,
    errorTableRow,
    alert,
    emptyState,

    // 問卷
    questionnaireItem,
    questionnaireOverviewStats,

    // 掃描歷史
    scanHistoryItem,
    scanHistoryList,

    // 登入記錄
    loginHistoryItem,
    loginHistoryList,

    // 追蹤
    trackingResult,

    // 問卷詳細
    questionnaireStatsDetail,
    questionnaireQrCodeSection,
    participantQrCodeModal
};
