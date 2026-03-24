/**
 * 🐋 ClawCoin 鯨魚監控系統
 * 
 * 資料來源：
 * - DeBank API: https://api.debank.com
 * - Whale Alert API: https://api.whale-alert.io
 * 
 * 監控目標：
 * - BNB Chain 大戶（>1000 BNB）
 * - BEP-20 代幣大額轉帳
 * - 交易所資金流入/流出
 */

require('dotenv').config();
const axios = require('axios');

// ============== DeBank API ==============
const DEBANK_API = 'https://api.debank.com';
const DEBANK_API_KEY = process.env.DEBANK_API_KEY || '';

/**
 * 取得錢包餘額
 */
async function getWalletPortfolio(address) {
    try {
        const response = await axios.get(`${DEBANK_API}/v1/user/portfolio`, {
            params: { 
                id: address,
                api_key: DEBANK_API_KEY
            },
            timeout: 10000
        });
        return response.data;
    } catch (error) {
        console.error(`[DeBank] 取得錢包 ${address} 失敗:`, error.message);
        return null;
    }
}

/**
 * 取得錢包持有的代幣列表
 */
async function getWalletTokens(address) {
    try {
        const response = await axios.get(`${DEBANK_API}/v1/user/token_list`, {
            params: { 
                id: address,
                api_key: DEBANK_API_KEY
            },
            timeout: 10000
        });
        return response.data;
    } catch (error) {
        console.error(`[DeBank] 取得代幣列表失敗:`, error.message);
        return null;
    }
}

/**
 * 取得 BNB Chain 區塊鏈數據（透過 Covalent API）
 */
const COVALENT_API = 'https://api.covalenthq.com/v1';
const COVALENT_API_KEY = process.env.COVALENT_API_KEY || '';

/**
 * 取得錢包餘額（Covalent）
 */
async function getCovalentBalance(address, chainId = '56') {
    try {
        const response = await axios.get(
            `${COVALENT_API}/${chainId}/address/${address}/balance_v2/`,
            {
                params: { 'key': COVALENT_API_KEY },
                timeout: 10000
            }
        );
        return response.data;
    } catch (error) {
        console.error(`[Covalent] 取得餘額失敗:`, error.message);
        return null;
    }
}

/**
 * 取得代幣轉帳歷史
 */
async function getTokenTransfers(address, chainId = '56') {
    try {
        const response = await axios.get(
            `${COVALENT_API}/${chainId}/address/${address}/transfers_v2/`,
            {
                params: { 
                    'key': COVALENT_API_KEY,
                    'contract-address': '0x...' // CLAW 合約位址
                },
                timeout: 10000
            }
        );
        return response.data;
    } catch (error) {
        console.error(`[Covalent] 取得轉帳歷史失敗:`, error.message);
        return null;
    }
}

// ============== Whale Alert API ==============
const WHALE_ALERT_API = 'https://api.whale-alert.io/v1';
const WHALE_ALERT_API_KEY = process.env.WHALE_ALERT_API_KEY || '';

/**
 * 取得最近鯨魚交易
 */
async function getWhaleTransactions(minValue = 1000000) {
    try {
        const response = await axios.get(`${WHALE_ALERT_API}/transactions`, {
            params: {
                'api_key': WHALE_ALERT_API_KEY,
                'min_value': minValue,
                'blockchain': 'binance_smart_chain'
            },
            timeout: 10000
        });
        return response.data;
    } catch (error) {
        console.error(`[Whale Alert] 取得交易失敗:`, error.message);
        return null;
    }
}

// ============== BNB Chain 大戶列表 ==============
const KNOWN_BSC_WHALES = [
    '0x8894e0a05b1d3e2075b9d0e9e9f7c0a0c7b3d5e9', // 範例：交易所熱錢包
    '0x713bd6dda19775d70834e7b134f2b5cff3a07c9f',
    '0x21a31ee1afc51d94c2efccaa2092ad1028285549', // Binance: Binance Hot Wallet 4
    '0x9696f8f2f1d40c0d1e8f9c0b3a7d5e9f2a1c3b5d',
];

/**
 * 監控名單內的鯨魚錢包
 */
async function monitorKnownWhales() {
    console.log('\n🐋 開始監控 BNB Chain 鯨魚錢包...\n');
    
    for (const address of KNOWN_BSC_WHALES) {
        const portfolio = await getCovalentBalance(address);
        if (portfolio?.data?.items) {
            const bnbBalance = portfolio.data.items.find(
                item => item.contract_ticker_symbol === 'BNB'
            );
            const balance = bnbBalance ? parseFloat(bnbBalance.balance) / 1e18 : 0;
            
            if (balance > 10) { // 只顯示 >10 BNB 的錢包
                console.log(`💰 ${address.slice(0, 10)}... | BNB: ${balance.toFixed(2)}`);
            }
        }
        await new Promise(r => setTimeout(r, 500)); // 避免 API 限制
    }
}

// ============== Alert 系統 ==============
/**
 * 發送 Alert（目前支援：Telegram / Console）
 */
function sendAlert(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const emoji = {
        'INFO': 'ℹ️',
        'WARNING': '⚠️',
        'ALERT': '🚨',
        'SUCCESS': '✅'
    }[type] || 'ℹ️';
    
    const formatted = `[${timestamp}] ${emoji} [${type}] ${message}`;
    console.log(formatted);
    
    // TODO: 整合 Telegram Bot
    // TODO: 儲存到日誌檔案
}

/**
 * 監控大額轉帳
 */
async function watchLargeTransfers() {
    console.log('\n👀 監控 BNB Chain 大額轉帳...\n');
    
    const txns = await getWhaleTransactions(500000); // >50萬美元
    if (txns?.transactions?.length > 0) {
        for (const tx of txns.transactions) {
            const amount = tx.amount_usd ? `$${(tx.amount_usd / 1e6).toFixed(2)}M` : 'N/A';
            const symbol = tx.symbol || 'UNKNOWN';
            console.log(`🐋 ${symbol} | ${amount} | ${tx.from?.address?.slice(0,10)}... → ${tx.to?.address?.slice(0,10)}...`);
        }
    }
}

// ============== 主程式 ==============
async function main() {
    console.log('==========================================');
    console.log('🐋 ClawCoin 鯨魚監控系統啟動');
    console.log('==========================================\n');
    
    // 單次監控
    await monitorKnownWhales();
    await watchLargeTransfers();
    
    // 每 5 分鐘輪詢（生產環境）
    // setInterval(async () => {
    //     await monitorKnownWhales();
    //     await watchLargeTransfers();
    // }, 5 * 60 * 1000);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    getWalletPortfolio,
    getWalletTokens,
    getCovalentBalance,
    getWhaleTransactions,
    monitorKnownWhales,
    watchLargeTransfers,
    sendAlert
};
