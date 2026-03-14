// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {DeckWarsCard} from "./DeckWarsCard.sol";
import {HLUSD} from "./HLUSD.sol";

contract DeckWarsQuest is Ownable {
    struct Quest {
        string name;
        string description;
        uint256 goal;
        uint256 rewardCardId;
        bool active;
    }

    Quest[5] public quests;
    mapping(address => uint256[5]) public progress;
    mapping(address => bool[5]) public claimed;
    mapping(address => bool) public hasSeasonPass;

    mapping(uint256 => mapping(address => bool)) public daoVoted;
    mapping(uint256 => mapping(uint256 => uint256)) public daoVotes;
    uint256 public currentVoteSeason;
    uint256 public featuredCard;

    DeckWarsCard public immutable cardContract;
    HLUSD public immutable token;

    address public battleContract;
    address public craftContract;
    address public seasonPassContract;

    event QuestClaimed(address indexed player, uint256 questId, uint256 cardId);
    event VoteCast(address indexed player, uint256 cardId, uint256 season);
    event BattleContractSet(address indexed battle);
    event CraftContractSet(address indexed craft);
    event SeasonPassContractSet(address indexed seasonPass);

    modifier onlyBattle() {
        require(msg.sender == battleContract, "Not battle contract");
        _;
    }

    modifier onlyCraft() {
        require(msg.sender == craftContract, "Not craft contract");
        _;
    }

    modifier onlySeasonPass() {
        require(msg.sender == seasonPassContract, "Not season pass");
        _;
    }

    constructor(address _card, address _token) Ownable(msg.sender) {
        require(_card != address(0), "Card contract required");
        require(_token != address(0), "Token required");
        cardContract = DeckWarsCard(_card);
        token = HLUSD(_token);

        quests[0] = Quest({
            name: "First Blood",
            description: "Win 1 battle",
            goal: 1,
            rewardCardId: 7,
            active: true
        });
        quests[1] = Quest({
            name: "Warrior",
            description: "Win 5 battles",
            goal: 5,
            rewardCardId: 12,
            active: true
        });
        quests[2] = Quest({
            name: "Collector",
            description: "Own 10 cards",
            goal: 10,
            rewardCardId: 11,
            active: true
        });
        quests[3] = Quest({
            name: "Crafter",
            description: "Craft 3 cards",
            goal: 3,
            rewardCardId: 14,
            active: true
        });
        quests[4] = Quest({
            name: "Season Champion",
            description: "Win 20 battles",
            goal: 20,
            rewardCardId: 4,
            active: true
        });
    }

    function setBattleContract(address _battle) external onlyOwner {
        require(_battle != address(0), "Battle required");
        battleContract = _battle;
        emit BattleContractSet(_battle);
    }

    function setCraftContract(address _craft) external onlyOwner {
        require(_craft != address(0), "Craft required");
        craftContract = _craft;
        emit CraftContractSet(_craft);
    }

    function setSeasonPassContract(address _seasonPass) external onlyOwner {
        require(_seasonPass != address(0), "SeasonPass required");
        seasonPassContract = _seasonPass;
        emit SeasonPassContractSet(_seasonPass);
    }

    function updateBattleWin(address player) external onlyBattle {
        progress[player][0] += 1;
        progress[player][1] += 1;
        progress[player][4] += 1;
    }

    function updateCraft(address player) external onlyCraft {
        progress[player][3] += 1;
    }

    function checkCollector(address player) external {
        uint256 total;
        for (uint256 i = 1; i <= 20; i++) {
            total += cardContract.balanceOf(player, i);
        }
        if (total >= 10) {
            progress[player][2] = 10;
        }
    }

    function claimQuest(uint256 questId) external {
        require(questId < 5, "Invalid quest");
        Quest memory q = quests[questId];
        require(q.active, "Quest inactive");
        require(
            progress[msg.sender][questId] >= q.goal,
            "Quest not complete"
        );
        require(!claimed[msg.sender][questId], "Already claimed");

        claimed[msg.sender][questId] = true;

        cardContract.mintCard(msg.sender, q.rewardCardId, 1);

        if (hasSeasonPass[msg.sender]) {
            uint256 bonus = 2 * 10 ** 18;
            if (token.balanceOf(address(this)) >= bonus) {
                token.transfer(msg.sender, bonus);
            }
        }

        emit QuestClaimed(msg.sender, questId, q.rewardCardId);
    }

    function voteForCard(uint256 cardId) external {
        require(cardId >= 1 && cardId <= 20, "Invalid card");
        require(
            !daoVoted[currentVoteSeason][msg.sender],
            "Already voted this season"
        );
        daoVoted[currentVoteSeason][msg.sender] = true;
        daoVotes[currentVoteSeason][cardId] += 1;
        emit VoteCast(msg.sender, cardId, currentVoteSeason);
    }

    function getFeaturedCard() external returns (uint256) {
        uint256 maxVotes;
        uint256 winningCard;
        for (uint256 i = 1; i <= 20; i++) {
            uint256 v = daoVotes[currentVoteSeason][i];
            if (v > maxVotes) {
                maxVotes = v;
                winningCard = i;
            }
        }
        featuredCard = winningCard;
        return winningCard;
    }

    function setHasSeasonPass(address player, bool val) external onlySeasonPass {
        hasSeasonPass[player] = val;
    }

    function resetSeason() external onlyOwner {
        currentVoteSeason += 1;
        // progress/claimed logically reset by using a new season index in UI;
        // onchain mappings remain as history.
    }
}

