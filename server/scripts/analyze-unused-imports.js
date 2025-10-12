#!/usr/bin/env node
/**
 * 分析未使用的 imports 和 requires
 */

const fs = require('fs');
const path = require('path');

const results = {
    unusedImports: [],
    potentiallyUnusedFiles: [],
    summary: {}
};

// 要掃描的目錄
const dirsToScan = [
    'routes',
    'controllers',
    'middleware',
    'utils',
    'config'
];

// 排除的檔案
const excludeFiles = [
    'server.js',
    'package.json',
    'package-lock.json'
];

/**
 * 檢查檔案中的 require/import 是否被使用
 */
function analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const unused = [];

    lines.forEach((line, index) => {
        // 匹配 const xxx = require('...')
        const requireMatch = line.match(/const\s+(\{[^}]+\}|[\w,\s]+)\s*=\s*require\(['"]([^'"]+)['"]\)/);
        if (requireMatch) {
            const vars = requireMatch[1];
            
            // 解構賦值
            if (vars.startsWith('{')) {
                const destructured = vars.match(/\{([^}]+)\}/)[1]
                    .split(',')
                    .map(v => v.trim().split(':')[0].trim());
                
                destructured.forEach(varName => {
                    // 檢查變數是否在後續程式碼中使用
                    const restOfFile = lines.slice(index + 1).join('\n');
                    const usageRegex = new RegExp(`\\b${varName}\\b`, 'g');
                    const matches = restOfFile.match(usageRegex);
                    
                    if (!matches || matches.length === 0) {
                        unused.push({
                            line: index + 1,
                            variable: varName,
                            module: requireMatch[2],
                            fullLine: line.trim()
                        });
                    }
                });
            } else {
                // 普通賦值
                const varNames = vars.split(',').map(v => v.trim());
                varNames.forEach(varName => {
                    const restOfFile = lines.slice(index + 1).join('\n');
                    const usageRegex = new RegExp(`\\b${varName}\\b`, 'g');
                    const matches = restOfFile.match(usageRegex);
                    
                    if (!matches || matches.length === 0) {
                        unused.push({
                            line: index + 1,
                            variable: varName,
                            module: requireMatch[2],
                            fullLine: line.trim()
                        });
                    }
                });
            }
        }
    });

    return unused;
}

/**
 * 遞迴掃描目錄
 */
function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            scanDirectory(fullPath);
        } else if (file.endsWith('.js') && !excludeFiles.includes(file)) {
            const relativePath = path.relative(process.cwd(), fullPath);
            const unused = analyzeFile(fullPath);
            
            if (unused.length > 0) {
                results.unusedImports.push({
                    file: relativePath,
                    unused: unused
                });
            }
        }
    });
}

// 執行掃描
console.log('🔍 開始掃描未使用的 imports...\n');

dirsToScan.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    if (fs.existsSync(fullPath)) {
        console.log(`📁 掃描 ${dir}/`);
        scanDirectory(fullPath);
    }
});

// 輸出結果
console.log('\n' + '='.repeat(80));
console.log('📊 分析結果');
console.log('='.repeat(80) + '\n');

if (results.unusedImports.length === 0) {
    console.log('✅ 沒有發現未使用的 imports！');
} else {
    console.log(`⚠️  發現 ${results.unusedImports.length} 個檔案包含未使用的 imports:\n`);
    
    results.unusedImports.forEach(({ file, unused }) => {
        console.log(`📄 ${file}`);
        unused.forEach(({ line, variable, module, fullLine }) => {
            console.log(`   Line ${line}: ${variable} from '${module}'`);
            console.log(`   ${fullLine}`);
        });
        console.log('');
    });
}

// 儲存結果到 JSON
const outputPath = path.join(process.cwd(), 'scripts', 'unused-imports-report.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`\n💾 詳細報告已儲存至: ${outputPath}`);

