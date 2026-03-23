/**
 * Polymarket CLOB Script
 * Usage: PRIVATE_KEY=0x... node polymarket.js <command>
 * 
 * Commands:
 *   api-key     - Create or derive API key
 *   markets     - List open markets
 *   order-book  - Get order book for a market
 *   trades      - Get recent trades
 */

const { ClobClient } = require("@polymarket/clob-client");
const { Wallet } = require("ethers");

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const POLYMARKET_CLOB_URL = "https://clob.polymarket.com";
const CHAIN_ID = 137; // Polygon mainnet

async function getClient() {
  if (!PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY environment variable is required");
  }
  const wallet = new Wallet(PRIVATE_KEY);
  return new ClobClient(POLYMARKET_CLOB_URL, CHAIN_ID, wallet);
}

async function createApiKey() {
  console.log("🔑 Creating/Deriving API Key...");
  const client = await getClient();
  const credentials = await client.createOrDeriveApiKey();
  console.log("✅ API Credentials:");
  console.log("  API Key:", credentials.apiKey);
  console.log("  Secret:", credentials.secret);
  console.log("  Passphrase:", credentials.passphrase);
  return credentials;
}

async function listMarkets(limit = 20) {
  console.log(`📊 Fetching ${limit} open markets from Gamma API...`);
  const resp = await fetch(`https://gamma-api.polymarket.com/markets?closed=false&limit=${limit}`);
  const data = await resp.json();
  // Gamma API returns object with numeric keys
  const markets = Object.values(data);
  
  markets.slice(0, limit).forEach((m, i) => {
    const prices = JSON.parse(m.outcomePrices || "[]");
    const outcomes = JSON.parse(m.outcomes || "[]");
    const vol = Number(m.volumeNum || 0);
    console.log(`\n${i + 1}. ${m.question}`);
    console.log(`   ID: ${m.id}`);
    console.log(`   Volume: $${vol.toLocaleString()}`);
    if (prices.length >= 2) {
      console.log(`   ${outcomes[0] || "Yes"}: ${(parseFloat(prices[0]) * 100).toFixed(1)}%`);
      console.log(`   ${outcomes[1] || "No"}: ${(parseFloat(prices[1]) * 100).toFixed(1)}%`);
    }
  });
  return markets;
}

async function getOrderBook(marketId) {
  console.log(`📋 Order Book for Market: ${marketId}`);
  const resp = await fetch(`${POLYMARKET_CLOB_URL}/orderbook?market=${marketId}`);
  const book = await resp.json();
  console.log(JSON.stringify(book, null, 2));
  return book;
}

async function getTrades(marketId, limit = 50) {
  console.log(`📜 Recent Trades for Market: ${marketId}`);
  const resp = await fetch(`${POLYMARKET_CLOB_URL}/trades?market=${marketId}&limit=${limit}`);
  const trades = await resp.json();
  console.log(JSON.stringify(trades, null, 2));
  return trades;
}

async function getMarketFills(marketId) {
  console.log(`💰 Fills for Market: ${marketId}`);
  const resp = await fetch(`${POLYMARKET_CLOB_URL}/fills?market=${marketId}`);
  const fills = await resp.json();
  console.log(JSON.stringify(fills, null, 2));
  return fills;
}

async function main() {
  const cmd = process.argv[2];
  const arg = process.argv[3];

  try {
    switch (cmd) {
      case "api-key":
        await createApiKey();
        break;
      case "markets":
        await listMarkets(arg ? parseInt(arg) : 20);
        break;
      case "order-book":
        if (!arg) {
          console.error("Usage: node polymarket.js order-book <market_id>");
          process.exit(1);
        }
        await getOrderBook(arg);
        break;
      case "trades":
        if (!arg) {
          console.error("Usage: node polymarket.js trades <market_id>");
          process.exit(1);
        }
        await getTrades(arg);
        break;
      case "fills":
        if (!arg) {
          console.error("Usage: node polymarket.js fills <market_id>");
          process.exit(1);
        }
        await getMarketFills(arg);
        break;
      default:
        console.log(`
Polymarket CLOB Script

Usage:
  PRIVATE_KEY=0x... node polymarket.js <command> [args]

Commands:
  api-key     Create or derive API key (requires PRIVATE_KEY)
  markets     List open markets (optional: limit number)
  order-book  Get order book for a market (requires market_id)
  trades      Get recent trades (requires market_id)
  fills       Get fills (requires market_id)

Examples:
  PRIVATE_KEY=0x... node polymarket.js api-key
  node polymarket.js markets 10
  node polymarket.js order-book 540881
  node polymarket.js trades 540881
        `);
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

main();
