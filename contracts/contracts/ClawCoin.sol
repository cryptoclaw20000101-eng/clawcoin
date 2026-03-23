// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ClawCoin (CLAW)
 * @dev BEP-20 Token for ClawCoin Ecosystem
 * 
 * 代幣分配：
 * - 生態系統基金: 30% (300,000,000 CLAW) - 3個月 cliff, 24個月線性解鎖
 * - 社群/空投: 20% (200,000,000 CLAW) - TGE 10%, 其餘按月解鎖
 * - 流動性池: 15% (150,000,000 CLAW) - 無鎖倉
 * - 私募投資者: 10% (100,000,000 CLAW) - 6個月 cliff
 * - OpenClaw基金: 15% (150,000,000 CLAW) - 12個月 cliff, 24個月線性解鎖
 * - 團隊: 10% (100,000,000 CLAW) - 12個月 cliff
 */
contract ClawCoin is ERC20, ERC20Permit, AccessControl, Pausable, ReentrancyGuard {
    
    // ============ Constants ============
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18; // 10億 CLAW
    uint8   public constant DECIMALS = 18;
    
    // ============ Roles ============
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    // ============ State ============
    bool public isInitialized = false;
    
    // 團隊錢包地址（部署時設定）
    address public ecosystemFund;
    address public communityAirdrop;
    address public liquidityPool;
    address public privateInvestors;
    address public openClawFund;
    address public teamWallet;
    
    // 時間鎖狀態
    uint256 public launchTime;
    
    // 解鎖狀態標記
    mapping(address => uint256) public lockedAmount;
    mapping(address => uint256) public vestingStart;
    mapping(address => uint256) public vestingDuration;
    
    // ============ Events ============
    event Initialized(
        address indexed ecosystemFund,
        address indexed communityAirdrop,
        address indexed liquidityPool,
        address privateInvestors,
        address openClawFund,
        address teamWallet
    );
    
    event TokensLocked(address indexed beneficiary, uint256 amount, uint256 startTime, uint256 duration);
    event TokensUnlocked(address indexed beneficiary, uint256 amount);
    event TeamWalletUpdated(address indexed oldWallet, address indexed newWallet);
    
    // ============ Modifiers ============
    modifier onlyInitialized() {
        require(isInitialized, "ClawCoin: not initialized");
        _;
    }
    
    // ============ Constructor ============
    constructor() 
        ERC20("ClawCoin", "CLAW") 
        ERC20Permit("ClawCoin") 
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        
        launchTime = block.timestamp;
    }
    
    // ============ Initialization ============
    /**
     * @dev 初始化代幣分配（只能調用一次）
     * @param _ecosystemFund 生態系統基金
     * @param _communityAirdrop 社群/空投
     * @param _liquidityPool 流動性池
     * @param _privateInvestors 私募投資者
     * @param _openClawFund OpenClaw基金
     * @param _teamWallet 團隊錢包
     */
    function initialize(
        address _ecosystemFund,
        address _communityAirdrop,
        address _liquidityPool,
        address _privateInvestors,
        address _openClawFund,
        address _teamWallet
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!isInitialized, "ClawCoin: already initialized");
        require(_ecosystemFund != address(0), "ClawCoin: zero address");
        require(_communityAirdrop != address(0), "ClawCoin: zero address");
        require(_liquidityPool != address(0), "ClawCoin: zero address");
        require(_privateInvestors != address(0), "ClawCoin: zero address");
        require(_openClawFund != address(0), "ClawCoin: zero address");
        require(_teamWallet != address(0), "ClawCoin: zero address");
        
        ecosystemFund = _ecosystemFund;
        communityAirdrop = _communityAirdrop;
        liquidityPool = _liquidityPool;
        privateInvestors = _privateInvestors;
        openClawFund = _openClawFund;
        teamWallet = _teamWallet;
        
        // ============ 代幣分配 ============
        
        // 流動性池 15% - 無鎖倉，TGE 100%
        _mint(liquidityPool, TOTAL_SUPPLY * 15 / 100);
        
        // 社群/空投 20% - TGE 10%
        uint256 communityTGE = TOTAL_SUPPLY * 20 / 100 * 10 / 100;
        _mint(communityAirdrop, communityTGE);
        // 其餘 18% 線性解鎖（12個月）
        _lockTokens(communityAirdrop, TOTAL_SUPPLY * 20 / 100 - communityTGE, 365 days);
        
        // 私募投資者 10% - 6個月 cliff
        _mint(privateInvestors, TOTAL_SUPPLY * 10 / 100);
        _lockTokens(privateInvestors, TOTAL_SUPPLY * 10 / 100, 0 seconds); // cliff = 0, 需手動解鎖
        
        // 生態系統基金 30% - 3個月 cliff, 24個月線性解鎖
        _mint(ecosystemFund, TOTAL_SUPPLY * 30 / 100);
        _lockTokens(ecosystemFund, TOTAL_SUPPLY * 30 / 100, 730 days);
        
        // OpenClaw基金 15% - 12個月 cliff, 24個月線性解鎖
        _mint(openClawFund, TOTAL_SUPPLY * 15 / 100);
        _lockTokens(openClawFund, TOTAL_SUPPLY * 15 / 100, 730 days);
        
        // 團隊 10% - 12個月 cliff
        _mint(teamWallet, TOTAL_SUPPLY * 10 / 100);
        _lockTokens(teamWallet, TOTAL_SUPPLY * 10 / 100, 730 days);
        
        isInitialized = true;
        
        emit Initialized(
            _ecosystemFund,
            _communityAirdrop,
            _liquidityPool,
            _privateInvestors,
            _openClawFund,
            _teamWallet
        );
    }
    
    // ============ Locking Mechanism ============
    function _lockTokens(address beneficiary, uint256 amount, uint256 duration) internal {
        if (amount > 0 && duration > 0) {
            lockedAmount[beneficiary] = amount;
            vestingStart[beneficiary] = block.timestamp;
            vestingDuration[beneficiary] = duration;
            emit TokensLocked(beneficiary, amount, block.timestamp, duration);
        }
    }
    
    function getLockedAmount(address beneficiary) public view returns (uint256) {
        if (lockedAmount[beneficiary] == 0) return 0;
        
        uint256 elapsed = block.timestamp - vestingStart[beneficiary];
        uint256 vested = 0;
        
        if (elapsed >= vestingDuration[beneficiary]) {
            vested = lockedAmount[beneficiary];
        } else {
            vested = lockedAmount[beneficiary] * elapsed / vestingDuration[beneficiary];
        }
        
        return lockedAmount[beneficiary] - vested;
    }
    
    // ============ Transfer Override (v4) ============
    function _beforeTokenTransfer(address from, address to, uint256 value) internal override onlyInitialized {
        // 檢查鎖倉
        if (from != address(0) && lockedAmount[from] > 0) {
            uint256 locked = getLockedAmount(from);
            require(balanceOf(from) - value >= locked, "ClawCoin: tokens locked");
        }
        super._beforeTokenTransfer(from, to, value);
    }
    
    // ============ Admin Functions ============
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
    
    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        _burn(from, amount);
    }
    
    // 解鎖私募（需手動處理 cliff）
    function unlockPrivateInvestor(address beneficiary) external onlyRole(OPERATOR_ROLE) {
        require(lockedAmount[beneficiary] > 0, "ClawCoin: no locked tokens");
        // 私募6個月後可手動解鎖
        lockedAmount[beneficiary] = 0;
        emit TokensUnlocked(beneficiary, 0);
    }
    
    // 更新團隊錢包（12個月後）
    function updateTeamWallet(address newWallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newWallet != address(0), "ClawCoin: zero address");
        address oldWallet = teamWallet;
        teamWallet = newWallet;
        emit TeamWalletUpdated(oldWallet, newWallet);
    }
    
    // 緊急提取（仅合约所有者）
    function emergencyWithdraw() external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        payable(msg.sender).transfer(address(this).balance);
    }
    
    // ============ View Functions ============
    function getTokenInfo() external view returns (
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 totalSupply_,
        uint256 circulatingSupply_
    ) {
        return (
            name(),
            symbol(),
            decimals(),
            totalSupply(),
            totalSupply() - lockedAmount[ecosystemFund] - lockedAmount[openClawFund] - lockedAmount[teamWallet]
        );
    }
}
