/**
 * 集中式日誌記錄工具
 *
 * 功能:
 * - 統一的日誌格式
 * - 多級別日誌 (DEBUG, INFO, WARN, ERROR)
 * - 自動日誌輪轉 (按日期)
 * - 敏感資料過濾
 * - 開發/生產環境區分
 *
 * 使用方式:
 * const logger = require('./utils/logger');
 * logger.info('用戶登入', { userId: 123 });
 * logger.error('資料庫錯誤', error);
 */
const fs = require('fs');
const path = require('path');

// 日誌級別
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// 日誌級別對應的 emoji 和顏色
const LOG_LEVEL_CONFIG = {
    DEBUG: { emoji: '🔍', color: '\x1b[36m' },  // Cyan
    INFO: { emoji: '📝', color: '\x1b[32m' },   // Green
    WARN: { emoji: '⚠️', color: '\x1b[33m' },   // Yellow
    ERROR: { emoji: '❌', color: '\x1b[31m' }   // Red
};

const RESET_COLOR = '\x1b[0m';

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '../logs');
        this.ensureLogDirectory();

        // 從環境變數讀取日誌級別，預設為 INFO
        this.logLevel = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.INFO;

        // 是否為生產環境
        this.isProduction = process.env.NODE_ENV === 'production';
    }

    /**
     * 確保日誌目錄存在
     */
    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    /**
     * 格式化日誌時間 (GMT+8 台北時區)
     */
    formatTimestamp() {
        const { getGMT8Timestamp } = require('./timezone');
        return getGMT8Timestamp();
    }

    /**
     * 獲取客戶端 IP
     */
    getClientIP(req) {
        return req.ip || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
               'unknown';
    }

    /**
     * 記錄 4xx 錯誤 (客戶端錯誤)
     */
    log4xx(req, res, statusCode, message = '') {
        // 忽略瀏覽器自動請求的路徑
        const ignoredPaths = [
            '/.well-known/appspecific/com.chrome.devtools.json',
            '/favicon.ico',
            '/.well-known/apple-app-site-association',
            '/.well-known/assetlinks.json'
        ];

        const requestUrl = req.originalUrl || req.url;
        if (ignoredPaths.includes(requestUrl)) {
            return; // 不記錄這些請求
        }

        const logData = {
            timestamp: this.formatTimestamp(),
            type: '4xx_CLIENT_ERROR',
            statusCode,
            method: req.method,
            url: requestUrl,
            userAgent: req.get('User-Agent') || 'unknown',
            ip: this.getClientIP(req),
            referer: req.get('Referer') || 'direct',
            message,
            headers: {
                accept: req.get('Accept'),
                contentType: req.get('Content-Type'),
                authorization: req.get('Authorization') ? '[REDACTED]' : undefined
            },
            query: req.query,
            body: this.sanitizeBody(req.body),
            user: req.user ? {
                id: req.user.id,
                username: req.user.username,
                role: req.user.role
            } : null,
            sessionId: req.sessionID || null
        };

        this.writeLog('4xx_errors', logData);

        // 開發環境下同時輸出到控制台
        if (process.env.NODE_ENV !== 'production') {
            console.warn(`🟡 4xx Error [${statusCode}]:`, {
                method: req.method,
                url: req.originalUrl,
                ip: this.getClientIP(req),
                message
            });
        }
    }

    /**
     * 記錄 5xx 錯誤 (服務器錯誤)
     */
    log5xx(req, res, statusCode, error, message = '') {
        const logData = {
            timestamp: this.formatTimestamp(),
            type: '5xx_SERVER_ERROR',
            statusCode,
            method: req.method,
            url: req.originalUrl || req.url,
            userAgent: req.get('User-Agent') || 'unknown',
            ip: this.getClientIP(req),
            referer: req.get('Referer') || 'direct',
            message,
            error: {
                name: error?.name,
                message: error?.message,
                stack: error?.stack
            },
            headers: {
                accept: req.get('Accept'),
                contentType: req.get('Content-Type'),
                authorization: req.get('Authorization') ? '[REDACTED]' : undefined
            },
            query: req.query,
            body: this.sanitizeBody(req.body),
            user: req.user ? {
                id: req.user.id,
                username: req.user.username,
                role: req.user.role
            } : null,
            sessionId: req.sessionID || null,
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime()
        };

        this.writeLog('5xx_errors', logData);
        
        // 開發環境下同時輸出到控制台
        if (process.env.NODE_ENV !== 'production') {
            console.error(`🔴 5xx Error [${statusCode}]:`, {
                method: req.method,
                url: req.originalUrl,
                ip: this.getClientIP(req),
                error: error?.message,
                stack: error?.stack
            });
        }
    }

    /**
     * 清理敏感數據
     */
    sanitizeBody(body) {
        if (!body || typeof body !== 'object') return body;
        
        const sanitized = { ...body };
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
        
        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        }
        
        return sanitized;
    }

    /**
     * 寫入日誌文件
     */
    writeLog(type, data) {
        const { getGMT8Date } = require('./timezone');
        const date = getGMT8Date();
        const filename = `${type}_${date}.log`;
        const filepath = path.join(this.logDir, filename);
        
        const logLine = JSON.stringify(data) + '\n';
        
        fs.appendFile(filepath, logLine, (err) => {
            if (err) {
                console.error('Failed to write log:', err);
            }
        });
    }

    /**
     * 通用日誌記錄方法
     */
    log(level, message, data = {}, error = null) {
        // 檢查日誌級別
        if (LOG_LEVELS[level] < this.logLevel) {
            return; // 不記錄低於設定級別的日誌
        }

        const logData = {
            timestamp: this.formatTimestamp(),
            level,
            message,
            data: typeof data === 'object' ? this.sanitizeBody(data) : data,
            error: error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : null,
            pid: process.pid,
            hostname: require('os').hostname()
        };

        // 寫入對應級別的日誌文件
        const logType = level.toLowerCase();
        this.writeLog(logType, logData);

        // 開發環境下輸出到控制台
        if (!this.isProduction) {
            this.consoleLog(level, message, data, error);
        }
    }

    /**
     * 控制台輸出（帶顏色）
     */
    consoleLog(level, message, data, error) {
        const config = LOG_LEVEL_CONFIG[level];
        const timestamp = new Date().toLocaleTimeString('zh-TW');

        console.log(
            `${config.color}${config.emoji} [${timestamp}] [${level}]${RESET_COLOR}`,
            message
        );

        if (data && Object.keys(data).length > 0) {
            console.log('  Data:', data);
        }

        if (error) {
            console.error('  Error:', error.message);
            if (error.stack) {
                console.error('  Stack:', error.stack);
            }
        }
    }

    /**
     * DEBUG 級別日誌
     */
    debug(message, data = {}) {
        this.log('DEBUG', message, data);
    }

    /**
     * INFO 級別日誌
     */
    info(message, data = {}) {
        this.log('INFO', message, data);
    }

    /**
     * WARN 級別日誌
     */
    warn(message, data = {}, error = null) {
        this.log('WARN', message, data, error);
    }

    /**
     * ERROR 級別日誌
     */
    error(message, data = {}, error = null) {
        this.log('ERROR', message, data, error);
    }

    /**
     * 業務日誌 - 用戶操作
     */
    business(action, data = {}) {
        const logData = {
            timestamp: this.formatTimestamp(),
            type: 'BUSINESS',
            action,
            data: this.sanitizeBody(data)
        };

        this.writeLog('business', logData);

        if (!this.isProduction) {
            console.log(`💼 [BUSINESS] ${action}:`, data);
        }
    }

    /**
     * 安全日誌 - 認證、授權相關
     */
    security(event, data = {}) {
        const logData = {
            timestamp: this.formatTimestamp(),
            type: 'SECURITY',
            event,
            data: this.sanitizeBody(data)
        };

        this.writeLog('security', logData);

        // 安全事件總是輸出到控制台
        console.warn(`🔒 [SECURITY] ${event}:`, data);
    }

    /**
     * 性能日誌
     */
    performance(operation, duration, data = {}) {
        const logData = {
            timestamp: this.formatTimestamp(),
            type: 'PERFORMANCE',
            operation,
            duration,
            data
        };

        this.writeLog('performance', logData);

        if (!this.isProduction && duration > 1000) {
            console.warn(`⏱️ [SLOW] ${operation}: ${duration}ms`, data);
        }
    }

    /**
     * 記錄訪問日誌
     */
    access(req, res) {
        const logData = {
            timestamp: this.formatTimestamp(),
            type: 'ACCESS',
            method: req.method,
            url: req.originalUrl || req.url,
            statusCode: res.statusCode,
            responseTime: res.get('X-Response-Time'),
            userAgent: req.get('User-Agent') || 'unknown',
            ip: this.getClientIP(req),
            referer: req.get('Referer') || 'direct',
            user: req.user ? {
                id: req.user.id,
                username: req.user.username
            } : null
        };

        this.writeLog('access', logData);
    }

    /**
     * 清理舊日誌文件 (保留最近 N 天)
     */
    cleanOldLogs(daysToKeep = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        fs.readdir(this.logDir, (err, files) => {
            if (err) {
                this.error('清理日誌失敗', { error: err.message });
                return;
            }

            let cleanedCount = 0;
            files.forEach(file => {
                const filepath = path.join(this.logDir, file);
                fs.stat(filepath, (err, stats) => {
                    if (err) return;

                    if (stats.mtime < cutoffDate) {
                        fs.unlink(filepath, (err) => {
                            if (!err) {
                                cleanedCount++;
                                this.info('清理舊日誌', { file, size: stats.size });
                            }
                        });
                    }
                });
            });

            if (cleanedCount > 0) {
                this.info(`清理了 ${cleanedCount} 個舊日誌文件`);
            }
        });
    }

    /**
     * 獲取日誌統計
     */
    getLogStats() {
        return new Promise((resolve, reject) => {
            fs.readdir(this.logDir, (err, files) => {
                if (err) {
                    reject(err);
                    return;
                }

                const stats = {
                    totalFiles: 0,
                    totalSize: 0,
                    byType: {}
                };

                let pending = files.length;
                if (pending === 0) {
                    resolve(stats);
                    return;
                }

                files.forEach(file => {
                    const filepath = path.join(this.logDir, file);
                    fs.stat(filepath, (err, fileStat) => {
                        if (!err) {
                            stats.totalFiles++;
                            stats.totalSize += fileStat.size;

                            const type = file.split('_')[0];
                            if (!stats.byType[type]) {
                                stats.byType[type] = { count: 0, size: 0 };
                            }
                            stats.byType[type].count++;
                            stats.byType[type].size += fileStat.size;
                        }

                        pending--;
                        if (pending === 0) {
                            resolve(stats);
                        }
                    });
                });
            });
        });
    }
}

// 創建單例實例
const logger = new Logger();

// 定期清理舊日誌 (每天執行一次)
setInterval(() => {
    logger.cleanOldLogs();
}, 24 * 60 * 60 * 1000);

module.exports = logger;
