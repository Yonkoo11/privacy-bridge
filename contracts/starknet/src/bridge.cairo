#[starknet::interface]
pub trait IPrivacyBridge<TContractState> {
    fn mint(
        ref self: TContractState,
        full_proof_with_hints: Span<felt252>,
        storacha_cid: felt252,
    );

    fn is_nullifier_spent(self: @TContractState, nullifier_hash: u256) -> bool;
    fn get_merkle_root(self: @TContractState) -> u256;
    fn set_merkle_root(ref self: TContractState, root: u256);
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

    #[storage]
    struct Storage {
        verifier_class_hash: ClassHash,
        merkle_root: u256,
        nullifiers: starknet::storage::Map<u256, bool>,
        owner: starknet::ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ShieldedMint: ShieldedMint,
        RootUpdated: RootUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct ShieldedMint {
        nullifier_hash: u256,
        recipient: u256,
        amount: u256,
        storacha_cid: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct RootUpdated {
        new_root: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        verifier_class_hash: ClassHash,
        owner: starknet::ContractAddress,
    ) {
        self.verifier_class_hash.write(verifier_class_hash);
        self.owner.write(owner);
    }

    #[abi(embed_v0)]
    impl PrivacyBridgeImpl of super::IPrivacyBridge<ContractState> {
        fn mint(
            ref self: ContractState,
            full_proof_with_hints: Span<felt252>,
            storacha_cid: felt252,
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

            // 3. Check merkle root matches
            let stored_root = self.merkle_root.read();
            assert(proof_root == stored_root, 'Merkle root mismatch');

            // 4. Check nullifier not already spent (double-spend protection)
            let spent = self.nullifiers.read(nullifier_hash);
            assert(!spent, 'Nullifier already spent');

            // 5. Mark nullifier as spent
            self.nullifiers.write(nullifier_hash, true);

            // 6. Emit mint event
            self.emit(ShieldedMint {
                nullifier_hash,
                recipient,
                amount,
                storacha_cid,
            });
        }

        fn is_nullifier_spent(self: @ContractState, nullifier_hash: u256) -> bool {
            self.nullifiers.read(nullifier_hash)
        }

        fn get_merkle_root(self: @ContractState) -> u256 {
            self.merkle_root.read()
        }

        fn set_merkle_root(ref self: ContractState, root: u256) {
            let caller = starknet::get_caller_address();
            let owner = self.owner.read();
            assert(caller == owner, 'Only owner can set root');
            self.merkle_root.write(root);
            self.emit(RootUpdated { new_root: root });
        }
    }
}
