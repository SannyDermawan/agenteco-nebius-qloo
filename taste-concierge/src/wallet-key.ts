/**
 * Reads a wallet key from the environment. Two forms are accepted:
 *   - an EVM private key: 0x followed by 64 hex characters
 *   - a Solana secret key: the 64 bytes of a Solana keypair, as base58 or as a JSON array like the Solana CLI keypair file
 * The SDK takes a hex string for EVM and a Uint8Array for Solana, and uses the chain of the key's own family
 * (Solana devnet for a Solana key, the primary EVM chain otherwise).
 */
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export function base58Decode(text: string): Uint8Array {
  let value = 0n
  for (const ch of text) {
    const digit = ALPHABET.indexOf(ch)
    if (digit < 0) throw new Error('The key is not valid base58.')
    value = value * 58n + BigInt(digit)
  }
  const bytes: number[] = []
  while (value > 0n) {
    bytes.unshift(Number(value & 0xffn))
    value >>= 8n
  }
  for (const ch of text) {
    if (ch !== '1') break
    bytes.unshift(0)
  }
  return Uint8Array.from(bytes)
}

export type WalletKey = `0x${string}` | Uint8Array

export function parseWalletKey(raw: string | undefined, name = 'WALLET_PRIVATE_KEY'): WalletKey {
  const value = raw?.trim()
  if (!value) throw new Error(`Missing ${name} in .env (a testnet wallet).`)
  if (/^0x[0-9a-fA-F]{64}$/.test(value)) return value as `0x${string}`
  if (/^0x/i.test(value)) throw new Error(`${name} starts with 0x but is not 32 bytes of hex: an EVM key is 0x followed by 64 hex characters.`)
  if (value.startsWith('[')) {
    const parsed: unknown = JSON.parse(value)
    if (Array.isArray(parsed) && parsed.length === 64 && parsed.every((n) => Number.isInteger(n) && n >= 0 && n < 256)) return Uint8Array.from(parsed as number[])
    throw new Error(`${name} looks like a JSON array but is not 64 bytes.`)
  }
  const bytes = base58Decode(value)
  if (bytes.length === 64) return bytes
  throw new Error(`${name} must be an EVM key (0x + 64 hex) or a Solana secret key (64 bytes, base58 or JSON array).`)
}
