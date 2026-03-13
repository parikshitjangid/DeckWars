// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @dev Minimal interface for SeasonRewards — provided by this same Dev 2 deploy.
interface ISeasonRewards {
    function markQuestRewardClaimable(address player, uint256 seasonId, uint256 questId) external;
}

/**
 * @title QuestSystem
 * @notice Manages 5 quests per season, tracks player progress, handles DAO
 *         card voting (1 wallet = 1 vote per season), and triggers reward
 *         claims through SeasonRewards.
 */
contract QuestSystem is Ownable {
    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    struct Quest {
        uint256 questId;
        string  description;
        uint256 targetProgress; // e.g. win 10 battles
        bool    active;
    }

    struct PlayerQuestData {
        uint256 progress;
        bool    completed;
        bool    rewardClaimed;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public constant QUESTS_PER_SEASON = 5;

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    ISeasonRewards public seasonRewards;

    /// @dev seasonId → questIndex (0-4) → Quest
    mapping(uint256 => Quest[QUESTS_PER_SEASON]) public seasonQuests;

    /// @dev seasonId → player → questIndex → PlayerQuestData
    mapping(uint256 => mapping(address => PlayerQuestData[QUESTS_PER_SEASON])) public playerQuestData;

    /// @dev DAO card voting: seasonId → cardId → voteCount
    mapping(uint256 => mapping(uint256 => uint256)) public cardVotes;

    /// @dev seasonId → player → hasVoted (1 wallet = 1 vote per season)
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    /// @dev Authorised callers that can update progress (SeasonEngine, BattleEngine)
    mapping(address => bool) public authorisedUpdater;

    uint256 public currentSeasonId;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event QuestProgressUpdated(address indexed player, uint256 indexed seasonId, uint256 indexed questId, uint256 progress);
    event QuestCompleted(address indexed player, uint256 indexed seasonId, uint256 indexed questId);
    event QuestRewardClaimed(address indexed player, uint256 indexed seasonId, uint256 indexed questId);
    event CardVoted(address indexed voter, uint256 indexed seasonId, uint256 indexed cardId);
    event SeasonQuestsSet(uint256 indexed seasonId);

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error NotAuthorised();
    error InvalidQuestId(uint256 questId);
    error QuestNotCompleted(uint256 questId);
    error AlreadyClaimed(uint256 questId);
    error AlreadyVoted(address voter);
    error QuestNotActive(uint256 questId);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function setSeasonRewards(address _seasonRewards) external onlyOwner {
        seasonRewards = ISeasonRewards(_seasonRewards);
    }

    function setAuthorisedUpdater(address updater, bool status) external onlyOwner {
        authorisedUpdater[updater] = status;
    }

    /**
     * @notice Define all 5 quests for a new season. Called by SeasonEngine on startSeason.
     */
    function setSeasonQuests(
        uint256 seasonId,
        string[QUESTS_PER_SEASON] calldata descriptions,
        uint256[QUESTS_PER_SEASON] calldata targets
    ) external {
        if (!authorisedUpdater[msg.sender] && msg.sender != owner()) revert NotAuthorised();
        for (uint256 i = 0; i < QUESTS_PER_SEASON; i++) {
            seasonQuests[seasonId][i] = Quest({
                questId: i,
                description: descriptions[i],
                targetProgress: targets[i],
                active: true
            });
        }
        emit SeasonQuestsSet(seasonId);
    }

    function setCurrentSeasonId(uint256 seasonId) external {
        if (!authorisedUpdater[msg.sender] && msg.sender != owner()) revert NotAuthorised();
        currentSeasonId = seasonId;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Update a player's quest progress. Called by BattleEngine or SeasonEngine.
     * @param player    The player address.
     * @param seasonId  Current season.
     * @param questId   Quest index (0-4).
     * @param amount    Progress increment.
     */
    function updateProgress(
        address player,
        uint256 seasonId,
        uint256 questId,
        uint256 amount
    ) external {
        if (!authorisedUpdater[msg.sender] && msg.sender != owner()) revert NotAuthorised();
        if (questId >= QUESTS_PER_SEASON) revert InvalidQuestId(questId);

        Quest storage quest = seasonQuests[seasonId][questId];
        if (!quest.active) revert QuestNotActive(questId);

        PlayerQuestData storage data = playerQuestData[seasonId][player][questId];
        if (data.completed) return; // already done, no-op

        data.progress += amount;

        emit QuestProgressUpdated(player, seasonId, questId, data.progress);

        if (data.progress >= quest.targetProgress) {
            data.completed = true;
            emit QuestCompleted(player, seasonId, questId);
        }
    }

    /**
     * @notice Claim reward for a completed quest.
     */
    function claimQuestReward(uint256 seasonId, uint256 questId) external {
        if (questId >= QUESTS_PER_SEASON) revert InvalidQuestId(questId);

        PlayerQuestData storage data = playerQuestData[seasonId][msg.sender][questId];
        if (!data.completed) revert QuestNotCompleted(questId);
        if (data.rewardClaimed) revert AlreadyClaimed(questId);

        data.rewardClaimed = true;

        // Notify SeasonRewards to make the reward claimable
        if (address(seasonRewards) != address(0)) {
            seasonRewards.markQuestRewardClaimable(msg.sender, seasonId, questId);
        }

        emit QuestRewardClaimed(msg.sender, seasonId, questId);
    }

    /**
     * @notice Cast a DAO vote for which card should be added next season.
     *         1 wallet = 1 vote per season.
     * @param cardId   The proposed card token ID to vote for.
     */
    function voteOnCard(uint256 cardId) external {
        uint256 seasonId = currentSeasonId;
        if (hasVoted[seasonId][msg.sender]) revert AlreadyVoted(msg.sender);

        hasVoted[seasonId][msg.sender] = true;
        cardVotes[seasonId][cardId] += 1;

        emit CardVoted(msg.sender, seasonId, cardId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    function getPlayerProgress(
        address player,
        uint256 seasonId,
        uint256 questId
    ) external view returns (PlayerQuestData memory) {
        return playerQuestData[seasonId][player][questId];
    }

    function getSeasonQuests(uint256 seasonId)
        external
        view
        returns (Quest[QUESTS_PER_SEASON] memory)
    {
        return seasonQuests[seasonId];
    }

    function getCardVotes(uint256 seasonId, uint256 cardId) external view returns (uint256) {
        return cardVotes[seasonId][cardId];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Convenience hooks (called by CraftingSystem, BattleEngine)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Called by CraftingSystem after a successful craft.
     *         Increments the Crafter quest (index 1 by default).
     */
    function notifyCraft(address player) external {
        if (!authorisedUpdater[msg.sender] && msg.sender != owner()) revert NotAuthorised();
        // Quest index 1 = "Craft 3 cards" by default
        _incrementQuestIfActive(player, currentSeasonId, 1, 1);
    }

    /**
     * @notice Called by BattleEngine after a battle win.
     *         Increments the battle-win quest (index 0 by default).
     */
    function notifyBattleWin(address player) external {
        if (!authorisedUpdater[msg.sender] && msg.sender != owner()) revert NotAuthorised();
        // Quest index 0 = "Win X battles" by default
        _incrementQuestIfActive(player, currentSeasonId, 0, 1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _incrementQuestIfActive(
        address player,
        uint256 seasonId,
        uint256 questId,
        uint256 amount
    ) internal {
        if (questId >= QUESTS_PER_SEASON) return;
        Quest storage quest = seasonQuests[seasonId][questId];
        if (!quest.active) return;
        PlayerQuestData storage data = playerQuestData[seasonId][player][questId];
        if (data.completed) return;
        data.progress += amount;
        emit QuestProgressUpdated(player, seasonId, questId, data.progress);
        if (data.progress >= quest.targetProgress) {
            data.completed = true;
            emit QuestCompleted(player, seasonId, questId);
        }
    }
}
