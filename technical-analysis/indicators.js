/**
 * 📈 ClawCoin 技術分析模組
 * 
 * 支援指標：
 * - MACD（移動平均收斂發散）
 * - RSI（相對強弱指數）
 * - KDJ（隨機指標）
 * - A/D（累積/分配指標）
 * - 成交量背離偵測
 * 
 * 資料來源：CoinGecko API
 */

require('dotenv').config();
const axios = require('axios');

const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || '';

// ============== 工具函數 ==============

/**
 * 計算簡單移動平均線 (SMA)
 */
function calculateSMA(prices, period) {
    const sma = [];
    for (let i = period - 1; i < prices.length; i++) {
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        sma.push(sum / period);
    }
    return sma;
}

/**
 * 計算指數移動平均線 (EMA)
 */
function calculateEMA(prices, period) {
    const k = 2 / (period + 1);
    const ema = [prices[0]];
    
    for (let i = 1; i < prices.length; i++) {
        ema.push(prices[i] * k + ema[i - 1] * (1 - k));
    }
    return ema;
}

// ============== MACD ==============
/**
 * 計算 MACD
 * @param {number[]} prices - 價格陣列
 * @param {number} fastPeriod - 快線週期（預設12）
 * @param {number} slowPeriod - 慢線週期（預設26）
 * @param {number} signalPeriod - 信號線週期（預設9）
 */
function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const fastEMA = calculateEMA(prices, fastPeriod);
    const slowEMA = calculateEMA(prices, slowPeriod);
    
    // MACD Line = Fast EMA - Slow EMA
    const macdLine = fastEMA.map((fast, i) => fast - slowEMA[i]);
    
    // Signal Line = MACD 的 9 日 EMA
    const signalLine = calculateEMA(macdLine, signalPeriod);
    
    // Histogram = MACD Line - Signal Line
    const histogram = macdLine.map((macd, i) => macd - signalLine[i]);
    
    return {
        macd: macdLine,
        signal: signalLine,
        histogram: histogram,
        latest: {
            macd: macdLine[macdLine.length - 1],
            signal: signalLine[signalLine.length - 1],
            histogram: histogram[histogram.length - 1]
        }
    };
}

/**
 * MACD 信號分析
 */
function analyzeMACD(macdResult) {
    const { macd, signal: macdSignal, histogram, latest } = macdResult;
    const prevHistogram = histogram[histogram.length - 2];
    
    let signalName = 'NEUTRAL';
    let strength = 0;
    
    // 金叉：MACD 從下穿越 Signal
    if (histogram[histogram.length - 1] > 0 && prevHistogram <= 0) {
        signalName = 'BUY';
        strength = Math.min(Math.abs(latest.histogram) * 10, 100);
    }
    // 死叉：MACD 從上穿越 Signal
    else if (histogram[histogram.length - 1] < 0 && prevHistogram >= 0) {
        signalName = 'SELL';
        strength = Math.min(Math.abs(latest.histogram) * 10, 100);
    }
    // MACD > 0 且上升
    else if (latest.macd > 0 && latest.histogram > 0) {
        signalName = 'BUY';
        strength = 60;
    }
    // MACD < 0 且下降
    else if (latest.macd < 0 && latest.histogram < 0) {
        signalName = 'SELL';
        strength = 60;
    }
    
    return { signal: signalName, strength, ...latest };
}

// ============== RSI ==============
/**
 * 計算 RSI
 * @param {number[]} prices - 價格陣列
 * @param {number} period - 計算週期（預設14）
 */
function calculateRSI(prices, period = 14) {
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
        changes.push(prices[i] - prices[i - 1]);
    }
    
    let avgGain = 0;
    let avgLoss = 0;
    
    // 初始平均
    for (let i = 0; i < period; i++) {
        if (changes[i] > 0) avgGain += changes[i];
        else avgLoss += Math.abs(changes[i]);
    }
    avgGain /= period;
    avgLoss /= period;
    
    const rsi = [];
    
    // Wilder 平滑法
    for (let i = period; i < changes.length; i++) {
        const gain = changes[i] > 0 ? changes[i] : 0;
        const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
        
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
    }
    
    return rsi;
}

/**
 * RSI 信號分析
 */
function analyzeRSI(rsiValues) {
    const latestRSI = rsiValues[rsiValues.length - 1];
    const prevRSI = rsiValues[rsiValues.length - 2];
    
    let signal = 'NEUTRAL';
    let strength = 0;
    let zone = '';
    
    if (latestRSI >= 70) zone = 'OVERBOUGHT';
    else if (latestRSI <= 30) zone = 'OVERSOLD';
    else zone = 'NEUTRAL';
    
    // RSI 從超賣區向上穿越
    if (prevRSI < 30 && latestRSI >= 30) {
        signal = 'BUY';
        strength = Math.min((latestRSI - 30) * 2, 100);
    }
    // RSI 從超買區向下穿越
    else if (prevRSI > 70 && latestRSI <= 70) {
        signal = 'SELL';
        strength = Math.min((70 - latestRSI) * 2, 100);
    }
    // 強烈超賣
    else if (latestRSI <= 25) {
        signal = 'BUY';
        strength = 80;
    }
    // 強烈超買
    else if (latestRSI >= 75) {
        signal = 'SELL';
        strength = 80;
    }
    
    return { 
        signal, 
        strength, 
        rsi: latestRSI, 
        zone,
        prevRSI
    };
}

