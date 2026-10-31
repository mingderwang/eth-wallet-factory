import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt as scryptCallback,
} from 'node:crypto'
import { password } from '@inquirer/prompts'
import { vaultPath } from '../config'

const N = 1 << 15
const r = 8
const p = 1
const keyLength = 32

type Vault = {
  version: 1
  kdf: 'scrypt'
  N: number
  r: number
  p: number
  salt: string
  iv: string
  tag: string
  ciphertext: string
}

function deriveKey(passphrase: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      passphrase,
      salt,
      keyLength,
      { N, r, p, maxmem: 128 * 1024 * 1024 },
      (error, derivedKey) => {
        if (error) reject(error)
        else resolve(derivedKey)
      },
    )
  })
}

export async function promptNewPassword(): Promise<string> {
  const first = await password({
    message: 'Create a strong vault password (input is masked):',
    mask: '*',
  })
  if (first.length < 14) {
    throw new Error('Use a vault password of at least 14 characters.')
  }
  const second = await password({
    message: 'Confirm vault password:',
    mask: '*',
  })
  if (first !== second) throw new Error('Passwords do not match.')
  return first
}

export async function promptVaultPassword(): Promise<string> {
  return password({ message: 'Vault password:', mask: '*' })
}

export async function saveMnemonic(mnemonic: string) {
  const passphrase = await promptNewPassword()
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = await deriveKey(passphrase, salt)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(mnemonic, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  const vault: Vault = {
    version: 1,
    kdf: 'scrypt',
    N, r, p,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
  }

  await mkdir(dirname(vaultPath), { recursive: true, mode: 0o700 })
  await writeFile(vaultPath, JSON.stringify(vault, null, 2), { mode: 0o600 })
  await chmod(vaultPath, 0o600)
  console.log(`Encrypted mnemonic vault saved: ${vaultPath}`)
}

export async function loadMnemonic(): Promise<string> {
  const raw = await readFile(vaultPath, 'utf8')
  const vault = JSON.parse(raw) as Vault
  if (vault.version !== 1 || vault.kdf !== 'scrypt') {
    throw new Error('Unsupported or invalid vault format.')
  }
  const passphrase = await promptVaultPassword()
  const key = await deriveKey(passphrase, Buffer.from(vault.salt, 'hex'))
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(vault.iv, 'hex'),
    )
    decipher.setAuthTag(Buffer.from(vault.tag, 'hex'))
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(vault.ciphertext, 'hex')),
      decipher.final(),
    ])
    return plaintext.toString('utf8')
  } catch {
    throw new Error('Vault decryption failed. Wrong password or damaged vault.')
  }
}
