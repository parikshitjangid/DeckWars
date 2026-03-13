// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./CardNFT.sol";
import "./TreasuryVault.sol";

/**
 * @title SeasonPass
 * @notice Players purchase a Season Pass with HLUSD.
 *         Pass tracks XP per player from 1–100.
 *         Milestone rewards are claimable at specific levels.
 *         hasPremiumMultiplier() is used by Dev 2's contracts for 2× XP bonus.
 */
contract SeasonPass is Ownable {
    using SafeERC20 for IERC20;

    // ─── Types ───────────────────────────────────────────────────────────────

    struct PlayerPass {
        bool    active;
        uint256 seasonId;
        uint8   level;       // 1–100
        uint256 xp;          // cumulative XP within current level
        uint256 totalXP;     // lifetime XP this season
    }

    struct Milestone {
        uint8   requiredLevel;
        uint8   cardTokenId;   // 0 = no card reward, >0 = mint this card ID
        bool    exists;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    IERC20        public immutable hlusd;
    TreasuryVault public immutable treasury;
    CardNFT       public cardNFT; // set after CardNFT deploy; used for milestone card mints

    uint256 public currentSeasonId;
    uint256 public passPriceHLUSD;        // e.g., 20 HLUSD
    uint256 public xpPerLevel;            // XP required to advance one level (e.g., 100)
    uint8   public multiplierThreshold;   // min level to count as premium multiplier (e.g., 1)

    mapping(address => PlayerPass) public passes;
    mapping(address => mapping(uint8 => bool)) public milestoneClaimed; // player → level → claimed

    /// @notice Milestones: level → Milestone
    mapping(uint8 => Milestone) public milestones;

    /// @notice Authorized XP granting addresses (QuestSystem, etc. from Dev 2)
    mapping(address => bool) public authorizedXPGranters;

    // ─── Events ──────────────────────────────────────────────────────────────

    event PassPurchased(address indexed player, uint256 seasonId);
    event XPAdded(address indexed player, uint256 amount, uint8 newLevel);
    event LevelUp(address indexed player, uint8 newLevel);
    event MilestoneClaimed(address indexed player, uint8 level);
    event SeasonAdvanced(uint256 newSeasonId);
    event MilestoneSet(uint8 level, uint8 cardTokenId);
    event XPGranterAuthorized(address indexed granter);
    event XPGranterRevoked(address indexed granter);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error PassAlreadyActive();
    error NoActivePass();
    error MilestoneNotReached(uint8 required, uint8 current);
    error MilestoneAlreadyClaimed();
    error MilestoneNotConfigured(uint8 level);
    error NotAuthorizedXPGranter();
    error PassIsForOldSeason();

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _treasury, address _hlusd) Ownable(msg.sender) {
        treasury          = TreasuryVault(_treasury);
        hlusd             = IERC20(_hlusd);
        currentSeasonId   = 1;
        passPriceHLUSD    = 10 ether;  // 10 HLUSD — matches design doc
        xpPerLevel        = 100;       // 100 XP per level
        multiplierThreshold = 1;       // any active pass owner gets 2× multiplier
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    /// @notice Link CardNFT for milestone card minting
    function setCardNFT(address _cardNFT) external onlyOwner {
        cardNFT = CardNFT(_cardNFT);
    }

    /// @notice Set pass price (in HLUSD, 18 decimals)
    function setPassPrice(uint256 price) external onlyOwner {
        passPriceHLUSD = price;
    }

    /// @notice Configure a milestone reward
    function setMilestone(uint8 level, uint8 cardTokenId) external onlyOwner {
        milestones[level] = Milestone(level, cardTokenId, true);
        emit MilestoneSet(level, cardTokenId);
    }

    /// @notice Advance to a new season (resets passes)
    function advanceSeason() external onlyOwner {
        currentSeasonId++;
        emit SeasonAdvanced(currentSeasonId);
    }

    /// @notice Authorize a contract to grant XP (QuestSystem, etc.)
    function authorizeXPGranter(address granter) external onlyOwner {
        authorizedXPGranters[granter] = true;
        emit XPGranterAuthorized(granter);
    }

    function revokeXPGranter(address granter) external onlyOwner {
        authorizedXPGranters[granter] = false;
        emit XPGranterRevoked(granter);
    }

    // ─── Core ────────────────────────────────────────────────────────────────

    /**
     * @notice Purchase a Season Pass for the current season.
     *         Player must approve this contract for at least passPriceHLUSD.
     */
    function purchasePass() external {
        PlayerPass storage p = passes[msg.sender];
        if (p.active && p.seasonId == currentSeasonId) revert PassAlreadyActive();

        // Collect payment → TreasuryVault
        hlusd.safeTransferFrom(msg.sender, address(treasury), passPriceHLUSD);
        treasury.receiveRevenue(passPriceHLUSD);

        // Initialize/reset pass for current season
        passes[msg.sender] = PlayerPass({
            active:    true,
            seasonId:  currentSeasonId,
            level:     1,
            xp:        0,
            totalXP:   0
        });

        emit PassPurchased(msg.sender, currentSeasonId);
    }

    /**
     * @notice Grant XP to a player's season pass.
     *         Only authorized XP granters can call this.
     */
    function addXP(address player, uint256 amount) external {
        if (!authorizedXPGranters[msg.sender]) revert NotAuthorizedXPGranter();
        PlayerPass storage p = passes[player];
        if (!p.active || p.seasonId != currentSeasonId) revert NoActivePass();

        p.xp += amount;
        p.totalXP += amount;

        // Level-up loop
        while (p.xp >= xpPerLevel && p.level < 100) {
            p.xp -= xpPerLevel;
            p.level++;
            emit LevelUp(player, p.level);
        }

        emit XPAdded(player, amount, p.level);
    }

    /**
     * @notice Claim a milestone reward at a specific level.
     */
    function claimMilestone(uint8 level) external {
        PlayerPass storage p = passes[msg.sender];
        if (!p.active || p.seasonId != currentSeasonId) revert NoActivePass();
        if (p.level < level) revert MilestoneNotReached(level, p.level);
        if (milestoneClaimed[msg.sender][level]) revert MilestoneAlreadyClaimed();

        Milestone memory m = milestones[level];
        if (!m.exists) revert MilestoneNotConfigured(level);

        milestoneClaimed[msg.sender][level] = true;

        // Mint card reward if configured
        if (m.cardTokenId > 0 && address(cardNFT) != address(0)) {
            cardNFT.mint(msg.sender, m.cardTokenId, 1);
        }

        emit MilestoneClaimed(msg.sender, level);
    }

    // ─── Views (for Dev 2 integration) ───────────────────────────────────────

    /**
     * @notice Returns true if player has an active pass this season at or above
     *         the multiplierThreshold level. Used by Dev 2's QuestSystem/RankSystem.
     */
    function hasPremiumMultiplier(address player) external view returns (bool) {
        PlayerPass storage p = passes[player];
        return p.active && p.seasonId == currentSeasonId && p.level >= multiplierThreshold;
    }

    /// @notice Full pass info for a player
    function getPass(address player) external view returns (PlayerPass memory) {
        return passes[player];
    }
}
