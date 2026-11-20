// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ============================================================================
// SHN v2 — Shaheen Coin on BNB Chain
// Fixes over v1 (SHN_Full.sol (2).txt), each covered by test/v2.test.js:
//  F1  buy(): SHN amount no longer divided by 1e18 (v1 paid 94,248 wei for 400 USDT)
//  F2  hardcap is 2,400,000 USDT and can only be raised, by the owner (DAO Timelock)
//  F3  sale inventory excludes staked principal, reward pool and unvested tokens
//  F4  vesting can never pay more than the allocation
//  F5  staking pays real rewards from a funded pool (Synthetix model); no mint() call
//  F6  anti-whale on the sale = per-wallet USDT cap + cooldown + bot list
//      (v1 maxTx/maxWallet would have blocked buys above ~424 USDT once F1 is fixed)
//  F7  operator role for day-to-day sale admin (whitelist, pause) so the
//      48h Timelock is not needed for each buyer
//  F8  token clock is timestamp-based, so DAO "1 days / 1 weeks" are real days
// ============================================================================

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";

// ==================== 1. SHN TOKEN ====================
contract SHN is ERC20, ERC20Permit, ERC20Votes, Ownable {
    constructor(string memory name_, string memory symbol_, uint256 initialSupply, address initialOwner)
        ERC20(name_, symbol_)
        ERC20Permit(name_)
        Ownable(initialOwner)
    {
        _mint(initialOwner, initialSupply);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    // F8: governance durations in seconds, not blocks
    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }

    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }

    function nonces(address owner_) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner_);
    }
}

