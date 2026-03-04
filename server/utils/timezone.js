/**
 * 時區工具函數
 * 統一使用 GMT+8 (台北時區)
 *
 * 規則：
 * - 資料庫使用 SQLite CURRENT_TIMESTAMP 存儲 UTC 時間（格式如 '2025-12-18 05:16:14'）
 * - 顯示時統一轉換為 Asia/Taipei (GMT+8)
 */

const TAIPEI_TIMEZONE = 'Asia/Taipei';
const GMT8_OFFSET = '+08:00';

function pad(value) {
    return String(value).padStart(2, '0');
}

function formatDbUtcDate(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        return null;
    }

    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

/**
 * 解析資料庫時間字串為 Date 物件
 * 確保把沒有時區標記的時間當作 UTC 解析
 * @param {string|Date} date - 資料庫時間字串或 Date 物件
 * @returns {Date|null} - Date 物件或 null（無效輸入）
 */
function parseDbDate(date) {
    if (!date) return null;

    // 如果已經是 Date 物件，直接返回
    if (date instanceof Date) {
        return isNaN(date.getTime()) ? null : date;
    }

    let dateStr = String(date);

    // 資料庫存的是 UTC 時間（格式如 '2025-12-18 05:16:14'）
    // 需要明確告訴 JavaScript 這是 UTC 時間
    // 如果時間字串不包含 timezone 資訊，加上 'Z' 表示 UTC
    if (!dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.includes('T')) {
        dateStr = dateStr.replace(' ', 'T') + 'Z';
    } else if (dateStr.includes('T') && !dateStr.includes('Z') && !dateStr.includes('+')) {
        dateStr = dateStr + 'Z';
    }

    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * 解析前端/本地的 GMT+8 日期時間輸入
 * - 支援 YYYY-MM-DD
 * - 支援 YYYY-MM-DDTHH:mm
 * - 支援 YYYY-MM-DD HH:mm:ss
 * 若未帶時區，視為 GMT+8
 * @param {string|Date} value
 * @returns {Date|null}
 */
function parseGMT8Input(value) {
    if (!value) return null;
    if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value;
    }

    let input = String(value).trim();
    if (!input) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
        input = `${input}T00:00:00${GMT8_OFFSET}`;
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) {
        input = `${input}:00${GMT8_OFFSET}`;
    } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(input)) {
        input = `${input.replace(' ', 'T')}:00${GMT8_OFFSET}`;
    } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(input)) {
        input = `${input.replace(' ', 'T')}${GMT8_OFFSET}`;
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(input)) {
        input = `${input}${GMT8_OFFSET}`;
    }

    const parsed = new Date(input);
    return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * 將 GMT+8 輸入轉成資料庫可比較的 UTC timestamp
 * @param {string|Date} value
 * @returns {string|null}
 */
function toDbUtcTimestamp(value) {
    const date = parseGMT8Input(value);
    return formatDbUtcDate(date);
}

/**
 * 取得指定 GMT+8 日期對應的 UTC 區間（[start, end)）
 * @param {string} dateString - YYYY-MM-DD
 * @returns {{startUtc: string|null, endUtc: string|null}}
 */
function getGMT8DateRange(dateString) {
    if (!dateString) {
        return { startUtc: null, endUtc: null };
    }

    const start = parseGMT8Input(dateString);
    if (!start) {
        return { startUtc: null, endUtc: null };
    }

    const end = new Date(start.getTime());
    end.setUTCDate(end.getUTCDate() + 1);

    return {
        startUtc: formatDbUtcDate(start),
        endUtc: formatDbUtcDate(end)
    };
}

/**
 * 獲取當前 GMT+8 時間戳 (格式: YYYY-MM-DD HH:MM:SS)
 * @returns {string} GMT+8 時間戳
 */
function getGMT8Timestamp() {
    return new Date().toLocaleString('zh-TW', {
        timeZone: TAIPEI_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).replace(/\//g, '-');
}

/**
 * 獲取當前 GMT+8 日期 (格式: YYYY-MM-DD)
 * @returns {string} GMT+8 日期
 */
function getGMT8Date() {
    return new Date().toLocaleDateString('zh-TW', {
        timeZone: TAIPEI_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).replace(/\//g, '-');
}

/**
 * 將任意日期轉換為 GMT+8 時間戳
 * @param {Date|string} date - 日期對象或日期字符串
 * @returns {string} GMT+8 時間戳
 */
function toGMT8Timestamp(date) {
    const d = parseDbDate(date);
    if (!d) return '-';

    return d.toLocaleString('zh-TW', {
        timeZone: TAIPEI_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).replace(/\//g, '-');
}

/**
 * 格式化 GMT+8 時間顯示（主要函式）
 * 正確處理資料庫 UTC 時間的解析
 * @param {string} timestamp - 時間戳
 * @param {string} format - 格式 ('date' | 'datetime' | 'time')
 * @returns {string} 格式化的時間字符串
 */
function formatGMT8Time(timestamp, format = 'datetime') {
    const date = parseDbDate(timestamp);
    if (!date) return '-';

    const options = {
        timeZone: TAIPEI_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    };

    if (format === 'datetime' || format === 'time') {
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.second = '2-digit';
        options.hour12 = false;
    }

    if (format === 'time') {
        delete options.year;
        delete options.month;
        delete options.day;
    }

    return date.toLocaleString('zh-TW', options);
}

/**
 * 格式化日期為 Log 用的時間戳記（台北時區）
 * @param {Date} date - 日期，預設為當前時間
 * @returns {string} Log 格式的時間字串 [YYYY-MM-DD HH:mm:ss]
 */
function logTimestamp(date = new Date()) {
    const d = date instanceof Date ? date : new Date();
    return d.toLocaleString('zh-TW', {
        timeZone: TAIPEI_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).replace(/\//g, '-');
}

/**
 * 獲取 GMT+8 時區偏移量（小時）
 * @returns {number} 8
 */
function getGMT8Offset() {
    return 8;
}

module.exports = {
    TAIPEI_TIMEZONE,
    GMT8_OFFSET,
    parseDbDate,
    parseGMT8Input,
    getGMT8Timestamp,
    getGMT8Date,
    toGMT8Timestamp,
    toDbUtcTimestamp,
    getGMT8DateRange,
    formatGMT8Time,
    logTimestamp,
    getGMT8Offset
};
