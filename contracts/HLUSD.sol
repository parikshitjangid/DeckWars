// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title HLUSD - HeLa USD mock stablecoin for DeckWars
/// @notice Simple ERC20 with public faucet and owner minting
contract HLUSD is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT = 100 * 10 ** 18;

    constructor() ERC20("HeLa USD", "HLUSD") Ownable(msg.sender) {}

    /// @notice Faucet for test tokens. Anyone can call.
    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Mint arbitrary amount of HLUSD to an address. Only owner.
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Mint to zero address");
        _mint(to, amount);
    }
}

