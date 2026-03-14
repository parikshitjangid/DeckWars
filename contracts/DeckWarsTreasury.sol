// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {HLUSD} from "./HLUSD.sol";

contract DeckWarsTreasury is Ownable {
    address public devWallet;
    HLUSD public immutable token;
    uint256 public prizePool;
    uint256 public totalRevenue;
    uint256 public constant DEV_SHARE = 85;
    uint256 public constant PRIZE_SHARE = 15;

    mapping(address => bool) public authorized;

    event PaymentReceived(
        address indexed from,
        uint256 total,
        uint256 toDev,
        uint256 toPrize
    );
    event PrizeWithdrawn(address indexed to, uint256 amount);
    event Authorized(address indexed caller, bool authorized);

    modifier onlyAuthorized() {
        require(authorized[msg.sender], "Not authorized");
        _;
    }

    constructor(address _devWallet, address _token) Ownable(msg.sender) {
        require(_devWallet != address(0), "Dev wallet required");
        require(_token != address(0), "Token required");
        devWallet = _devWallet;
        token = HLUSD(_token);
    }

    function addAuthorized(address caller) external onlyOwner {
        require(caller != address(0), "Zero address");
        authorized[caller] = true;
        emit Authorized(caller, true);
    }

    function removeAuthorized(address caller) external onlyOwner {
        authorized[caller] = false;
        emit Authorized(caller, false);
    }

    function receivePayment(
        address from,
        uint256 amount
    ) external onlyAuthorized {
        require(from != address(0), "From zero");
        require(amount > 0, "Amount zero");

        bool ok = token.transferFrom(from, address(this), amount);
        require(ok, "Transfer failed");

        uint256 devAmount = (amount * DEV_SHARE) / 100;
        uint256 prizeAmount = amount - devAmount;

        bool okDev = token.transfer(devWallet, devAmount);
        require(okDev, "Dev transfer failed");

        prizePool += prizeAmount;
        totalRevenue += amount;

        emit PaymentReceived(from, amount, devAmount, prizeAmount);
    }

    function withdrawPrize(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "To zero");
        require(amount <= prizePool, "Insufficient prizePool");
        prizePool -= amount;
        bool ok = token.transfer(to, amount);
        require(ok, "Prize transfer failed");
        emit PrizeWithdrawn(to, amount);
    }

    function getStats()
        external
        view
        returns (uint256 total, uint256 pool, uint256 todev)
    {
        return (totalRevenue, prizePool, DEV_SHARE);
    }
}

