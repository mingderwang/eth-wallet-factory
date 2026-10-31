import { english, generateMnemonic, mnemonicToAccount } from 'viem/accounts'

export const derivationPath = (index: number) =>
  `m/44'/60'/0'/0/${index}` as const

export function newMnemonic(): string {
  // 256 bits of entropy yields a 24-word BIP-39 mnemonic.
  return generateMnemonic(english, 256)
}

export function deriveEoa(mnemonic: string, index: number) {
  return mnemonicToAccount(mnemonic, {
    path: derivationPath(index),
  })
}