// ============== KDJ ==============
/**
 * 計算 KDJ
 * @param {number[]} highs - 最高價陣列
 * @param {number[]} lows - 最低價陣列
 * @param {number[]} closes - 收盤價陣列
 * @param {number} period - RSV 週期（預設9）
 * @param {number} kPeriod - K 線週期（預設3）
 * @param {number} dPeriod - D 線週期（預設3）
 */
function calculateKDJ(highs, lows, closes, period = 9, kPeriod = 3, dPeriod = 3) {
    const kValues = [];
    const dValues = [];
    const jValues = [];
    
    let k = 50;
    let d = 50;
    
    for (let i = period - 1; i < closes.length; i++) {
        // 計算 RSV
        let maxHigh = -Infinity;
        let minLow = Infinity;
        for (let j = i - period + 1; j <= i; j++) {
            maxHigh = Math.max(maxHigh, highs[j]);
            minLow = Math.min(minLow, lows[j]);
        }
        
        const rsv = maxHigh === minLow ? 50 : (closes[i] - minLow) / (maxHigh - minLow) * 100;
        
        // K = 2/3 * 前K + 1/3 * RSV
        k = (2 / 3) * k + (1 / 3) * rsv;
        // D = 2/3 * 前D + 1/3 * K
        d = (2 / 3) * d + (1 / 3) * k;
        // J = 3K - 2D
        const j = 3 * k - 2 * d;
        
        kValues.push(k);
        dValues.push(d);
        jValues.push(j);
    }
    
    return { k: kValues, d: dValues, j: jValues };
}

/**
 * KDJ 信號分析
 */
function analyzeKDJ(kdjResult) {
    const { k, d, j } = kdjResult;
    const len = k.length;
    
    const latestK = k[len - 1];
    const latestD = d[len - 1];
    const latestJ = j[len - 1];
    const prevK = k[len - 2];
    const prevD = d[len - 2];
    
    let signal = 'NEUTRAL';
    let strength = 0;
    
    // 金叉：K 穿越 D
    if (prevK < prevD && latestK >= latestD) {
        signal = 'BUY';
        strength = Math.min(Math.abs(latestK - latestD) * 3, 100);
    }
    // 死叉：K 跌破 D
    else if (prevK > prevD && latestK <= latestD) {
        signal = 'SELL';
        strength = Math.min(Math.abs(latestK - latestD) * 3, 100);
    }
    // J 進入超買區 (>100)
    else if (latestJ > 100) {
        signal = 'SELL';
        strength = Math.min((latestJ - 100) * 2, 100);
    }
    // J 進入超賣區 (<0)
    else if (latestJ < 0) {
        signal = 'BUY';
        strength = Math.min(Math.abs(latestJ) * 2, 100);
    }
    
    return { signal, strength, k: latestK, d: latestD, j: latestJ };
}

// ============== A/D（Accumulation/Distribution）==============
/**
 * 計算 A/D 指標（Accumulation/Distribution）
 */
function calculateAD(highs, lows, closes, volumes) {
    const adLine = [];
    let cumulative = 0;
    
    for (let i = 0; i < closes.length; i++) {
        const high = highs[i];
        const low = lows[i];
        const close = closes[i];
        const volume = volumes[i];
        
        const range = high - low;
        const moneyFlow = range === 0 ? 0.5 : (close - low) / range;
        
        cumulative += (moneyFlow * 2 - 1) * volume;
        adLine.push(cumulative);
    }
    
    return adLine;
}

/**
 * A/D 信號分析
 */
function analyzeAD(adLine) {
    const latest = adLine[adLine.length - 1];
    const prev = adLine[adLine.length - 2];
    const trend = latest > prev ? 'ACCUMULATION' : latest < prev ? 'DISTRIBUTION' : 'NEUTRAL';
    
    let signal = 'NEUTRAL';
    
    // A/D 上升 + 價格上升 = 強勢
    if (trend === 'ACCUMULATION') {
        signal = 'BUY';
    } else if (trend === 'DISTRIBUTION') {
        signal = 'SELL';
    }
    
    return { signal, ad: latest, trend };
}

// ============== 成交量背離 ==============
/**
 * 偵測成交量背離
 * @param {number[]} prices - 價格陣列
 * @param {number[]} volumes - 成交量陣列
 */
