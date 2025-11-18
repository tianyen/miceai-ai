/**
 * 統一錯誤碼系統
 * 
 * 錯誤碼格式：XXXX
 * - 1XXX: 認證相關錯誤
 * - 2XXX: 權限相關錯誤
 * - 3XXX: 資源相關錯誤
 * - 4XXX: 驗證相關錯誤
 * - 5XXX: 業務邏輯錯誤
 * - 9XXX: 系統錯誤
 */

const ErrorCodes = {
    // 1XXX: 認證相關錯誤
    UNAUTHORIZED: {
        code: 1001,
        message: '未認證的用戶',
        statusCode: 401
    },
    INVALID_CREDENTIALS: {
        code: 1002,
        message: '用戶名或密碼錯誤',
        statusCode: 401
    },
    TOKEN_EXPIRED: {
        code: 1003,
        message: '登入已過期，請重新登入',
        statusCode: 401
    },
    TOKEN_INVALID: {
        code: 1004,
        message: '無效的認證令牌',
        statusCode: 401
    },
    SESSION_EXPIRED: {
        code: 1005,
        message: '會話已過期，請重新登入',
        statusCode: 401
    },

    // 2XXX: 權限相關錯誤
    FORBIDDEN: {
        code: 2001,
        message: '權限不足',
        statusCode: 403
    },
    INSUFFICIENT_PERMISSIONS: {
        code: 2002,
        message: '您沒有執行此操作的權限',
        statusCode: 403
    },
    PROJECT_ACCESS_DENIED: {
        code: 2003,
        message: '您沒有訪問此專案的權限',
        statusCode: 403
    },

    // 3XXX: 資源相關錯誤
    NOT_FOUND: {
        code: 3001,
        message: '資源不存在',
        statusCode: 404
    },
    PROJECT_NOT_FOUND: {
        code: 3002,
        message: '專案不存在',
        statusCode: 404
    },
    USER_NOT_FOUND: {
        code: 3003,
        message: '用戶不存在',
        statusCode: 404
    },
    GAME_NOT_FOUND: {
        code: 3004,
        message: '遊戲不存在',
        statusCode: 404
    },
    VOUCHER_NOT_FOUND: {
        code: 3005,
        message: '兌換券不存在',
        statusCode: 404
    },
    BOOTH_NOT_FOUND: {
        code: 3006,
        message: '攤位不存在',
        statusCode: 404
    },
    TEMPLATE_NOT_FOUND: {
        code: 3007,
        message: '模板不存在',
        statusCode: 404
    },
    SUBMISSION_NOT_FOUND: {
        code: 3008,
        message: '報名記錄不存在',
        statusCode: 404
    },

    // 4XXX: 驗證相關錯誤
    VALIDATION_ERROR: {
        code: 4001,
        message: '資料驗證失敗',
        statusCode: 400
    },
    MISSING_REQUIRED_FIELD: {
        code: 4002,
        message: '缺少必填欄位',
        statusCode: 400
    },
    INVALID_EMAIL: {
        code: 4003,
        message: '無效的電子郵件格式',
        statusCode: 400
    },
    INVALID_PHONE: {
        code: 4004,
        message: '無效的電話號碼格式',
        statusCode: 400
    },
    INVALID_DATE: {
        code: 4005,
        message: '無效的日期格式',
        statusCode: 400
    },
    INVALID_PARAMETER: {
        code: 4006,
        message: '無效的參數',
        statusCode: 400
    },

    // 5XXX: 業務邏輯錯誤
    DUPLICATE_ENTRY: {
        code: 5001,
        message: '資料已存在',
        statusCode: 409
    },
    DUPLICATE_EMAIL: {
        code: 5002,
        message: '電子郵件已被使用',
        statusCode: 409
    },
    DUPLICATE_USERNAME: {
        code: 5003,
        message: '用戶名已被使用',
        statusCode: 409
    },
    DUPLICATE_PROJECT_CODE: {
        code: 5004,
        message: '專案代碼已被使用',
        statusCode: 409
    },
    REGISTRATION_CLOSED: {
        code: 5005,
        message: '報名已截止',
        statusCode: 400
    },
    REGISTRATION_FULL: {
        code: 5006,
        message: '報名人數已滿',
        statusCode: 400
    },
    ALREADY_REGISTERED: {
        code: 5007,
        message: '您已經報名過此活動',
        statusCode: 409
    },
    ALREADY_CHECKED_IN: {
        code: 5008,
        message: '您已經報到過了',
        statusCode: 409
    },
    VOUCHER_OUT_OF_STOCK: {
        code: 5009,
        message: '兌換券已發放完畢',
        statusCode: 400
    },
    VOUCHER_ALREADY_USED: {
        code: 5010,
        message: '兌換券已被使用',
        statusCode: 409
    },

    // 9XXX: 系統錯誤
    INTERNAL_SERVER_ERROR: {
        code: 9001,
        message: '伺服器內部錯誤',
        statusCode: 500
    },
    DATABASE_ERROR: {
        code: 9002,
        message: '資料庫錯誤',
        statusCode: 500
    },
    EXTERNAL_SERVICE_ERROR: {
        code: 9003,
        message: '外部服務錯誤',
        statusCode: 500
    }
};

module.exports = ErrorCodes;

