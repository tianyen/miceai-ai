/**
 * CSRF Token Utility
 * 獨立的 CSRF Token 工具，供 standalone 頁面使用
 *
 * 使用方式：
 * 1. 在 HTML 中引入: <script src="/js/common/csrf.js"></script>
 * 2. 在 AJAX headers 中使用: { 'X-CSRF-Token': getCsrfToken() }
 */

/**
 * 取得 CSRF Token
 * @returns {string} CSRF Token 或空字串
 */
function getCsrfToken() {
    // 1. 從 meta tag 取得 (最優先)
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    if (metaTag) {
        return metaTag.getAttribute('content');
    }

    // 2. 從 cookie 取得 (XSRF-TOKEN)
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    if (match) {
        return decodeURIComponent(match[1]);
    }

    // 3. 從全域變數取得
    if (typeof window.__CSRF_TOKEN__ !== 'undefined') {
        return window.__CSRF_TOKEN__;
    }

    // 4. 無法取得時回傳空字串
    return '';
}

// 確保全域可用
window.getCsrfToken = getCsrfToken;
