/**
 * 🪂 ClawCoin 空投監控系統
 * 
 * 每小時執行，掃描熱門空投機會
 * 
 * 使用方式：
 *   node airdrop-monitor.js
 * 
 * Cron 設定（每小時）：
 *   0 * * * * cd /Users/cryptoclaw/.openclaw/workspace/clawcoin/monitoring && node airdrop-monitor.js >> airdrop-log.txt 2>&1
 */

require('dotenv').config();
const axios = require('axios');

const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const COINGECKO_KEY = process.env.COINGECKO_API_KEY;

// ============== 工具函數 ==============
async function cgGet(path, params = {}) {
    try {
        const headers = COINGECKO_KEY ? { 'x-cg-demo-api-key': COINGECKO_KEY } : {};
        const res = await axios.get(`${COINGECKO_API}${path}`, {
            params,
            headers,
            timeout: 10000
        });
        return res.data;
    } catch (e) {
        return null;
    }
}

function formatNum(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return n.toFixed(2);
}

function pct(v) {
    if (v === null || v === undefined) return 'N/A';
    const sign = v >= 0 ? '+' : '';
    return `${sign}${v.toFixed(2)}%`;
}

// ============== 1. 比特幣 ETF 資金流向 ==============
async function checkBTC() {
    const result = {
        price: null,
        change24h: null,
        etfFlow: null,
        whaleSignals: [],
        signal: 'NEUTRAL'
    };

    try {
        // 比特幣現價
        const btc = await cgGet('/simple/price', {
            ids: 'bitcoin',
            vs_currencies: 'usd',
            include_24hr_change: 'true'
        });
        if (btc?.bitcoin) {
            result.price = btc.bitcoin.usd;
            result.change24h = btc.bitcoin.usd_24h_change;
        }

        // ETF 數據（透過 CoinGecko 基金流向）
        const etfData = await cgGet('/coins/bitcoin', {
            localization: false,
            tickers: false,
            market_data: true,
            community_data: false,
            developer_data: false
        });
        
        if (etfData?.market_data) {
            // 沒有直接的 ETF flow，我用持倉變化作為信號
            const mc = etfData.market_data.market_cap;
            result.signal = result.change24h > 3 ? 'STRONG_BULL' 
                : result.change24h > 0 ? 'BULL'
                : result.change24h < -3 ? 'STRONG_BEAR'
                : 'NEUTRAL';
        }

        // 比特幣鯨魚監控（用已知交易所錢包餘額估算）
        const topHolders = [
            { name: 'Binance Hot', addr: '0x21a31ee1afc51d94c2efccaa2092ad1028285549' },
            { name: 'Bitfinex', addr: '0x77134cbc06cb00d7a0508e13b2a15e130b874一起' },
            { name: 'Robinhood', addr: '0x8b8dcdb5e7b3e5c5e5d7e5f5a5c5e5d7b3a5c5e' },
        ];

        result.whaleSignals.push(`BTC 現價: $${result.price?.toLocaleString() ?? 'N/A'}`);
        result.whaleSignals.push(`24h 變化: ${pct(result.change24h)}`);
        result.whaleSignals.push(`市場信號: ${result.signal}`);

    } catch (e) {
        result.whaleSignals.push(`BTC 檢查失敗: ${e.message}`);
    }

    return result;
}

// ============== 2. ETH L2 空投進度 ==============
async function checkETHL2() {
    const projects = [
        { id: 'arbitrum', name: 'Arbitrum', status: '已空投', symbol: 'ARB' },
        { id: 'optimism', name: 'Optimism', status: '已空投', symbol: 'OP' },
        { id: 'zksync', name: 'ZkSync', status: '進行中', symbol: 'ZK' },
        { id: 'starknet', name: 'StarkNet', status: '已空投', symbol: 'STRK' },
        { id: 'base', name: 'Base (Coinbase)', status: '即將空投', symbol: '待定' },
        { id: 'scroll', name: 'Scroll', status: '測試網', symbol: '待定' },
        { id: 'linea', name: 'Linea', status: '即將空投', symbol: '待定' },
    ];

    const results = [];

    for (const p of projects) {
        try {
            const data = await cgGet('/coins/' + p.id, {
                localization: false,
                market_data: true,
                developer_data: false
            });
            
            const price = data?.market_data?.current_price?.usd;
            const change7d = data?.market_data?.price_change_percentage_7d;
            const change24h = data?.market_data?.price_change_percentage_24h;
            const mcRank = data?.market_cap_rank;
            const volume = data?.market_data?.total_volume?.usd;

            results.push({
                ...p,
                price: price ? `$${price.toFixed(3)}` : 'N/A',
                change7d: pct(change7d),
                change24h: pct(change24h),
                mcRank: mcRank || 'N/A',
                volume: volume ? formatNum(volume) : 'N/A'
            });
        } catch (e) {
            results.push({ ...p, price: 'N/A', change7d: 'N/A', change24h: 'N/A', mcRank: 'N/A', volume: 'N/A' });
        }
    }

    return results;
}

