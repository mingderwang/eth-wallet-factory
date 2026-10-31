# eth-wallet-factory

A TypeScript CLI for Ethereum HD wallets, Coinbase Smart Account address derivation, ERC-4337 UserOperations and EIP-7702 authorization workflows. The default network is Sepolia.

> **Security notice:** This is a development scaffold, not an audited wallet. Use disposable Sepolia funds until you have independently reviewed the implementation.

## Requirements

- Node.js 20 or newer to run the published CLI.
- An Ethereum Sepolia RPC endpoint.
- A bundler URL for ERC-4337 operations.
- A separately deployed and audited EIP-7702 delegate contract for EIP-7702 authorization.

## Install from npm

```bash
npm install -g eth-wallet-factory
eth-wallet --help
```

Or run without a global installation:

```bash
npx eth-wallet-factory --help
```

## Configuration

Create a `.env` file in your working directory using `.env.example` as a reference. Configure `ETH_RPC_URL`, `BUNDLER_RPC_URL` and `EIP7702_DELEGATE_ADDRESS` as needed. The CLI does not automatically load `.env` files. Export variables in your shell or use your preferred environment manager.

## Commands

```bash
# Create an encrypted 24-word mnemonic vault and derive three accounts
eth-wallet create --count 3

# Inspect addresses and check Sepolia balances
eth-wallet inspect --count 3
eth-wallet balance --count 3

# Display the recovery phrase only with both safeguards
CONFIRM_SECRET_DISPLAY=YES eth-wallet recovery --show-secret

# Derive Coinbase Smart Wallet addresses (does not deploy)
eth-wallet aa-inspect --count 3

# Send an ERC-4337 UserOperation
CONFIRM_EXECUTION=YES eth-wallet aa-send --index 0 --to 0xYourRecipient --eth 0.001 --execute

# Sign EIP-7702 authorization without broadcasting
eth-wallet 7702-sign --index 0

# Broadcast a saved EIP-7702 authorization with explicit confirmation
CONFIRM_EXECUTION=YES eth-wallet 7702-execute --index 0 --execute
```

## Development

```bash
npm install
npm run typecheck
npm run build
node dist/cli.js --help
```

Bun may also be used for local development. The published executable is bundled for Node.js 20+. `npm publish` runs type-checking and building through `prepublishOnly`.

## Architecture and security boundaries

- BIP-39 24-word mnemonic generation and BIP-32/BIP-44 derivation using `m/44'/60'/0'/0/{index}`.
- Mnemonic encryption with scrypt and AES-256-GCM.
- Coinbase Smart Account derivation through viem 2.32.0 or later's `toCoinbaseSmartAccount` (the `1.1` version option was added in viem 2.32.0). The first UserOperation normally triggers deployment; `aa-inspect` does not deploy.
- ERC-4337 UserOperations are submitted through a user-configured bundler.
- EIP-7702 is a separate account model. It does not automatically make an EOA a Coinbase Smart Wallet. The delegate address must identify a purpose-built, audited implementation.
- Broadcasting requires both `--execute` and `CONFIRM_EXECUTION=YES`.

Never commit `.env`, `.vault/`, authorization files, mnemonics, private keys or RPC credentials. Back up the recovery phrase offline. Protect signed EIP-7702 authorizations. Independently verify the chain ID, delegate bytecode, audit, upgradeability and recovery behavior before use.

## License

MIT. See [LICENSE](./LICENSE).
