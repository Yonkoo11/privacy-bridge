// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "poseidon-solidity/PoseidonT3.sol";

/**
 * Wrapper around poseidon-solidity's PoseidonT3 library.
 * Deploys as a contract so PrivacyBridge can call it via address.
 */
contract PoseidonT3Wrapper {
    function poseidon(uint256[2] memory inputs) external pure returns (uint256) {
        return PoseidonT3.hash(inputs);
    }
}
