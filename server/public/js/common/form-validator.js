/**
 * 表單驗證類
 * 統一表單驗證邏輯，支持鏈式調用
 */

class FormValidator {
    constructor(formElement) {
        this.form = typeof formElement === 'string' 
            ? document.querySelector(formElement) 
            : formElement;
        this.errors = {};
        this.rules = {};
    }

    /**
     * 驗證必填欄位
     * @param {string} fieldName - 欄位名稱
     * @param {string} message - 錯誤訊息
     * @returns {FormValidator} this
     */
    required(fieldName, message = '此欄位為必填') {
        const value = this.getFieldValue(fieldName);
        if (!value || value.trim() === '') {
            this.addError(fieldName, message);
        }
        return this;
    }

    /**
     * 驗證電子郵件
     * @param {string} fieldName - 欄位名稱
     * @param {string} message - 錯誤訊息
     * @returns {FormValidator} this
     */
    email(fieldName, message = '請輸入有效的電子郵件') {
        const value = this.getFieldValue(fieldName);
        if (value && !Utils.validateEmail(value)) {
            this.addError(fieldName, message);
        }
        return this;
    }

    /**
     * 驗證手機號碼
     * @param {string} fieldName - 欄位名稱
     * @param {string} message - 錯誤訊息
     * @returns {FormValidator} this
     */
    phone(fieldName, message = '請輸入有效的手機號碼') {
        const value = this.getFieldValue(fieldName);
        if (value && !Utils.validatePhone(value)) {
            this.addError(fieldName, message);
        }
        return this;
    }

    /**
     * 驗證最小長度
     * @param {string} fieldName - 欄位名稱
     * @param {number} length - 最小長度
     * @param {string} message - 錯誤訊息
     * @returns {FormValidator} this
     */
    minLength(fieldName, length, message) {
        const value = this.getFieldValue(fieldName);
        if (value && value.length < length) {
            this.addError(fieldName, message || `最少需要 ${length} 個字符`);
        }
        return this;
    }

    /**
     * 驗證最大長度
     * @param {string} fieldName - 欄位名稱
     * @param {number} length - 最大長度
     * @param {string} message - 錯誤訊息
     * @returns {FormValidator} this
     */
    maxLength(fieldName, length, message) {
        const value = this.getFieldValue(fieldName);
        if (value && value.length > length) {
            this.addError(fieldName, message || `最多 ${length} 個字符`);
        }
        return this;
    }

    /**
     * 驗證數字範圍
     * @param {string} fieldName - 欄位名稱
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @param {string} message - 錯誤訊息
     * @returns {FormValidator} this
     */
    range(fieldName, min, max, message) {
        const value = parseFloat(this.getFieldValue(fieldName));
        if (!isNaN(value) && (value < min || value > max)) {
            this.addError(fieldName, message || `請輸入 ${min} 到 ${max} 之間的數字`);
        }
        return this;
    }

    /**
     * 驗證兩個欄位值相同
     * @param {string} fieldName1 - 第一個欄位名稱
     * @param {string} fieldName2 - 第二個欄位名稱
     * @param {string} message - 錯誤訊息
     * @returns {FormValidator} this
     */
    match(fieldName1, fieldName2, message = '兩個欄位的值不相同') {
        const value1 = this.getFieldValue(fieldName1);
        const value2 = this.getFieldValue(fieldName2);
        if (value1 !== value2) {
            this.addError(fieldName2, message);
        }
        return this;
    }

    /**
     * 自定義驗證
     * @param {string} fieldName - 欄位名稱
     * @param {Function} validator - 驗證函數
     * @param {string} message - 錯誤訊息
     * @returns {FormValidator} this
     */
    custom(fieldName, validator, message) {
        const value = this.getFieldValue(fieldName);
        if (!validator(value)) {
            this.addError(fieldName, message);
        }
        return this;
    }

    /**
     * 檢查是否有效
     * @returns {boolean} 是否有效
     */
    isValid() {
        return Object.keys(this.errors).length === 0;
    }

    /**
     * 獲取所有錯誤
     * @returns {object} 錯誤對象
     */
    getErrors() {
        return this.errors;
    }

    /**
     * 顯示錯誤
     */
    showErrors() {
        this.clearErrors();
        Object.keys(this.errors).forEach(fieldName => {
            const field = this.form.querySelector(`[name="${fieldName}"]`);
            if (field) {
                field.classList.add('is-invalid');
                const errorDiv = document.createElement('div');
                errorDiv.className = 'invalid-feedback';
                errorDiv.textContent = this.errors[fieldName];
                field.parentNode.appendChild(errorDiv);
            }
        });
    }

    /**
     * 清除錯誤
     */
    clearErrors() {
        this.form.querySelectorAll('.is-invalid').forEach(el => {
            el.classList.remove('is-invalid');
        });
        this.form.querySelectorAll('.invalid-feedback').forEach(el => {
            el.remove();
        });
        this.errors = {};
    }

    /**
     * 獲取欄位值
     * @private
     * @param {string} fieldName - 欄位名稱
     * @returns {string} 欄位值
     */
    getFieldValue(fieldName) {
        const field = this.form.querySelector(`[name="${fieldName}"]`);
        if (!field) return '';
        
        // 處理 checkbox
        if (field.type === 'checkbox') {
            return field.checked ? field.value : '';
        }
        
        // 處理 radio
        if (field.type === 'radio') {
            const checked = this.form.querySelector(`[name="${fieldName}"]:checked`);
            return checked ? checked.value : '';
        }
        
        return field.value;
    }

    /**
     * 添加錯誤
     * @private
     * @param {string} fieldName - 欄位名稱
     * @param {string} message - 錯誤訊息
     */
    addError(fieldName, message) {
        if (!this.errors[fieldName]) {
            this.errors[fieldName] = message;
        }
    }
}

// 導出到全局
window.FormValidator = FormValidator;

