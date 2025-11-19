#!/usr/bin/env node

/**
 * 遷移腳本：將 console.log 替換為 logger
 * 
 * 使用方式:
 * node scripts/migrate-to-logger.js --dry-run  # 預覽變更
 * node scripts/migrate-to-logger.js            # 執行變更
 */

const fs = require('fs');
const path = require('path');

const isDryRun = process.argv.includes('--dry-run');

// 需要掃描的目錄
const dirsToScan = [
    'server/routes',
    'server/middleware',
    'server/utils',
    'server/config'
];

// 替換規則
const replacementRules = [
    {
        pattern: /console\.log\(/g,
        replacement: 'logger.info(',
        description: 'console.log → logger.info'
    },
    {
        pattern: /console\.error\(/g,
        replacement: 'logger.error(',
        description: 'console.error → logger.error'
    },
    {
        pattern: /console\.warn\(/g,
        replacement: 'logger.warn(',
        description: 'console.warn → logger.warn'
    },
    {
        pattern: /console\.debug\(/g,
        replacement: 'logger.debug(',
        description: 'console.debug → logger.debug'
    }
];

// 統計
const stats = {
    filesScanned: 0,
    filesModified: 0,
    replacements: 0
};

/**
 * 掃描目錄中的所有 JS 文件
 */
function scanDirectory(dir) {
    const files = [];
    
    function scan(currentDir) {
        const items = fs.readdirSync(currentDir);
        
        items.forEach(item => {
            const fullPath = path.join(currentDir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                scan(fullPath);
            } else if (item.endsWith('.js')) {
                files.push(fullPath);
            }
        });
    }
    
    scan(dir);
    return files;
}

/**
 * 處理單個文件
 */
function processFile(filepath) {
    stats.filesScanned++;
    
    let content = fs.readFileSync(filepath, 'utf8');
    let modified = false;
    let replacementCount = 0;
    
    // 檢查是否已經引入 logger
    const hasLoggerImport = content.includes("require('../utils/logger')") ||
                           content.includes("require('../../utils/logger')") ||
                           content.includes("require('../../../utils/logger')");
    
    // 應用替換規則
    replacementRules.forEach(rule => {
        const matches = content.match(rule.pattern);
        if (matches) {
            content = content.replace(rule.pattern, rule.replacement);
            replacementCount += matches.length;
            modified = true;
        }
    });
    
    if (modified) {
        stats.filesModified++;
        stats.replacements += replacementCount;
        
        // 如果沒有引入 logger，添加引入語句
        if (!hasLoggerImport) {
            // 計算相對路徑
            const relativePath = path.relative(path.dirname(filepath), path.join(__dirname, '../utils/logger.js'));
            const importPath = relativePath.startsWith('.') ? relativePath : './' + relativePath;
            
            // 在文件開頭添加 logger 引入
            const lines = content.split('\n');
            let insertIndex = 0;
            
            // 找到最後一個 require 語句的位置
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('require(')) {
                    insertIndex = i + 1;
                }
            }
            
            lines.splice(insertIndex, 0, `const logger = require('${importPath.replace(/\\/g, '/')}');`);
            content = lines.join('\n');
        }
        
        console.log(`${isDryRun ? '[DRY RUN]' : '✅'} ${filepath}`);
        console.log(`  替換了 ${replacementCount} 處`);
        
        if (!isDryRun) {
            fs.writeFileSync(filepath, content, 'utf8');
        }
    }
}

/**
 * 主函數
 */
function main() {
    console.log('🔍 開始掃描文件...\n');
    
    if (isDryRun) {
        console.log('⚠️  DRY RUN 模式：不會實際修改文件\n');
    }
    
    dirsToScan.forEach(dir => {
        const fullPath = path.join(__dirname, '..', dir);
        
        if (!fs.existsSync(fullPath)) {
            console.log(`⚠️  目錄不存在: ${dir}`);
            return;
        }
        
        console.log(`📁 掃描目錄: ${dir}`);
        const files = scanDirectory(fullPath);
        
        files.forEach(file => {
            processFile(file);
        });
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 統計結果');
    console.log('='.repeat(60));
    console.log(`掃描文件數: ${stats.filesScanned}`);
    console.log(`修改文件數: ${stats.filesModified}`);
    console.log(`替換次數: ${stats.replacements}`);
    console.log('='.repeat(60));
    
    if (isDryRun) {
        console.log('\n💡 提示: 移除 --dry-run 參數以執行實際變更');
    } else {
        console.log('\n✅ 遷移完成！');
    }
}

// 執行
main();

