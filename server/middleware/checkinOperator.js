/**
 * 報到專員權限中間件
 *
 * 用於限制 checkin_operator 用戶只能存取報到相關功能
 * 透過 users.preferences JSON 欄位控制權限
 *
 * preferences 格式: {"checkin_operator":true,"allowed_projects":[2]}
 */

/**
 * 解析用戶 preferences
 */
function parsePreferences(user) {
    if (!user || !user.preferences) return {};
    try {
        return typeof user.preferences === 'string'
            ? JSON.parse(user.preferences)
            : user.preferences;
    } catch (e) {
        return {};
    }
}

/**
 * 檢查是否為報到專員
 */
function isCheckinOperator(user) {
    const prefs = parsePreferences(user);
    return prefs.checkin_operator === true;
}

/**
 * 取得報到專員可存取的專案 ID 列表
 */
function getAllowedProjects(user) {
    const prefs = parsePreferences(user);
    return Array.isArray(prefs.allowed_projects) ? prefs.allowed_projects : [];
}

/**
 * 報到專員路由守衛
 * - 非報到專員：放行
 * - 報到專員：檢查專案 ID 是否在允許列表中
 */
const checkinOperatorGuard = (req, res, next) => {
    if (!isCheckinOperator(req.user)) {
        return next(); // 非報到專員，放行
    }

    // 從多個來源取得 project_id
    const projectId = Number(
        req.query.project_id ||
        req.params.projectId ||
        req.params.id ||
        req.body.project_id
    );

    const allowed = getAllowedProjects(req.user);

    if (!projectId || !allowed.includes(projectId)) {
        // API 請求返回 JSON
        if (req.xhr || req.headers.accept?.includes('application/json') || req.originalUrl.startsWith('/api/')) {
            return res.status(403).json({
                success: false,
                message: '報到專員無權限存取此專案'
            });
        }
        // 頁面請求重定向
        return res.redirect(`/admin/qr-scanner?project_id=${allowed[0] || 2}`);
    }

    next();
};

/**
 * 報到專員專用路由阻擋器
 * 用於完全阻擋報到專員存取特定路由
 */
const blockCheckinOperator = (req, res, next) => {
    if (!isCheckinOperator(req.user)) {
        return next();
    }

    const allowed = getAllowedProjects(req.user);
    const defaultProject = allowed[0] || 2;

    if (req.xhr || req.headers.accept?.includes('application/json') || req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({
            success: false,
            message: '報到專員無權限存取此功能'
        });
    }

    return res.redirect(`/admin/qr-scanner?project_id=${defaultProject}`);
};

module.exports = {
    parsePreferences,
    isCheckinOperator,
    getAllowedProjects,
    checkinOperatorGuard,
    blockCheckinOperator
};