function detectVolumeDivergence(prices, volumes) {
    const signals = [];
    
    // 最後 20 根 K 線分析
    const lookback = Math.min(20, prices.length);
    
    for (let i = prices.length - lookback; i < prices.length - 1; i++) {
        const priceChange = prices[i + 1] - prices[i];
        const volumeChange = volumes[i + 1] - volumes[i];
        
        // 看漲背離：價格下跌但成交量增加
        if (priceChange < 0 && volumeChange > 0) {
            signals.push({ type: 'BULLISH', index: i, strength: Math.min(volumeChange / volumes[i], 3) });
        }
        // 看跌背離：價格上漲但成交量減少
        else if (priceChange > 0 && volumeChange < 0) {
            signals.push({ type: 'BEARISH', index: i, strength: Math.min(Math.abs(volumeChange) / volumes[i], 3) });
        }
    }
    
    return signals;
}

// ============== 綜合分析 ==============
/**
 * 綜合技術分析
 */
function 综合分析(macdResult, rsiValues, kdjResult, adResult, prices, volumes) {
    const macd = analyzeMACD(macdResult);
    const rsi = analyzeRSI(rsiValues);
    const kdj = analyzeKDJ(kdjResult);
    const ad = analyzeAD(adResult);
    const divergence = detectVolumeDivergence(prices, volumes);
    
    // 評分系統：BUY=+1, SELL=-1, NEUTRAL=0
    let score = 0;
    const factors = [macd, rsi, kdj, ad];
    
    for (const factor of factors) {
        if (factor.signal === 'BUY') score += 1;
        else if (factor.signal === 'SELL') score -= 1;
    }
    
    // 加上背離
    const bullishDiv = divergence.filter(d => d.type === 'BULLISH').length;
    const bearishDiv = divergence.filter(d => d.type === 'BEARISH').length;
    score += bullishDiv * 0.5;
    score -= bearishDiv * 0.5;
    
    let recommendation = 'NEUTRAL';
    if (score >= 2) recommendation = 'BUY';
    else if (score <= -2) recommendation = 'SELL';
    
    return {
        recommendation,
        score: score.toFixed(1),
        macd,
        rsi,
        kdj,
        ad,
        divergence: divergence.slice(-3),
        summary: {
            buySignals: factors.filter(f => f.signal === 'BUY').length + bullishDiv,
            sellSignals: factors.filter(f => f.signal === 'SELL').length + bearishDiv,
            neutralSignals: factors.filter(f => f.signal === 'NEUTRAL').length
        }
    };
}

// ============== 取得幣種資料並分析 ==============
/**
 * 從 CoinGecko 取得 K 線資料並執行技術分析
 */
async function analyzeCoin(symbol = 'binancecoin', days = 30) {
    try {
        // 取得市場數據（包含歷史價格）
        const headers = COINGECKO_API_KEY ? { 'x-cg-demo-api-key': COINGECKO_API_KEY } : {};
        const response = await axios.get(`${COINGECKO_API}/coins/${symbol}/market_chart`, {
            params: { vs_currency: 'usd', days },
            headers,
            timeout: 10000
        });
        
        const prices = response.data.prices.map(p => p[1]);
        const volumes = response.data.total_volumes.map(v => v[1]);
        
        // 計算高低價（模擬）
        const highs = prices.map((p, i) => p * (1 + Math.random() * 0.02));
        const lows = prices.map((p, i) => p * (1 - Math.random() * 0.02));
        
        // 計算各項指標
        const macdResult = calculateMACD(prices);
        const rsiValues = calculateRSI(prices);
        const kdjResult = calculateKDJ(highs, lows, prices);
        const adResult = calculateAD(highs, lows, prices, volumes);
        
        // 綜合分析
        const analysis = 综合分析(macdResult, rsiValues, kdjResult, adResult, prices, volumes);
        
        return {
            symbol,
            currentPrice: prices[prices.length - 1],
            analysis
        };
    } catch (error) {
        console.error(`[技術分析] 取得 ${symbol} 資料失敗:`, error.message);
        return null;
    }
}

// ============== 主程式 ==============
async function main() {
    console.log('==========================================');
    console.log('📊 ClawCoin 技術分析系統啟動');
    console.log('==========================================\n');
    
    const symbols = ['bitcoin', 'ethereum', 'binancecoin'];
    
    for (const symbol of symbols) {
        const result = await analyzeCoin(symbol);
        if (result) {
            console.log(`\n🪙 ${symbol.toUpperCase()}`);
            console.log(`💵 現價: $${result.currentPrice.toFixed(2)}`);
            console.log(`🎯 綜合信號: [${result.analysis.recommendation}] (評分: ${result.analysis.score})`);
            console.log(`📈 買入: ${result.analysis.summary.buySignals} | 賣出: ${result.analysis.summary.sellSignals} | 中立: ${result.analysis.summary.neutralSignals}`);
            console.log(`  MACD: ${result.analysis.macd.signal} | RSI: ${result.analysis.rsi.rsi.toFixed(1)} (${result.analysis.rsi.zone}) | KDJ: ${result.analysis.kdj.signal}`);
        }
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    calculateSMA,
    calculateEMA,
    calculateMACD,
    analyzeMACD,
    calculateRSI,
    analyzeRSI,
    calculateKDJ,
    analyzeKDJ,
    calculateAD,
    analyzeAD,
    detectVolumeDivergence,
    综合分析,
    analyzeCoin
};