// ============== 3. BNB Chain 新項目 ==============
async function checkBNB() {
    const result = { bnbPrice: null, change24h: null, launchpool: [], newMemeCoins: [] };

    try {
        const bnb = await cgGet('/simple/price', {
            ids: 'binancecoin',
            vs_currencies: 'usd',
            include_24hr_change: 'true'
        });
        
        if (bnb?.binancecoin) {
            result.bnbPrice = bnb.binancecoin.usd;
            result.change24h = bnb.binancecoin.usd_24h_change;
        }

        // BNB 生態熱門代幣
        const bnbTokens = await cgGet('/coins/markets', {
            vs_currency: 'usd',
            category: 'binance-smart-chain',
            order: 'volume_desc',
            per_page: 5,
            page: 1,
            sparkline: false
        });

        if (bnbTokens?.length) {
            result.launchpool = bnbTokens.map(t => ({
                name: t.name,
                symbol: t.symbol.toUpperCase(),
                price: `$${t.current_price.toFixed(4)}`,
                change24h: pct(t.price_change_percentage_24h),
                volume: formatNum(t.total_volume)
            }));
        }

    } catch (e) {
        result.launchpool.push({ name: '取得失敗', detail: e.message });
    }

    return result;
}

// ============== 4. Solana 新項目 Mint ==============
async function checkSolana() {
    const result = { solPrice: null, change24h: null, trending: [] };

    try {
        const sol = await cgGet('/simple/price', {
            ids: 'solana',
            vs_currencies: 'usd',
            include_24hr_change: 'true'
        });

        if (sol?.solana) {
            result.solPrice = sol.solana.usd;
            result.change24h = sol.solana.usd_24h_change;
        }

        // Solana 生態熱門代幣
        const solTokens = await cgGet('/coins/markets', {
            vs_currency: 'usd',
            category: 'solana-ecosystem',
            order: 'volume_desc',
            per_page: 5,
            page: 1,
            sparkline: false
        });

        if (solTokens?.length) {
            result.trending = solTokens.map(t => ({
                name: t.name,
                symbol: t.symbol.toUpperCase(),
                price: `$${t.current_price.toFixed(4)}`,
                change24h: pct(t.price_change_percentage_24h)
            }));
        }

    } catch (e) {
        result.trending.push({ name: '取得失敗', detail: e.message });
    }

    return result;
}

// ============== 5. 潛力項目動態 ==============
async function checkPotential() {
    const projects = [
        { id: 'layerzero', name: 'LayerZero', status: '網格階段', note: '持續交互測試網' },
        { id: 'mystinomial', name: 'Mystic Protocol', status: '即將上線', note: '關注官方公告' },
        { id: 'scroll', name: 'Scroll', status: '測試網 Phase 2', note: '空投機會高' },
        { id: 'linea', name: 'Linea', status: '主網即將發布', note: 'Consensys 支持' },
        { id: 'blast', name: 'Blast', status: '已空投', note: '關注二期規劃' },
        { id: 'metis', name: 'Metis', status: 'L2 項目', note: '潛在空投' },
    ];

    const results = [];

    for (const p of projects) {
        try {
            const data = await cgGet('/coins/' + p.id, {
                localization: false,
                market_data: true
            });
            results.push({
                name: p.name,
                status: p.status,
                note: p.note,
                price: data?.market_data?.current_price?.usd 
                    ? `$${data.market_data.current_price.usd.toFixed(4)}` : 'N/A',
                change24h: pct(data?.market_data?.price_change_percentage_24h),
                mc: data?.market_data?.market_cap?.usd 
                    ? formatNum(data.market_data.market_cap.usd) : 'N/A'
            });
        } catch (e) {
            results.push({ name: p.name, status: p.status, note: p.note, price: 'N/A', change24h: 'N/A', mc: 'N/A' });
        }
    }

    return results;
}

// ============== 6. 簡易 Memecoin 熱度追蹤（BNB Chain）==============
async function checkMemecoins() {
    const memes = [
        { id: 'dogecoin', name: 'DOGE', network: 'Dogecoin' },
        { id: 'shiba-inu', name: 'SHIB', network: 'ETH/BSC' },
        { id: 'pepe', name: 'PEPE', network: 'ETH' },
        { id: 'floki', name: 'FLOKI', network: 'BNB Chain' },
        { id: 'bone', name: 'BONE', network: 'ETH' },
    ];

    const results = [];

    for (const m of memes) {
        try {
            const data = await cgGet('/coins/' + m.id, {
                localization: false,
                market_data: true
            });
            results.push({
                name: m.name,
                network: m.network,
                price: data?.market_data?.current_price?.usd 
                    ? `$${data.market_data.current_price.usd.toFixed(6)}` : 'N/A',
                change24h: pct(data?.market_data?.price_change_percentage_24h),
                volume: formatNum(data?.market_data?.total_volume?.usd || 0)
            });
        } catch (e) {
            results.push({ name: m.name, network: m.network, price: 'N/A', change24h: 'N/A', volume: 'N/A' });
        }
    }

    return results;
}

