// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ClawCoin ($CLAW) - Meme Coin
 * @dev BEP-20 Meme Coin on BNB Chain
 * 
 * 🎯 代幣經濟：
 * - 總供應量: 1,000,000,000 (10億) CLAW - 固定，燒毀後遞減
 * - 每筆轉帳燃燒 2%
 * - 流動性池: 50%
 * - 社群空投: 50%（無鎖倉）
 * - 無私募、無團隊份額
 * 
 * 🦐 Meme Coin 特點：燃燒機制 + 社群驅動
 */
contract ClawCoin is ERC20, ERC20Burnable, Ownable {
    
    // ============ Constants ============
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 10**18;
    uint256 public constant BURN_RATE = 200; // 2% = 200/10000
    
    // ============ State ============
    bool    public isInitialized   = false;
    address public lpPair          = address(0);
    address public marketingWallet  = address(0);
    address public constant DEAD_ADDRESS = address(0xdead);
    bool    public burnEnabled     = true;
    uint256 public totalBurned      = 0;
    
    // ============ Events ============
    event TokensBurned(address indexed from, uint256 amount, uint256 burnedAmount);
    event MarketingWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event BurnToggled(bool enabled);
    event LpPairUpdated(address indexed oldPair, address indexed newPair);
    
    // ============ Storage Slot Helpers (OZ ERC20 v4 layout) ============
    // OZ ERC20 storage layout:
    // slot 0: _totalSupply (uint256)
    // slot 1: _balances (mapping)
    // slot 2: _allowances (mapping)
    // slot 3: _name (string)
    // slot 4: _symbol (string)
    // slot 5: _decimals (uint8)
    
    function _balanceOf(address account) internal view returns (uint256) {
        return _getBoolSlot(keccak256(abi.encode(account, uint256(1))));
    }
    
    function _setBalance(address account, uint256 newBalance) private {
        _setUintSlot(keccak256(abi.encode(account, uint256(1))), newBalance);
    }
    
    function _setTotalSupply(uint256 newSupply) private {
        _setUintSlot(bytes32(uint256(0)), newSupply);
    }
    
    function _getUintSlot(bytes32 slot) internal view returns (uint256 r) {
        assembly { r := sload(slot) }
    }
    
    function _setUintSlot(bytes32 slot, uint256 value) private {
        assembly { sstore(slot, value) }
    }
    
    function _getBoolSlot(bytes32 slot) internal view returns (uint256 r) {
        assembly { r := sload(slot) }
    }
    
    // ============ Constructor ============
    constructor() ERC20("ClawCoin", "CLAW") Ownable() {}
    
    // ============ Initialization ============
    function initialize(address _marketingWallet, address _lpPair) external onlyOwner {
        require(!isInitialized, "ClawCoin: already initialized");
        require(_marketingWallet != address(0), "ClawCoin: zero marketing wallet");
        
        marketingWallet = _marketingWallet;
        lpPair          = _lpPair != address(0) ? _lpPair : DEAD_ADDRESS;
        
        // 流動性池 50% → DEAD（LP 建立後置換）
        _mint(DEAD_ADDRESS, INITIAL_SUPPLY * 50 / 100);  // 5億
        
        // 社群/空投 50% → Owner
        _mint(owner(), INITIAL_SUPPLY * 50 / 100);         // 5億
        
        isInitialized = true;
    }
    
    // ============ Transfer Override with 2% Burn ============
    /**
     * @dev 重寫 _transfer，內嵌 2% 燃燒邏輯
     * 
     * 白名單（不燃燒）：DEAD / lpPair / marketingWallet / owner / mint / burn
     */
    function _transfer(
        address from,
        address to,
        uint256 value
    ) internal override {
        require(from != address(0), "ERC20: transfer from zero address");
        require(to   != address(0), "ERC20: transfer to zero address");
        
        // ---- 計算燃燒量 ----
        bool shouldBurn = burnEnabled
            && value > 0
            && from != DEAD_ADDRESS
            && to   != DEAD_ADDRESS
            && from != lpPair
            && to   != lpPair
            && from != marketingWallet
            && to   != marketingWallet
            && from != owner()
            && to   != owner();
        
        uint256 burnAmount    = shouldBurn ? (value * BURN_RATE) / 10000 : 0;
        uint256 transferAmt   = value - burnAmount;
        
        // ---- Hooks ----
        _beforeTokenTransfer(from, to, transferAmt);
        
        // ---- 讀取余額 ----
        uint256 fromBalance = _balanceOf(from);
        require(fromBalance >= value, "ERC20: transfer amount exceeds balance");
        
        // ---- 更新余額（assembly 寫入 storage）----
        unchecked {
            _setBalance(from, fromBalance - value);         // 扣總額
            _setBalance(to, _balanceOf(to) + transferAmt); // 接收方收到扣燒後的
        }
        
        emit Transfer(from, to, transferAmt);
        _afterTokenTransfer(from, to, transferAmt);
        
        // ---- 執行燃燒（assembly 直接修改 totalSupply + DEAD balance）----
        if (burnAmount > 0) {
            uint256 currentSupply = _getUintSlot(bytes32(uint256(0)));
            _setTotalSupply(currentSupply - burnAmount);    // 真正減少總供應
            totalBurned += burnAmount;
            emit Transfer(from, DEAD_ADDRESS, burnAmount);
        }
    }
    
    // ============ Admin Functions ============
    function setMarketingWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "ClawCoin: zero address");
        emit MarketingWalletUpdated(marketingWallet, newWallet);
        marketingWallet = newWallet;
    }
    
    function setLpPair(address newPair) external onlyOwner {
        require(newPair != address(0), "ClawCoin: zero address");
        emit LpPairUpdated(lpPair, newPair);
        lpPair = newPair;
    }
    
    function setBurnEnabled(bool enabled) external onlyOwner {
        burnEnabled = enabled;
        emit BurnToggled(enabled);
    }
    
    // ============ View Functions ============
    function getTokenInfo() external view returns (
        string memory name_,
        string memory symbol_,
        uint8   decimals_,
        uint256 totalSupply_,
        uint256 circulatingSupply_,
        uint256 totalBurned_
    ) {
        return (
            name(),
            symbol(),
            decimals(),
            totalSupply(),
            totalSupply() - balanceOf(DEAD_ADDRESS),
            totalBurned
        );
    }
    
    receive() external payable {}
}
