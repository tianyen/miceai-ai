/**
 * Handlebars 模板引擎配置
 */
const { engine } = require('express-handlebars');
const config = require('./index');

// Handlebars helpers
const helpers = {
    // 條件判斷
    eq: function(a, b, options) {
        if (arguments.length === 3 && options && typeof options.fn === 'function') {
            return (a === b) ? options.fn(this) : options.inverse(this);
        } else {
            return a === b;
        }
    },
    ne: (a, b) => a !== b,
    gt: (a, b) => a > b,
    lt: (a, b) => a < b,
    and: (a, b) => a && b,
    or: (a, b) => a || b,
    not: (a) => !a,
    
    // 日期格式化
    formatDate: (date) => {
        if (!date) return '';
        return new Date(date).toLocaleDateString('zh-TW');
    },
    formatDateTime: (date) => {
        if (!date) return '';
        return new Date(date).toLocaleString('zh-TW');
    },
    
    // 工具函數
    json: (context) => JSON.stringify(context),
    substring: (str, start, length) => {
        if (!str) return '';
        return str.substring(start, length || str.length);
    },
    
    // 條件渲染
    ifCond: function(v1, operator, v2, options) {
        switch (operator) {
            case '==': return (v1 == v2) ? options.fn(this) : options.inverse(this);
            case '===': return (v1 === v2) ? options.fn(this) : options.inverse(this);
            case '!=': return (v1 != v2) ? options.fn(this) : options.inverse(this);
            case '!==': return (v1 !== v2) ? options.fn(this) : options.inverse(this);
            case '<': return (v1 < v2) ? options.fn(this) : options.inverse(this);
            case '<=': return (v1 <= v2) ? options.fn(this) : options.inverse(this);
            case '>': return (v1 > v2) ? options.fn(this) : options.inverse(this);
            case '>=': return (v1 >= v2) ? options.fn(this) : options.inverse(this);
            case '&&': return (v1 && v2) ? options.fn(this) : options.inverse(this);
            case '||': return (v1 || v2) ? options.fn(this) : options.inverse(this);
            default: return options.inverse(this);
        }
    }
};

module.exports = {
    // 創建 Handlebars 引擎
    create: () => {
        return engine({
            layoutsDir: config.paths.layouts,
            partialsDir: config.paths.partials,
            defaultLayout: 'main',
            extname: '.handlebars',
            helpers
        });
    },
    
    // 導出 helpers 以供測試
    helpers
};