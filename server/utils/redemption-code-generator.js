/**
 * 兌換碼生成工具
 * 格式: GAME-YYYY-XXXXXX
 * 範例: GAME-2025-A3B7C9
 */

const crypto = require('crypto');

/**
 * 生成唯一的兌換碼
 * @param {number} year - 年份（可選，預設為當前年份）
 * @returns {string} 兌換碼
 */
function generateRedemptionCode(year = null) {
    const currentYear = year || new Date().getFullYear();
    const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `GAME-${currentYear}-${randomPart}`;
}

/**
 * 驗證兌換碼格式
 * @param {string} code - 兌換碼
 * @returns {boolean} 是否為有效格式
 */
function validateRedemptionCode(code) {
    if (!code || typeof code !== 'string') {
        return false;
    }
    
    // 格式: GAME-YYYY-XXXXXX
    const pattern = /^GAME-\d{4}-[A-F0-9]{6}$/;
    return pattern.test(code);
}

/**
 * 從兌換碼中提取年份
 * @param {string} code - 兌換碼
 * @returns {number|null} 年份或 null
 */
function extractYear(code) {
    if (!validateRedemptionCode(code)) {
        return null;
    }
    
    const parts = code.split('-');
    return parseInt(parts[1], 10);
}

/**
 * 生成確定性的兌換碼（用於測試）
 * @param {number} index - 索引
 * @param {number} year - 年份
 * @returns {string} 兌換碼
 */
function generateDeterministicCode(index, year = 2025) {
    const hash = crypto.createHash('sha256')
        .update(`redemption-code-${year}-${index}`)
        .digest('hex')
        .substring(0, 6)
        .toUpperCase();
    return `GAME-${year}-${hash}`;
}

module.exports = {
    generateRedemptionCode,
    validateRedemptionCode,
    extractYear,
    generateDeterministicCode
};

