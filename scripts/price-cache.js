#!/usr/bin/env node
/**
 * ClawCoin Price Cache - 每 30 秒更新一次
 * 共用於網站 + Telegram Bot
 */

const COINGECKO_KEY = 'CG-t1FPoEKsr2cq7jK6wuryTCeL';
const CACHE_FILE = '/Users/cryptoclaw/.openclaw/workspace/clawcoin-website/website/data/price-cache.json';

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

async function fetchPrices() {
  try {
    const ids = COINS.map(c => c.id).join(',');
    const resp = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h`,
      { headers: { 'x-cg-demo-api-key': COINGECKO_KEY } }
    );
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
    
    // Save to cache file
    const fs = require('fs');
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    
    console.log(`[${new Date().toLocaleTimeString('zh-TW')}] Prices updated`);
    return cache;
  } catch (e) {
    console.error('Fetch error:', e.message);
    return null;
  }
}

// CLI mode: fetch once
if (require.main === module) {
  fetchPrices().then(cache => {
    if (cache) {
      console.log('Sample:', JSON.stringify(cache.prices.bitcoin, null, 2));
    }
    process.exit(0);
  });
}

module.exports = { fetchPrices };
