/**
 * 💰 空投獵人錢包餘額查詢
 * 
 * 一次查詢錢包在各鏈的資產狀態
 * 
 * 使用方式：
 *   node check-balances.js
 * 
 * 查詢範圍：
 * - Scroll 主網
 * - Linea 主網
 * - ZkSync Era 主網
 * - Base 主網
 * - Arbitrum 主網
 * - Optimism 主網
 */

require('dotenv').config();
const axios = require('axios');
const { ethers } = require('ethers');

const WALLET = process.env.OWNER_ADDRESS || '0xADB3e2f2db015cCa98cbF89530D6Fb712F42d610';

const CHAINS = {
    ethereum: {
        name: 'Ethereum',
        rpc: 'https://eth.llamarpc.com',
        symbol: 'ETH',
        explorer: 'https://etherscan.io'
    },
    scroll: {
        name: 'Scroll',
        rpc: 'https://rpc.scroll.io',
        symbol: 'ETH',
        explorer: 'https://scrollscan.com'
    },
    linea: {
        name: 'Linea',
        rpc: 'https://rpc.linea.build',
        symbol: 'ETH',
        explorer: 'https://lineascan.build'
    },
    zksync: {
        name: 'ZkSync Era',
        rpc: 'https://mainnet.era.zksync.io',
        symbol: 'ETH',
        explorer: 'https://explorer.zksync.io'
    },
    base: {
        name: 'Base',
        rpc: 'https://mainnet.base.org',
        symbol: 'ETH',
        explorer: 'https://basescan.org'
    },
    arbitrum: {
        name: 'Arbitrum One',
        rpc: 'https://arb1.arbitrum.io/rpc',
        symbol: 'ETH',
        explorer: 'https://arbiscan.io'
    },
    optimism: {
        name: 'Optimism',
        rpc: 'https://mainnet.optimism.io',
        symbol: 'ETH',
        explorer: 'https://optimistic.etherscan.io'
    },
    bsc: {
        name: 'BNB Chain',
        rpc: 'https://bsc-dataseed.binance.org',
        symbol: 'BNB',
        explorer: 'https://bscscan.com'
    }
};

async function getBalance(chainKey, chain) {
    try {
        const provider = new ethers.JsonRpcProvider(chain.rpc);
        const balance = await provider.getBalance(WALLET);
        const formatted = parseFloat(ethers.formatEther(balance));
        
        // 估算 USD（ETH 鏈用 ETH 價格，BSC 用 BNB 價格）
        let price = 1;
        if (chainKey !== 'bsc') {
            // 用簡單估算：ETH ~ $2000，BNB ~ $600
            price = chain.symbol === 'ETH' ? 2000 : 1;
        } else {
            price = 600;
        }
        
        return {
            chain: chain.name,
            symbol: chain.symbol,
            balance: formatted.toFixed(4),
            usd: (formatted * price).toFixed(2),
            explorer: `${chain.explorer}/address/${WALLET}`,
            ok: true
        };
    } catch (e) {
        return {
            chain: chain.name,
            symbol: chain.symbol,
            balance: 'N/A',
            usd: 'N/A',
            explorer: `${chain.explorer}/address/${WALLET}`,
            ok: false,
            error: e.message.slice(0, 50)
        };
    }
}

async function main() {
    console.log('\n==========================================');
    console.log('💰 ClawCoin 空投獵人錢包查詢');
    console.log('==========================================');
    console.log(`👛 錢包: ${WALLET}\n`);

    console.log('🔍 查詢各鏈餘額...\n');

    const results = await Promise.all(
        Object.entries(CHAINS).map(([key, chain]) => 
            getBalance(key, chain).then(r => ({ key, ...r }))
        )
    );

    console.log('  鏈             代號    餘額         USD         狀態');
    console.log('  ' + '─'.repeat(75));

    for (const r of results) {
        const status = r.ok ? '✅' : '❌';
        const balance = (r.balance + '      ').slice(0, 10);
        const chain = (r.chain + '          ').slice(0, 14);
        const sym = (r.symbol + '   ').slice(0, 5);
        const usd = r.ok ? `$${r.usd}` : 'N/A';
        console.log(`  ${chain} ${sym} ${balance} ${usd.padStart(10)}  ${status}`);
    }

    const totalUSD = results
        .filter(r => r.ok)
        .reduce((sum, r) => sum + parseFloat(r.usd || 0), 0);

    console.log('\n  ' + '─'.repeat(75));
    console.log(`  📊 總計估算: $${totalUSD.toFixed(2)} USD`);
    console.log('\n  🔗 Etherscan 多鏈瀏覽:');
    console.log(`  https://etherscan.io/address/${WALLET}`);
    console.log(`  https://basescan.org/address/${WALLET}`);
    console.log(`  https://scrollscan.com/address/${WALLET}`);
    console.log(`  https://lineascan.build/address/${WALLET}`);

    // 檢測錢包在各鏈的互動歷史（估算）
    console.log('\n==========================================');
    console.log('📋 各鏈空投資格評估');
    console.log('==========================================\n');

    const assessments = [
        {
            name: 'Scroll',
            eligible: parseFloat(results.find(r => r.key === 'scroll')?.balance || '0') > 0,
            note: '需要 Scroll 主網有 ETH 餘額和交互記錄'
        },
        {
            name: 'Linea',
            eligible: parseFloat(results.find(r => r.key === 'linea')?.balance || '0') > 0,
            note: '需要 Linea 主網有活動'
        },
        {
            name: 'Base',
            eligible: parseFloat(results.find(r => r.key === 'base')?.balance || '0') > 0,
            note: '需要 Base 主網有活動'
        },
        {
            name: 'ZkSync Era',
            eligible: parseFloat(results.find(r => r.key === 'zksync')?.balance || '0') > 0,
            note: '需要 ZkSync Era 主網有活動'
        }
    ];

    for (const a of assessments) {
        const icon = a.eligible ? '✅' : '⭕';
        console.log(`  ${icon} ${a.name}: ${a.note}`);
    }

    console.log('\n==========================================\n');
}

main().catch(console.error);
