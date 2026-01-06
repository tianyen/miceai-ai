/**
 * 管理後台共用功能
 */

/**
 * 取得 CSRF Token
 * @returns {string} CSRF token
 */
window.getCsrfToken = function() {
    return window.__CSRF_TOKEN__ || document.querySelector('meta[name="csrf-token"]')?.content || '';
};

/**
 * 帶有 CSRF Token 的 fetch 包裝函數
 * @param {string} url - 請求 URL
 * @param {object} options - fetch 選項
 * @returns {Promise} fetch Promise
 */
window.adminFetch = function(url, options = {}) {
    const csrfToken = getCsrfToken();
    options.headers = {
        ...options.headers,
        'X-CSRF-Token': csrfToken
    };
    return fetch(url, options);
};

/**
 * 帶有 CSRF Token 的 jQuery AJAX 包裝函數
 * @param {object} options - jQuery AJAX 選項
 * @returns {jqXHR} jQuery AJAX Promise
 */
window.adminAjax = function(options) {
    const csrfToken = getCsrfToken();
    options.headers = {
        ...options.headers,
        'X-CSRF-Token': csrfToken
    };
    return $.ajax(options);
};

window.AdminSystem = {
    user: null,
    currentPage: null,

    /**
     * 初始化管理系統
     */
    init() {
        this.loadUserInfo();
        this.setupEventListeners();
        this.setupAjaxEnhancements();
        this.initializeComponents();
    },

    /**
     * 載入用戶資訊
     */
    async loadUserInfo() {
        try {
            const response = await fetch('/api/admin/user/current');
            if (response.ok) {
                const text = await response.text();
                if (text) {
                    const parsed = JSON.parse(text);
                    this.user = (parsed && typeof parsed === 'object' && parsed.success && parsed.data) ? parsed.data : parsed;
                    this.updateUserDisplay();
                }
            }
        } catch (error) {
            console.error('載入用戶資訊失敗:', error);
        }
    },

    /**
     * 更新用戶顯示
     */
    updateUserDisplay() {
        if (!this.user) return;

        document.querySelectorAll('[data-user="name"]').forEach(el => {
            el.textContent = this.user.full_name || this.user.username;
        });

        document.querySelectorAll('[data-user="role"]').forEach(el => {
            el.textContent = this.getRoleText(this.user.role);
        });

        // 根據角色顯示/隱藏元素
        this.updateRoleBasedVisibility();
    },

    /**
     * 取得角色文字
     */
    getRoleText(role) {
        const roleMap = {
            'super_admin': '超級管理員',
            'project_manager': '專案管理員',
            'vendor': '廠商用戶',
            'project_user': '一般用戶'
        };
        return roleMap[role] || role;
    },

    /**
     * 根據角色更新可見性
     */
    updateRoleBasedVisibility() {
        if (!this.user) return;

        const adminOnlyElements = document.querySelectorAll('.admin-only');
        const isAdmin = this.user.role === 'super_admin';

        adminOnlyElements.forEach(el => {
            el.style.display = isAdmin ? '' : 'none';
        });
    },

    /**
     * 設置事件監聽器
     */
    setupEventListeners() {
        // 側邊欄切換
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-toggle="sidebar"]')) {
                this.toggleSidebar();
            }
        });

        // 登出處理
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action="logout"]')) {
                e.preventDefault();
                this.logout();
            }
        });

        // 表單提交增強
        document.addEventListener('submit', (e) => {
            if (e.target.matches('.admin-form')) {
                this.handleFormSubmit(e);
            }
        });

        // 響應式處理
        window.addEventListener('resize', Utils.throttle(() => {
            this.handleResize();
        }, 250));
    },

    /**
     * 設置 AJAX 增強功能
     */
    setupAjaxEnhancements() {
        // AJAX 請求前的處理
        $(document).on('ajaxStart', () => {
            // 添加全局載入狀態
            document.body.classList.add('ajax-loading');
        });

        // AJAX 請求後的處理
        $(document).on('ajaxStop', () => {
            // 移除全局載入狀態
            document.body.classList.remove('ajax-loading');

            // 重新初始化組件
            this.initializeComponents();
        });
    },

    /**
     * 初始化組件
     */
    initializeComponents() {
        this.initDataTables();
        this.initModals();
        this.initTooltips();
        this.initDatePickers();
        this.initFileUploads();
    },

    /**
     * 初始化數據表格
     */
    initDataTables() {
        document.querySelectorAll('.data-table').forEach(table => {
            // 添加排序功能
            this.addTableSorting(table);

            // 添加篩選功能
            this.addTableFiltering(table);
        });
    },

    /**
     * 添加表格排序
     */
    addTableSorting(table) {
        const headers = table.querySelectorAll('th[data-sortable]');
        headers.forEach(header => {
            header.style.cursor = 'pointer';
            header.addEventListener('click', () => {
                this.sortTable(table, header);
            });
        });
    },

    /**
     * 排序表格
     */
    sortTable(table, header) {
        const column = Array.from(header.parentNode.children).indexOf(header);
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        const isAscending = !header.classList.contains('sort-asc');

        // 清除其他排序標記
        table.querySelectorAll('th').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
        });

        // 添加當前排序標記
        header.classList.add(isAscending ? 'sort-asc' : 'sort-desc');

        // 排序行
        rows.sort((a, b) => {
            const aText = a.children[column].textContent.trim();
            const bText = b.children[column].textContent.trim();

            // 嘗試數字比較
            const aNum = parseFloat(aText);
            const bNum = parseFloat(bText);

            if (!isNaN(aNum) && !isNaN(bNum)) {
                return isAscending ? aNum - bNum : bNum - aNum;
            }

            // 文字比較
            return isAscending ?
                aText.localeCompare(bText) :
                bText.localeCompare(aText);
        });

        // 重新插入排序後的行
        const tbody = table.querySelector('tbody');
        rows.forEach(row => tbody.appendChild(row));
    },

    /**
     * 添加表格篩選
     */
    addTableFiltering(table) {
        const filterInput = table.parentNode.querySelector('.table-filter');
        if (filterInput) {
            filterInput.addEventListener('input', Utils.debounce((e) => {
                this.filterTable(table, e.target.value);
            }, 300));
        }
    },

    /**
     * 篩選表格
     */
    filterTable(table, query) {
        const rows = table.querySelectorAll('tbody tr');
        const searchTerm = query.toLowerCase();

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    },

    /**
     * 初始化模態框
     */
    initModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            // 點擊背景關閉
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                }
            });

            // ESC 鍵關閉
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal.classList.contains('show')) {
                    this.closeModal(modal);
                }
            });
        });
    },

    /**
     * 開啟模態框
     */
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            document.body.classList.add('modal-open');
        }
    },

    /**
     * 關閉模態框
     */
    closeModal(modal) {
        if (typeof modal === 'string') {
            modal = document.getElementById(modal);
        }
        if (modal) {
            modal.classList.remove('show');
            document.body.classList.remove('modal-open');
        }
    },

    /**
     * 初始化工具提示
     */
    initTooltips() {
        document.querySelectorAll('[data-tooltip]').forEach(element => {
            element.addEventListener('mouseenter', (e) => {
                this.showTooltip(e.target, e.target.getAttribute('data-tooltip'));
            });

            element.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
    },

    /**
     * 顯示工具提示
     */
    showTooltip(element, text) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = text;
        document.body.appendChild(tooltip);

        const rect = element.getBoundingClientRect();
        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.top - tooltip.offsetHeight - 5 + 'px';

        this.currentTooltip = tooltip;
    },

    /**
     * 隱藏工具提示
     */
    hideTooltip() {
        if (this.currentTooltip) {
            this.currentTooltip.remove();
            this.currentTooltip = null;
        }
    },

    /**
     * 初始化日期選擇器
     */
    initDatePickers() {
        document.querySelectorAll('input[type="date"], input[type="datetime-local"]').forEach(input => {
            // 可以在這裡添加第三方日期選擇器的初始化
        });
    },

    /**
     * 初始化文件上傳
     */
    initFileUploads() {
        document.querySelectorAll('.file-upload').forEach(upload => {
            this.setupFileUpload(upload);
        });
    },

    /**
     * 設置文件上傳
     */
    setupFileUpload(uploadElement) {
        const input = uploadElement.querySelector('input[type="file"]');
        const preview = uploadElement.querySelector('.file-preview');

        if (input) {
            input.addEventListener('change', (e) => {
                this.handleFileSelect(e.target.files, preview);
            });
        }
    },

    /**
     * 處理文件選擇
     */
    handleFileSelect(files, preview) {
        if (!preview) return;

        preview.innerHTML = '';

        Array.from(files).forEach(file => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.innerHTML = `
                <span class="file-name">${file.name}</span>
                <span class="file-size">${Utils.formatFileSize(file.size)}</span>
            `;
            preview.appendChild(item);
        });
    },

    /**
     * 切換側邊欄
     */
    toggleSidebar() {
        document.body.classList.toggle('sidebar-collapsed');
    },

    /**
     * 處理視窗大小變化
     */
    handleResize() {
        const isMobile = window.innerWidth < 768;

        if (isMobile) {
            document.body.classList.add('mobile-layout');
        } else {
            document.body.classList.remove('mobile-layout');
        }
    },

    /**
     * 更新當前頁面
     */
    updateCurrentPage() {
        const path = window.location.pathname;
        const page = path.split('/').pop() || 'dashboard';
        this.currentPage = page;

        // 更新導航狀態
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        const activeLink = document.querySelector(`.nav-link[href*="${page}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    },

    /**
     * 處理表單提交
     */
    handleFormSubmit(event) {
        const form = event.target;

        // 添加提交狀態
        form.classList.add('submitting');

        // 禁用提交按鈕
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '提交中...';
        }
    },

    /**
     * 登出
     */
    async logout() {
        if (confirm('確定要登出嗎？')) {
            try {
                const csrfToken = getCsrfToken();
                const response = await fetch('/admin/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    }
                });

                if (response.ok) {
                    window.location.href = '/admin/login';
                } else {
                    showError('登出失敗，請稍後再試');
                }
            } catch (error) {
                showError('登出失敗，請稍後再試');
            }
        }
    }
};

// 全域快捷方法
window.openModal = function (modalId) {
    AdminSystem.openModal(modalId);
};

window.closeModal = function (modal) {
    AdminSystem.closeModal(modal);
};

window.logoutAdmin = function () {
    AdminSystem.logout();
};

// jQuery AJAX 屬性處理器
$(document).ready(function () {
    // 處理 data-ajax-* 屬性的點擊事件
    $(document).on('click', '[data-ajax-url]', function (e) {
        e.preventDefault();

        const $element = $(this);
        const url = $element.attr('data-ajax-url');
        const method = $element.attr('data-ajax-method') || 'GET';
        const target = $element.attr('data-ajax-target') || '';
        const swap = $element.attr('data-ajax-swap') || 'innerHTML';
        const confirm_msg = $element.attr('data-ajax-confirm');

        // 確認對話框
        if (confirm_msg && !confirm(confirm_msg)) {
            return;
        }

        // 收集表單數據（如果是表單內的元素）
        const form = $element.closest('form')[0];
        const data = form ? new FormData(form) : {};

        $.ajax({
            url: url,
            method: method,
            data: data,
            processData: method === 'GET',
            contentType: method === 'GET' ? 'application/x-www-form-urlencoded' : false,
            success: function (response) {
                if (target) {
                    if (swap === 'innerHTML') {
                        $(target).html(response);
                    } else if (swap === 'outerHTML') {
                        $(target).replaceWith(response);
                    } else if (swap === 'beforeend') {
                        $(target).append(response);
                    }

                    // 觸發自定義事件
                    $(target).trigger('ajax:afterSwap', { target: $(target)[0] });
                }

                // 如果響應是 JSON 並包含成功消息
                if (typeof response === 'object' && response.success) {
                    if (response.message && typeof showNotification === 'function') {
                        showNotification(response.message, 'success');
                    }
                }
            },
            error: function (xhr) {
                console.error('AJAX 請求失敗:', xhr);
                if (typeof showNotification === 'function') {
                    showNotification('操作失敗，請稍後再試', 'error');
                }
            }
        });
    });

    // 注意：舊的 data-ajax-* 處理器已移除，改用專用的表單處理器
});

// 自動初始化
document.addEventListener('DOMContentLoaded', function () {
    if (document.body.classList.contains('admin-layout')) {
        AdminSystem.init();
    }
});
