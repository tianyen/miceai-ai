/**
 * 日誌記錄工具
 * 專門用於記錄 4xx 和 5xx 錯誤的 debug log
 */
const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '../logs');
        this.ensureLogDirectory();
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
     * 格式化日誌時間
     */
    formatTimestamp() {
        return new Date().toISOString();
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
        const logData = {
            timestamp: this.formatTimestamp(),
            type: '4xx_CLIENT_ERROR',
            statusCode,
            method: req.method,
            url: req.originalUrl || req.url,
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
        const date = new Date().toISOString().split('T')[0];
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
     * 記錄一般 debug 信息
     */
    debug(message, data = {}) {
        const logData = {
            timestamp: this.formatTimestamp(),
            type: 'DEBUG',
            message,
            data
        };

        this.writeLog('debug', logData);
        
        if (process.env.NODE_ENV !== 'production') {
            console.log(`🔍 Debug:`, message, data);
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
     * 清理舊日誌文件 (保留最近 30 天)
     */
    cleanOldLogs() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        fs.readdir(this.logDir, (err, files) => {
            if (err) return;
            
            files.forEach(file => {
                const filepath = path.join(this.logDir, file);
                fs.stat(filepath, (err, stats) => {
                    if (err) return;
                    
                    if (stats.mtime < thirtyDaysAgo) {
                        fs.unlink(filepath, (err) => {
                            if (!err) {
                                console.log(`Cleaned old log file: ${file}`);
                            }
                        });
                    }
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
