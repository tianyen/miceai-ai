// 共用 JavaScript 工具函數
// 替代 HTMX 功能，使用 jQuery 實現

// 全局應用對象
window.App = {
    // API 基礎 URL
    baseURL: '/api/admin',
    
    // 通用 AJAX 函數
    ajax: function(options) {
        const defaults = {
            method: 'GET',
            dataType: 'json',
            timeout: 30000,
            error: function(xhr, status, error) {
                console.error('AJAX Error:', error);
                App.showNotification('請求失敗，請稍後再試', 'error');
            }
        };
        
        const settings = $.extend({}, defaults, options);
        return $.ajax(settings);
    },
    
    // 顯示通知訊息
    showNotification: function(message, type = 'info', duration = 5000) {
        // 創建通知元素
        const notification = $(`
            <div class="notification notification-${type}">
                <div class="notification-content">
                    <span class="notification-message">${message}</span>
                    <button class="notification-close">&times;</button>
                </div>
            </div>
        `);
        
        // 添加到頁面
        if ($('#notification-container').length === 0) {
            $('body').append('<div id="notification-container"></div>');
        }
        
        $('#notification-container').append(notification);
        
        // 顯示動畫
        notification.fadeIn(300);
        
        // 自動隱藏
        if (duration > 0) {
            setTimeout(function() {
                notification.fadeOut(300, function() {
                    notification.remove();
                });
            }, duration);
        }
        
        // 點擊關閉
        notification.find('.notification-close').on('click', function() {
            notification.fadeOut(300, function() {
                notification.remove();
            });
        });
        
        return notification;
    },
    
    // 顯示載入狀態
    showLoading: function(target) {
        const $target = $(target);
        const loadingHtml = `
            <div class="loading-overlay">
                <div class="loading-spinner"></div>
                <span>載入中...</span>
            </div>
        `;
        $target.html(loadingHtml);
    },
    
    // 隱藏載入狀態
    hideLoading: function(target) {
        $(target).find('.loading-overlay').remove();
    },
    
    // 格式化日期 (GMT+8 台北時區)
    // 資料庫存的是 UTC 時間，需要明確標示後轉換
    formatDate: function(dateString, format = 'YYYY-MM-DD') {
        if (!dateString) return '';

        // 確保時間字串被當作 UTC 解析
        let dateStr = String(dateString);
        if (!dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.includes('T')) {
            dateStr = dateStr.replace(' ', 'T') + 'Z';
        } else if (dateStr.includes('T') && !dateStr.includes('Z') && !dateStr.includes('+')) {
            dateStr = dateStr + 'Z';
        }

        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';

        // 轉換為台北時區
        const taipeiDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
        const year = taipeiDate.getFullYear();
        const month = String(taipeiDate.getMonth() + 1).padStart(2, '0');
        const day = String(taipeiDate.getDate()).padStart(2, '0');
        const hours = String(taipeiDate.getHours()).padStart(2, '0');
        const minutes = String(taipeiDate.getMinutes()).padStart(2, '0');

        switch(format) {
            case 'YYYY-MM-DD':
                return `${year}-${month}-${day}`;
            case 'YYYY-MM-DD HH:mm':
                return `${year}-${month}-${day} ${hours}:${minutes}`;
            case 'MM/DD':
                return `${month}/${day}`;
            default:
                return date.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });
        }
    },
    
    // 確認對話框
    confirm: function(message, callback) {
        if (window.confirm(message)) {
            if (typeof callback === 'function') {
                callback();
            }
            return true;
        }
        return false;
    },
    
    // 模態框管理
    modal: {
        show: function(content, options = {}) {
            const defaults = {
                title: '提示',
                size: 'md', // sm, md, lg
                backdrop: true,
                keyboard: true
            };
            
            const settings = $.extend({}, defaults, options);
            
            const modalHtml = `
                <div class="modal fade" id="app-modal" tabindex="-1">
                    <div class="modal-dialog modal-${settings.size}">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">${settings.title}</h5>
                                <button type="button" class="btn-close" data-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                ${content}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // 移除現有模態框
            $('#app-modal').remove();
            
            // 添加新模態框
            $('body').append(modalHtml);
            
            const $modal = $('#app-modal');
            
            // 顯示模態框
            $modal.fadeIn(300);
            $('body').addClass('modal-open');
            
            // 事件處理
            $modal.find('[data-dismiss="modal"], .btn-close').on('click', function() {
                App.modal.hide();
            });
            
            if (settings.backdrop) {
                $modal.on('click', function(e) {
                    if (e.target === this) {
                        App.modal.hide();
                    }
                });
            }
            
            if (settings.keyboard) {
                $(document).on('keydown.modal', function(e) {
                    if (e.keyCode === 27) { // ESC key
                        App.modal.hide();
                    }
                });
            }
            
            return $modal;
        },
        
        hide: function() {
            const $modal = $('#app-modal');
            $modal.fadeOut(300, function() {
                $modal.remove();
                $('body').removeClass('modal-open');
                $(document).off('keydown.modal');
            });
        }
    },
    
    // 表格功能
    table: {
        // 載入表格數據
        load: function(tableId, url, options = {}) {
            const $table = $(tableId);
            const $tbody = $table.find('tbody');
            
            App.showLoading($tbody);
            
            App.ajax({
                url: url,
                method: options.method || 'GET',
                data: options.data || {},
                success: function(response) {
                    if (response.success) {
                        if (options.render && typeof options.render === 'function') {
                            const html = options.render(response.data);
                            $tbody.html(html);
                        } else {
                            $tbody.html(response.html || '<tr><td colspan="100%" class="text-center">暫無數據</td></tr>');
                        }
                    } else {
                        $tbody.html('<tr><td colspan="100%" class="text-center text-danger">載入失敗</td></tr>');
                    }
                },
                error: function() {
                    $tbody.html('<tr><td colspan="100%" class="text-center text-danger">載入失敗</td></tr>');
                }
            });
        },
        
        // 分頁功能
        pagination: function(containerId, currentPage, totalPages, onPageChange) {
            const $container = $(containerId);
            
            if (totalPages <= 1) {
                $container.empty();
                return;
            }
            
            let html = '<nav class="pagination-nav"><ul class="pagination">';
            
            // 上一頁
            if (currentPage > 1) {
                html += `<li class="page-item"><a class="page-link" href="#" data-page="${currentPage - 1}">上一頁</a></li>`;
            }
            
            // 頁碼
            for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
                const activeClass = i === currentPage ? 'active' : '';
                html += `<li class="page-item ${activeClass}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
            }
            
            // 下一頁
            if (currentPage < totalPages) {
                html += `<li class="page-item"><a class="page-link" href="#" data-page="${currentPage + 1}">下一頁</a></li>`;
            }
            
            html += '</ul></nav>';
            
            $container.html(html);
            
            // 綁定點擊事件
            $container.find('.page-link').on('click', function(e) {
                e.preventDefault();
                const page = parseInt($(this).data('page'));
                if (page && typeof onPageChange === 'function') {
                    onPageChange(page);
                }
            });
        }
    },
    
    // 表單功能
    form: {
        // 序列化表單數據為對象
        serialize: function(form) {
            const $form = $(form);
            const formData = {};
            
            $form.find('input, select, textarea').each(function() {
                const $field = $(this);
                const name = $field.attr('name');
                const type = $field.attr('type');
                
                if (!name) return;
                
                if (type === 'checkbox' || type === 'radio') {
                    if ($field.is(':checked')) {
                        formData[name] = $field.val();
                    }
                } else {
                    formData[name] = $field.val();
                }
            });
            
            return formData;
        },
        
        // 填充表單數據
        populate: function(form, data) {
            const $form = $(form);
            
            Object.keys(data).forEach(function(key) {
                const $field = $form.find(`[name="${key}"]`);
                const value = data[key];
                
                if ($field.length) {
                    const type = $field.attr('type');
                    
                    if (type === 'checkbox' || type === 'radio') {
                        $field.filter(`[value="${value}"]`).prop('checked', true);
                    } else {
                        $field.val(value);
                    }
                }
            });
        },
        
        // 重置表單
        reset: function(form) {
            $(form)[0].reset();
        },
        
        // 表單驗證
        validate: function(form, rules = {}) {
            const $form = $(form);
            const data = App.form.serialize(form);
            const errors = {};
            
            Object.keys(rules).forEach(function(field) {
                const rule = rules[field];
                const value = data[field];
                
                if (rule.required && (!value || value.trim() === '')) {
                    errors[field] = rule.message || `${field} 為必填欄位`;
                }
                
                if (value && rule.pattern && !rule.pattern.test(value)) {
                    errors[field] = rule.message || `${field} 格式不正確`;
                }
                
                if (value && rule.min && value.length < rule.min) {
                    errors[field] = rule.message || `${field} 長度不能少於 ${rule.min} 個字符`;
                }
                
                if (value && rule.max && value.length > rule.max) {
                    errors[field] = rule.message || `${field} 長度不能超過 ${rule.max} 個字符`;
                }
            });
            
            // 顯示錯誤
            $form.find('.error-message').remove();
            $form.find('.is-invalid').removeClass('is-invalid');
            
            Object.keys(errors).forEach(function(field) {
                const $field = $form.find(`[name="${field}"]`);
                $field.addClass('is-invalid');
                $field.after(`<div class="error-message text-danger small">${errors[field]}</div>`);
            });
            
            return Object.keys(errors).length === 0;
        }
    }
};

