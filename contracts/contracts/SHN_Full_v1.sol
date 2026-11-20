// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address initialOwner
    )
        ERC20(name, symbol)
        ERC20Permit(name)
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

    // Required overrides
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}

// ==================== 2. ECOSYSTEM ====================
contract SHN_EcoSystem is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    SHN public immutable shnToken;
    IERC20 public immutable usdt;

    // ---- Sale Config ----
    uint256 public constant SHN_PER_USD   = 238;
    uint256 public constant MIN_BUY_USD   = 50   * 1e18;
    uint256 public constant MAX_BUY_USD   = 10000 * 1e18;
    uint256 public constant HARDCAP_USD   = 5_000_000 * 1e18;
    uint256 public totalRaised;
    bool    public saleActive;
    mapping(address => bool)    public whitelist;
    mapping(address => uint256) public userSpentUSD;

    // ---- Burn ----
    uint256 public constant BURN_BPS = 100; // 1%
    uint256 public totalBurned;

    // ---- Staking ----
    struct Stake { uint256 amount; uint256 rewardDebt; }
    mapping(address => Stake) public stakes;
    uint256 public totalStaked;
    uint256 public rewardPerTokenStored;
    uint256 public lastUpdateTime;
    uint256 public rewardRate = 100;
    uint256 public constant APR_BOOST_DURATION = 30 days;
    uint256 public boostEndTime;

    // ---- Referral ----
    uint256 public constant REFERRAL_BPS = 500; // 5%
    mapping(address => address) public referrers;
    mapping(address => uint256) public referralEarned;

    // ---- Vesting ----
    struct Vesting {
        uint256 total;
        uint256 claimed;
        uint256 start;
        uint256 duration;
    }
    mapping(address => Vesting) public vestings;

    // ---- Anti-Whale ----
    uint256 public maxWallet      = 500_000 * 1e18;
    uint256 public maxTx          = 100_000 * 1e18;
    uint256 public tradeCooldown  = 30;
    mapping(address => uint256) public lastTrade;
    mapping(address => bool)    public isBot;
    bool public limitsEnabled = true;

    // ---- Events ----
    event TokensPurchased(address indexed buyer, uint256 usd, uint256 shn, uint256 burned, address referrer);
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount, uint256 reward);
    event ReferralPaid(address indexed referrer, address indexed buyer, uint256 amount);
    event VestingAdded(address indexed beneficiary, uint256 amount);

    constructor(address _shn, address _usdt, address initialOwner)
        Ownable(initialOwner)
    {
        shnToken     = SHN(_shn);
        usdt         = IERC20(_usdt);
        boostEndTime = block.timestamp + APR_BOOST_DURATION;
    }

    // ---- Buy ----
    function buy(uint256 usdAmount, address referrer) external nonReentrant {
        require(saleActive, "Sale off");
        require(whitelist[msg.sender], "Not WL");
        require(usdAmount >= MIN_BUY_USD, "Min 50 USDT");
        require(userSpentUSD[msg.sender] + usdAmount <= MAX_BUY_USD, "Max 10k USDT");
        require(totalRaised + usdAmount <= HARDCAP_USD, "Hardcap reached");
        require(!isBot[msg.sender], "Bot detected");

        if (
            referrer != address(0) &&
            referrer != msg.sender &&
            referrers[msg.sender] == address(0)
        ) {
            referrers[msg.sender] = referrer;
        }

        usdt.safeTransferFrom(msg.sender, address(this), usdAmount);

        uint256 shnAmount  = usdAmount * SHN_PER_USD / 1e18;
        uint256 burnAmount = shnAmount * BURN_BPS / 10000;
        uint256 userAmount = shnAmount - burnAmount;

        address currentRef = referrers[msg.sender];
        if (currentRef != address(0)) {
            uint256 refAmount = shnAmount * REFERRAL_BPS / 10000;
            shnToken.transfer(currentRef, refAmount);
            referralEarned[currentRef] += refAmount;
            emit ReferralPaid(currentRef, msg.sender, refAmount);
        }

        shnToken.transfer(msg.sender, userAmount);
        shnToken.burn(burnAmount);

        totalRaised           += usdAmount;
        totalBurned           += burnAmount;
        userSpentUSD[msg.sender] += usdAmount;

        _checkLimits(msg.sender, userAmount);

        emit TokensPurchased(msg.sender, usdAmount, userAmount, burnAmount, currentRef);
    }

    // ---- Staking ----
    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) return rewardPerTokenStored;
        return rewardPerTokenStored
            + (rewardRate * (lastTimeRewardApplicable() - lastUpdateTime) * 1e18 / totalStaked);
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < boostEndTime ? block.timestamp : boostEndTime;
    }

    function earned(address account) public view returns (uint256) {
        return stakes[account].amount
            * (rewardPerToken() - stakes[account].rewardDebt)
            / 1e18;
    }

    function _updateReward(address account) internal {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime       = lastTimeRewardApplicable();
        if (account != address(0)) {
            stakes[account].rewardDebt = rewardPerToken();
        }
    }

    function stake(uint256 amount) external nonReentrant {
        _updateReward(msg.sender);
        shnToken.transferFrom(msg.sender, address(this), amount);
        stakes[msg.sender].amount += amount;
        totalStaked               += amount;
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external nonReentrant {
        require(stakes[msg.sender].amount >= amount, "Not enough staked");
        _updateReward(msg.sender);
        uint256 reward = earned(msg.sender);
        stakes[msg.sender].amount    -= amount;
        totalStaked                  -= amount;
        stakes[msg.sender].rewardDebt = rewardPerToken();
        if (reward > 0) shnToken.mint(msg.sender, reward);
        shnToken.transfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount, reward);
    }

    // ---- Vesting ----
    function addVesting(address beneficiary, uint256 amount, uint256 duration)
        external
        onlyOwner
    {
        require(vestings[beneficiary].total == 0, "Already exists");
        vestings[beneficiary] = Vesting(amount, 0, block.timestamp, duration);
        shnToken.transferFrom(msg.sender, address(this), amount);
        emit VestingAdded(beneficiary, amount);
    }

    function claimVested() external {
        Vesting storage v = vestings[msg.sender];
        require(v.total > 0, "No vesting schedule");
        uint256 elapsed   = block.timestamp - v.start;
        uint256 claimable = (v.total * elapsed / v.duration) - v.claimed;
        require(claimable > 0, "Nothing to claim");
        v.claimed += claimable;
        shnToken.transfer(msg.sender, claimable);
    }

    // ---- Anti-Whale ----
    function _checkLimits(address to, uint256 amount) internal {
        if (!limitsEnabled) return;
        require(shnToken.balanceOf(to) + amount <= maxWallet, "Exceeds max wallet");
        require(amount <= maxTx, "Exceeds max tx");
        require(block.timestamp >= lastTrade[tx.origin] + tradeCooldown, "Trade cooldown");
        lastTrade[tx.origin] = block.timestamp;
    }

    // ---- Admin ----
    function setBot(address bot, bool status) external onlyOwner { isBot[bot] = status; }
    function setSaleActive(bool _active) external onlyOwner { saleActive = _active; }
    function setLimitsEnabled(bool _enabled) external onlyOwner { limitsEnabled = _enabled; }
    function setMaxWallet(uint256 _max) external onlyOwner { maxWallet = _max; }
    function setMaxTx(uint256 _max) external onlyOwner { maxTx = _max; }
    function addToWhitelist(address[] calldata users) external onlyOwner {
        for (uint256 i = 0; i < users.length; i++) whitelist[users[i]] = true;
    }
    function withdrawUSDT() external onlyOwner {
        usdt.safeTransfer(owner(), usdt.balanceOf(address(this)));
    }
}

