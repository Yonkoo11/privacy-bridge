#[starknet::interface]
pub trait IShieldedToken<TContractState> {
    fn name(self: @TContractState) -> felt252;
    fn symbol(self: @TContractState) -> felt252;
    fn decimals(self: @TContractState) -> u8;
    fn total_supply(self: @TContractState) -> u256;
    fn balance_of(self: @TContractState, account: starknet::ContractAddress) -> u256;
    fn allowance(
        self: @TContractState,
        owner: starknet::ContractAddress,
        spender: starknet::ContractAddress,
    ) -> u256;
    fn transfer(ref self: TContractState, recipient: starknet::ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState,
        sender: starknet::ContractAddress,
        recipient: starknet::ContractAddress,
        amount: u256,
    ) -> bool;
    fn approve(ref self: TContractState, spender: starknet::ContractAddress, amount: u256) -> bool;
    fn mint(ref self: TContractState, to: starknet::ContractAddress, amount: u256);
    fn burn(ref self: TContractState, from: starknet::ContractAddress, amount: u256);
}

#[starknet::contract]
mod ShieldedToken {
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        StorageMapReadAccess, StorageMapWriteAccess,
    };

    #[storage]
    struct Storage {
        _name: felt252,
        _symbol: felt252,
        _decimals: u8,
        _total_supply: u256,
        _balances: starknet::storage::Map<starknet::ContractAddress, u256>,
        _allowances: starknet::storage::Map<(starknet::ContractAddress, starknet::ContractAddress), u256>,
        _bridge: starknet::ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Transfer: Transfer,
        Approval: Approval,
    }

    #[derive(Drop, starknet::Event)]
    struct Transfer {
        #[key]
        from: starknet::ContractAddress,
        #[key]
        to: starknet::ContractAddress,
        value: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Approval {
        #[key]
        owner: starknet::ContractAddress,
        #[key]
        spender: starknet::ContractAddress,
        value: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        bridge: starknet::ContractAddress,
        name: felt252,
        symbol: felt252,
    ) {
        self._name.write(name);
        self._symbol.write(symbol);
        self._decimals.write(18);
        self._bridge.write(bridge);
    }

    #[abi(embed_v0)]
    impl ShieldedTokenImpl of super::IShieldedToken<ContractState> {
        fn name(self: @ContractState) -> felt252 {
            self._name.read()
        }

        fn symbol(self: @ContractState) -> felt252 {
            self._symbol.read()
        }

        fn decimals(self: @ContractState) -> u8 {
            self._decimals.read()
        }

        fn total_supply(self: @ContractState) -> u256 {
            self._total_supply.read()
        }

        fn balance_of(self: @ContractState, account: starknet::ContractAddress) -> u256 {
            self._balances.read(account)
        }

        fn allowance(
            self: @ContractState,
            owner: starknet::ContractAddress,
            spender: starknet::ContractAddress,
        ) -> u256 {
            self._allowances.read((owner, spender))
        }

        fn transfer(
            ref self: ContractState,
            recipient: starknet::ContractAddress,
            amount: u256,
        ) -> bool {
            let caller = starknet::get_caller_address();
            self._transfer(caller, recipient, amount);
            true
        }

        fn transfer_from(
            ref self: ContractState,
            sender: starknet::ContractAddress,
            recipient: starknet::ContractAddress,
            amount: u256,
        ) -> bool {
            let caller = starknet::get_caller_address();
            let current_allowance = self._allowances.read((sender, caller));
            assert(current_allowance >= amount, 'Insufficient allowance');
            self._allowances.write((sender, caller), current_allowance - amount);
            self._transfer(sender, recipient, amount);
            true
        }

        fn approve(
            ref self: ContractState,
            spender: starknet::ContractAddress,
            amount: u256,
        ) -> bool {
            let caller = starknet::get_caller_address();
            self._allowances.write((caller, spender), amount);
            self.emit(Approval { owner: caller, spender, value: amount });
            true
        }

        fn mint(ref self: ContractState, to: starknet::ContractAddress, amount: u256) {
            let caller = starknet::get_caller_address();
            let bridge = self._bridge.read();
            assert(caller == bridge, 'Only bridge can mint');

            let supply = self._total_supply.read();
            self._total_supply.write(supply + amount);
            let bal = self._balances.read(to);
            self._balances.write(to, bal + amount);

            let zero: starknet::ContractAddress = 0.try_into().unwrap();
            self.emit(Transfer { from: zero, to, value: amount });
        }

        fn burn(ref self: ContractState, from: starknet::ContractAddress, amount: u256) {
            let caller = starknet::get_caller_address();
            let bridge = self._bridge.read();
            assert(caller == bridge, 'Only bridge can burn');

            let bal = self._balances.read(from);
            assert(bal >= amount, 'Burn exceeds balance');
            self._balances.write(from, bal - amount);
            let supply = self._total_supply.read();
            self._total_supply.write(supply - amount);

            let zero: starknet::ContractAddress = 0.try_into().unwrap();
            self.emit(Transfer { from, to: zero, value: amount });
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _transfer(
            ref self: ContractState,
            sender: starknet::ContractAddress,
            recipient: starknet::ContractAddress,
            amount: u256,
        ) {
            let sender_bal = self._balances.read(sender);
            assert(sender_bal >= amount, 'Insufficient balance');
            self._balances.write(sender, sender_bal - amount);
            let recip_bal = self._balances.read(recipient);
            self._balances.write(recipient, recip_bal + amount);
            self.emit(Transfer { from: sender, to: recipient, value: amount });
        }
    }
}
