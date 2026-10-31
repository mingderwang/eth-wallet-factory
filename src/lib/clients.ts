import { createPublicClient, createWalletClient, http, type Account } from 'viem'
import { chain, rpcUrl } from '../config'

export const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl, { timeout: 20_000 }),
})

export function walletClient(account: Account) {
  return createWalletClient({
    account,
    chain,
    transport: http(rpcUrl, { timeout: 20_000 }),
  })
}

export async function assertSepolia() {
  const actual = await publicClient.getChainId()
  if (actual !== chain.id) {
    throw new Error(`Wrong RPC chain: expected Sepolia (${chain.id}), received ${actual}`)
  }
}
