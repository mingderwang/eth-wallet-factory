#!/usr/bin/env node
import {
  formatEther,
  isAddress,
  parseEther,
  type Address,
} from 'viem'
import { createBundlerClient } from 'viem/account-abstraction'
import { readFile } from 'node:fs/promises'
import { mkdir } from 'node:fs/promises'
import { countOption, flag, indexOption, option } from './lib/args'
import { assertSepolia, publicClient, walletClient } from './lib/clients'
import { bundlerRpcUrl, chain, eip7702Delegate, vaultDir } from './config'
import { deriveEoa, derivationPath, newMnemonic } from './wallet/hd'
import { loadMnemonic, saveMnemonic } from './wallet/vault'
import { deriveCoinbaseSmartAccount } from './aa/coinbase'
import { saveAuthorization, sign7702 } from './eip7702/authorization'

function printHelp() {
  console.log(`
Ethereum Wallet Factory (Sepolia)

Commands:
  create       Generate a 24-word mnemonic, encrypt it, derive HD accounts.
  inspect      Show HD-derived EOA addresses and derivation paths.
  balance      Show ETH balance, nonce and code status for EOAs.
  recovery     Display the recovery phrase only after two explicit safeguards.
  aa-inspect   Derive Coinbase Smart Wallet addresses (no deployment).
  aa-send      Send an ERC-4337 UserOperation (requires --execute).
  7702-sign    Sign EIP-7702 authorization (does not broadcast).
  7702-execute Broadcast a saved authorization (requires --execute).

Examples:
  bun run wallet:create --count 3
  bun run wallet:inspect --count 3
  bun run wallet:balance --count 3
  bun run aa:inspect --count 3
  bun run aa:send --index 0 --to 0x... --eth 0.001 --execute
  bun run 7702:sign --index 0
  bun run 7702:execute --index 0 --execute
`)
}

async function confirmExecution(action: string) {
  if (!flag('--execute')) {
    throw new Error(`Refusing to broadcast. Re-run with --execute to explicitly authorize: ${action}`)
  }
  if (process.env.CONFIRM_EXECUTION !== 'YES') {
    throw new Error(`Set CONFIRM_EXECUTION=YES as a second explicit safeguard before broadcasting: ${action}`)
  }
}

