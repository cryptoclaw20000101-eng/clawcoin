/**
 * 🛠️ ClawCoin ($CLAW) Meme Coin 部署腳本
 * 
 * 使用方式：
 *   npx hardhat run scripts/deploy.js --network bsc_testnet
 *   npx hardhat run scripts/deploy.js --network bsc_mainnet
 * 
 * 前置條件：
 *   1. .env 中設定 PRIVATE_KEY
 *   2. 錢包有足夠 BNB 支付 gas
 *   3. BSCSCAN_API_KEY（選填，無則跳過原始碼驗證）
 */

require('dotenv').config();
const hre = require('hardhat');

const NETWORK_CONFIG = {
    bsc_testnet: {
        chainId: 97,
        name: 'BSC Testnet',
        faucet: 'https://www.bnbchain.org/en/testnet-faucet'
    },
    bsc_mainnet: {
        chainId: 56,
        name: 'BNB Chain Mainnet',
        faucet: null
    }
};

async function main() {
    console.log('==========================================');
    console.log('🦐 ClawCoin ($CLAW) Meme Coin 部署');
    console.log(`🌐 網路: ${hre.network.name}`);
    console.log('==========================================\n');

    // ---- 參數檢查 ----
    const privateKey   = process.env.PRIVATE_KEY;
    const bscscanKey  = process.env.BSCSCAN_API_KEY;
    const marketing   = process.env.MARKETING_WALLET;
    const owner       = process.env.OWNER_ADDRESS; // 預設部署錢包

    if (!privateKey || privateKey === 'enter_your_64_char_hex_private_key_here') {
        console.error('❌ 錯誤: .env 中 PRIVATE_KEY 未設定或仍為 placeholder');
        console.error('   請編輯: ~/.openclaw/workspace/clawcoin/contracts/.env');
        process.exit(1);
    }

    if (!bscscanKey || bscscanKey === 'your_bscscan_api_key_here') {
        console.warn('⚠️ 警告: BSCSCAN_API_KEY 未設定，跳過原始碼驗證');
        console.warn('   申請: https://bscscan.com/apis\n');
    }

    // ---- 顯示網路資訊 ----
    const netCfg = NETWORK_CONFIG[hre.network.name] || NETWORK_CONFIG.bsc_testnet;
    console.log(`📡 網路: ${netCfg.name} (chainId: ${netCfg.chainId})`);

    // ---- 錢包餘額檢查 ----
    const [deployer] = await hre.ethers.getSigners();
    const balance    = await hre.ethers.provider.getBalance(deployer.address);
    const balanceEth = hre.ethers.formatEther(balance);
    console.log(`👛 部署錢包: ${deployer.address}`);
    console.log(`💰 BNB 餘額: ${balanceEth} BNB`);

    if (balanceEth === '0.0') {
        console.error(`\n❌ 餘額為 0，無法部署！`);
        if (netCfg.faucet) {
            console.error(`   水龍頭: ${netCfg.faucet}`);
        }
        process.exit(1);
    }

    if (parseFloat(balanceEth) < 0.01) {
        console.warn(`\n⚠️ 餘額較低 (< 0.01 BNB)，可能影響部署 gas`);
    }

    // ---- 部署合約 ----
    console.log('\n📦 部署 ClawCoin 合約...');
    const ClawCoin = await hre.ethers.getContractFactory('ClawCoin');
    const contract = await ClawCoin.deploy();
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();
    console.log(`✅ 合約地址: ${contractAddress}`);

    // ---- 初始化（2% 燃燒 Meme Coin 模式）----
    console.log('\n🔧 初始化代幣經濟模型...');

    const marketingWallet = marketing || deployer.address;
    const lpPair         = hre.network.name === 'bsc_mainnet'
        ? process.env.LP_PAIR_MAINNET || '0x0000000000000000000000000000000000000001'
        : process.env.LP_PAIR_TESTNET || deployer.address; // 測試網用 deployer 當 LP placeholder

    const initTx = await contract.initialize(marketingWallet, lpPair);
    await initTx.wait();
    console.log(`✅ 代幣分配完成`);
    console.log(`   行銷錢包: ${marketingWallet}`);
    console.log(`   LP Pair:  ${lpPair}`);

    // ---- 顯示代幣資訊 ----
    const [
        name,
        symbol,
        decimals,
        totalSupply,
        circulatingSupply,
        totalBurned
    ] = await contract.getTokenInfo();

    console.log('\n==========================================');
    console.log('📊 ClawCoin 代幣資訊');
    console.log('==========================================');
    console.log(`  名稱:         ${name}`);
    console.log(`  代號:         ${symbol}`);
    console.log(`  小數位:       ${decimals}`);
    console.log(`  總供應量:     ${hre.ethers.formatEther(totalSupply)} CLAW`);
    console.log(`  流通量:       ${hre.ethers.formatEther(circulatingSupply)} CLAW`);
    console.log(`  累計燃燒:     ${hre.ethers.formatEther(totalBurned)} CLAW`);
    console.log(`  燃燒率:       2% / 每筆轉帳`);
    console.log(`  燃燒機制:     ${(await contract.burnEnabled()) ? '✅ 開啟' : '❌ 關閉'}`);
    console.log(`  部署者角色:   ${await contract.owner()}`);

    // ---- LP Pair 設定提醒 ----
    if (hre.network.name !== 'hardhat') {
        console.log('\n⚠️ 重要: LP Pair 尚未設定');
        console.log('   部署到 DEX（PancakeSwap）後，使用:');
        console.log(`   contract.setLpPair("YOUR_LP_PAIR_ADDRESS")`);
        console.log(`   contract.setBurnEnabled(true)`);
    }

    // ---- 儲存地址 ----
    const envKey = hre.network.name === 'bsc_mainnet'
        ? 'CLAWCOIN_ADDRESS_MAINNET'
        : 'CLAWCOIN_ADDRESS_TESTNET';
    console.log(`\n📝 在 .env 中設定: ${envKey}=${contractAddress}`);

    // ---- BSCScan 原始碼驗證 ----
    if (bscscanKey && bscscanKey !== 'your_bscscan_api_key_here' && hre.network.name !== 'hardhat') {
        console.log('\n🔍 等待區塊確認 (約 5 秒)...');
        await new Promise(r => setTimeout(r, 5000));

        try {
            console.log('📤 提交 BSCScan 驗證...');
            await hre.run('verify:verify', {
                address: contractAddress,
                constructorArguments: [],
                contract: 'contracts/ClawCoin.sol:ClawCoin'
            });
            console.log('✅ 原始碼驗證成功 (BSCScan)');
        } catch (err) {
            console.warn('⚠️ 驗證稍後手動執行:');
            console.warn(`   npx hardhat verify --network ${hre.network.name} ${contractAddress}`);
        }
    }

    console.log('\n==========================================');
    console.log('🎉 部署完成！');
    console.log('==========================================\n');
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('\n❌ 部署失敗:', err.message || err);
        process.exit(1);
    });
