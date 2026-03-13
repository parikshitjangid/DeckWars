// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title TreasuryVault
 * @notice Receives HLUSD revenue from PremiumPacks and SeasonPass.
 *         On distribution: 85% → devWallet, 15% → prizePool.
 *
 *         Revenue flow:
 *           PremiumPacks/SeasonPass → transferFrom player → TreasuryVault
 *           Owner (or keeper) calls distributeRevenue() to split.
 */
contract TreasuryVault is Ownable {
    using SafeERC20 for IERC20;

    // ─── Constants ───────────────────────────────────────────────────────────

    uint256 public constant DEV_BPS = 8500;   // 85.00%
    uint256 public constant PRIZE_BPS = 1500; // 15.00%
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ─── State ───────────────────────────────────────────────────────────────

    IERC20 public immutable hlusd;
    address public devWallet;
    address public prizePool;

    /// @notice Addresses allowed to call receiveRevenue (PremiumPacks, SeasonPass)
    mapping(address => bool) public authorizedSources;

    // ─── Events ──────────────────────────────────────────────────────────────

    event RevenueReceived(address indexed source, uint256 amount);
    event RevenueDistributed(uint256 devAmount, uint256 prizeAmount);
    event DevWalletUpdated(address indexed newWallet);
    event PrizePoolUpdated(address indexed newPool);
    event SourceAuthorized(address indexed source);
    event SourceRevoked(address indexed source);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error NotAuthorizedSource();
    error ZeroBalance();
    error ZeroAddress();

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _hlusd, address _devWallet, address _prizePool) Ownable(msg.sender) {
        if (_hlusd == address(0) || _devWallet == address(0) || _prizePool == address(0)) {
            revert ZeroAddress();
        }
        hlusd = IERC20(_hlusd);
        devWallet = _devWallet;
        prizePool = _prizePool;
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    /// @notice Authorize PremiumPacks or SeasonPass to notify this vault
    function authorizeSource(address source) external onlyOwner {
        authorizedSources[source] = true;
        emit SourceAuthorized(source);
    }

    /// @notice Revoke a source
    function revokeSource(address source) external onlyOwner {
        authorizedSources[source] = false;
        emit SourceRevoked(source);
    }

    function setDevWallet(address _devWallet) external onlyOwner {
        if (_devWallet == address(0)) revert ZeroAddress();
        devWallet = _devWallet;
        emit DevWalletUpdated(_devWallet);
    }

    function setPrizePool(address _prizePool) external onlyOwner {
        if (_prizePool == address(0)) revert ZeroAddress();
        prizePool = _prizePool;
        emit PrizePoolUpdated(_prizePool);
    }

    // ─── Revenue Handling ────────────────────────────────────────────────────

    /**
     * @notice Called by PremiumPacks/SeasonPass after they pull HLUSD from the player.
     *         The HLUSD must already be transferred to this contract before calling.
     *         (Caller does: hlusd.transferFrom(player, address(vault), amount) then calls this)
     */
    function receiveRevenue(uint256 amount) external {
        if (!authorizedSources[msg.sender]) revert NotAuthorizedSource();
        emit RevenueReceived(msg.sender, amount);
    }

    /**
     * @notice Distributes the full HLUSD balance of this vault: 85% dev, 15% prize pool.
     *         Anyone can call — useful for a keeper bot to trigger periodically.
     */
    function distributeRevenue() external {
        uint256 balance = hlusd.balanceOf(address(this));
        if (balance == 0) revert ZeroBalance();

        uint256 devAmount = (balance * DEV_BPS) / BPS_DENOMINATOR;
        uint256 prizeAmount = balance - devAmount; // remainder avoids rounding loss

        hlusd.safeTransfer(devWallet, devAmount);
        hlusd.safeTransfer(prizePool, prizeAmount);

        emit RevenueDistributed(devAmount, prizeAmount);
    }

    /// @notice Addresses allowed to withdraw from prize pool (SeasonRewards, AIBattleAgent)
    mapping(address => bool) public authorizedWithdrawers;

    /// @notice Authorize a contract to withdraw from the vault (SeasonRewards, etc.)
    function authorizeWithdrawer(address withdrawer) external onlyOwner {
        authorizedWithdrawers[withdrawer] = true;
    }

    /// @notice Revoke a withdrawer
    function revokeWithdrawer(address withdrawer) external onlyOwner {
        authorizedWithdrawers[withdrawer] = false;
    }

    /**
     * @notice Withdraw HLUSD from the vault to a specified address.
     *         Called by SeasonRewards for rank/milestone/leaderboard payouts.
     * @param to      Recipient address.
     * @param amount  Amount of HLUSD to send (18 decimals).
     */
    function withdrawFromPrizePool(address to, uint256 amount) external {
        require(authorizedWithdrawers[msg.sender] || msg.sender == owner(), "Not authorized");
        uint256 balance = hlusd.balanceOf(address(this));
        require(balance >= amount, "Insufficient vault balance");
        hlusd.safeTransfer(to, amount);
    }

    /// @notice View current HLUSD balance held in the vault
    function vaultBalance() external view returns (uint256) {
        return hlusd.balanceOf(address(this));
    }
}
