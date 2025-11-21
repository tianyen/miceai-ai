/**
 * 兌換券條件檢查工具
 * 檢查玩家是否符合兌換券條件
 */

/**
 * 檢查玩家是否符合兌換券條件
 * @param {Object} session - 遊戲會話資料
 * @param {number} session.final_score - 最終分數
 * @param {number} session.total_play_time - 總遊玩時間（秒）
 * @param {Object} conditions - 兌換券條件
 * @param {number} conditions.min_score - 最低分數要求
 * @param {number} conditions.min_play_time - 最低遊玩時間要求（秒）
 * @param {string} conditions.other_conditions - 其他條件（JSON 字串）
 * @returns {Object} { eligible: boolean, reason: string }
 */
function checkVoucherEligibility(session, conditions) {
    const { final_score, total_play_time } = session;
    const { min_score, min_play_time, other_conditions } = conditions;
    
    // 檢查分數條件
    if (min_score && final_score < min_score) {
        return {
            eligible: false,
            reason: `分數未達標（需要 ${min_score} 分，目前 ${final_score} 分）`
        };
    }
    
    // 檢查時間條件
    if (min_play_time && total_play_time < min_play_time) {
        return {
            eligible: false,
            reason: `遊玩時間未達標（需要 ${min_play_time} 秒，目前 ${total_play_time} 秒）`
        };
    }
    
    // 檢查其他條件（JSON 格式）
    if (other_conditions) {
        try {
            const otherConds = typeof other_conditions === 'string' 
                ? JSON.parse(other_conditions) 
                : other_conditions;
            
            // 檢查最大分數限制
            if (otherConds.max_score && final_score > otherConds.max_score) {
                return {
                    eligible: false,
                    reason: `分數超過上限（最多 ${otherConds.max_score} 分）`
                };
            }
            
            // 檢查最大時間限制
            if (otherConds.max_play_time && total_play_time > otherConds.max_play_time) {
                return {
                    eligible: false,
                    reason: `遊玩時間超過上限（最多 ${otherConds.max_play_time} 秒）`
                };
            }
            
            // 可以在這裡添加更多自定義條件檢查
            
        } catch (error) {
            console.error('解析 other_conditions 失敗:', error);
            // 如果解析失敗，忽略其他條件
        }
    }
    
    // 所有條件都符合
    return {
        eligible: true,
        reason: '符合所有條件'
    };
}

/**
 * 檢查兌換券庫存
 * @param {Object} voucher - 兌換券資料
 * @param {number} voucher.remaining_quantity - 剩餘數量
 * @param {number} voucher.total_quantity - 總數量
 * @returns {Object} { available: boolean, reason: string }
 */
function checkVoucherStock(voucher) {
    const { remaining_quantity, total_quantity } = voucher;

    if (remaining_quantity === null || remaining_quantity === undefined) {
        return {
            available: false,
            reason: '兌換券庫存資料不完整'
        };
    }

    if (remaining_quantity <= 0) {
        return {
            available: false,
            reason: '兌換券已售罄'
        };
    }

    return {
        available: true,
        reason: `剩餘庫存: ${remaining_quantity}/${total_quantity}`
    };
}

/**
 * 完整的兌換券檢查（條件 + 庫存）
 * @param {Object} session - 遊戲會話資料
 * @param {Object} voucher - 兌換券資料
 * @param {Object} conditions - 兌換券條件
 * @returns {Object} { canRedeem: boolean, reason: string }
 */
function checkVoucherRedemption(session, voucher, conditions) {
    // 檢查條件
    const eligibility = checkVoucherEligibility(session, conditions);
    if (!eligibility.eligible) {
        return {
            canRedeem: false,
            reason: eligibility.reason
        };
    }
    
    // 檢查庫存
    const stock = checkVoucherStock(voucher);
    if (!stock.available) {
        return {
            canRedeem: false,
            reason: stock.reason
        };
    }
    
    return {
        canRedeem: true,
        reason: '可以兌換'
    };
}

module.exports = {
    checkVoucherEligibility,
    checkVoucherStock,
    checkVoucherRedemption
};

