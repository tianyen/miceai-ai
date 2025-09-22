#!/usr/bin/env node
/**
 * 日誌查看工具
 * 用於查看和分析錯誤日誌
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const logsDir = path.join(__dirname, '../logs');

// 顏色輸出
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function colorize(text, color) {
    return `${colors[color]}${text}${colors.reset}`;
}

function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString('zh-TW');
}

function displayLogEntry(entry) {
    try {
        const log = JSON.parse(entry);
        
        console.log(colorize('─'.repeat(80), 'cyan'));
        console.log(colorize(`[${formatTimestamp(log.timestamp)}]`, 'blue'), 
                   colorize(log.type, log.type.includes('4xx') ? 'yellow' : 'red'));
        
        if (log.statusCode) {
            console.log(colorize('Status:', 'magenta'), log.statusCode);
        }
        
        console.log(colorize('Method:', 'magenta'), log.method);
        console.log(colorize('URL:', 'magenta'), log.url);
        console.log(colorize('IP:', 'magenta'), log.ip);
        
        if (log.user) {
            console.log(colorize('User:', 'magenta'), `${log.user.username} (ID: ${log.user.id})`);
        }
        
        if (log.message) {
            console.log(colorize('Message:', 'magenta'), log.message);
        }
        
        if (log.error && log.error.message) {
            console.log(colorize('Error:', 'red'), log.error.message);
            if (log.error.stack && process.argv.includes('--stack')) {
                console.log(colorize('Stack:', 'red'));
                console.log(log.error.stack);
            }
        }
        
        if (log.userAgent) {
            console.log(colorize('User-Agent:', 'magenta'), log.userAgent);
        }
        
        console.log();
    } catch (e) {
        console.log(colorize('Invalid log entry:', 'red'), entry);
    }
}

function listLogFiles() {
    try {
        const files = fs.readdirSync(logsDir)
            .filter(file => file.endsWith('.log'))
            .sort()
            .reverse();
        
        console.log(colorize('Available log files:', 'green'));
        files.forEach((file, index) => {
            const stats = fs.statSync(path.join(logsDir, file));
            console.log(`${index + 1}. ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
        });
        
        return files;
    } catch (error) {
        console.error(colorize('Error reading logs directory:', 'red'), error.message);
        return [];
    }
}

async function viewLogFile(filename, options = {}) {
    const filepath = path.join(logsDir, filename);
    
    if (!fs.existsSync(filepath)) {
        console.error(colorize('Log file not found:', 'red'), filename);
        return;
    }
    
    console.log(colorize(`Viewing log file: ${filename}`, 'green'));
    console.log(colorize('Press Ctrl+C to exit', 'yellow'));
    console.log();
    
    const fileStream = fs.createReadStream(filepath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });
    
    let count = 0;
    const maxLines = options.lines || Infinity;
    
    for await (const line of rl) {
        if (line.trim()) {
            displayLogEntry(line);
            count++;
            
            if (count >= maxLines) {
                break;
            }
            
            // 分頁顯示
            if (count % 10 === 0 && !options.noPage) {
                await new Promise(resolve => {
                    process.stdout.write(colorize('Press Enter to continue...', 'yellow'));
                    process.stdin.once('data', resolve);
                });
                console.log();
            }
        }
    }
    
    console.log(colorize(`Total entries displayed: ${count}`, 'green'));
}

function showUsage() {
    console.log(colorize('日誌查看工具使用說明:', 'green'));
    console.log();
    console.log('查看所有可用的日誌文件:');
    console.log('  node scripts/view-logs.js');
    console.log();
    console.log('查看特定日誌文件:');
    console.log('  node scripts/view-logs.js <filename>');
    console.log();
    console.log('選項:');
    console.log('  --lines <n>    只顯示最後 n 行');
    console.log('  --stack        顯示錯誤堆棧信息');
    console.log('  --no-page      不分頁顯示');
    console.log();
    console.log('範例:');
    console.log('  node scripts/view-logs.js 4xx_errors_2024-08-11.log');
    console.log('  node scripts/view-logs.js 5xx_errors_2024-08-11.log --lines 20 --stack');
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        showUsage();
        return;
    }
    
    const filename = args.find(arg => !arg.startsWith('--'));
    const options = {
        lines: args.includes('--lines') ? parseInt(args[args.indexOf('--lines') + 1]) : undefined,
        stack: args.includes('--stack'),
        noPage: args.includes('--no-page')
    };
    
    if (!filename) {
        const files = listLogFiles();
        if (files.length === 0) {
            console.log(colorize('No log files found.', 'yellow'));
            return;
        }
        
        console.log();
        console.log(colorize('Usage: node scripts/view-logs.js <filename>', 'yellow'));
        return;
    }
    
    await viewLogFile(filename, options);
}

// 處理 Ctrl+C
process.on('SIGINT', () => {
    console.log(colorize('\nExiting...', 'yellow'));
    process.exit(0);
});

main().catch(console.error);
