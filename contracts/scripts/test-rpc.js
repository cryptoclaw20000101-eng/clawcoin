require('dotenv').config();
const hre = require('hardhat');

async function test() {
  try {
    const block = await hre.ethers.provider.getBlockNumber();
    const network = await hre.ethers.provider.getNetwork();
    const address = process.env.ECOSYSTEM_FUND;
    const balance = await hre.ethers.provider.getBalance(address);
    
    console.log(`✅ BSC Testnet 連線成功`);
    console.log(`   網路: ${network.name} (chainId: ${network.chainId})`);
    console.log(`   區塊高度: ${block}`);
    console.log(`   錢包餘額: ${hre.ethers.formatEther(balance)} BNB`);
  } catch(e) {
    console.error('❌ 連線失敗:', e.message);
    process.exit(1);
  }
}

test().then(() => process.exit(0));
