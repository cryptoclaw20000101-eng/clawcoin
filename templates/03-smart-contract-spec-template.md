# ClawCoin 智慧合約規格模板

> 版本：v0.1 | 創建日期：2026-03-22 | 狀態：草稿

---

## 文件資訊
| 項目 | 內容 |
|------|------|
| 合約名稱 | |
| 合約版本 | v0.1 |
| 最終更新 | 2026-03-22 |
| 審計狀態 | 待審計 |

---

## 1. 合約總覽

### 1.1 合約目的
_簡述此合約的核心功能和目的_

### 1.2 合約類型
- [ ] 代幣合約 (Token Contract)
- [ ] 質押合約 (Staking Contract)
- [ ] 治理合約 (Governance Contract)
- [ ] 分銷合約 (Distribution Contract)
- [ ] 拍賣合約 (Auction Contract)
- [ ] 借貸合約 (Lending Contract)
- [ ] 其他：___________

### 1.3 區塊鏈部署
| 項目 | 內容 |
|------|------|
| 區塊鏈網路 | |
| 合約地址 | 待部署 |
| Solidity 版本 | |
| 編譯器版本 | |

---

## 2. 合約架構

### 2.1 繼承關係
```
合約繼承圖：

OpenZeppelin Contracts
        │
        ├── AccessControl (可选)
        ├── Pausable (可选)
        └── ReentrancyGuard (可选)
                │
                └── ClawCoinContract (主要合約)
```

### 2.2 依賴庫
| 庫/合約 | 版本 | 用途 |
|---------|------|------|
| OpenZeppelin Contracts | ^5.0 | 安全標準 |
| solmate | - | 可選高效實現 |
| 自訂庫 | - | |

---

## 3. 接口定義

### 3.1 主要函數

#### 3.1.1 初始化 (Initializer)
```solidity
function initialize(
    string memory name_,
    string memory symbol_,
    uint256 initialSupply_,
    address admin_
) external initializer;
```

#### 3.1.2 代幣操作
```solidity
// 鑄造新代幣
function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE);

// 燃燒代幣
function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE);

// 轉帳
function transfer(address to, uint256 amount) external returns (bool);

// 批量轉帳
function batchTransfer(address[] calldata recipients, uint256[] calldata amounts) external;
```

#### 3.1.3 查詢函數
```solidity
// 查詢餘額
function balanceOf(address account) external view returns (uint256);

// 查詢總供應量
function totalSupply() external view returns (uint256);

// 查詢授權額度
function allowance(address owner, address spender) external view returns (uint256);
```

### 3.2 事件 (Events)
```solidity
event Initialized(uint256 version);
event Transfer(address indexed from, address indexed to, uint256 value);
event Approval(address indexed owner, address indexed spender, uint256 value);
event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);
```

### 3.3 錯誤 (Errors)
```solidity
error InsufficientBalance(address account, uint256 required, uint256 available);
error InvalidRecipient(address recipient);
error ZeroAmount();
error Unauthorized(address caller);
error ContractPaused();
```

---

## 4. 存取控制

### 4.1 角色定義
| 角色 | 權限描述 | 位址 |
|------|---------|------|
| DEFAULT_ADMIN_ROLE | 超級管理員 | |
| MINTER_ROLE | 鑄造代幣 | |
| BURNER_ROLE | 燃燒代幣 | |
| PAUSER_ROLE | 暫停合約 | |
| OPERATOR_ROLE | 運營操作 | |

### 4.2 多簽要求
- [ ] 單簽
- [ ] 2/3 多簽
- [ ] 3/5 多簽
- [ ] 自定義門檻：_ / _

---

## 5. 功能規格

### 5.1 核心功能

#### 功能 1: 代幣轉帳
```
描述：用戶之間轉移 CLAW 代幣

前置條件：
- 合約未被暫停
- 發送方餘額充足
- 接收方地址有效

流程：
1. 驗證呼叫者為非零地址
2. 從發送方扣除代幣
3. 向接收方增加代幣
4. 發送 Transfer 事件

後置條件：
- 發送方餘額減少
- 接收方餘額增加
- 事件已發出
```

#### 功能 2: 質押質押
```
描述：用戶質押代幣以獲得獎勵

前置條件：
- 質押池未關閉
- 用戶余額充足
- 質押金額 >= 最低質押量

流程：
1. 鎖定用戶代幣至合約
2. 記錄質押資訊
3. 計算起始時間
4. 更新總質押量
```

### 5.2 邊界條件處理
| 場景 | 處理方式 |
|------|----------|
| 零金額轉帳 | revert ZeroAmount() |
| 地址為零 | revert InvalidRecipient() |
| 餘額不足 | revert InsufficientBalance() |
| 合約暫停 | revert ContractPaused() |

