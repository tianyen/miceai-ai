/**
 * 通知系統
 * 提供統一的通知顯示功能
 */

window.NotificationSystem = {
    container: null,
    notifications: new Map(),

    /**
     * 初始化通知系統
     */
    init() {
        this.container = document.getElementById('notification-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
        }

        // 監聽 jQuery AJAX 事件
        this.setupJQueryListeners();
    },

    /**
     * 設置 jQuery AJAX 事件監聽器
     */
    setupJQueryListeners() {
        // 成功請求 - 監聽全域 AJAX 成功事件
        $(document).on('ajaxSuccess', (event, xhr, settings) => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const successMessage = xhr.getResponseHeader('X-Success-Message');
                if (successMessage) {
                    this.show(successMessage, 'success');
                }
            }
        });

        // 錯誤請求 - 監聽全域 AJAX 錯誤事件
        $(document).on('ajaxError', (event, xhr, settings, thrownError) => {
            const errorMessage = xhr.getResponseHeader('X-Error-Message') || '請求失敗，請稍後再試';
            this.show(errorMessage, 'error');
        });

        // 網路錯誤 - 監聽 AJAX 超時和網路錯誤
        $(document).on('ajaxError', (event, xhr, settings, thrownError) => {
            if (xhr.status === 0 && thrownError !== 'abort') {
                this.show('網路連線錯誤，請檢查您的網路連線', 'error');
            }
        });
    },

    /**
     * 顯示通知
     * @param {string} message - 訊息內容
     * @param {string} type - 通知類型 ('success', 'error', 'warning', 'info')
     * @param {number} duration - 顯示時間（毫秒），0 表示不自動關閉
     * @param {Object} options - 額外選項
     */
    show(message, type = 'info', duration = 5000, options = {}) {
        const id = Utils.generateId();
        const notification = this.createNotification(id, message, type, options);

        this.container.appendChild(notification);
        this.notifications.set(id, notification);

        // 觸發進入動畫
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });

        // 自動關閉
        if (duration > 0) {
            setTimeout(() => {
                this.hide(id);
            }, duration);
        }

        return id;
    },

    /**
     * 創建通知元素
     * @param {string} id - 通知 ID
     * @param {string} message - 訊息內容
     * @param {string} type - 通知類型
     * @param {Object} options - 額外選項
     * @returns {Element} 通知元素
     */
    createNotification(id, message, type, options) {
        const notification = document.createElement('div');
        notification.id = `notification-${id}`;
        notification.className = `notification notification-${type}`;

        const icon = this.getIcon(type);
        const closeButton = options.closable !== false ?
            '<button class="notification-close" onclick="NotificationSystem.hide(\'' + id + '\')">&times;</button>' : '';

        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">${icon}</div>
                <div class="notification-message">${Utils.escapeHtml(message)}</div>
                ${closeButton}
            </div>
            ${options.actions ? this.createActions(options.actions) : ''}
        `;

        return notification;
    },

    /**
     * 取得圖示
     * @param {string} type - 通知類型
     * @returns {string} 圖示 HTML
     */
    getIcon(type) {
        const icons = {
            success: '<i class="fas fa-check-circle"></i>',
            error: '<i class="fas fa-exclamation-circle"></i>',
            warning: '<i class="fas fa-exclamation-triangle"></i>',
            info: '<i class="fas fa-info-circle"></i>'
        };
        return icons[type] || icons.info;
    },

    /**
     * 創建操作按鈕
     * @param {Array} actions - 操作列表
     * @returns {string} 操作按鈕 HTML
     */
    createActions(actions) {
        const actionButtons = actions.map(action =>
            `<button class="notification-action btn btn-sm btn-${action.type || 'secondary'}" 
                     onclick="${action.onclick}">${action.text}</button>`
        ).join('');

        return `<div class="notification-actions">${actionButtons}</div>`;
    },

    /**
     * 隱藏通知
     * @param {string} id - 通知 ID
     */
    hide(id) {
        const notification = this.notifications.get(id);
        if (notification) {
            notification.classList.add('hide');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                this.notifications.delete(id);
            }, 300);
        }
    },

    /**
     * 清除所有通知
     */
    clear() {
        this.notifications.forEach((notification, id) => {
            this.hide(id);
        });
    },

    /**
     * 顯示成功通知
     * @param {string} message - 訊息內容
     * @param {number} duration - 顯示時間
     */
    success(message, duration = 3000) {
        return this.show(message, 'success', duration);
    },

    /**
     * 顯示錯誤通知
     * @param {string} message - 訊息內容
     * @param {number} duration - 顯示時間
     */
    error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    },

    /**
     * 顯示警告通知
     * @param {string} message - 訊息內容
     * @param {number} duration - 顯示時間
     */
    warning(message, duration = 4000) {
        return this.show(message, 'warning', duration);
    },

    /**
     * 顯示資訊通知
     * @param {string} message - 訊息內容
     * @param {number} duration - 顯示時間
     */
    info(message, duration = 4000) {
        return this.show(message, 'info', duration);
    },

    /**
     * 顯示確認對話框
     * @param {string} message - 訊息內容
     * @param {Function} onConfirm - 確認回調
     * @param {Function} onCancel - 取消回調
     */
    confirm(message, onConfirm, onCancel) {
        const actions = [
            {
                text: '取消',
                type: 'secondary',
                onclick: `NotificationSystem.hide('${Utils.generateId()}'); ${onCancel ? onCancel.toString() + '()' : ''}`
            },
            {
                text: '確認',
                type: 'primary',
                onclick: `NotificationSystem.hide('${Utils.generateId()}'); ${onConfirm ? onConfirm.toString() + '()' : ''}`
            }
        ];

        return this.show(message, 'warning', 0, { actions, closable: false });
    }
};

// 全域快捷方法
window.showNotification = function (message, type = 'info', duration = 5000) {
    return NotificationSystem.show(message, type, duration);
};

window.showSuccess = function (message, duration = 3000) {
    return NotificationSystem.success(message, duration);
};

window.showError = function (message, duration = 5000) {
    return NotificationSystem.error(message, duration);
};

window.showWarning = function (message, duration = 4000) {
    return NotificationSystem.warning(message, duration);
};

window.showInfo = function (message, duration = 4000) {
    return NotificationSystem.info(message, duration);
};

window.showConfirm = function (message, onConfirm, onCancel) {
    return NotificationSystem.confirm(message, onConfirm, onCancel);
};

// 初始化函數
window.initNotifications = function () {
    NotificationSystem.init();
};

// 自動初始化
document.addEventListener('DOMContentLoaded', function () {
    NotificationSystem.init();
});
