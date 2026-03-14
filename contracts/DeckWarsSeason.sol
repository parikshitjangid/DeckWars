// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract DeckWarsSeason is Ownable {
    uint256 public currentSeason = 1;
    uint256 public seasonStart;
    uint256 public constant SEASON_DURATION = 30 days;
    mapping(uint256 => string) public seasonNames;
    mapping(uint256 => uint256) public seasonPrizePool;
    bool public seasonActive;

    event SeasonStarted(uint256 seasonId, string name, uint256 startTime);
    event SeasonEnded(uint256 seasonId, uint256 endTime);

    constructor() Ownable(msg.sender) {}

    function startSeason(string calldata name) external onlyOwner {
        require(!seasonActive, "Season already active");
        seasonStart = block.timestamp;
        seasonActive = true;
        seasonNames[currentSeason] = name;
        emit SeasonStarted(currentSeason, name, block.timestamp);
    }

    function endSeason(bool forceEnd) external onlyOwner {
        require(seasonActive, "No active season");
        if (!forceEnd) {
            require(
                block.timestamp >= seasonStart + SEASON_DURATION,
                "Season not over"
            );
        }
        seasonActive = false;
        emit SeasonEnded(currentSeason, block.timestamp);
        currentSeason += 1;
    }

    function isSeasonActive() external view returns (bool) {
        return seasonActive;
    }

    function timeRemaining() external view returns (uint256) {
        if (!seasonActive) {
            return 0;
        }
        uint256 endTime = seasonStart + SEASON_DURATION;
        if (block.timestamp >= endTime) {
            return 0;
        }
        return endTime - block.timestamp;
    }

    function getCurrentSeason() external view returns (uint256) {
        return currentSeason;
    }

    function getSeasonName(uint256 seasonId) external view returns (string memory) {
        return seasonNames[seasonId];
    }
}

