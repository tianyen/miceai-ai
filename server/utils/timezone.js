/**
 * 时区工具函数
 * 统一使用 GMT+8 (台北时区)
 */

/**
 * 获取当前 GMT+8 时间戳 (格式: YYYY-MM-DD HH:MM:SS)
 * @returns {string} GMT+8 时间戳
 */
function getGMT8Timestamp() {
    const now = new Date();
    const gmt8Time = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return gmt8Time.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * 获取当前 GMT+8 日期 (格式: YYYY-MM-DD)
 * @returns {string} GMT+8 日期
 */
function getGMT8Date() {
    const now = new Date();
    const gmt8Time = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return gmt8Time.toISOString().substring(0, 10);
}

/**
 * 将任意日期转换为 GMT+8 时间戳
 * @param {Date|string} date - 日期对象或日期字符串
 * @returns {string} GMT+8 时间戳
 */
function toGMT8Timestamp(date) {
    const d = new Date(date);
    const gmt8Time = new Date(d.getTime() + (8 * 60 * 60 * 1000));
    return gmt8Time.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * 格式化 GMT+8 时间显示
 * @param {string} timestamp - 时间戳
 * @returns {string} 格式化的时间字符串
 */
function formatGMT8Time(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

/**
 * 获取 GMT+8 时区偏移量（小时）
 * @returns {number} 8
 */
function getGMT8Offset() {
    return 8;
}

module.exports = {
    getGMT8Timestamp,
    getGMT8Date,
    toGMT8Timestamp,
    formatGMT8Time,
    getGMT8Offset
};