async function main() {
  const command = process.argv[2]
  if (!command || command === 'help' || command === '--help') return printHelp()

  if (command === 'create') {
    const count = countOption()
    await mkdir(vaultDir, { recursive: true, mode: 0o700 })
    const mnemonic = newMnemonic()
    await saveMnemonic(mnemonic)
    console.log(`Generated ${count} HD account(s) from one 24-word mnemonic.`)
    console.log('Mnemonic was encrypted and was NOT printed.')
    for (let i = 0; i < count; i++) {
      const account = deriveEoa(mnemonic, i)
      console.log(`${i}: ${account.address}  ${derivationPath(i)}`)
    }
    console.log('Back up the recovery phrase securely. The CLI intentionally does not display it.')
    return
  }

  const mnemonic = await loadMnemonic()

  if (command === 'recovery') {
    if (!flag('--show-secret') || process.env.CONFIRM_SECRET_DISPLAY !== 'YES') {
      throw new Error('Refusing to display recovery phrase. Require --show-secret and CONFIRM_SECRET_DISPLAY=YES.');
    }
    console.warn('WARNING: Anyone who sees this phrase can control every derived account.');
    console.log(mnemonic);
    return;
  }

  if (command === 'inspect') {
    const count = countOption()
    for (let i = 0; i < count; i++) {
      const account = deriveEoa(mnemonic, i)
      console.log(`${i}\t${account.address}\t${derivationPath(i)}`)
    }
    return
  }

  if (command === 'balance') {
    await assertSepolia()
    const count = countOption()
    for (let i = 0; i < count; i++) {
      const account = deriveEoa(mnemonic, i)
      const [balance, nonce, code] = await Promise.all([
        publicClient.getBalance({ address: account.address }),
        publicClient.getTransactionCount({ address: account.address }),
        publicClient.getCode({ address: account.address }),
      ])
      console.log([
        `index=${i}`,
        `address=${account.address}`,
        `ETH=${formatEther(balance)}`,
        `nonce=${nonce}`,
        `code=${code && code !== '0x' ? 'present' : 'EOA/no-code'}`,
      ].join('  '))
    }
    return
  }

  if (command === 'aa-inspect') {
    await assertSepolia()
    const count = countOption()
    for (let i = 0; i < count; i++) {
      const { owner, smartAccount } = await deriveCoinbaseSmartAccount(mnemonic, i)
      const [balance, code] = await Promise.all([
        publicClient.getBalance({ address: smartAccount.address }),
        publicClient.getCode({ address: smartAccount.address }),
      ])
      console.log(`index=${i}`)
      console.log(`  owner EOA:       ${owner.address}`)
      console.log(`  Coinbase SCA:    ${smartAccount.address}`)
      console.log(`  ETH:             ${formatEther(balance)}`)
      console.log(`  deployed:        ${Boolean(code && code !== '0x')}`)
    }
    return
  }

  if (command === 'aa-send') {
    await assertSepolia()
    if (!bundlerRpcUrl) throw new Error('Set BUNDLER_RPC_URL to a Sepolia ERC-4337 bundler endpoint.')
    const index = indexOption()
    const to = option('--to')
    const eth = option('--eth', '0')
    if (!to || !isAddress(to)) throw new Error('Provide a valid --to address.')
    const value = parseEther(eth!)
    if (value < 0n) throw new Error('--eth cannot be negative.')
    await confirmExecution(`send ${eth} ETH from Coinbase Smart Wallet index ${index} to ${to}`)

    const { smartAccount } = await deriveCoinbaseSmartAccount(mnemonic, index)
    const bundler = createBundlerClient({
      account: smartAccount,
      client: publicClient,
      transport: (await import('viem')).http(bundlerRpcUrl),
    })
    const userOpHash = await bundler.sendUserOperation({
      account: smartAccount,
      calls: [{ to: to as Address, value }],
    })
    console.log(`UserOperation hash: ${userOpHash}`)
    console.log('Submitted to bundler. Check the bundler/EntryPoint receipt before assuming finality.')
    return
  }

  if (command === '7702-sign') {
    const index = indexOption()
    const result = await sign7702(mnemonic, index)
    const path = `${vaultDir}/eip7702-${index}.authorization.json`
    await saveAuthorization(path, result)
    console.log(`Authorization signed and saved: ${path}`)
    console.log(`EOA: ${result.owner}`)
    console.log(`Delegate: ${result.delegate}`)
    console.log('NOT broadcast. Treat the authorization file as a sensitive bearer artifact.')
    return
  }

  if (command === '7702-execute') {
    await assertSepolia()
    const index = indexOption()
    await confirmExecution(`apply EIP-7702 delegation to HD account ${index}`)
    const path = `${vaultDir}/eip7702-${index}.authorization.json`
    const saved = JSON.parse(await readFile(path, 'utf8'))
    const owner = deriveEoa(mnemonic, index)
    if (saved.owner?.toLowerCase() !== owner.address.toLowerCase()) {
      throw new Error('Authorization owner does not match this HD index.')
    }
    if (saved.chainId !== chain.id) throw new Error('Authorization chain ID is not Sepolia.')
    if (!eip7702Delegate || saved.delegate?.toLowerCase() !== eip7702Delegate.toLowerCase()) {
      throw new Error('Saved authorization delegate does not match EIP7702_DELEGATE_ADDRESS.')
    }
    const client = walletClient(owner)
    const hash = await client.sendTransaction({
      account: owner,
      to: owner.address,
      authorizationList: [saved.authorization],
      value: 0n,
    })
    console.log(`Broadcast transaction: ${hash}`)
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    console.log(`Receipt status: ${receipt.status}`)
    return
  }

  printHelp()
  throw new Error(`Unknown command: ${command}`)
}

main().catch((error) => {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
