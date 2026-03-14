// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {HLUSD} from "./HLUSD.sol";
import {DeckWarsCard} from "./DeckWarsCard.sol";
import {DeckWarsQuest} from "./DeckWarsQuest.sol";
import {DeckWarsTreasury} from "./DeckWarsTreasury.sol";

contract DeckWarsSeasonPass is Ownable {
    HLUSD public immutable token;
    DeckWarsCard public immutable cardContract;
    DeckWarsQuest public immutable questContract;
    DeckWarsTreasury public immutable treasury;

    uint256 public PASS_PRICE = 10 ether;

    mapping(address => bool) public hasPass;
    mapping(address => uint256) public passLevel;
    mapping(address => uint256) public passSeason;

    uint256 public currentSeason;

    mapping(address => mapping(uint256 => bool)) public milestoneClaimed;

    event PassPurchased(address indexed player, uint256 season);
    event PassLevelUp(address indexed player, uint256 newLevel);
    event MilestoneClaimed(address indexed player, uint256 level);

    constructor(
        address _token,
        address _card,
        address _quest,
        address _treasury
    ) Ownable(msg.sender) {
        require(_token != address(0), "Token required");
        require(_card != address(0), "Card required");
        require(_quest != address(0), "Quest required");
        require(_treasury != address(0), "Treasury required");
        token = HLUSD(_token);
        cardContract = DeckWarsCard(_card);
        questContract = DeckWarsQuest(_quest);
        treasury = DeckWarsTreasury(_treasury);
        currentSeason = 1;
    }

    function purchasePass() external {
        require(!hasPass[msg.sender] || passSeason[msg.sender] != currentSeason, "Already have pass");

        treasury.receivePayment(msg.sender, PASS_PRICE);

        hasPass[msg.sender] = true;
        passLevel[msg.sender] = 0;
        passSeason[msg.sender] = currentSeason;

        questContract.setHasSeasonPass(msg.sender, true);

        cardContract.mintCard(msg.sender, 1, 1);

        emit PassPurchased(msg.sender, currentSeason);
    }

    function addPassXP(address player, uint256 xp) external {
        require(xp > 0, "XP zero");
        require(hasPass[player], "No pass");
        passLevel[player] += xp;
        _autoGrantMilestones(player);
        emit PassLevelUp(player, passLevel[player]);
    }

    function claimMilestone(uint256 level) external {
        require(hasPass[msg.sender], "No pass");
        require(passSeason[msg.sender] == currentSeason, "Old pass");
        require(passLevel[msg.sender] >= level, "Level too low");
        require(!milestoneClaimed[msg.sender][level], "Milestone claimed");
        _grantMilestoneReward(msg.sender, level);
        milestoneClaimed[msg.sender][level] = true;
        emit MilestoneClaimed(msg.sender, level);
    }

    function getPassInfo(
        address player
    ) external view returns (bool owned, uint256 level) {
        owned = hasPass[player] && passSeason[player] == currentSeason;
        level = passLevel[player];
    }

    function newSeason(uint256 season) external onlyOwner {
        currentSeason = season;
    }

    function _autoGrantMilestones(address player) internal {
        uint256 lvl = passLevel[player];
        uint256[7] memory milestones = [uint256(10),20,30,40,50,75,100];
        for (uint256 i = 0; i < milestones.length; i++) {
            uint256 m = milestones[i];
            if (lvl >= m && !milestoneClaimed[player][m]) {
                _grantMilestoneReward(player, m);
                milestoneClaimed[player][m] = true;
                emit MilestoneClaimed(player, m);
            }
        }
    }

    function _grantMilestoneReward(address player, uint256 level) internal {
        if (level == 10) {
            cardContract.mintCard(player, 3, 1);
        } else if (level == 20) {
            cardContract.mintCard(player, 2, 1);
        } else if (level == 30) {
            cardContract.mintCard(player, 15, 1);
        } else if (level == 40) {
            token.transfer(player, 5 ether);
        } else if (level == 50) {
            cardContract.mintCard(player, 6, 1);
        } else if (level == 75) {
            token.transfer(player, 10 ether);
        } else if (level == 100) {
            cardContract.mintCard(player, 20, 1);
        }
    }
}

