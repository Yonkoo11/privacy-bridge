// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPoseidonHasher {
    function poseidon(uint256[2] memory inputs) external pure returns (uint256);
}

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
 * Fix 1: Fixed denominations — all deposits in a pool must match.
 * Fix 3: On-chain incremental Merkle tree (Poseidon, depth 24).
 * Fix 7: Emergency withdraw with 30-day timelock.
 */

contract PrivacyBridge {
    uint256 public constant TREE_DEPTH = 24;
    uint256 public constant MAX_LEAVES = 2 ** TREE_DEPTH;
    uint256 public constant ROOT_HISTORY_SIZE = 30;
    uint256 public constant EMERGENCY_DELAY = 30 days;

    // On-chain Merkle tree state (Fix 3)
    IPoseidonHasher public immutable hasher;
    uint256 public nextLeafIndex;
    mapping(uint256 => uint256) public filledSubtrees;
    mapping(uint256 => uint256) public roots;
    uint256 public currentRootIndex;

    // Commitment tracking
    mapping(uint256 => bool) public commitmentExists;

    // Fix 1: Fixed denominations
    mapping(uint256 => bool) public allowedDenominations;

    // Fix 7: Emergency withdraw
    address public owner;
    uint256 public emergencyWithdrawTime; // 0 = not initiated

    // Precomputed Poseidon zero values: z[0] = H(0,0), z[k] = H(z[k-1], z[k-1])
    uint256[25] public ZEROS;

    // Events
    event CommitmentLocked(uint256 commitment, address token);
    event NewRoot(uint256 root);
    event EmergencyInitiated(uint256 executeAfter);
    event EmergencyCancelled();
    event EmergencyExecuted(address to, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _hasher) {
        hasher = IPoseidonHasher(_hasher);
        owner = msg.sender;

        // Fix 1: Set allowed denominations (wei)
        allowedDenominations[100000000000000] = true;     // 0.0001
        allowedDenominations[1000000000000000] = true;    // 0.001
        allowedDenominations[10000000000000000] = true;   // 0.01
        allowedDenominations[100000000000000000] = true;  // 0.1

        // Compute zero values using the deployed hasher
        ZEROS[0] = hasher.poseidon([uint256(0), uint256(0)]);
        for (uint256 i = 1; i <= TREE_DEPTH; i++) {
            ZEROS[i] = hasher.poseidon([ZEROS[i - 1], ZEROS[i - 1]]);
        }

        // Initialize filled subtrees with zero values
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            filledSubtrees[i] = ZEROS[i];
        }

        // Store initial empty root
        roots[0] = ZEROS[TREE_DEPTH];
    }

    /**
     * Lock native FLOW tokens with a commitment hash.
     * @param commitment Poseidon hash: H(H(secret, nullifier), amount)
     */
    function lock(uint256 commitment) external payable {
        require(allowedDenominations[msg.value], "Invalid denomination");
        require(nextLeafIndex < MAX_LEAVES, "Tree full");
        require(!commitmentExists[commitment], "Duplicate commitment");

        commitmentExists[commitment] = true;

        // Insert into Merkle tree
        _insert(commitment);

        emit CommitmentLocked(commitment, address(0));
    }

    /**
     * Insert a leaf into the incremental Merkle tree.
     */
    function _insert(uint256 leaf) internal {
        uint256 currentIndex = nextLeafIndex;
        uint256 currentHash = leaf;

        for (uint256 level = 0; level < TREE_DEPTH; level++) {
            if (currentIndex % 2 == 0) {
                filledSubtrees[level] = currentHash;
                currentHash = hasher.poseidon([currentHash, ZEROS[level]]);
            } else {
                currentHash = hasher.poseidon([filledSubtrees[level], currentHash]);
            }
            currentIndex >>= 1;
        }

        // Store new root in history ring buffer
        currentRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        roots[currentRootIndex] = currentHash;
        nextLeafIndex++;

        emit NewRoot(currentHash);
    }

    /**
     * Check if a root is in the recent history.
     */
    function isKnownRoot(uint256 root) external view returns (bool) {
        if (root == 0) return false;
        uint256 idx = currentRootIndex;
        for (uint256 i = 0; i < ROOT_HISTORY_SIZE; i++) {
            if (roots[idx] == root) return true;
            if (idx == 0) idx = ROOT_HISTORY_SIZE - 1;
            else idx--;
        }
        return false;
    }

    /**
     * Get the latest Merkle root.
     */
    function getLatestRoot() external view returns (uint256) {
        return roots[currentRootIndex];
    }

    /**
     * Get the current number of deposits (tree size).
     */
    function getDepositCount() external view returns (uint256) {
        return nextLeafIndex;
    }

    // === Fix 7: Emergency Withdraw ===

    function initiateEmergencyWithdraw() external onlyOwner {
        require(emergencyWithdrawTime == 0, "Already initiated");
        emergencyWithdrawTime = block.timestamp + EMERGENCY_DELAY;
        emit EmergencyInitiated(emergencyWithdrawTime);
    }

    function cancelEmergencyWithdraw() external onlyOwner {
        require(emergencyWithdrawTime != 0, "Not initiated");
        emergencyWithdrawTime = 0;
        emit EmergencyCancelled();
    }

    function executeEmergencyWithdraw(address payable to) external onlyOwner {
        require(emergencyWithdrawTime != 0, "Not initiated");
        require(block.timestamp >= emergencyWithdrawTime, "Delay not passed");

        uint256 balance = address(this).balance;
        emergencyWithdrawTime = 0;

        (bool ok,) = to.call{value: balance}("");
        require(ok, "Transfer failed");

        emit EmergencyExecuted(to, balance);
    }
}
