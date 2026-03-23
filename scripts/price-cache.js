#!/usr/bin/env node
/**
 * ClawCoin Price Cache - 智慧更新系統
 * - 正常時每 60 秒更新
 * - 遇到 rate limit 時自動延長間隔（指數退避）
 * - 最多嘗試 3 次
 */

const COINGECKO_KEY = 'CG-t1FPoEKsr2cq7jK6wuryTCeL';
const CACHE_FILE = '/Users/cryptoclaw/.openclaw/workspace/clawcoin-website/website/data/price-cache.json';
const STATE_FILE = '/Users/cryptoclaw/.openclaw/workspace/clawcoin-website/website/data/cache-state.json';

const COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
];

const fs = require('fs');

// 讀取狀態
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {}
  return { consecutiveErrors: 0, lastUpdate: null };
}

// 儲存狀態
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function formatPrice(price) {
  if (price >= 1000) return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return '$' + price.toFixed(4);
  if (price >= 0.01) return '$' + price.toFixed(6);
  return '$' + price.toFixed(8);
}

function formatChange(change) {
  const sign = change >= 0 ? '+' : '';
  return sign + change.toFixed(2) + '%';
}

function formatMarketCap(mc) {
  if (mc >= 1e12) return '$' + (mc / 1e12).toFixed(2) + 'T';
  if (mc >= 1e9) return '$' + (mc / 1e9).toFixed(2) + 'B';
  if (mc >= 1e6) return '$' + (mc / 1e6).toFixed(2) + 'M';
  return '$' + mc.toLocaleString();
}

async function fetchPricesWithRetry(maxRetries = 3) {
  const state = loadState();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const ids = COINS.map(c => c.id).join(',');
      const resp = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h`,
        { headers: { 'x-cg-demo-api-key': COINGECKO_KEY } }
      );
      
      if (resp.status === 429) {
        // Rate limited - 延長等待時間
        const waitTime = Math.min(attempt * 30, 120); // 30s, 60s, 最多120s
        console.log(`⚠️ Rate limited，等待 ${waitTime}s 後重試...`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, waitTime * 1000));
          continue;
        } else {
          throw new Error('Rate limit exceeded after retries');
        }
      }
      
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      
      const data = await resp.json();
      
      const cache = {
        updated: new Date().toISOString(),
        prices: {}
      };
      
      COINS.forEach(coin => {
        const coinData = data.find(c => c.id === coin.id) || {};
        const change = coinData.price_change_percentage_24h || 0;
        cache.prices[coin.id] = {
          symbol: coin.symbol,
          name: coin.name,
          price: formatPrice(coinData.current_price || 0),
          rawPrice: coinData.current_price || 0,
          change: formatChange(change),
          rawChange: change,
          marketCap: formatMarketCap(coinData.market_cap || 0),
          volume: formatMarketCap(coinData.total_volume || 0),
        };
      });
      
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
      
      // 更新狀態：成功
      state.consecutiveErrors = 0;
      state.lastUpdate = new Date().toISOString();
      saveState(state);
      
      console.log(`[${new Date().toLocaleTimeString('zh-TW')}] ✅ Prices updated`);
      return cache;
      
    } catch (e) {
      console.error(`❌ Attempt ${attempt} failed: ${e.message}`);
      if (attempt === maxRetries) {
        state.consecutiveErrors++;
        saveState(state);
        console.error(`⚠️ 連續錯誤次數: ${state.consecutiveErrors}`);
        return null;
      }
    }
  }
}

// CLI mode: fetch once
if (require.main === module) {
  fetchPricesWithRetry().then(cache => {
    if (cache) {
      console.log('BTC:', cache.prices.bitcoin.price, cache.prices.bitcoin.change);
    }
    process.exit(0);
  });
}

module.exports = { fetchPricesWithRetry };
