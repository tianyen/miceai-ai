// 統一的前端 trace_id 工具
// 確保所有前端頁面使用相同的 trace_id 格式

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
 * 支援兩種格式:
 * 1. 標準格式: MICE-{timestamp}-{random} (例如: MICE-m3k5l2-abc123xyz)
 * 2. 舊格式: TRACE{timestamp}{random} (例如: TRACED074DD3EE3E27B6B)
 * @param {string} traceId - 要驗證的 trace_id
 * @returns {boolean} 是否為有效格式
 */
function validateTraceId(traceId) {
    if (!traceId || typeof traceId !== 'string') {
        return false;
    }

    // 標準格式: MICE-{timestamp}-{random}
    const standardPattern = /^MICE-[a-z0-9]+-[a-z0-9]+$/;

    // 舊格式: TRACE{timestamp}{random} (至少 10 個字符)
    const legacyPattern = /^TRACE[A-Z0-9]{10,}$/;

    return standardPattern.test(traceId) || legacyPattern.test(traceId);
}

/**
 * 從 URL 參數獲取 trace_id
 * @returns {string|null} trace_id 或 null
 */
function getTraceIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const traceId = urlParams.get('trace_id');
    
    if (traceId && validateTraceId(traceId)) {
        return traceId;
    }
    
    return null;
}

/**
 * 設置 Cookie
 * @param {string} name - Cookie 名稱
 * @param {string} value - Cookie 值
 * @param {number} days - 過期天數
 */
function setCookie(name, value, days = 30) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

/**
 * 獲取 Cookie
 * @param {string} name - Cookie 名稱
 * @returns {string|null} Cookie 值或 null
 */
function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

/**
 * 從存儲中獲取 trace_id
 * 優先從 localStorage，然後從 Cookie
 * @returns {string|null} trace_id 或 null
 */
function getStoredTraceId() {
    // 優先從 localStorage 獲取
    let traceId = localStorage.getItem('traceId');

    if (traceId && validateTraceId(traceId)) {
        return traceId;
    }

    // 從 Cookie 獲取
    traceId = getCookie('traceId');

    if (traceId && validateTraceId(traceId)) {
        // 同步到 localStorage
        localStorage.setItem('traceId', traceId);
        return traceId;
    }

    return null;
}

/**
 * 存儲 trace_id 到多個位置
 * @param {string} traceId - 要存儲的 trace_id
 */
function storeTraceId(traceId) {
    if (!validateTraceId(traceId)) {
        console.error('無效的 trace_id 格式:', traceId);
        return;
    }

    // 存儲到 localStorage
    localStorage.setItem('traceId', traceId);

    // 存儲到 Cookie (30天有效期)
    setCookie('traceId', traceId, 30);

    console.log('trace_id 已存儲:', traceId);
}

/**
 * 獲取或生成 trace_id
 * 優先級：URL 參數 > localStorage > Cookie > 生成新的
 * @returns {string} trace_id
 */
function getOrGenerateTraceId() {
    // 1. 優先從 URL 參數獲取
    const urlTraceId = getTraceIdFromURL();
    if (urlTraceId) {
        console.log('使用來自 URL 的 trace_id:', urlTraceId);
        storeTraceId(urlTraceId); // 存儲到本地
        return urlTraceId;
    }

    // 2. 從存儲中獲取
    const storedTraceId = getStoredTraceId();
    if (storedTraceId) {
        console.log('使用已存儲的 trace_id:', storedTraceId);
        return storedTraceId;
    }

    // 3. 生成新的
    const newTraceId = generateTraceId();
    console.log('生成新的 trace_id:', newTraceId);
    storeTraceId(newTraceId);
    return newTraceId;
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

// 導出到全域
window.TraceIdUtils = {
    generateTraceId,
    validateTraceId,
    getTraceIdFromURL,
    getOrGenerateTraceId,
    extractTimestamp,
    getTraceIdCreatedAt,
    storeTraceId,
    getStoredTraceId,
    setCookie,
    getCookie
};
