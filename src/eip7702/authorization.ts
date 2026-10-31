import { isAddress, type Address } from 'viem'
import { eip7702Delegate } from '../config'
import { assertSepolia, walletClient } from '../lib/clients'
import { deriveEoa } from '../wallet/hd'
import { writeFile, mkdir, chmod } from 'node:fs/promises'
import { dirname } from 'node:path'

export function requireDelegate(): Address {
  if (!eip7702Delegate || !isAddress(eip7702Delegate)) {
    throw new Error('Set EIP7702_DELEGATE_ADDRESS to a verified, deployed EIP-7702 delegate on Sepolia.')
  }
  return eip7702Delegate as Address
}

export async function sign7702(mnemonic: string, index: number) {
  await assertSepolia()
  const delegate = requireDelegate()
  const owner = deriveEoa(mnemonic, index)
  const client = walletClient(owner)
  const code = await (await import('../lib/clients')).publicClient.getCode({ address: delegate })
  if (!code || code === '0x') {
    throw new Error(`No contract bytecode found at delegate ${delegate} on Sepolia.`)
  }

  const authorization = await client.signAuthorization({
    account: owner,
    contractAddress: delegate,
    executor: 'self',
    chainId: 11155111,
  })

  return {
    owner: owner.address,
    chainId: 11155111,
    delegate,
    authorization,
  }
}

export async function saveAuthorization(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await writeFile(path, JSON.stringify(value, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v, 2), { mode: 0o600 })
  await chmod(path, 0o600)
}
