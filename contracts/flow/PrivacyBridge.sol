// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Privacy Bridge — Lock Contract (Flow EVM)
 *
 * Users lock FLOW tokens with a Poseidon commitment hash.
 * The commitment hides (secret, nullifier, amount) so a chain observer
 * cannot link the lock to the later Starknet claim.
 *
 * The commitment is computed off-chain as:
 *   commitment = Poseidon(Poseidon(secret, nullifier), amount)
 *
 * Only the commitment hash is stored on-chain (in the Merkle tree).
 * Amount is in calldata but NOT in indexed event topics.
 */

contract PrivacyBridge {
    uint256 public constant TREE_DEPTH = 24;
    uint256 public constant MAX_LEAVES = 2 ** TREE_DEPTH;

    // Merkle tree state
    uint256 public nextLeafIndex;
    mapping(uint256 => uint256) public commitments; // index => commitment
    mapping(uint256 => bool) public commitmentExists; // commitment => exists (prevent duplicates)

    // Events — commitment is NOT indexed to reduce linkability surface
    event CommitmentLocked(uint256 commitment, address token);
    event DepositETH(uint256 indexed leafIndex, uint256 commitment, uint256 amount);

    /**
     * Lock native FLOW tokens with a commitment hash.
     * @param commitment Poseidon hash: H(H(secret, nullifier), amount)
     */
    function lock(uint256 commitment) external payable {
        require(msg.value > 0, "Must send FLOW");
        require(nextLeafIndex < MAX_LEAVES, "Tree full");
        require(!commitmentExists[commitment], "Duplicate commitment");

        uint256 leafIndex = nextLeafIndex;
        commitments[leafIndex] = commitment;
        commitmentExists[commitment] = true;
        nextLeafIndex++;

        emit CommitmentLocked(commitment, address(0)); // address(0) = native FLOW
        emit DepositETH(leafIndex, commitment, msg.value);
    }

    /**
     * Get all commitments for Merkle tree reconstruction.
     * Client calls this to build the off-chain tree and generate proofs.
     */
    function getCommitment(uint256 index) external view returns (uint256) {
        require(index < nextLeafIndex, "Index out of bounds");
        return commitments[index];
    }

    /**
     * Get the current number of deposits (tree size).
     */
    function getDepositCount() external view returns (uint256) {
        return nextLeafIndex;
    }
}
