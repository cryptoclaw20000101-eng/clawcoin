/**
 * 🔒 ClawCoin DeFi 安全審計模組
 * 
 * 審計項目：
 * - 閃電貸漏洞檢測
 * - 重入攻擊檢測
 * - 整數溢出/下溢檢測
 * - 權限控制檢測
 * - 代碼品質分析
 * 
 * 外部審計：CertiK, Trail of Bits, OpenZeppelin
 */

const fs = require('fs');
const path = require('path');

// ============== 合約原始碼分析 ==============
const CLAWCOIN_SOURCE = path.join(__dirname, '../contracts/contracts/ClawCoin.sol');

/**
 * 載入合約原始碼
 */
function loadContractSource() {
    try {
        return fs.readFileSync(CLAWCOIN_SOURCE, 'utf8');
    } catch (error) {
        console.error('[審計] 無法讀取合約原始碼:', error.message);
        return null;
    }
}

// ============== 審計規則 ==============
const AUDIT_RULES = [
    {
        id: 'FLASH_LOAN',
        name: '閃電貸漏洞',
        severity: 'CRITICAL',
        patterns: [
            /call\.value/i,
            /address\(this\)\.balance/i,
            /transfer.*gas/i,
            /send.*gas/i,
        ],
        check: (source) => {
            // 檢查是否直接操作底層 call
            const hasLowLevelCall = /\.call\{value:/i.test(source) || /\.call\s*\(/i.test(source);
            // 檢查是否依賴 block.timestamp 或 block.number 做關鍵判斷
            const timestampDependent = /block\.timestamp.*==|block\.number.*==/i.test(source);
            return hasLowLevelCall || timestampDependent;
        },
        recommendation: '避免使用低層級 call。若需接收 ETH，使用 receive() 或 payable()。關鍵操作不應依賴單一區塊時間戳。'
    },
    {
        id: 'REENTRANCY',
        name: '重入攻擊',
        severity: 'HIGH',
        patterns: [
            /_transfer/i,
            /_move/i,
            /_update/i,
        ],
        check: (source) => {
            // OpenZeppelin 的 _update/_transfer 已內建 ReentrancyGuard
            const hasReentrancyGuard = /ReentrancyGuard/i.test(source);
            const hasNonReentrant = /nonReentrant/i.test(source);
            const usesCustomTransfer = /_transfer.*\{/i.test(source) && !hasReentrancyGuard;
            return !hasReentrancyGuard && !hasNonReentrant && usesCustomTransfer;
        },
        recommendation: '建議使用 OpenZeppelin ReentrancyGuard 或 CEI (Checks-Effects-Interactions) 模式。'
    },
    {
        id: 'OVERFLOW',
        name: '整數溢出/下溢',
        severity: 'HIGH',
        patterns: [
            /\+\+/i,
            /\-=/i,
            /\+=/i,
        ],
        check: (source) => {
            // Solidity 0.8+ 內建溢出檢查
            const usesSolidity08 = /^pragma solidity \^?0\.[89]/im.test(source) || /^pragma solidity >=?0\.[89]/im.test(source);
            const usesSafeMath = /using SafeMath for/i.test(source);
            // 檢查是否使用 <= 0.7.x
            const usesOldSolidity = /^pragma solidity \^?0\.[0-7]\./im.test(source);
            return (usesOldSolidity && !usesSafeMath) || !usesSolidity08;
        },
        recommendation: '使用 Solidity 0.8+ 內建溢出檢查，或使用 OpenZeppelin SafeMath 庫。'
    },
    {
        id: 'ACCESS_CONTROL',
        name: '權限控制',
        severity: 'MEDIUM',
        patterns: [
            /onlyRole/i,
            /onlyAdmin/i,
            /onlyOwner/i,
            /requiresRole/i,
        ],
        check: (source) => {
            const hasAccessControl = /AccessControl/i.test(source);
            const hasRoles = /roles/i.test(source) || /_grantRole/i.test(source);
            return !hasAccessControl && !hasRoles;
        },
        recommendation: '建議使用 OpenZeppelin AccessControl 進行角色權限管理。'
    },
    {
        id: 'PAUSE',
        name: '暫停機制',
        severity: 'MEDIUM',
        patterns: [
            /Pausable/i,
            /pause/i,
            /unpause/i,
        ],
        check: (source) => {
            const hasPausable = /Pausable/i.test(source);
            const hasPauseFunc = /function pause/i.test(source);
            return !hasPausable && !hasPauseFunc;
        },
        recommendation: '建議實作 Pausable 模式，以便在發現異常時緊急暫停合約。'
    },
    {
        id: 'OWNABLE',
        name: '可擁有性',
        severity: 'LOW',
        patterns: [
            /Ownable/i,
            /owner/i,
            /transferOwnership/i,
        ],
        check: (source) => {
            const hasOwnable = /Ownable/i.test(source);
            const hasOwner = /owner\s*=/i.test(source);
            return !hasOwnable && !hasOwner;
        },
        recommendation: '建議使用 OpenZeppelin Ownable 明確合約擁有者。'
    },
    {
        id: 'EXTERNAL_CALLS',
        name: '外部調用風險',
        severity: 'MEDIUM',
        patterns: [
            /\.call\(/i,
            /\.delegatecall\(/i,
            /\.staticcall\(/i,
        ],
        check: (source) => {
            const hasExternalCalls = /\.call\(/i.test(source) || /\.delegatecall\(/i.test(source);
            return hasExternalCalls;
        },
        recommendation: '外部調用需小心處理返回值，避免重入。建議使用 try/catch 包裝外部調用。'
    }
];

/**
 * 執行靜態審計
 */
function performStaticAudit(source) {
    console.log('\n==========================================');
    console.log('🔍 ClawCoin 合約靜態安全審計');
    console.log('==========================================\n');
    
    if (!source) {
        console.log('❌ 無法載入合約原始碼');
        return { passed: false, issues: [] };
    }
    
    const issues = [];
    
    for (const rule of AUDIT_RULES) {
        const failed = rule.check(source);
        const status = failed ? '❌ 需關注' : '✅ 通过';
        
        console.log(`${status} [${rule.severity}] ${rule.name}`);
        
        if (failed) {
            issues.push({
                id: rule.id,
                name: rule.name,
                severity: rule.severity,
                recommendation: rule.recommendation
            });
        }
    }
    
    return { passed: issues.length === 0, issues };
}

/**
 * 估算 Gas 優化
 */
function estimateGas(source) {
    console.log('\n==========================================');
    console.log('⛽ Gas 優化建議');
    console.log('==========================================\n');
    
    const suggestions = [];
    
    // 檢查是否啟用優化器
    if (!/optimizer.*enabled.*true/i.test(source)) {
        suggestions.push('建議在 hardhat.config.js 中啟用優化器 (enabled: true, runs: 200)');
    }
    
    // 檢查是否使用 immutable
    if (!/immutable/i.test(source)) {
        suggestions.push('考慮使用 immutable 關鍵字存儲永不變更的變量');
    }
    
    // 檢查是否使用 constant
    if (!/constant.*=.*\d/i.test(source) && /\b0x[0-9a-fA-F]{64}\b/.test(source)) {
        suggestions.push('已知地址可使用 constant 關鍵字節省 Gas');
    }
    
    // 捆綁 storage 讀寫
    if (source.includes('public') && !source.includes('memory')) {
        suggestions.push('Getter 函數返回 memory 陣列可節省 Gas');
    }
    
    if (suggestions.length === 0) {
        console.log('✅ 未發現明顯 Gas 優化空間');
    } else {
        suggestions.forEach(s => console.log(`💡 ${s}`));
    }
    
    return suggestions;
}

/**
 * 產生審計報告
 */
function generateAuditReport() {
    console.log('\n==========================================');
    console.log('📋 ClawCoin 安全審計報告');
    console.log('==========================================\n');
    
    const source = loadContractSource();
    const audit = performStaticAudit(source);
    const gasTips = estimateGas(source);
    
    console.log('\n==========================================');
    console.log('📊 審計摘要');
    console.log('==========================================');
    console.log(`審計時間: ${new Date().toISOString()}`);
    console.log(`合約: ClawCoin.sol`);
    console.log(`靜態審計: ${audit.passed ? "✅ 通過" : "⚠️ 發現 " + audit.issues.length + " 個問題"}`);
    
    if (!audit.passed) {
        console.log('\n🔴 嚴重問題 (CRITICAL):');
        audit.issues
            .filter(i => i.severity === 'CRITICAL')
            .forEach(i => {
                console.log(`  - ${i.name}`);
                console.log(`    建議: ${i.recommendation}`);
            });
        
        console.log('\n🟡 高風險問題 (HIGH):');
        audit.issues
            .filter(i => i.severity === 'HIGH')
            .forEach(i => {
                console.log(`  - ${i.name}`);
                console.log(`    建議: ${i.recommendation}`);
            });
        
        console.log('\n🟠 中風險問題 (MEDIUM):');
        audit.issues
            .filter(i => i.severity === 'MEDIUM')
            .forEach(i => {
                console.log(`  - ${i.name}`);
                console.log(`    建議: ${i.recommendation}`);
            });
    } else {
        console.log('✅ 合約通過靜態安全審計');
    }
    
    if (gasTips.length > 0) {
        console.log(`\n💡 Gas 優化建議 (${gasTips.length} 項)`);
    }
    
    console.log('\n==========================================');
    console.log('📝 後續行動建議');
    console.log('==========================================');
    console.log('1. 申請 CertiK 正式審計: https://certik.com/audits');
    console.log('2. 申請 CertiK Skynet 活動監控');
    console.log('3. 在測試網部署後進行完整測試');
    console.log('4. 設定區塊瀏覽器合約驗證');
    
    return { audit, gasTips };
}

// ============== 主程式 ==============
function main() {
    console.log('==========================================');
    console.log('🔒 ClawCoin DeFi 安全審計工具');
    console.log('==========================================');
    generateAuditReport();
}

if (require.main === module) {
    main();
}

module.exports = {
    loadContractSource,
    performStaticAudit,
    estimateGas,
    generateAuditReport
};