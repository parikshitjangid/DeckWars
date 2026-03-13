// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./CardNFT.sol";
import "./TreasuryVault.sol";

/**
 * @title PremiumPacks
 * @notice Players spend HLUSD to open card packs.
 *         Three tiers: Silver, Gold, Diamond.
 *         Each tier has a price, cards-per-pack, supply cap, and pity counter.
 *         Pity counter: after N non-legendary pulls, the next pull guarantees a Legendary.
 *
 * @dev Randomness: uses block.prevrandao + blockhash + nonce (hackathon scope).
 *      For production, replace with Chainlink VRF.
 */
contract PremiumPacks is Ownable {
    using SafeERC20 for IERC20;

    // ─── Types ───────────────────────────────────────────────────────────────

    enum PackTier { Silver, Gold, Diamond }

    struct PackConfig {
        uint256 priceHLUSD;      // price in HLUSD (18 decimals)
        uint8   cardsPerPack;    // number of cards given
        uint16  pityCap;         // consecutive non-legendary pulls that trigger pity
        uint256 supplyCap;       // max total packs that can be opened (0 = unlimited)
        uint256 totalOpened;     // how many packs have been opened
    }

    // ─── State ───────────────────────────────────────────────────────────────

    CardNFT       public immutable cardNFT;
    TreasuryVault public immutable treasury;
    IERC20        public immutable hlusd;

    mapping(PackTier => PackConfig) public packConfigs;

    /// @notice pityCounter[player][tier] — consecutive non-legendary pulls
    mapping(address => mapping(PackTier => uint16)) public pityCounter;

    /// @notice Token IDs available per tier (set by owner; can overlap)
    mapping(PackTier => uint256[]) private _tierTokenIds;

    uint256 private _nonce;

    // ─── Events ──────────────────────────────────────────────────────────────

    event PackOpened(
        address indexed player,
        PackTier indexed tier,
        uint256[] tokenIds
    );
    event PityTriggered(address indexed player, PackTier indexed tier);
    event PackConfigUpdated(PackTier indexed tier, PackConfig config);
    event TierTokenSet(PackTier indexed tier, uint256[] tokenIds);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error PackSupplyExhausted(PackTier tier);
    error NoTokensConfiguredForTier(PackTier tier);
    error InsufficientAllowance();

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _cardNFT, address _treasury, address _hlusd) Ownable(msg.sender) {
        cardNFT  = CardNFT(_cardNFT);
        treasury = TreasuryVault(_treasury);
        hlusd    = IERC20(_hlusd);

        // Default config — owner can update via setPackConfig()
        packConfigs[PackTier.Silver]  = PackConfig(5 ether,  3, 50, 0, 0);
        packConfigs[PackTier.Gold]    = PackConfig(15 ether, 5, 20, 0, 0);
        packConfigs[PackTier.Diamond] = PackConfig(50 ether, 5, 10, 0, 0);
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    /// @notice Update pack configuration
    function setPackConfig(
        PackTier tier,
        uint256 priceHLUSD,
        uint8 cardsPerPack,
        uint16 pityCap,
        uint256 supplyCap
    ) external onlyOwner {
        PackConfig storage cfg = packConfigs[tier];
        cfg.priceHLUSD    = priceHLUSD;
        cfg.cardsPerPack  = cardsPerPack;
        cfg.pityCap       = pityCap;
        cfg.supplyCap     = supplyCap;
        emit PackConfigUpdated(tier, cfg);
    }

    /// @notice Set card drop pool for a tier (array of tokenIds)
    function setTierTokenIds(PackTier tier, uint256[] calldata tokenIds) external onlyOwner {
        _tierTokenIds[tier] = tokenIds;
        emit TierTokenSet(tier, tokenIds);
    }

    // ─── Core Pack Opening ───────────────────────────────────────────────────

    /**
     * @notice Open a pack of the given tier.
     *         Player must have approved this contract for at least packConfigs[tier].priceHLUSD.
     */
    function openPack(PackTier tier) external returns (uint256[] memory mintedTokenIds) {
        PackConfig storage cfg = packConfigs[tier];

        // Supply cap check
        if (cfg.supplyCap > 0 && cfg.totalOpened >= cfg.supplyCap) {
            revert PackSupplyExhausted(tier);
        }

        uint256[] storage pool = _tierTokenIds[tier];
        if (pool.length == 0) revert NoTokensConfiguredForTier(tier);

        // Collect payment → send to TreasuryVault
        hlusd.safeTransferFrom(msg.sender, address(treasury), cfg.priceHLUSD);
        treasury.receiveRevenue(cfg.priceHLUSD);

        cfg.totalOpened++;

        // Roll cards
        mintedTokenIds = new uint256[](cfg.cardsPerPack);
        bool pityActive = pityCounter[msg.sender][tier] >= cfg.pityCap;

        for (uint8 i = 0; i < cfg.cardsPerPack; i++) {
            _nonce++;
            uint256 rand = uint256(
                keccak256(abi.encodePacked(block.prevrandao, block.timestamp, msg.sender, _nonce, i))
            );

            uint256 tokenId;
            if (pityActive && i == 0) {
                // Force a legendary on first slot
                tokenId = _forceLegendary(rand, pool);
                pityCounter[msg.sender][tier] = 0;
                pityActive = false;
                emit PityTriggered(msg.sender, tier);
            } else {
                tokenId = pool[rand % pool.length];
                // Track pity: if not legendary, increment counter
                CardNFT.CardStats memory stats = cardNFT.getCardStats(tokenId);
                if (stats.rarity != CardNFT.Rarity.Legendary) {
                    pityCounter[msg.sender][tier]++;
                } else {
                    pityCounter[msg.sender][tier] = 0;
                }
            }

            mintedTokenIds[i] = tokenId;
            cardNFT.mint(msg.sender, tokenId, 1);
        }

        emit PackOpened(msg.sender, tier, mintedTokenIds);
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    /// @notice Pick a Legendary token from the pool; fallback to last token if none found
    function _forceLegendary(uint256 rand, uint256[] storage pool) internal view returns (uint256) {
        // Collect legendaries from pool
        uint256 legendaryCount;
        for (uint256 i = 0; i < pool.length; i++) {
            if (cardNFT.getCardStats(pool[i]).rarity == CardNFT.Rarity.Legendary) {
                legendaryCount++;
            }
        }
        if (legendaryCount == 0) {
            // No legendary configured — just return a random card
            return pool[rand % pool.length];
        }
        uint256 pick = rand % legendaryCount;
        uint256 counter;
        for (uint256 i = 0; i < pool.length; i++) {
            if (cardNFT.getCardStats(pool[i]).rarity == CardNFT.Rarity.Legendary) {
                if (counter == pick) return pool[i];
                counter++;
            }
        }
        return pool[rand % pool.length]; // fallback
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function getPityCounter(address player, PackTier tier) external view returns (uint16) {
        return pityCounter[player][tier];
    }

    function getTierTokenIds(PackTier tier) external view returns (uint256[] memory) {
        return _tierTokenIds[tier];
    }
}
