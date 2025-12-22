/**
 * 共用工具函數庫
 * 提供前台和後台共用的基礎功能
 */

// 全域工具物件
window.Utils = {
    
    /**
     * 格式化日期 (GMT+8 台北時區)
     * @param {string|Date} date - 日期
     * @param {string} format - 格式 ('date', 'datetime', 'time')
     * @returns {string} 格式化後的日期字串
     */
    formatDate(date, format = 'date') {
        if (!date) return '';

        // 資料庫存的是 UTC 時間（格式如 '2025-12-18 05:16:14'）
        // 需要明確告訴 JavaScript 這是 UTC 時間
        let dateStr = String(date);

        // 如果時間字串不包含 timezone 資訊，加上 'Z' 表示 UTC
        if (!dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.includes('T')) {
            dateStr = dateStr.replace(' ', 'T') + 'Z';
        } else if (dateStr.includes('T') && !dateStr.includes('Z') && !dateStr.includes('+')) {
            dateStr = dateStr + 'Z';
        }

        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';

        const options = {
            date: { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' },
            datetime: {
                timeZone: 'Asia/Taipei',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false
            },
            time: { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
        };

        return d.toLocaleString('zh-TW', options[format] || options.date);
    },
    
    /**
     * 格式化文件大小
     * @param {number} bytes - 位元組數
     * @returns {string} 格式化後的大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    /**
     * 防抖函數
     * @param {Function} func - 要防抖的函數
     * @param {number} wait - 等待時間（毫秒）
     * @returns {Function} 防抖後的函數
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    /**
     * 節流函數
     * @param {Function} func - 要節流的函數
     * @param {number} limit - 限制時間（毫秒）
     * @returns {Function} 節流後的函數
     */
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    /**
     * 深拷貝物件
     * @param {any} obj - 要拷貝的物件
     * @returns {any} 拷貝後的物件
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = this.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    },
    
    /**
     * 生成隨機 ID
     * @param {number} length - ID 長度
     * @returns {string} 隨機 ID
     */
    generateId(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },
    
    /**
     * 驗證電子郵件格式
     * @param {string} email - 電子郵件
     * @returns {boolean} 是否有效
     */
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
    
    /**
     * 驗證手機號碼格式（台灣）
     * @param {string} phone - 手機號碼
     * @returns {boolean} 是否有效
     */
    validatePhone(phone) {
        const re = /^09\d{8}$/;
        return re.test(phone.replace(/\s+/g, ''));
    },
    
    /**
     * 轉義 HTML 字符
     * @param {string} text - 要轉義的文字
     * @returns {string} 轉義後的文字
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    },
    
    /**
     * 取得 URL 參數
     * @param {string} name - 參數名稱
     * @returns {string|null} 參數值
     */
    getUrlParameter(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    },
    
    /**
     * 設定 URL 參數
     * @param {string} name - 參數名稱
     * @param {string} value - 參數值
     */
    setUrlParameter(name, value) {
        const url = new URL(window.location);
        url.searchParams.set(name, value);
        window.history.pushState({}, '', url);
    },
    
    /**
     * 移除 URL 參數
     * @param {string} name - 參數名稱
     */
    removeUrlParameter(name) {
        const url = new URL(window.location);
        url.searchParams.delete(name);
        window.history.pushState({}, '', url);
    },
    
    /**
     * 複製文字到剪貼簿
     * @param {string} text - 要複製的文字
     * @returns {Promise<boolean>} 是否成功
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            // 降級方案
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                document.body.removeChild(textArea);
                return true;
            } catch (err) {
                document.body.removeChild(textArea);
                return false;
            }
        }
    },
    
    /**
     * 載入 CSS 檔案
     * @param {string} href - CSS 檔案路徑
     * @returns {Promise} 載入完成的 Promise
     */
    loadCSS(href) {
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
        });
    },
    
    /**
     * 載入 JavaScript 檔案
     * @param {string} src - JS 檔案路徑
     * @returns {Promise} 載入完成的 Promise
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },
    
    /**
     * 檢查元素是否在視窗內
     * @param {Element} element - 要檢查的元素
     * @returns {boolean} 是否在視窗內
     */
    isElementInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    },
    
    /**
     * 平滑滾動到元素
     * @param {Element|string} element - 元素或選擇器
     * @param {number} offset - 偏移量
     */
    scrollToElement(element, offset = 0) {
        const target = typeof element === 'string' ? document.querySelector(element) : element;
        if (target) {
            const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    }
};

// 初始化載入指示器功能
window.initLoadingIndicators = function() {
    // 自動顯示載入指示器
    $(document).on('ajaxStart', function() {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) {
            indicator.style.display = 'block';
        }
    });

    $(document).on('ajaxStop', function() {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    });
};

// 顯示表單驗證錯誤
function displayFormErrors(errors) {
    // 清除現有錯誤
    document.querySelectorAll('.form-error').forEach(el => el.remove());
    
    // 顯示新錯誤
    Object.keys(errors).forEach(field => {
        const input = document.querySelector(`[name="${field}"]`);
        if (input) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'form-error text-danger mt-1';
            errorDiv.textContent = errors[field];
            input.parentNode.appendChild(errorDiv);
            input.classList.add('is-invalid');
        }
    });
}
