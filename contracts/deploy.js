require("dotenv").config();
const hre = require("hardhat");

async function main() {
  console.log("🚀 開始部署 ClawCoin...");
  
  // 讀取錢包地址
  const addresses = {
    ecosystemFund: process.env.ECOSYSTEM_FUND,
    communityAirdrop: process.env.COMMUNITY_AIRDROP,
    liquidityPool: process.env.LIQUIDITY_POOL,
    privateInvestors: process.env.PRIVATE_INVESTORS,
    openClawFund: process.env.OPENCLAW_FUND,
    teamWallet: process.env.TEAM_WALLET
  };
  
  console.log("\n📋 錢包地址設定：");
  console.log("   生態系統基金:", addresses.ecosystemFund);
  console.log("   社群/空投:", addresses.communityAirdrop);
  console.log("   流動性池:", addresses.liquidityPool);
  console.log("   私募投資者:", addresses.privateInvestors);
  console.log("   OpenClaw基金:", addresses.openClawFund);
  console.log("   團隊錢包:", addresses.teamWallet);
  
  // 檢查地址是否有效
  const requiredAddress = "0xc2c04677CDC011B57c7f253E3a2Ab7f5920E8B15";
  const allSame = Object.values(addresses).every(addr => addr === requiredAddress);
  
  if (allSame) {
    console.log("\n⚠️  注意：所有地址都相同（測試模式）");
    console.log("   部署到主網前請更換為真實地址！");
  }
  
  // 部署合約
  console.log("\n📤 部署合約中...");
  const ClawCoin = await hre.ethers.getContractFactory("ClawCoin");
  const clawCoin = await ClawCoin.deploy();
  
  await clawCoin.deployed();
  
  console.log("✅ ClawCoin 合約已部署到:", clawCoin.address);
  
  // 初始化代幣分配
  console.log("\n📝 初始化代幣分配...");
  const tx = await clawCoin.initialize(
    addresses.ecosystemFund,
    addresses.communityAirdrop,
    addresses.liquidityPool,
    addresses.privateInvestors,
    addresses.openClawFund,
    addresses.teamWallet
  );
  await tx.wait();
  
  console.log("✅ 代幣分配初始化完成！");
  
  // 驗證合約
  console.log("\n🔍 驗證合約...");
  try {
    await hre.run("verify:verify", {
      address: clawCoin.address,
      constructorArguments: [],
    });
    console.log("✅ 合約驗證成功!");
  } catch (error) {
    console.log("⚠️  合約驗證需要手動在 BSCScan 上完成");
  }
  
  console.log("\n" + "=".repeat(50));
  console.log("📊 部署摘要");
  console.log("=".repeat(50));
  console.log("合約地址:", clawCoin.address);
  console.log("區塊鏈:", hre.network.name);
  console.log("區塊瀏覽器: https://bscscan.com/address/" + clawCoin.address);
  console.log("=".repeat(50));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
