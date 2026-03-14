// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract DeckWarsCard is ERC1155, AccessControl, Ownable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    struct CardData {
        string name;
        uint8 attack;
        uint8 defense;
        uint8 element; // 0=Fire,1=Water,2=Earth
        uint8 rarity; // 0=Common,1=Uncommon,2=Rare,3=Epic,4=Legendary
        uint256 maxSupply; // 0 = unlimited
        uint256 seasonMinted;
    }

    uint256 public constant TOTAL_CARDS = 20;
    uint256 public currentSeason = 1;

    mapping(uint256 => CardData) public cards;

    mapping(uint256 => uint256) public totalMinted;
    mapping(address => bool) public starterClaimed;

    event CardMinted(address indexed to, uint256 cardId, uint256 amount);
    event StarterPackMinted(address indexed player, uint256[] cardIds);
    event NewSeason(uint256 season);

    constructor() ERC1155("") Ownable(msg.sender) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        _initCards();
    }

    function _initCards() internal {
        // Common: rarity 0, Uncommon:1, Rare:2, Epic:3, Legendary:4
        // Supply caps per rarity (per season): Common/Uncommon unlimited (0), Rare=5000, Epic=2000, Legendary=500
        _setCard(
            1,
            "FlameWolf",
            8,
            3,
            0,
            2,
            5000
        );
        _setCard(
            2,
            "TidalSerpent",
            7,
            5,
            1,
            2,
            5000
        );
        _setCard(
            3,
            "StoneGolem",
            5,
            9,
            2,
            1,
            0
        );
        _setCard(
            4,
            "InfernoPhoenix",
            10,
            4,
            0,
            4,
            500
        );
        _setCard(
            5,
            "FrostLeviathan",
            9,
            6,
            1,
            4,
            500
        );
        _setCard(
            6,
            "CrystalDrake",
            8,
            8,
            2,
            3,
            2000
        );
        _setCard(
            7,
            "CinderFox",
            4,
            2,
            0,
            0,
            0
        );
        _setCard(
            8,
            "TideCaller",
            3,
            4,
            1,
            0,
            0
        );
        _setCard(
            9,
            "MossSprite",
            2,
            5,
            2,
            0,
            0
        );
        _setCard(
            10,
            "VolcanoBeast",
            6,
            4,
            0,
            1,
            0
        );
        _setCard(
            11,
            "CoralGuard",
            4,
            7,
            1,
            1,
            0
        );
        _setCard(
            12,
            "QuakeHammer",
            7,
            6,
            2,
            2,
            5000
        );
        _setCard(
            13,
            "EmberShade",
            5,
            3,
            0,
            0,
            0
        );
        _setCard(
            14,
            "WhirlpoolDemon",
            8,
            3,
            1,
            3,
            2000
        );
        _setCard(
            15,
            "BoulderTitan",
            6,
            8,
            2,
            2,
            5000
        );
        _setCard(
            16,
            "AshWalker",
            3,
            3,
            0,
            0,
            0
        );
        _setCard(
            17,
            "BrineStalker",
            5,
            5,
            1,
            1,
            0
        );
        _setCard(
            18,
            "RootWarden",
            4,
            6,
            2,
            0,
            0
        );
        _setCard(
            19,
            "MagmaKing",
            9,
            5,
            0,
            3,
            2000
        );
        _setCard(
            20,
            "AbyssalLord",
            10,
            7,
            1,
            4,
            500
        );
    }

    function _setCard(
        uint256 id,
        string memory name,
        uint8 attack,
        uint8 defense,
        uint8 element,
        uint8 rarity,
        uint256 maxSupply
    ) internal {
        cards[id] = CardData({
            name: name,
            attack: attack,
            defense: defense,
            element: element,
            rarity: rarity,
            maxSupply: maxSupply,
            seasonMinted: 0
        });
    }

    function mintStarterPack(address player) external {
        require(!starterClaimed[player], "Starter already claimed");
        starterClaimed[player] = true;

        uint256[] memory cardIds = new uint256[](5);
        uint256[] memory amounts = new uint256[](5);

        uint256 nonce = 0;
        for (uint256 i = 0; i < 5; i++) {
            uint256 rarity = uint256(
                keccak256(
                    abi.encodePacked(
                        blockhash(block.number - 1),
                        player,
                        block.timestamp,
                        i,
                        nonce
                    )
                )
            ) % 2; // 0 or 1 -> Common / Uncommon
            uint256 cardId = _getRandomCardByRarity(
                uint8(rarity),
                uint256(
                    keccak256(
                        abi.encodePacked(
                            blockhash(block.number - 1),
                            player,
                            block.timestamp,
                            i,
                            nonce + 1
                        )
                    )
                )
            );
            cardIds[i] = cardId;
            amounts[i] = 1;
            _incrementSupply(cardId, 1);
            nonce++;
        }

        _mintBatch(player, cardIds, amounts, "");

        emit StarterPackMinted(player, cardIds);
    }

    function mintCard(
        address to,
        uint256 cardId,
        uint256 amount
    ) external onlyRole(MINTER_ROLE) {
        _incrementSupply(cardId, amount);
        _mint(to, cardId, amount, "");
        emit CardMinted(to, cardId, amount);
    }

    function burn(
        address from,
        uint256 cardId,
        uint256 amount
    ) external onlyRole(MINTER_ROLE) {
        _burn(from, cardId, amount);
    }

    function getCard(uint256 cardId) external view returns (CardData memory) {
        require(cardId >= 1 && cardId <= TOTAL_CARDS, "Invalid cardId");
        return cards[cardId];
    }

    function getRarity(uint256 cardId) external view returns (uint8) {
        require(cardId >= 1 && cardId <= TOTAL_CARDS, "Invalid cardId");
        return cards[cardId].rarity;
    }

    function getElement(uint256 cardId) external view returns (uint8) {
        require(cardId >= 1 && cardId <= TOTAL_CARDS, "Invalid cardId");
        return cards[cardId].element;
    }

    function newSeason() external onlyOwner {
        currentSeason += 1;
        for (uint256 i = 1; i <= TOTAL_CARDS; i++) {
            cards[i].seasonMinted = 0;
        }
        emit NewSeason(currentSeason);
    }

    function _incrementSupply(uint256 cardId, uint256 amount) internal {
        require(cardId >= 1 && cardId <= TOTAL_CARDS, "Invalid cardId");
        CardData storage data = cards[cardId];
        if (data.maxSupply > 0) {
            require(
                data.seasonMinted + amount <= data.maxSupply,
                "Supply cap reached"
            );
        }
        data.seasonMinted += amount;
        totalMinted[cardId] += amount;
    }

    function _getRandomCardByRarity(
        uint8 rarity,
        uint256 seed
    ) internal view returns (uint256) {
        uint256[] memory matches = new uint256[](TOTAL_CARDS);
        uint256 count;
        for (uint256 i = 1; i <= TOTAL_CARDS; i++) {
            if (cards[i].rarity == rarity) {
                matches[count] = i;
                count++;
            }
        }
        require(count > 0, "No cards for rarity");
        uint256 index = seed % count;
        return matches[index];
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}

