// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Minimal interface for CardNFT (ERC-1155) — matches actual CardNFT.mint() signature.
interface ICardNFTMinter {
    function mint(address to, uint256 id, uint256 amount) external;
}

/// @dev Minimal interface for TreasuryVault — Dev 1.
interface ITreasuryVault {
    function withdrawFromPrizePool(address to, uint256 amount) external;
}

interface IRankSystemRewards {
    enum Rank { Bronze, Silver, Gold, Platinum, Diamond, Legend }
    function getPlayerStats(address player)
        external
        view
        returns (
            uint256 totalRP,
            uint256 currentSeasonRP,
            uint256 wins,
            uint256 losses,
            Rank    rank,
            bool    exists
        );
    function getLeaderboardPosition(address player) external view returns (uint256);
    function getTopLeaderboard() external view returns (address[100] memory);
}

/**
 * @title SeasonRewards
 * @notice Distributes three reward tracks at season end:
 *   1. Rank HLUSD  — amount scales with rank tier
 *   2. Leaderboard exclusive cards — top-100 get a special CardNFT
 *   3. Personal milestones — RP/win thresholds claimable independently
 *
 *   All rewards have a 90-day claim window from season finalization.
 */
contract SeasonRewards is Ownable, ReentrancyGuard {
    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    struct SeasonSnapshot {
        uint256 finalizedAt;    // timestamp when SeasonEngine finalized
        bool    exists;
    }

    struct MilestoneConfig {
        uint256 rpRequired;
        uint256 winsRequired;
        uint256 hlUSDAmount;    // in 18-decimal HLUSD
        uint256 exclusiveCardId; // 0 = no card, >0 = mint this card ID
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public constant CLAIM_WINDOW    = 90 days;
    uint256 public constant EXCLUSIVE_CARD_SUPPLY = 1; // 1-of-1 per address

    // HLUSD per rank tier (in wei, 18 decimals)
    uint256 public constant RANK_REWARD_BRONZE   = 0;
    uint256 public constant RANK_REWARD_SILVER   = 5  ether;
    uint256 public constant RANK_REWARD_GOLD     = 15 ether;
    uint256 public constant RANK_REWARD_PLATINUM = 35 ether;
    uint256 public constant RANK_REWARD_DIAMOND  = 75 ether;
    uint256 public constant RANK_REWARD_LEGEND   = 150 ether;

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    IERC20               public hlUSD;
    ICardNFTMinter       public cardNFT;
    ITreasuryVault       public treasuryVault;
    IRankSystemRewards   public rankSystem;

    /// @dev SeasonEngine is authorized to call markQuestRewardClaimable
    address public seasonEngine;
    address public questSystem;

    /// @dev seasonId → SeasonSnapshot
    mapping(uint256 => SeasonSnapshot) public seasonSnapshots;

    /// @dev seasonId → player → rankRewardClaimed
    mapping(uint256 => mapping(address => bool)) public rankRewardClaimed;

    /// @dev seasonId → player → leaderboardRewardClaimed
    mapping(uint256 => mapping(address => bool)) public leaderboardRewardClaimed;

    /// @dev seasonId → player → milestoneIndex → claimed
    mapping(uint256 => mapping(address => mapping(uint256 => bool))) public milestoneClaimed;

    /// @dev seasonId → player → questId → claimable (set by QuestSystem)
    mapping(uint256 => mapping(address => mapping(uint256 => bool))) public questRewardClaimable;

    /// @dev Milestone configs (global, updated per season by owner)
    MilestoneConfig[] public milestones;

    /// @dev leaderboard exclusive card token ID (set per season by owner)
    mapping(uint256 => uint256) public leaderboardCardId;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event SeasonRegistered(uint256 indexed seasonId, uint256 finalizedAt);
    event RewardClaimed(address indexed player, uint256 indexed seasonId, string rewardType, uint256 amount);
    event RewardExpired(address indexed player, uint256 indexed seasonId, string rewardType);
    event QuestRewardMarked(address indexed player, uint256 indexed seasonId, uint256 questId);

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error NotAuthorised();
    error SeasonNotRegistered(uint256 seasonId);
    error RewardAlreadyClaimed();
    error ClaimWindowExpired();
    error NotEligible();
    error InsufficientRewardPool();

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param _hlUSD          HLUSD token address (ERC-20).
     * @param _cardNFT        CardNFT address (Dev 1 placeholder).
     * @param _treasuryVault  TreasuryVault address (Dev 1 placeholder).
     * @param _rankSystem     RankSystem address.
     */
    constructor(
        address _hlUSD,
        address _cardNFT,
        address _treasuryVault,
        address _rankSystem
    ) Ownable(msg.sender) {
        hlUSD         = IERC20(_hlUSD);
        cardNFT       = ICardNFTMinter(_cardNFT);
        treasuryVault = ITreasuryVault(_treasuryVault);
        rankSystem    = IRankSystemRewards(_rankSystem);

        // Default milestones
        milestones.push(MilestoneConfig({ rpRequired: 1000,  winsRequired: 5,   hlUSDAmount: 2 ether,  exclusiveCardId: 0 }));
        milestones.push(MilestoneConfig({ rpRequired: 3000,  winsRequired: 15,  hlUSDAmount: 8 ether,  exclusiveCardId: 0 }));
        milestones.push(MilestoneConfig({ rpRequired: 8000,  winsRequired: 40,  hlUSDAmount: 20 ether, exclusiveCardId: 18 }));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function setAddresses(
        address _hlUSD,
        address _cardNFT,
        address _treasuryVault,
        address _rankSystem
    ) external onlyOwner {
        hlUSD         = IERC20(_hlUSD);
        cardNFT       = ICardNFTMinter(_cardNFT);
        treasuryVault = ITreasuryVault(_treasuryVault);
        rankSystem    = IRankSystemRewards(_rankSystem);
    }

    function setSeasonEngine(address _seasonEngine) external onlyOwner {
        seasonEngine = _seasonEngine;
    }

    function setQuestSystem(address _questSystem) external onlyOwner {
        questSystem = _questSystem;
    }

    function setLeaderboardCardId(uint256 seasonId, uint256 cardId) external onlyOwner {
        leaderboardCardId[seasonId] = cardId;
    }

    function setMilestones(MilestoneConfig[] calldata configs) external onlyOwner {
        delete milestones;
        for (uint256 i = 0; i < configs.length; i++) {
            milestones.push(configs[i]);
        }
    }

    /**
     * @notice Register a finalized season so rewards become claimable.
     *         Called by SeasonEngine after finalizeSeason().
     */
    function registerSeason(uint256 seasonId) external {
        if (msg.sender != seasonEngine && msg.sender != owner()) revert NotAuthorised();
        seasonSnapshots[seasonId] = SeasonSnapshot({
            finalizedAt: block.timestamp,
            exists: true
        });
        emit SeasonRegistered(seasonId, block.timestamp);
    }

    /**
     * @notice Called by QuestSystem when a player claims a quest reward.
     */
    function markQuestRewardClaimable(address player, uint256 seasonId, uint256 questId) external {
        if (msg.sender != questSystem && msg.sender != owner()) revert NotAuthorised();
        questRewardClaimable[seasonId][player][questId] = true;
        emit QuestRewardMarked(player, seasonId, questId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Track 1 — Rank Reward (HLUSD)
    // ─────────────────────────────────────────────────────────────────────────

    function claimRankReward(uint256 seasonId) external nonReentrant {
        _checkSeasonAndWindow(seasonId);
        if (rankRewardClaimed[seasonId][msg.sender]) revert RewardAlreadyClaimed();

        uint256 amount = _rankRewardAmount(msg.sender);
        if (amount == 0) revert NotEligible();

        rankRewardClaimed[seasonId][msg.sender] = true;

        // Pull from TreasuryVault prize pool
        if (address(treasuryVault) != address(0)) {
            treasuryVault.withdrawFromPrizePool(msg.sender, amount);
        } else {
            // Fallback: direct transfer from contract balance (for testing)
            require(hlUSD.transfer(msg.sender, amount), "HLUSD transfer failed");
        }

        emit RewardClaimed(msg.sender, seasonId, "rank", amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Track 2 — Leaderboard Exclusive Card
    // ─────────────────────────────────────────────────────────────────────────

    function claimLeaderboardReward(uint256 seasonId) external nonReentrant {
        _checkSeasonAndWindow(seasonId);
        if (leaderboardRewardClaimed[seasonId][msg.sender]) revert RewardAlreadyClaimed();

        // Verify top-100 position
        uint256 position = rankSystem.getLeaderboardPosition(msg.sender);
        if (position == 0 || position > 100) revert NotEligible();

        uint256 cardId = leaderboardCardId[seasonId];
        if (cardId == 0) revert NotEligible();

        leaderboardRewardClaimed[seasonId][msg.sender] = true;

        if (address(cardNFT) != address(0)) {
            cardNFT.mint(msg.sender, cardId, EXCLUSIVE_CARD_SUPPLY);
        }

        emit RewardClaimed(msg.sender, seasonId, "leaderboard", cardId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Track 3 — Personal Milestones
    // ─────────────────────────────────────────────────────────────────────────

    function claimMilestone(uint256 seasonId, uint256 milestoneIndex) external nonReentrant {
        _checkSeasonAndWindow(seasonId);
        if (milestoneIndex >= milestones.length) revert NotEligible();
        if (milestoneClaimed[seasonId][msg.sender][milestoneIndex]) revert RewardAlreadyClaimed();

        MilestoneConfig memory cfg = milestones[milestoneIndex];

        (uint256 totalRP, , uint256 wins, , , ) = rankSystem.getPlayerStats(msg.sender);
        if (totalRP < cfg.rpRequired || wins < cfg.winsRequired) revert NotEligible();

        milestoneClaimed[seasonId][msg.sender][milestoneIndex] = true;

        if (cfg.hlUSDAmount > 0) {
            if (address(treasuryVault) != address(0)) {
                treasuryVault.withdrawFromPrizePool(msg.sender, cfg.hlUSDAmount);
            } else {
                require(hlUSD.transfer(msg.sender, cfg.hlUSDAmount), "HLUSD transfer failed");
            }
        }
        if (cfg.exclusiveCardId > 0 && address(cardNFT) != address(0)) {
            cardNFT.mint(msg.sender, cfg.exclusiveCardId, 1);
        }

        emit RewardClaimed(msg.sender, seasonId, "milestone", milestoneIndex);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    function getMilestoneCount() external view returns (uint256) {
        return milestones.length;
    }

    function getClaimDeadline(uint256 seasonId) external view returns (uint256) {
        SeasonSnapshot memory s = seasonSnapshots[seasonId];
        if (!s.exists) return 0;
        return s.finalizedAt + CLAIM_WINDOW;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _checkSeasonAndWindow(uint256 seasonId) internal view {
        SeasonSnapshot memory s = seasonSnapshots[seasonId];
        if (!s.exists) revert SeasonNotRegistered(seasonId);
        if (block.timestamp > s.finalizedAt + CLAIM_WINDOW) revert ClaimWindowExpired();
    }

    function _rankRewardAmount(address player) internal view returns (uint256) {
        (, , , , IRankSystemRewards.Rank rank, bool exists) = rankSystem.getPlayerStats(player);
        if (!exists) return 0;
        if (rank == IRankSystemRewards.Rank.Legend)   return RANK_REWARD_LEGEND;
        if (rank == IRankSystemRewards.Rank.Diamond)  return RANK_REWARD_DIAMOND;
        if (rank == IRankSystemRewards.Rank.Platinum) return RANK_REWARD_PLATINUM;
        if (rank == IRankSystemRewards.Rank.Gold)     return RANK_REWARD_GOLD;
        if (rank == IRankSystemRewards.Rank.Silver)   return RANK_REWARD_SILVER;
        return RANK_REWARD_BRONZE;
    }
}
