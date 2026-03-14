// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {DeckWarsRank} from "./DeckWarsRank.sol";
import {DeckWarsCard} from "./DeckWarsCard.sol";
import {HLUSD} from "./HLUSD.sol";

contract DeckWarsRewards is Ownable {
    DeckWarsRank public immutable rankContract;
    DeckWarsCard public immutable cardContract;
    HLUSD public immutable token;

    mapping(address => bool) public rankRewardClaimed;
    mapping(address => bool) public leaderboardRewardClaimed;
    bool public claimsOpen;

    event RankRewardClaimed(
        address indexed player,
        uint8 rank,
        uint256 amount
    );
    event LeaderboardRewardClaimed(
        address indexed player,
        uint256 position,
        uint256 cardId
    );

    constructor(
        address _rank,
        address _card,
        address _token
    ) Ownable(msg.sender) {
        require(_rank != address(0), "Rank required");
        require(_card != address(0), "Card required");
        require(_token != address(0), "Token required");
        rankContract = DeckWarsRank(_rank);
        cardContract = DeckWarsCard(_card);
        token = HLUSD(_token);
    }

    function openClaims() external onlyOwner {
        claimsOpen = true;
    }

    function closeClaims() external onlyOwner {
        claimsOpen = false;
    }

    function fundRewards(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount zero");
        bool ok = token.transferFrom(msg.sender, address(this), amount);
        require(ok, "Transfer failed");
    }

    function claimRankReward() external {
        require(claimsOpen, "Claims closed");
        require(!rankRewardClaimed[msg.sender], "Already claimed");

        uint8 rank = rankContract.getRank(msg.sender);
        uint256 amount;
        if (rank == 1) {
            amount = 5 * 10 ** 18;
        } else if (rank == 2) {
            amount = 15 * 10 ** 18;
        } else if (rank == 3) {
            amount = 30 * 10 ** 18;
        } else if (rank == 4) {
            amount = 60 * 10 ** 18;
        } else if (rank >= 5) {
            amount = 150 * 10 ** 18;
        } else {
            amount = 0;
        }
        require(amount > 0, "No reward for rank");

        rankRewardClaimed[msg.sender] = true;
        bool ok = token.transfer(msg.sender, amount);
        require(ok, "Transfer failed");

        emit RankRewardClaimed(msg.sender, rank, amount);
    }

    function claimLeaderboardReward() external {
        require(claimsOpen, "Claims closed");
        require(
            !leaderboardRewardClaimed[msg.sender],
            "Leaderboard reward claimed"
        );

        address[100] memory lb = rankContract.getLeaderboard();
        uint256 position = 101;
        for (uint256 i = 0; i < lb.length; i++) {
            if (lb[i] == msg.sender) {
                position = i + 1;
                break;
            }
        }
        require(position <= 100, "Not in leaderboard");

        uint256 cardId;
        if (position <= 10) {
            cardId = 4;
        } else if (position <= 50) {
            cardId = 19;
        } else {
            cardId = 12;
        }

        leaderboardRewardClaimed[msg.sender] = true;
        cardContract.mintCard(msg.sender, cardId, 1);

        emit LeaderboardRewardClaimed(msg.sender, position, cardId);
    }
}

