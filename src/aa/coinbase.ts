import { toCoinbaseSmartAccount } from 'viem/account-abstraction'
import { publicClient } from '../lib/clients'
import { deriveEoa } from '../wallet/hd'

export async function deriveCoinbaseSmartAccount(mnemonic: string, index: number) {
  const owner = deriveEoa(mnemonic, index)
  // Coinbase Smart Wallet v1.1. The address is deterministic; this does not deploy it.
  const smartAccount = await toCoinbaseSmartAccount({
    client: publicClient,
    owners: [owner],
    version: '1.1',
  })
  return { owner, smartAccount }
}
