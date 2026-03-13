// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @dev Minimal ERC20 mock for use in Hardhat tests.
 */
contract ERC20Mock is ERC20 {
    constructor(
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}
