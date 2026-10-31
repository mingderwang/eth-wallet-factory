import { sepolia } from 'viem/chains'

export const chain = sepolia
export const chainId = 11155111

export const rpcUrl =
  process.env.ETH_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com'

export const bundlerRpcUrl = process.env.BUNDLER_RPC_URL

export const vaultDir = process.env.VAULT_DIR ?? '.vault'
export const vaultPath = `${vaultDir}/mnemonic.vault.json`

export const eip7702Delegate = process.env.EIP7702_DELEGATE_ADDRESS