// DOM 載入完成後初始化
$(document).ready(function() {
    // 添加通知樣式
    if ($('#app-styles').length === 0) {
        $('head').append(`
            <style id="app-styles">
                #notification-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 9999;
                    max-width: 400px;
                }
                
                .notification {
                    margin-bottom: 10px;
                    border-radius: 4px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    display: none;
                }
                
                .notification-content {
                    padding: 15px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                
                .notification-info {
                    background: #d1ecf1;
                    color: #0c5460;
                    border-left: 4px solid #17a2b8;
                }
                
                .notification-success {
                    background: #d4edda;
                    color: #155724;
                    border-left: 4px solid #28a745;
                }
                
                .notification-warning {
                    background: #fff3cd;
                    color: #856404;
                    border-left: 4px solid #ffc107;
                }
                
                .notification-error {
                    background: #f8d7da;
                    color: #721c24;
                    border-left: 4px solid #dc3545;
                }
                
                .notification-close {
                    background: none;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    margin-left: 10px;
                    opacity: 0.7;
                }
                
                .notification-close:hover {
                    opacity: 1;
                }
                
                .loading-overlay {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 40px;
                    color: #666;
                }
                
                .loading-spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #007bff;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 10px;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                .modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    z-index: 1050;
                    display: none;
                }
                
                .modal-dialog {
                    position: relative;
                    width: auto;
                    margin: 0.5rem;
                    pointer-events: none;
                }
                
                .modal-content {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    pointer-events: auto;
                    background: white;
                    border-radius: 0.3rem;
                    box-shadow: 0 0.25rem 0.5rem rgba(0,0,0,0.5);
                    margin: 1.75rem auto;
                }
                
                .modal-sm { max-width: 300px; }
                .modal-md { max-width: 500px; }
                .modal-lg { max-width: 800px; }
                
                .modal-header {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    padding: 1rem;
                    border-bottom: 1px solid #dee2e6;
                }
                
                .modal-body {
                    position: relative;
                    flex: 1 1 auto;
                    padding: 1rem;
                }
                
                body.modal-open {
                    overflow: hidden;
                }
            </style>
        `);
    }
});