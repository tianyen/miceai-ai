/**
 * 確定性 Trace ID 生成器
 *
 * 用於生成可預測的 trace_id，確保測試資料的一致性。
 *
 * 測試用戶對應表（精簡版，每個專案各一人）：
 * | 用戶       | registration_id | project  | trace_id                    |
 * |------------|-----------------|----------|----------------------------|
 * | 王大明     | 1               | TECH2024 | MICE-d074dd3e-e3e27b6b0   |
 * | 福利團體1  | 2               | MOON2025 | MICE-d74b09c8-6cfa4a823   |
 *
 * 注意：這裡的 registration_id 是 form_submissions.id，
 * 與後台管理員的 users.id 是不同的概念！
 *
 * 後台管理員 users.id:
 * - 1: admin (super_admin)
 * - 2: manager (project_manager)
 * - 3: user (project_user)
 * - 4: vendor
 */

const crypto = require('crypto');

class TraceIdGenerator {
    constructor(seed = 'mice-ai-2025') {
        this.seed = seed;
    }

    /**
     * 生成確定性的 trace_id
     * @param {number} index - 索引（對應 registration_id）
     * @returns {string} trace_id (格式: MICE-{8char}-{9char})
     */
    generateTraceId(index) {
        const hash = crypto.createHash('sha256')
            .update(`${this.seed}-trace-${index}`)
            .digest('hex');

        const timestamp = hash.substring(0, 8).toLowerCase();
        const random = hash.substring(8, 17).toLowerCase();

        return `MICE-${timestamp}-${random}`;
    }

    /**
     * 生成確定性的時間戳
     * @param {number} daysOffset - 天數偏移
     * @param {number} hoursOffset - 小時偏移
     * @param {number} minutesOffset - 分鐘偏移
     * @returns {string} ISO 格式時間戳
     */
    generateTimestamp(daysOffset = 0, hoursOffset = 0, minutesOffset = 0) {
        const baseDate = new Date();
        baseDate.setHours(0, 0, 0, 0);
        baseDate.setDate(baseDate.getDate() + daysOffset);
        baseDate.setHours(baseDate.getHours() + hoursOffset);
        baseDate.setMinutes(baseDate.getMinutes() + minutesOffset);
        return baseDate.toISOString().replace('T', ' ').substring(0, 19);
    }
}

// 預設實例
const defaultGenerator = new TraceIdGenerator();

// 預定義的測試用戶資料（精簡版，每個專案各一人）
// 注意：這些 id 是 registration_id (form_submissions.id)，不是 users.id
const TEST_REGISTRATIONS = {
    WANG_DAMING: {
        registration_id: 1,
        name: '王大明',
        project: 'TECH2024',
        traceId: defaultGenerator.generateTraceId(1)
    },
    FULI_GROUP1: {
        registration_id: 2,
        name: '福利團體1',
        project: 'MOON2025',
        traceId: defaultGenerator.generateTraceId(2)
    }
};

// 後台管理員用戶（與 TEST_REGISTRATIONS 是不同的概念！）
const ADMIN_USERS = {
    ADMIN:   { id: 1, username: 'admin',   role: 'super_admin' },
    MANAGER: { id: 2, username: 'manager', role: 'project_manager' },
    USER:    { id: 3, username: 'user',    role: 'project_user' },
    VENDOR:  { id: 4, username: 'vendor',  role: 'vendor' }
};

module.exports = {
    TraceIdGenerator,
    defaultGenerator,
    TEST_REGISTRATIONS,
    ADMIN_USERS
};