// ==================== 3. AIRDROP ====================
contract SHN_Airdrop is Ownable, ReentrancyGuard {
    IERC20  public immutable shn;
    bytes32 public immutable merkleRoot;
    uint256 public immutable airdropAmount;
    uint256 public immutable claimDeadline;

    mapping(address => bool) public claimed;
    uint256 public totalClaimed;

    event Claimed(address indexed user, uint256 amount);

    constructor(
        address _shn,
        bytes32 _merkleRoot,
        uint256 _airdropAmount,
        uint256 _durationDays,
        address initialOwner
    ) Ownable(initialOwner) {
        shn           = IERC20(_shn);
        merkleRoot    = _merkleRoot;
        airdropAmount = _airdropAmount;
        claimDeadline = block.timestamp + (_durationDays * 1 days);
    }

    function claim(bytes32[] calldata merkleProof) external nonReentrant {
        require(block.timestamp <= claimDeadline, "Airdrop ended");
        require(!claimed[msg.sender], "Already claimed");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, airdropAmount));
        require(MerkleProof.verify(merkleProof, merkleRoot, leaf), "Invalid proof");

        claimed[msg.sender]  = true;
        totalClaimed        += airdropAmount;
        shn.transfer(msg.sender, airdropAmount);

        emit Claimed(msg.sender, airdropAmount);
    }

    function withdrawUnclaimed() external onlyOwner {
        require(block.timestamp > claimDeadline, "Not ended yet");
        shn.transfer(owner(), shn.balanceOf(address(this)));
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

    function votingDelay()
        public view override(Governor, GovernorSettings) returns (uint256)
    { return super.votingDelay(); }

    function votingPeriod()
        public view override(Governor, GovernorSettings) returns (uint256)
    { return super.votingPeriod(); }

    function quorum(uint256 blockNumber)
        public view override(Governor, GovernorVotesQuorumFraction) returns (uint256)
    { return super.quorum(blockNumber); }

    function proposalThreshold()
        public view override(Governor, GovernorSettings) returns (uint256)
    { return super.proposalThreshold(); }

    function state(uint256 proposalId)
        public view override(Governor, GovernorTimelockControl) returns (ProposalState)
    { return super.state(proposalId); }

    function proposalNeedsQueuing(uint256 proposalId)
        public view override(Governor, GovernorTimelockControl) returns (bool)
    { return super.proposalNeedsQueuing(proposalId); }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint48) {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal view override(Governor, GovernorTimelockControl) returns (address)
    { return super._executor(); }
}
