// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RankSystem
 * @notice Tracks player stats, RP-based rank tiers, on-chain top-100
 *         leaderboard, and career stats. Season RP resets each season;
 *         career stats (totalRP, wins, losses) are permanent.
 */
contract RankSystem is Ownable {
    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    enum Rank { Bronze, Silver, Gold, Platinum, Diamond, Legend }

    struct PlayerStats {
        uint256 totalRP;         // career total RP
        uint256 currentSeasonRP; // resets each season
        uint256 wins;
        uint256 losses;
        Rank    rank;
        bool    exists;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constants — RP thresholds (current-season RP)
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public constant RP_SILVER   =  500;
    uint256 public constant RP_GOLD     = 1500;
    uint256 public constant RP_PLATINUM = 3000;
    uint256 public constant RP_DIAMOND  = 5000;
    uint256 public constant RP_LEGEND   = 10000;

    uint256 public constant LEADERBOARD_SIZE = 100;

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    mapping(address => PlayerStats) public playerStats;

    /// @dev Sorted leaderboard (descending by currentSeasonRP). Position 0 = rank 1.
    address[LEADERBOARD_SIZE] private _leaderboard;

    /// @dev Quick lookup: is this address currently in the top-100?
    mapping(address => bool) public inLeaderboard;

    /// @dev Floors for leaderboard entry — the lowest RP in the top-100
    uint256 public leaderboardFloor;

    /// @dev Authorised callers that can record wins/losses (BattleEngine, AIBattleAgent).
    mapping(address => bool) public authorisedRecorder;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event RankUpdated(address indexed player, Rank newRank, uint256 seasonRP);
    event LeaderboardUpdated(address indexed player, uint256 position);
    event SeasonRPReset(uint256 indexed seasonId);

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error NotAuthorised();
    error PlayerNotFound(address player);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function setAuthorisedRecorder(address recorder, bool status) external onlyOwner {
        authorisedRecorder[recorder] = status;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core — called by BattleEngine / AIBattleAgent
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Record a win for a player and award RP.
     * @param player  The winning player.
     * @param rpGain  RP to award (e.g. 50 for a normal win, 100 for ranked).
     */
    function recordWin(address player, uint256 rpGain) external {
        if (!authorisedRecorder[msg.sender] && msg.sender != owner()) revert NotAuthorised();
        _initPlayer(player);

        PlayerStats storage stats = playerStats[player];
        stats.wins            += 1;
        stats.totalRP         += rpGain;
        stats.currentSeasonRP += rpGain;

        _updateRank(player);
        _updateLeaderboard(player);
    }

    /**
     * @notice Record a loss and deduct RP (floor at 0).
     * @param player  The losing player.
     * @param rpLoss  RP to deduct.
     */
    function recordLoss(address player, uint256 rpLoss) external {
        if (!authorisedRecorder[msg.sender] && msg.sender != owner()) revert NotAuthorised();
        _initPlayer(player);

        PlayerStats storage stats = playerStats[player];
        stats.losses += 1;
        if (stats.currentSeasonRP >= rpLoss) {
            stats.currentSeasonRP -= rpLoss;
        } else {
            stats.currentSeasonRP = 0;
        }

        _updateRank(player);
        _updateLeaderboard(player);
    }

    /**
     * @notice Reset all players' current-season RP. Called by SeasonEngine on finalization.
     *         Career stats (totalRP, wins, losses) are preserved.
     */
    function resetSeasonRP(uint256 seasonId) external {
        if (!authorisedRecorder[msg.sender] && msg.sender != owner()) revert NotAuthorised();

        // Clear leaderboard for new season
        for (uint256 i = 0; i < LEADERBOARD_SIZE; i++) {
            address p = _leaderboard[i];
            if (p != address(0)) {
                playerStats[p].currentSeasonRP = 0;
                playerStats[p].rank = Rank.Bronze;
                inLeaderboard[p] = false;
                _leaderboard[i] = address(0);
            }
        }
        leaderboardFloor = 0;

        emit SeasonRPReset(seasonId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    function getPlayerStats(address player) external view returns (PlayerStats memory) {
        return playerStats[player];
    }

    function getTopLeaderboard() external view returns (address[100] memory) {
        return _leaderboard;
    }

    function getLeaderboardPosition(address player) external view returns (uint256) {
        for (uint256 i = 0; i < LEADERBOARD_SIZE; i++) {
            if (_leaderboard[i] == player) return i + 1; // 1-indexed
        }
        return 0; // not in top-100
    }

    function getRankName(address player) external view returns (string memory) {
        Rank r = playerStats[player].rank;
        if (r == Rank.Bronze)   return "Bronze";
        if (r == Rank.Silver)   return "Silver";
        if (r == Rank.Gold)     return "Gold";
        if (r == Rank.Platinum) return "Platinum";
        if (r == Rank.Diamond)  return "Diamond";
        return "Legend";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _initPlayer(address player) internal {
        if (!playerStats[player].exists) {
            playerStats[player].exists = true;
            playerStats[player].rank   = Rank.Bronze;
        }
    }

    function _updateRank(address player) internal {
        uint256 rp = playerStats[player].currentSeasonRP;
        Rank newRank;

        if      (rp >= RP_LEGEND)   newRank = Rank.Legend;
        else if (rp >= RP_DIAMOND)  newRank = Rank.Diamond;
        else if (rp >= RP_PLATINUM) newRank = Rank.Platinum;
        else if (rp >= RP_GOLD)     newRank = Rank.Gold;
        else if (rp >= RP_SILVER)   newRank = Rank.Silver;
        else                         newRank = Rank.Bronze;

        if (playerStats[player].rank != newRank) {
            playerStats[player].rank = newRank;
            emit RankUpdated(player, newRank, rp);
        }
    }

    /**
     * @dev Insertion-sort-style leaderboard update.
     *      Finds the correct position for `player` and shifts entries down.
     *      If the player is not in top-100 and their RP doesn't beat the floor, skip.
     */
    function _updateLeaderboard(address player) internal {
        uint256 playerRP = playerStats[player].currentSeasonRP;

        // If player already in leaderboard, remove and re-insert
        if (inLeaderboard[player]) {
            _removeFromLeaderboard(player);
        }

        // Check if player beats the current floor (last entry)
        address lastEntry = _leaderboard[LEADERBOARD_SIZE - 1];
        uint256 floorRP   = lastEntry != address(0) ? playerStats[lastEntry].currentSeasonRP : 0;

        // Count filled slots
        uint256 filled = 0;
        for (uint256 i = 0; i < LEADERBOARD_SIZE; i++) {
            if (_leaderboard[i] != address(0)) filled++;
        }

        bool hasRoom = filled < LEADERBOARD_SIZE;
        if (!hasRoom && playerRP <= floorRP) return; // doesn't qualify

        // Find insertion position (descending RP)
        uint256 insertAt = LEADERBOARD_SIZE; // default: end
        for (uint256 i = 0; i < LEADERBOARD_SIZE; i++) {
            address entry = _leaderboard[i];
            uint256 entryRP = entry != address(0) ? playerStats[entry].currentSeasonRP : 0;
            if (playerRP > entryRP) {
                insertAt = i;
                break;
            }
        }

        if (insertAt == LEADERBOARD_SIZE) return; // no slot found

        // Shift entries down from insertAt, evicting the last if full
        address evicted = _leaderboard[LEADERBOARD_SIZE - 1];
        if (evicted != address(0)) inLeaderboard[evicted] = false;

        for (uint256 i = LEADERBOARD_SIZE - 1; i > insertAt; i--) {
            _leaderboard[i] = _leaderboard[i - 1];
        }
        _leaderboard[insertAt] = player;
        inLeaderboard[player] = true;

        // Update floor
        address newLast = _leaderboard[LEADERBOARD_SIZE - 1];
        leaderboardFloor = newLast != address(0) ? playerStats[newLast].currentSeasonRP : 0;

        emit LeaderboardUpdated(player, insertAt + 1);
    }

    function _removeFromLeaderboard(address player) internal {
        for (uint256 i = 0; i < LEADERBOARD_SIZE; i++) {
            if (_leaderboard[i] == player) {
                // Shift entries up
                for (uint256 j = i; j < LEADERBOARD_SIZE - 1; j++) {
                    _leaderboard[j] = _leaderboard[j + 1];
                }
                _leaderboard[LEADERBOARD_SIZE - 1] = address(0);
                inLeaderboard[player] = false;
                return;
            }
        }
    }
}
