// 統一的 trace_id 生成工具
// 確保整個系統使用相同的 trace_id 格式

/**
 * 生成統一格式的 trace_id
 * 格式: MICE-{timestamp}-{random}
 * @returns {string} 生成的 trace_id
 */
function generateTraceId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `MICE-${timestamp}-${random}`;
}

/**
 * 驗證 trace_id 格式是否正確
 * @param {string} traceId - 要驗證的 trace_id
 * @returns {boolean} 是否為有效格式
 */
function validateTraceId(traceId) {
    if (!traceId || typeof traceId !== 'string') {
        return false;
    }
    
    // 檢查格式: MICE-{timestamp}-{random}
    const pattern = /^MICE-[a-z0-9]+-[a-z0-9]+$/;
    return pattern.test(traceId);
}

/**
 * 從 trace_id 中提取時間戳
 * @param {string} traceId - trace_id
 * @returns {number|null} 時間戳或 null
 */
function extractTimestamp(traceId) {
    if (!validateTraceId(traceId)) {
        return null;
    }
    
    try {
        const parts = traceId.split('-');
        if (parts.length >= 2) {
            const timestamp = parseInt(parts[1], 36);
            return isNaN(timestamp) ? null : timestamp;
        }
    } catch (error) {
        console.error('提取時間戳失敗:', error);
    }
    
    return null;
}

/**
 * 獲取 trace_id 的創建時間
 * @param {string} traceId - trace_id
 * @returns {Date|null} 創建時間或 null
 */
function getTraceIdCreatedAt(traceId) {
    const timestamp = extractTimestamp(traceId);
    return timestamp ? new Date(timestamp) : null;
}

module.exports = {
    generateTraceId,
    validateTraceId,
    extractTimestamp,
    getTraceIdCreatedAt
};