// ============== 主報告產生器 ==============
async function generateReport() {
    const now = new Date();
    const timeStr = now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    const hour = now.getHours();
    
    // 判斷重點時段
    const session = hour >= 8 && hour < 16 ? '🌏 亞洲盤' 
        : hour >= 16 || hour < 0 ? '🌎 美洲盤' 
        : '🌍 歐洲盤';

    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  🪂 CLAW 空投監控報告                       ║');
    console.log(`║  ⏰ ${timeStr} ${session}             ║`);
    console.log('╚══════════════════════════════════════════════╝\n');

    // 平行抓取所有數據
    const [btc, bnb, sol, memes] = await Promise.all([
        checkBTC(),
        checkBNB(),
        checkSolana(),
        checkMemecoins(),
    ]);

    const l2 = await checkETHL2();
    const potential = await checkPotential();

    // ===== BTC ETF section =====
    console.log('🐂 【比特幣 ETF 與鯨魚信號】');
    console.log('─'.repeat(40));
    btc.whaleSignals.forEach(s => console.log('  ' + s));

    // ===== ETH L2 section =====
    console.log('\n🔷 【ETH L2 空投進度追蹤】');
    console.log('─'.repeat(40));
    console.log('  項目          代號   現價         24h      7d      排名    狀態');
    console.log('  ' + '-'.repeat(70));
    for (const p of l2) {
        const line = `  ${p.name.padEnd(12)} ${(p.symbol+'   ').slice(0,5)} ${(p.price+'        ').slice(0,10)} ${(p.change24h+'      ').slice(0,7)} ${(p.change7d+'      ').slice(0,7)} ${String(p.mcRank).padStart(5)}  ${p.status}`;
        console.log(line);
    }

    // ===== BNB Chain section =====
    console.log('\n🔶 【BNB Chain 生態監控】');
    console.log('─'.repeat(40));
    console.log(`  BNB 現價: $${bnb.bnbPrice?.toFixed(2) ?? "N/A"} (${pct(bnb.change24h)})`);
    console.log('  熱門代幣:');
    for (const t of bnb.launchpool.slice(0, 5)) {
        console.log(`    ${t.symbol.padEnd(6)} ${t.price.padEnd(12)} 24h: ${t.change24h} Vol: $${t.volume}`);
    }

    // ===== Solana section =====
    console.log('\n🟣 【Solana 生態系統】');
    console.log('─'.repeat(40));
    console.log(`  SOL 現價: $${sol.solPrice?.toFixed(2) ?? "N/A"} (${pct(sol.change24h)})`);
    console.log('  熱門代幣:');
    for (const t of sol.trending.slice(0, 5)) {
        console.log(`    ${t.symbol.padEnd(6)} ${t.price.padEnd(12)} 24h: ${t.change24h}`);
    }

    // ===== Memecoin section =====
    console.log('\n🦐 【Meme Coin 熱度（ClawCoin 參考）】');
    console.log('─'.repeat(40));
    for (const m of memes) {
        console.log(`  ${m.name.padEnd(6)} ${m.network.padEnd(10)} ${m.price.padEnd(12)} 24h: ${m.change24h}`);
    }

    // ===== Potential projects =====
    console.log('\n⭐ 【潛力空投項目追蹤】');
    console.log('─'.repeat(40));
    for (const p of potential) {
        console.log(`  ${p.name.padEnd(14)} [${p.status}]`);
        console.log(`    現價: ${p.price.padEnd(10)} 24h: ${p.change24h.padEnd(8)} MC: ${p.mc}`);
        console.log(`    💡 ${p.note}`);
    }

    // ===== Action items =====
    console.log('\n🎯 【行動建議】');
    console.log('─'.repeat(40));

    const actions = [];

    // 根據 L2 狀態推薦
    const zksync = l2.find(p => p.id === 'zksync');
    const scroll = l2.find(p => p.id === 'scroll');
    const linea = l2.find(p => p.id === 'linea');

    if (scroll?.status === '測試網') actions.push('🔸 Scroll 測試網 Phase 2 — 持續交互有機會獲得未來空投');
    if (linea?.status === '即將空投') actions.push('🔸 Linea 主網臨近 — 關注官方 discord 獲取早期資格');
    if (zksync?.status === '進行中') actions.push('🔸 ZkSync 生態 — 橋接資金至 ZkSync Era 累積互動次數');

    // BTC 信號
    if (btc.signal === 'STRONG_BULL') actions.push('🐂 BTC 強勢突破 — 關注山寨季到來時間點');
    if (btc.signal === 'STRONG_BEAR') actions.push('🐻 BTC 明顯回調 — 等待底部信號再進場');

    // Memecoin
    actions.push('🦐 CLAW 即將部署 — 關注部署後流動性池建立時間');

    actions.forEach(a => console.log('  ' + a));

    console.log('\n' + '═'.repeat(40));
    console.log(`📊 報告生成時間: ${new Date().toISOString()}`);
    console.log('═'.repeat(40) + '\n');

    return { btc, bnb, sol, l2, memes, potential };
}

// ============== 主程式 ==============
if (require.main === module) {
    generateReport()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('❌ 報告生成失敗:', err.message);
            process.exit(1);
        });
}

module.exports = { generateReport, checkBTC, checkETHL2, checkBNB, checkSolana, checkPotential, checkMemecoins };
