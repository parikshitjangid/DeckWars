// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract DeckWarsRank is Ownable {
    struct PlayerStats {
        uint256 rankPoints;
        uint256 wins;
        uint256 losses;
        uint8 currentRank;
        uint256 totalDamageDealt;
    }

    mapping(address => PlayerStats) public stats;
    address[100] public leaderboard;
    uint256 public leaderboardSize;
    address public battleContract;

    event RankUpdated(address indexed player, uint256 newRP, uint8 newRank);
    event SeasonReset();
    event BattleContractSet(address indexed battle);
    event DamageRecorded(address indexed player, uint256 amount, uint256 totalDamage);

    modifier onlyBattle() {
        require(msg.sender == battleContract, "Not battle contract");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function setBattleContract(address _battle) external onlyOwner {
        require(_battle != address(0), "Battle required");
        battleContract = _battle;
        emit BattleContractSet(_battle);
    }

    function recordResult(
        address winner,
        address loser
    ) external onlyBattle {
        require(winner != address(0), "Winner zero");
        require(loser != address(0), "Loser zero");

        PlayerStats storage w = stats[winner];
        PlayerStats storage l = stats[loser];

        w.rankPoints += 25;
        w.wins += 1;

        if (l.rankPoints >= 10) {
            l.rankPoints -= 10;
        } else {
            l.rankPoints = 0;
        }
        l.losses += 1;

        _updateRankTier(winner);
        _updateRankTier(loser);

        _updateLeaderboard(winner);

        emit RankUpdated(winner, w.rankPoints, w.currentRank);
        emit RankUpdated(loser, l.rankPoints, l.currentRank);
    }

    function recordDamage(address player, uint256 amount) external onlyBattle {
        PlayerStats storage s = stats[player];
        s.totalDamageDealt += amount;
        emit DamageRecorded(player, amount, s.totalDamageDealt);
    }

    function getRank(address player) external view returns (uint8) {
        return stats[player].currentRank;
    }

    function getRP(address player) external view returns (uint256) {
        return stats[player].rankPoints;
    }

    function getStats(
        address player
    ) external view returns (PlayerStats memory) {
        return stats[player];
    }

    function getLeaderboard() external view returns (address[100] memory) {
        return leaderboard;
    }

    function getLeaderboardWithRP()
        external
        view
        returns (address[] memory players, uint256[] memory rps)
    {
        uint256 size = leaderboardSize < 10 ? leaderboardSize : 10;
        players = new address[](size);
        rps = new uint256[](size);
        for (uint256 i = 0; i < size; i++) {
            address p = leaderboard[i];
            players[i] = p;
            rps[i] = stats[p].rankPoints;
        }
    }

    function _updateRankTier(address player) internal {
        PlayerStats storage s = stats[player];
        uint256 rp = s.rankPoints;
        uint8 rank;
        if (rp >= 5000) {
            rank = 4;
        } else if (rp >= 3000) {
            rank = 3;
        } else if (rp >= 1500) {
            rank = 2;
        } else if (rp >= 500) {
            rank = 1;
        } else {
            rank = 0;
        }
        s.currentRank = rank;
    }

    function _updateLeaderboard(address player) internal {
        uint256 rp = stats[player].rankPoints;

        uint256 pos = leaderboardSize;
        for (uint256 i = 0; i < leaderboardSize; i++) {
            if (stats[leaderboard[i]].rankPoints < rp) {
                pos = i;
                break;
            }
        }

        if (pos >= 100) {
            return;
        }

        if (leaderboardSize < 100) {
            leaderboardSize += 1;
        }

        for (uint256 j = leaderboardSize - 1; j > pos; j--) {
            leaderboard[j] = leaderboard[j - 1];
        }
        leaderboard[pos] = player;
    }

    function resetSeason() external onlyOwner {
        for (uint256 i = 0; i < leaderboardSize; i++) {
            address p = leaderboard[i];
            stats[p].rankPoints = 0;
            stats[p].currentRank = 0;
        }
        leaderboardSize = 0;
        emit SeasonReset();
    }
}