// ==================== 2. ECOSYSTEM ====================
contract SHN_EcoSystem is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeERC20 for SHN;

    SHN public immutable shnToken;
    IERC20 public immutable usdt;

    // ---- Sale ----
    uint256 public constant SHN_PER_USD = 238;
    uint256 public constant MIN_BUY_USD = 50 * 1e18;
    uint256 public constant MAX_BUY_USD = 10_000 * 1e18;
    uint256 public hardcapUSD = 2_400_000 * 1e18; // F2
    uint256 public totalRaised;
    bool public saleActive;
    bool public whitelistRequired = true;
    mapping(address => bool) public whitelist;
    mapping(address => uint256) public userSpentUSD;

    // ---- Burn / Referral ----
    uint256 public constant BURN_BPS = 100; // 1%
    uint256 public constant REFERRAL_BPS = 500; // 5%, single level
    uint256 public totalBurned;
    mapping(address => address) public referrers;
    mapping(address => uint256) public referralEarned;

    // ---- Anti-whale (F6) ----
    uint256 public tradeCooldown = 30;
    mapping(address => uint256) public lastBuy;
    mapping(address => bool) public isBot;

    // ---- Roles (F7) ----
    address public operator;

    // ---- Staking (F5) ----
    mapping(address => uint256) public staked;
    uint256 public totalStaked;
    uint256 public rewardRate; // SHN per second
    uint256 public periodFinish;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public rewardPool; // funded and not yet paid
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    // ---- Vesting (F4) ----
    struct Vesting { uint256 total; uint256 claimed; uint256 start; uint256 duration; }
    mapping(address => Vesting) public vestings;
    uint256 public vestingOutstanding;

    // ---- Events ----
    event TokensPurchased(address indexed buyer, uint256 usd, uint256 shn, uint256 burned, address referrer);
    event ReferralPaid(address indexed referrer, address indexed buyer, uint256 amount);
    event HardcapRaised(uint256 oldCap, uint256 newCap);
    event OperatorSet(address indexed operator);
    event SaleActiveSet(bool active);
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardsFunded(uint256 amount, uint256 duration, uint256 rate);
    event VestingAdded(address indexed beneficiary, uint256 amount, uint256 duration);
    event VestingClaimed(address indexed beneficiary, uint256 amount);

    modifier onlyOperator() {
        require(msg.sender == operator || msg.sender == owner(), "Not operator");
        _;
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    constructor(address _shn, address _usdt, address initialOwner, address _operator) Ownable(initialOwner) {
        shnToken = SHN(_shn);
        usdt = IERC20(_usdt);
        operator = _operator;
        emit OperatorSet(_operator);
    }

    // ---------------- Views ----------------
    /// SHN the contract may sell: balance minus staked principal, reward pool and unvested tokens (F3)
    function saleInventory() public view returns (uint256) {
        uint256 bal = shnToken.balanceOf(address(this));
        uint256 locked = totalStaked + rewardPool + vestingOutstanding;
        return bal > locked ? bal - locked : 0;
    }

    function quote(uint256 usdAmount) public pure returns (uint256 gross, uint256 burned, uint256 toBuyer, uint256 referral) {
        gross = usdAmount * SHN_PER_USD; // F1 — both sides use 18 decimals
        burned = (gross * BURN_BPS) / 10000;
        toBuyer = gross - burned;
        referral = (gross * REFERRAL_BPS) / 10000;
    }

    // ---------------- Sale ----------------
    function buy(uint256 usdAmount, address referrer) external nonReentrant {
        require(saleActive, "Sale off");
        require(!whitelistRequired || whitelist[msg.sender], "Not WL");
        require(!isBot[msg.sender], "Bot detected");
        require(usdAmount >= MIN_BUY_USD, "Min 50 USDT");
        require(userSpentUSD[msg.sender] + usdAmount <= MAX_BUY_USD, "Max 10k USDT");
        require(totalRaised + usdAmount <= hardcapUSD, "Hardcap reached");
        require(block.timestamp >= lastBuy[msg.sender] + tradeCooldown, "Trade cooldown");

        if (referrer != address(0) && referrer != msg.sender && referrers[msg.sender] == address(0)) {
            referrers[msg.sender] = referrer;
        }
        address ref = referrers[msg.sender];

        (uint256 gross, uint256 burned, uint256 toBuyer, uint256 refAmount) = quote(usdAmount);
        if (ref == address(0)) refAmount = 0;
        require(saleInventory() >= gross + refAmount, "Sold out");

        // effects
        totalRaised += usdAmount;
        userSpentUSD[msg.sender] += usdAmount;
        totalBurned += burned;
        lastBuy[msg.sender] = block.timestamp;
        if (refAmount > 0) referralEarned[ref] += refAmount;

        // interactions
        usdt.safeTransferFrom(msg.sender, address(this), usdAmount);
        shnToken.safeTransfer(msg.sender, toBuyer);
        shnToken.burn(burned);
        if (refAmount > 0) {
            shnToken.safeTransfer(ref, refAmount);
            emit ReferralPaid(ref, msg.sender, refAmount);
        }
        emit TokensPurchased(msg.sender, usdAmount, toBuyer, burned, ref);
    }

    // ---------------- Staking (F5) ----------------
    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) return rewardPerTokenStored;
        return rewardPerTokenStored + ((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18) / totalStaked;
    }

    function earned(address account) public view returns (uint256) {
        return (staked[account] * (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18 + rewards[account];
    }

    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Zero amount");
        staked[msg.sender] += amount;
        totalStaked += amount;
        shnToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) public nonReentrant updateReward(msg.sender) {
        require(amount > 0 && staked[msg.sender] >= amount, "Not enough staked");
        staked[msg.sender] -= amount;
        totalStaked -= amount;
        shnToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function claimRewards() public nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardPool -= reward;
            shnToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    /// Owner funds a reward period; rewards can never exceed what was funded.
    function fundRewards(uint256 amount, uint256 duration) external onlyOwner updateReward(address(0)) {
        require(duration > 0 && amount > 0, "Bad params");
        shnToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 leftover = block.timestamp < periodFinish ? (periodFinish - block.timestamp) * rewardRate : 0;
        rewardRate = (amount + leftover) / duration;
        require(rewardRate > 0, "Rate zero");
        rewardPool += amount;
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + duration;
        emit RewardsFunded(amount, duration, rewardRate);
    }

    // ---------------- Vesting (F4) ----------------
    function addVesting(address beneficiary, uint256 amount, uint256 duration) external onlyOwner {
        require(beneficiary != address(0) && amount > 0 && duration > 0, "Bad params");
        require(vestings[beneficiary].total == 0, "Already exists");
        vestings[beneficiary] = Vesting(amount, 0, block.timestamp, duration);
        vestingOutstanding += amount;
        shnToken.safeTransferFrom(msg.sender, address(this), amount);
        emit VestingAdded(beneficiary, amount, duration);
    }

    function vestedAmount(address beneficiary) public view returns (uint256) {
        Vesting memory v = vestings[beneficiary];
        if (v.total == 0) return 0;
        uint256 elapsed = block.timestamp - v.start;
        return elapsed >= v.duration ? v.total : (v.total * elapsed) / v.duration;
    }

    function claimVested() external nonReentrant {
        Vesting storage v = vestings[msg.sender];
        require(v.total > 0, "No vesting schedule");
        uint256 claimable = vestedAmount(msg.sender) - v.claimed;
        require(claimable > 0, "Nothing to claim");
        v.claimed += claimable;
        vestingOutstanding -= claimable;
        shnToken.safeTransfer(msg.sender, claimable);
        emit VestingClaimed(msg.sender, claimable);
    }

    // ---------------- Admin ----------------
    function setOperator(address _operator) external onlyOwner {
        operator = _operator;
        emit OperatorSet(_operator);
    }

    function raiseHardcap(uint256 newCap) external onlyOwner {
        require(newCap > hardcapUSD, "Cap can only increase");
        emit HardcapRaised(hardcapUSD, newCap);
        hardcapUSD = newCap;
    }

    function setSaleActive(bool active) external onlyOperator {
        saleActive = active;
        emit SaleActiveSet(active);
    }

    function setWhitelistRequired(bool required) external onlyOperator { whitelistRequired = required; }
    function setBot(address bot, bool status) external onlyOperator { isBot[bot] = status; }
    function setTradeCooldown(uint256 secs) external onlyOperator { require(secs <= 1 days, "Too long"); tradeCooldown = secs; }

    function addToWhitelist(address[] calldata users) external onlyOperator {
        for (uint256 i = 0; i < users.length; i++) whitelist[users[i]] = true;
    }

    function removeFromWhitelist(address[] calldata users) external onlyOperator {
        for (uint256 i = 0; i < users.length; i++) whitelist[users[i]] = false;
    }

    function withdrawUSDT() external onlyOwner {
        usdt.safeTransfer(owner(), usdt.balanceOf(address(this)));
    }

    /// Unsold SHN only — staked, reward and vesting balances stay protected (F3)
    function withdrawUnsold(uint256 amount) external onlyOwner {
        require(amount <= saleInventory(), "Exceeds unsold");
        shnToken.safeTransfer(owner(), amount);
    }
}

// ==================== 3. AIRDROP ====================
contract SHN_Airdrop is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable shn;
    bytes32 public immutable merkleRoot;
    uint256 public immutable airdropAmount;
    uint256 public immutable claimDeadline;

    mapping(address => bool) public claimed;
    uint256 public totalClaimed;

    event Claimed(address indexed user, uint256 amount);

    constructor(address _shn, bytes32 _merkleRoot, uint256 _airdropAmount, uint256 _durationDays, address initialOwner)
        Ownable(initialOwner)
    {
        shn = IERC20(_shn);
        merkleRoot = _merkleRoot;
        airdropAmount = _airdropAmount;
        claimDeadline = block.timestamp + (_durationDays * 1 days);
    }

    function claim(bytes32[] calldata merkleProof) external nonReentrant {
        require(block.timestamp <= claimDeadline, "Airdrop ended");
        require(!claimed[msg.sender], "Already claimed");
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, airdropAmount));
        require(MerkleProof.verify(merkleProof, merkleRoot, leaf), "Invalid proof");
        claimed[msg.sender] = true;
        totalClaimed += airdropAmount;
        shn.safeTransfer(msg.sender, airdropAmount);
        emit Claimed(msg.sender, airdropAmount);
    }

    function withdrawUnclaimed() external onlyOwner {
        require(block.timestamp > claimDeadline, "Not ended yet");
        shn.safeTransfer(owner(), shn.balanceOf(address(this)));
    }
}

