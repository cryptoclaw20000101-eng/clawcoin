# ClawCoin Smart Contract

## 📁 檔案結構

```
contracts/
├── ClawCoin.sol      # 主合約
├── deploy.js        # 部署腳本
└── README.md        # 本檔案
```

## 🔧 安裝依賴

```bash
cd contracts
npm init -y
npm install --save-dev hardhat @nomiclabs/hardhat-ethers @openzeppelin/contracts
```

## ⚙️ 設定環境變數

建立 `.env` 檔案：

```env
PRIVATE_KEY=你的BSC錢包私鑰
BSC_RPC_URL=https://bsc-dataseed.binance.org/
BSCSCAN_API_KEY=你的BSCScan API Key（可選，用於驗證）
```

## 🚀 編譯合約

```bash
npx hardhat compile
```

## 🧪 本地測試

```bash
npx hardhat test
```

## 📤 部署到 BSC Testnet

```bash
npx hardhat run scripts/deploy.js --network bsc_testnet
```

## 📤 部署到 BSC Mainnet

```bash
npx hardhat run scripts/deploy.js --network bsc
```

## 📋 代幣分配（已寫入合約）

| 類別 | 數量 | 比例 | 鎖倉規則 |
|------|------|------|----------|
| 生態系統基金 | 300,000,000 CLAW | 30% | 3個月cliff, 24個月線性解鎖 |
| 社群/空投 | 200,000,000 CLAW | 20% | TGE 10%, 其餘12個月線性解鎖 |
| 流動性池 | 150,000,000 CLAW | 15% | 無鎖倉 |
| 私募投資者 | 100,000,000 CLAW | 10% | 6個月cliff |
| OpenClaw基金 | 150,000,000 CLAW | 15% | 12個月cliff, 24個月線性解鎖 |
| 團隊 | 100,000,000 CLAW | 10% | 12個月cliff, 24個月線性解鎖 |

## 🔐 安全特性

- ✅ OpenZeppelin ERC20 標準
- ✅ AccessControl 權限控制
- ✅ Pausable 緊急暫停
- ✅ ReentrancyGuard 重入攻擊防護
- ✅ 時間鎖 Vesting 機制

## 📄 合約函數

### 管理員函數
- `initialize(...)` - 初始化代幣分配
- `pause()` / `unpause()` - 暫停/恢復合約
- `mint(to, amount)` - 鑄造代幣
- `burn(from, amount)` - 燃燒代幣
- `updateTeamWallet(newWallet)` - 更新團隊錢包

### 查詢函數
- `getLockedAmount(address)` - 查詢鎖倉餘額
- `getTokenInfo()` - 查詢代幣資訊
- `lockedAmount(address)` - 地址鎖倉量
- `vestingStart(address)` - 歸屬開始時間
- `vestingDuration(address)` - 歸屬期限

## ⚠️ 部署前檢查清單

- [ ] 確認所有錢包地址正確
- [ ] 測試網部署並驗證
- [ ] 安排安全審計
- [ ] 主網部署前再次確認
- [ ] 在 BSCScan 上驗證合約源碼

## 📞 支援

如有問題，請聯繫開發團隊。