---

## 6. 安全機制

### 6.1 標準安全檢查
- [ ] ReentrancyGuard (重入攻擊防護)
- [ ] Ownable / AccessControl (權限控制)
- [ ] Pausable (緊急暫停)
- [ ] Circuit Breaker (熔斷機制)

### 6.2 數學安全
- [ ] SafeMath / .checked_mul/.checked_div
- [ ] 整數溢出檢查
- [ ] 精度處理

### 6.3 前端運行保護
- [ ] 交易的nonce機制
- [ ] 時間鎖
- [ ] 滑點保護

---

## 7. 代幣標準實現

### 7.1 ERC-20 標準
```solidity
// 標準函數
function name() external view returns (string memory);
function symbol() external view returns (string memory);
function decimals() external view returns (uint8);
function totalSupply() external view returns (uint256);
function balanceOf(address account) external view returns (uint256);
function transfer(address to, uint256 amount) external returns (bool);
function allowance(address owner, address spender) external view returns (uint256);
function approve(address spender, uint256 amount) external returns (bool);
function transferFrom(address from, address to, uint256 amount) external returns (bool);

// 擴展函數
function increaseAllowance(address spender, uint256 addedValue) external returns (bool);
function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool);
```

### 7.2 可選擴展
- [ ] ERC-20 Snapshots (快照)
- [ ] ERC-20 Capped (上限)
- [ ] ERC-20 Flash Minting (閃電鑄)
- [ ] ERC-20Votes (投票)

---

## 8. 合約狀態

### 8.1 狀態變數
```solidity
string private _name;              // 代幣名稱
string private _symbol;            // 代幣符號
uint8 private _decimals;           // 小數位數 (18)
uint256 private _totalSupply;      // 總供應量
mapping(address => uint256) private _balances;
mapping(address => mapping(address => uint256)) private _allowances;
bool public paused;                // 暫停狀態
```

### 8.2 構造函數
```solidity
constructor(
    string memory name_,
    string memory symbol_,
    uint8 decimals_,
    uint256 initialSupply_,
    address admin_
) {
    _name = name_;
    _symbol = symbol_;
    _decimals = decimals_;
    _mint(admin_, initialSupply_ * 10 ** decimals_);
}
```

---

## 9. 測試用例

### 9.1 單元測試
| 測試項 | 測試案例 | 預期結果 |
|--------|----------|----------|
| 初始化 | 正確初始化 | 設定正確的值 |
| 初始化 | 重複初始化 | revert (防止) |
| 轉帳 | 正常轉帳 | 餘額正確增減 |
| 轉帳 | 零金額 | revert |
| 轉帳 | 餘額不足 | revert |
| 鑄造 | 管理員鑄造 | 供應量增加 |
| 鑄造 | 非管理員鑄造 | revert |
| 質押 | 正常質押 | 更新質押記錄 |
| 質押 | 金額低於最低 | revert |

### 9.2 整合測試
- [ ] 跨合約調用
- [ ] 質押-獎勵完整流程
- [ ] 緊急暫停後恢復

### 9.3 壓力測試
- [ ] 大批量轉帳
- [ ] 並發質押
- [ ] Gas 消耗分析

---

## 10. 部署腳本

### 10.1 部署配置
```javascript
// scripts/deploy.js
const CLAW = await ethers.getContractFactory("ClawCoin");
const claw = await CLAW.deploy(
    "ClawCoin",           // name
    "CLAW",               // symbol
    18,                   // decimals
    1_000_000_000,        // initialSupply
    adminAddress          // admin
);
```

### 10.2 部署網路
| 網路 | 部署時間 | TX Hash | 區塊 |
|------|----------|---------|------|
| 本地測試 | TBD | | |
| Testnet | TBD | | |
| Mainnet | TBD | | |

---

## 11. 升級策略

### 11.1 可升級合約
- [ ] 是 (使用代理)
- [ ] 否

### 11.2 代理模式
- [ ] UUPS Proxy
- [ ] Transparent Proxy
- [ ] Diamond Pattern

### 11.3 升級流程
```
1. 在測試網部署新版本合約
2. 運行完整測試
3. 安全審計
4. 時間鎖延遲 (如適用)
5. 主網部署
6. 驗證功能
```

---

## 12. 審計清單

### 12.1 審計前檢查
- [ ] 所有函數有文件註釋
- [ ] 所有輸入有驗證
- [ ] 權限控制正確
- [ ] 測試覆蓋率 > 95%
- [ ] Gas 優化完成

### 12.2 審計機構
- [ ] 待選擇

### 12.3 已知問題
_記錄任何已知的限制或問題_

---

## 📝 備註

> 更新記錄：
> - 2026-03-22: 建立初版模板
