/**
 * 自定義應用錯誤類別
 */
class AppError extends Error {
    /**
     * 創建應用錯誤
     * @param {Object} errorCode - 錯誤碼對象（來自 error-codes.js）
     * @param {*} details - 額外的錯誤詳情
     */
    constructor(errorCode, details = null) {
        super(errorCode.message);
        this.name = 'AppError';
        this.code = errorCode.code;
        this.statusCode = errorCode.statusCode;
        this.details = details;
        
        // 保留堆疊追蹤
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * 轉換為 JSON 格式
     */
    toJSON() {
        const json = {
            success: false,
            error: {
                code: this.code,
                message: this.message
            }
        };

        if (this.details) {
            json.error.details = this.details;
        }

        return json;
    }
}

module.exports = AppError;

