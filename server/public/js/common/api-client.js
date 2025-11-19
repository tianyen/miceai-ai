/**
 * API 客戶端類
 * 統一所有 AJAX 請求，自動處理錯誤、載入狀態、認證等
 */

/**
 * API 錯誤類
 */
class APIError extends Error {
    constructor(message, statusCode, data) {
        super(message);
        this.name = 'APIError';
        this.statusCode = statusCode;
        this.code = data?.error?.code || null;
        this.details = data?.error?.details || null;
        this.data = data;
    }

    /**
     * 是否為認證錯誤
     */
    isAuthError() {
        return this.statusCode === 401 || this.code >= 1000 && this.code < 2000;
    }

    /**
     * 是否為權限錯誤
     */
    isPermissionError() {
        return this.statusCode === 403 || this.code >= 2000 && this.code < 3000;
    }

    /**
     * 是否為資源不存在錯誤
     */
    isNotFoundError() {
        return this.statusCode === 404 || this.code >= 3000 && this.code < 4000;
    }

    /**
     * 是否為驗證錯誤
     */
    isValidationError() {
        return this.statusCode === 400 || this.code >= 4000 && this.code < 5000;
    }
}

/**
 * API 客戶端類
 */
class APIClient {
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
        this.showLoading = true;
        this.showNotifications = true;
    }

    /**
     * 發送 HTTP 請求
     * @param {string} endpoint - API 端點
     * @param {object} options - 請求選項
     * @returns {Promise<object>} API 回應
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            ...options,
            headers: {
                ...this.defaultHeaders,
                ...options.headers
            }
        };

        // 顯示載入指示器
        if (this.showLoading && window.showLoading) {
            window.showLoading();
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            // 隱藏載入指示器
            if (this.showLoading && window.hideLoading) {
                window.hideLoading();
            }

            // 檢查回應狀態
            if (!response.ok || !data.success) {
                const errorMessage = data.error?.message || data.message || '請求失敗';
                throw new APIError(errorMessage, response.status, data);
            }

            // 顯示成功通知（如果有 message）
            if (this.showNotifications && data.message && window.showNotification) {
                window.showNotification(data.message, 'success');
            }

            return data;

        } catch (error) {
            // 隱藏載入指示器
            if (this.showLoading && window.hideLoading) {
                window.hideLoading();
            }

            // 顯示錯誤通知
            if (this.showNotifications && window.showNotification) {
                if (error instanceof APIError) {
                    window.showNotification(error.message, 'error');
                } else {
                    window.showNotification('網路錯誤，請稍後再試', 'error');
                }
            }

            // 重新拋出錯誤
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError('網路錯誤', 0, error);
        }
    }

    /**
     * GET 請求
     * @param {string} endpoint - API 端點
     * @param {object} params - 查詢參數
     * @returns {Promise<object>} API 回應
     */
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    }

    /**
     * POST 請求
     * @param {string} endpoint - API 端點
     * @param {object} data - 請求數據
     * @returns {Promise<object>} API 回應
     */
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT 請求
     * @param {string} endpoint - API 端點
     * @param {object} data - 請求數據
     * @returns {Promise<object>} API 回應
     */
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE 請求
     * @param {string} endpoint - API 端點
     * @returns {Promise<object>} API 回應
     */
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    /**
     * PATCH 請求
     * @param {string} endpoint - API 端點
     * @param {object} data - 請求數據
     * @returns {Promise<object>} API 回應
     */
    async patch(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }
}

// 創建全局實例
window.APIClient = APIClient;
window.APIError = APIError;
window.apiClient = new APIClient('/api');
window.adminAPI = new APIClient('/api/admin');
window.v1API = new APIClient('/api/v1');

