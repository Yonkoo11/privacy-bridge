#[starknet::interface]
pub trait IPrivacyBridge<TContractState> {
    fn mint(
        ref self: TContractState,
        full_proof_with_hints: Span<felt252>,
        max_fee_bps: u256,
    );

    fn is_nullifier_spent(self: @TContractState, nullifier_hash: u256) -> bool;
    fn get_merkle_root(self: @TContractState) -> u256;
    fn set_merkle_root(ref self: TContractState, root: u256);
    fn add_known_root(ref self: TContractState, root: u256);
    fn get_token_address(self: @TContractState) -> starknet::ContractAddress;
    fn set_token_address(ref self: TContractState, token_address: starknet::ContractAddress);
    fn get_relayer_fee(self: @TContractState) -> u256;
    fn set_relayer_fee(ref self: TContractState, fee_bps: u256);
    fn set_denomination(ref self: TContractState, denom: u256, allowed: bool);
    fn set_min_delay(ref self: TContractState, delay: u64);
}

#[starknet::contract]
mod PrivacyBridge {
    use starknet::ClassHash;
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        StorageMapReadAccess, StorageMapWriteAccess,
    };
    use privacy_bridge::groth16_verifier::{
        IGroth16VerifierBN254LibraryDispatcher,
        IGroth16VerifierBN254DispatcherTrait,
    };
    use privacy_bridge::shielded_token::{
        IShieldedTokenDispatcher,
        IShieldedTokenDispatcherTrait,
    };

    #[storage]
    struct Storage {
        verifier_class_hash: ClassHash,
        merkle_root: u256,
        nullifiers: starknet::storage::Map<u256, bool>,
        owner: starknet::ContractAddress,
        // Fix 1: Fixed denomination pools
        allowed_denominations: starknet::storage::Map<u256, bool>,
        // Fix 3: Root history
        known_roots: starknet::storage::Map<u256, bool>,
        // ERC20 token address (replaces internal balances)
        token_address: starknet::ContractAddress,
        // Fix 5: Relayer fee (basis points, max 500 = 5%)
        relayer_fee_bps: u256,
        // Fix 6: Withdrawal time lock
        root_timestamps: starknet::storage::Map<u256, u64>,
        min_withdrawal_delay: u64,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ShieldedMint: ShieldedMint,
        RootUpdated: RootUpdated,
    }

    // Fix 4: Removed storacha_cid from event
    #[derive(Drop, starknet::Event)]
    struct ShieldedMint {
        nullifier_hash: u256,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct RootUpdated {
        new_root: u256,
    }

    // Fixed denomination values (wei) for testnet
    const DENOM_0001: u256 = 100000000000000;       // 0.0001
    const DENOM_001: u256 = 1000000000000000;        // 0.001
    const DENOM_01: u256 = 10000000000000000;        // 0.01
    const DENOM_1: u256 = 100000000000000000;        // 0.1

    #[constructor]
    fn constructor(
        ref self: ContractState,
        verifier_class_hash: ClassHash,
        owner: starknet::ContractAddress,
        token_address: starknet::ContractAddress,
    ) {
        self.verifier_class_hash.write(verifier_class_hash);
        self.owner.write(owner);
        self.token_address.write(token_address);

        // Fix 1: Set allowed denominations
        self.allowed_denominations.write(DENOM_0001, true);
        self.allowed_denominations.write(DENOM_001, true);
        self.allowed_denominations.write(DENOM_01, true);
        self.allowed_denominations.write(DENOM_1, true);

        // Fix 6: Default delay 0 (for devnet testing)
        self.min_withdrawal_delay.write(0);
    }

    #[abi(embed_v0)]
    impl PrivacyBridgeImpl of super::IPrivacyBridge<ContractState> {
        fn mint(
            ref self: ContractState,
            full_proof_with_hints: Span<felt252>,
            max_fee_bps: u256,
        ) {
            // 1. Verify the Groth16 proof via garaga library call
            let class_hash = self.verifier_class_hash.read();
            let dispatcher = IGroth16VerifierBN254LibraryDispatcher { class_hash };
            let result = dispatcher.verify_groth16_proof_bn254(full_proof_with_hints);

            // 2. Extract public inputs: [root, nullifierHash, recipient, amount]
            let pi: Span<u256> = result.expect('ZK proof verification failed');

            assert(pi.len() == 4, 'Expected 4 public inputs');
            let proof_root: u256 = *pi.at(0);
            let nullifier_hash: u256 = *pi.at(1);
            let recipient: u256 = *pi.at(2);
            let amount: u256 = *pi.at(3);

            // Denomination is enforced at deposit time on Flow EVM.
            // NOT checked here — disabling a denomination after deposit would lock funds.

            // Fix 3: Check root is in known_roots history
            assert(self.known_roots.read(proof_root), 'Unknown merkle root');

            // Fix 6: Check withdrawal time lock
            let root_time = self.root_timestamps.read(proof_root);
            let now = starknet::get_block_timestamp();
            let delay = self.min_withdrawal_delay.read();
            assert(now >= root_time + delay, 'Withdrawal too early');

            // 4. Check nullifier not already spent (double-spend protection)
            let spent = self.nullifiers.read(nullifier_hash);
            assert(!spent, 'Nullifier already spent');

            // 5. Mark nullifier as spent
            self.nullifiers.write(nullifier_hash, true);

            // Fix 5: Relayer fee — mint fee to caller, remainder to recipient
            // max_fee_bps protects users from fee changes between proof gen and submission
            let fee_bps = self.relayer_fee_bps.read();
            assert(fee_bps <= max_fee_bps, 'Fee exceeds max agreed');
            let fee = amount * fee_bps / 10000;
            let net_amount = amount - fee;

            // Convert recipient u256 to ContractAddress
            let felt_recip: felt252 = recipient.try_into().expect('recipient overflow');
            let addr: starknet::ContractAddress = felt_recip.try_into().unwrap();

            // Mint pFLOW tokens via ERC20 contract
            let token = IShieldedTokenDispatcher { contract_address: self.token_address.read() };
            token.mint(addr, net_amount);

            // Fix 5: Mint relayer fee to caller (if any)
            if fee > 0 {
                let caller = starknet::get_caller_address();
                token.mint(caller, fee);
            }

            // Fix 4: Emit event without storacha_cid or recipient
            self.emit(ShieldedMint {
                nullifier_hash,
                amount,
            });
        }

        fn is_nullifier_spent(self: @ContractState, nullifier_hash: u256) -> bool {
            self.nullifiers.read(nullifier_hash)
        }

        fn get_merkle_root(self: @ContractState) -> u256 {
            self.merkle_root.read()
        }

        // Legacy: sets single root (kept for backward compat with tests)
        fn set_merkle_root(ref self: ContractState, root: u256) {
            let caller = starknet::get_caller_address();
            let owner = self.owner.read();
            assert(caller == owner, 'Only owner can set root');
            self.merkle_root.write(root);
            // Also add to known_roots and timestamp
            self.known_roots.write(root, true);
            self.root_timestamps.write(root, starknet::get_block_timestamp());
            self.emit(RootUpdated { new_root: root });
        }

        // Fix 3: Add root to history (owner only)
        fn add_known_root(ref self: ContractState, root: u256) {
            let caller = starknet::get_caller_address();
            let owner = self.owner.read();
            assert(caller == owner, 'Only owner can add root');
            self.merkle_root.write(root);
            self.known_roots.write(root, true);
            self.root_timestamps.write(root, starknet::get_block_timestamp());
            self.emit(RootUpdated { new_root: root });
        }

        fn get_token_address(self: @ContractState) -> starknet::ContractAddress {
            self.token_address.read()
        }

        // One-time token address setter (for deploy-time chicken-and-egg)
        fn set_token_address(ref self: ContractState, token_address: starknet::ContractAddress) {
            let caller = starknet::get_caller_address();
            let owner = self.owner.read();
            assert(caller == owner, 'Only owner can set token');
            let zero: starknet::ContractAddress = 0.try_into().unwrap();
            let current = self.token_address.read();
            assert(current == zero, 'Token already set');
            self.token_address.write(token_address);
        }

        // Fix 5: Relayer fee management
        fn get_relayer_fee(self: @ContractState) -> u256 {
            self.relayer_fee_bps.read()
        }

        fn set_relayer_fee(ref self: ContractState, fee_bps: u256) {
            let caller = starknet::get_caller_address();
            let owner = self.owner.read();
            assert(caller == owner, 'Only owner can set fee');
            assert(fee_bps <= 500, 'Fee exceeds 5%');
            self.relayer_fee_bps.write(fee_bps);
        }

        // Fix 1: Denomination management
        fn set_denomination(ref self: ContractState, denom: u256, allowed: bool) {
            let caller = starknet::get_caller_address();
            let owner = self.owner.read();
            assert(caller == owner, 'Only owner can set denom');
            self.allowed_denominations.write(denom, allowed);
        }

        // Fix 6: Withdrawal delay management
        fn set_min_delay(ref self: ContractState, delay: u64) {
            let caller = starknet::get_caller_address();
            let owner = self.owner.read();
            assert(caller == owner, 'Only owner can set delay');
            self.min_withdrawal_delay.write(delay);
        }
    }
}
