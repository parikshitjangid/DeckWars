// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

contract DeckWarsDeck is Ownable {
    IERC1155 public immutable cardContract;

    mapping(address => uint256[20]) public playerDeck;
    mapping(address => bool) public hasDeck;
    mapping(address => bool) public deckLocked;
    address public battleContract;

    event DeckRegistered(address indexed player);
    event DeckLocked(address indexed player);
    event DeckUnlocked(address indexed player);
    event BattleContractSet(address indexed battle);

    modifier onlyBattle() {
        require(msg.sender == battleContract, "Not battle contract");
        _;
    }

    constructor(address _card) Ownable(msg.sender) {
        require(_card != address(0), "Card contract required");
        cardContract = IERC1155(_card);
    }

    function registerDeck(uint256[20] calldata cardIds) external {
        require(!deckLocked[msg.sender], "Deck locked");

        for (uint256 i = 0; i < 20; i++) {
            uint256 id = cardIds[i];
            require(id > 0, "Deck must be full (20 cards)");
            require(
                cardContract.balanceOf(msg.sender, id) > 0,
                "Must own each card"
            );
        }

        playerDeck[msg.sender] = cardIds;
        hasDeck[msg.sender] = true;
        emit DeckRegistered(msg.sender);
    }

    function lockDeck(address player) external onlyBattle {
        deckLocked[player] = true;
        emit DeckLocked(player);
    }

    function unlockDeck(address player) external onlyBattle {
        deckLocked[player] = false;
        emit DeckUnlocked(player);
    }

    function getDeck(
        address player
    ) external view returns (uint256[20] memory) {
        return playerDeck[player];
    }

    function getCardAtTurn(
        address player,
        uint256 turn
    ) external view returns (uint256) {
        require(hasDeck[player], "No deck");
        uint256 index = turn % 5;
        return playerDeck[player][index];
    }

    function setBattleContract(address _battle) external onlyOwner {
        require(_battle != address(0), "Battle required");
        battleContract = _battle;
        emit BattleContractSet(_battle);
    }
}