// ==================== 4. DAO ====================
contract SHN_DAO is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    constructor(IVotes _token, TimelockController _timelock)
        Governor("Shaheen DAO")
        GovernorSettings(1 days, 1 weeks, 10_000e18)
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(4)
        GovernorTimelockControl(_timelock)
    {}

    function votingDelay() public view override(Governor, GovernorSettings) returns (uint256) { return super.votingDelay(); }
    function votingPeriod() public view override(Governor, GovernorSettings) returns (uint256) { return super.votingPeriod(); }
    function quorum(uint256 timepoint) public view override(Governor, GovernorVotesQuorumFraction) returns (uint256) { return super.quorum(timepoint); }
    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) { return super.proposalThreshold(); }
    function state(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (ProposalState) { return super.state(proposalId); }
    function proposalNeedsQueuing(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (bool) { return super.proposalNeedsQueuing(proposalId); }

    function _queueOperations(uint256 proposalId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
        internal override(Governor, GovernorTimelockControl) returns (uint48)
    { return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash); }

    function _executeOperations(uint256 proposalId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
        internal override(Governor, GovernorTimelockControl)
    { super._executeOperations(proposalId, targets, values, calldatas, descriptionHash); }

    function _cancel(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
        internal override(Governor, GovernorTimelockControl) returns (uint256)
    { return super._cancel(targets, values, calldatas, descriptionHash); }

    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) { return super._executor(); }
}
