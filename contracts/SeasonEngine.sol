// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IQuestSystem {
    function setSeasonQuests(
        uint256 seasonId,
        string[5] calldata descriptions,
        uint256[5] calldata targets
    ) external;
    function setCurrentSeasonId(uint256 seasonId) external;
}

interface IRankSystem {
    function resetSeasonRP(uint256 seasonId) external;
    function getTopLeaderboard() external view returns (address[100] memory);
}

/**
 * @title SeasonEngine
 * @notice Manages the 30-day season lifecycle: start, finalization, and
 *         a permanent on-chain historical archive of past seasons.
 */
contract SeasonEngine is Ownable {
    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    struct Season {
        uint256 id;
        uint256 startTime;
        uint256 endTime;      // startTime + 30 days
        bool    finalized;
        bytes32 archiveHash;  // keccak256 of leaderboard snapshot at finalization
        address[100] topPlayers; // leaderboard snapshot on finalization
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public constant SEASON_DURATION = 30 days;

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    IQuestSystem public questSystem;
    IRankSystem  public rankSystem;

    uint256 public currentSeasonId;
    bool    public seasonActive;

    /// @dev seasonId → Season (permanent archive)
    mapping(uint256 => Season) public seasons;

    // Default quest data — owner can override before each season start
    string[5] public defaultQuestDescriptions;
    uint256[5] public defaultQuestTargets;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event SeasonStarted(uint256 indexed seasonId, uint256 startTime, uint256 endTime);
    event SeasonFinalized(uint256 indexed seasonId, bytes32 archiveHash);

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error SeasonAlreadyActive();
    error NoActiveSeason();
    error SeasonNotOver();
    error SeasonAlreadyFinalized();

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(
        address _questSystem,
        address _rankSystem
    ) Ownable(msg.sender) {
        questSystem = IQuestSystem(_questSystem);
        rankSystem  = IRankSystem(_rankSystem);

        // Sensible default quests — owner can update via setDefaultQuests()
        defaultQuestDescriptions = [
            "Win 10 battles",
            "Craft 3 cards",
            "Open 5 premium packs",
            "Reach Gold rank",
            "Play 20 battles"
        ];
        defaultQuestTargets = [10, 3, 5, 1, 20];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function setQuestSystem(address _questSystem) external onlyOwner {
        questSystem = IQuestSystem(_questSystem);
    }

    function setRankSystem(address _rankSystem) external onlyOwner {
        rankSystem = IRankSystem(_rankSystem);
    }

    function setDefaultQuests(
        string[5] calldata descriptions,
        uint256[5] calldata targets
    ) external onlyOwner {
        defaultQuestDescriptions = descriptions;
        defaultQuestTargets = targets;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Start a new 30-day season. Only one season can be active at a time.
     */
    function startSeason() external onlyOwner {
        if (seasonActive) revert SeasonAlreadyActive();

        uint256 newId    = currentSeasonId + 1;
        uint256 start    = block.timestamp;
        uint256 end      = start + SEASON_DURATION;

        seasons[newId] = Season({
            id:          newId,
            startTime:   start,
            endTime:     end,
            finalized:   false,
            archiveHash: bytes32(0),
            topPlayers:  [address(0), address(0), address(0), address(0), address(0),
                          address(0), address(0), address(0), address(0), address(0),
                          address(0), address(0), address(0), address(0), address(0),
                          address(0), address(0), address(0), address(0), address(0),
                          address(0), address(0), address(0), address(0), address(0),
                          address(0), address(0), address(0), address(0), address(0),
                          address(0), address(0), address(0), address(0), address(0),
                          address(0), address(0), address(0), address(0), address(0),
                          address(0), address(0), address(0), address(0), address(0),
                          address(0), address(0), address(0), address(0), address(0),
                          address(0), address(0), address(0), address(0), address(0),
                          address(0), address(0), address(0), address(0), address(0),
                          address(0), address(0), address(0), address(0), address(0),
                          address(0), address(0), address(0), address(0), address(0),
                          address(0), address(0), address(0), address(0), address(0),
                          address(0), address(0), address(0), address(0), address(0),
                          address(0), address(0), address(0), address(0), address(0),
                          address(0), address(0), address(0), address(0), address(0),
                          address(0), address(0), address(0), address(0), address(0),
                          address(0), address(0), address(0), address(0), address(0)]
        });

        currentSeasonId = newId;
        seasonActive    = true;

        // Notify subsystems
        if (address(questSystem) != address(0)) {
            questSystem.setCurrentSeasonId(newId);
            questSystem.setSeasonQuests(newId, defaultQuestDescriptions, defaultQuestTargets);
        }

        emit SeasonStarted(newId, start, end);
    }

    /**
     * @notice Finalize the current season after 30 days have elapsed.
     *         Snapshots the leaderboard and archives it permanently.
     */
    function finalizeSeason() external onlyOwner {
        if (!seasonActive) revert NoActiveSeason();

        Season storage season = seasons[currentSeasonId];
        if (season.finalized) revert SeasonAlreadyFinalized();
        if (block.timestamp < season.endTime) revert SeasonNotOver();

        // Snapshot leaderboard from RankSystem
        if (address(rankSystem) != address(0)) {
            address[100] memory top = rankSystem.getTopLeaderboard();
            for (uint256 i = 0; i < 100; i++) {
                season.topPlayers[i] = top[i];
            }
            // Archive hash = keccak256 of addresses + seasonId for uniqueness
            season.archiveHash = keccak256(abi.encode(top, currentSeasonId));

            // Reset season RP for all players (career stats unaffected)
            rankSystem.resetSeasonRP(currentSeasonId);
        } else {
            season.archiveHash = keccak256(abi.encode(currentSeasonId, block.timestamp));
        }

        season.finalized = true;
        seasonActive     = false;

        emit SeasonFinalized(currentSeasonId, season.archiveHash);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    function getCurrentSeason() external view returns (Season memory) {
        return seasons[currentSeasonId];
    }

    function getSeasonById(uint256 seasonId) external view returns (Season memory) {
        return seasons[seasonId];
    }

    function getTimeRemaining() external view returns (uint256) {
        if (!seasonActive) return 0;
        Season storage season = seasons[currentSeasonId];
        if (block.timestamp >= season.endTime) return 0;
        return season.endTime - block.timestamp;
    }
}
