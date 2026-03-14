// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title ReentrancyGuardLocal
 * @notice Lightweight reentrancy guard compatible with pre-Cancun EVMs.
 *         Uses only basic SSTORE/SLOAD opcodes — no `mcopy` (Cancun).
 *         Drop-in replacement for OpenZeppelin's ReentrancyGuard on
 *         chains that haven't upgraded to Cancun EVM yet (e.g. HeLa testnet).
 */
abstract contract ReentrancyGuardLocal {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED     = 2;

    uint256 private _status = _NOT_ENTERED;

    error ReentrancyGuardReentrantCall();

    modifier nonReentrant() {
        if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}
