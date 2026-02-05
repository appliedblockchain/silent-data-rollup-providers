import { ethers } from 'ethers'
import { quoteToHash, sha256 } from './quoteToHash'
import { verifyQuoteRegistered } from './registry'
import { CA_ROOT_PEM } from './quote/validateTdxQuote'

function compressUncompressedSecp256k1(pubUncompressed: Uint8Array): Buffer {
  if (pubUncompressed.length !== 65 || pubUncompressed[0] !== 0x04) {
    throw new Error(
      `Unexpected pubkey format/length: ${pubUncompressed.length}`,
    )
  }
  const x = pubUncompressed.slice(1, 33)
  const y = pubUncompressed.slice(33, 65)
  const prefix = (y[31] & 1) === 0 ? 0x02 : 0x03 // even -> 02, odd -> 03
  return Buffer.concat([Buffer.from([prefix]), Buffer.from(x)])
}

const DomainSeparatorSign = 'CUSTOM-RPC SIGN:'

function stringToBytes(str: string): Uint8Array {
  let rawQuote: Uint8Array
  try {
    rawQuote = ethers.getBytes('0x' + str)
  } catch (e: any) {
    throw new Error(`Invalid hex: ${e?.message ?? e}`)
  }
  return rawQuote
}

export async function validateTdxAttestation(
  attestBody: Buffer,
  exporterKey: Buffer,
  l1RpcUrl: string,
  registryContractAddress: string,
): Promise<boolean> {
  const text = attestBody.toString('utf8').trim()
  let json: any
  try {
    json = JSON.parse(text)
  } catch (e: any) {
    throw new Error(`Invalid TDX attestation body JSON: ${e?.message ?? e}`)
  }
  const rawQuote = stringToBytes(json.quote)
  const { challenge, hashVariants } = await quoteToHash(rawQuote, CA_ROOT_PEM)
  // challenge is the REPORT_DATA of the request without the domain separator prefix
  const registered = await verifyQuoteRegistered(
    hashVariants,
    l1RpcUrl,
    registryContractAddress,
  )
  if (!registered) {
    throw new Error('TDX measurement not registered in verification registry')
  }

  const challengeBuffer = Buffer.from(challenge)
  if (challengeBuffer.length < 32) {
    throw new Error(`Report data too short: ${challengeBuffer.length}`)
  }
  const pubHashFromQuote = challengeBuffer.subarray(challengeBuffer.length - 32)

  const pubCompressed = await recoverSignaturePubkey(
    exporterKey,
    json.signature,
  )
  const pubHash = await sha256(pubCompressed)
  return bytesEqual(pubHashFromQuote, pubHash)
}

export async function recoverSignaturePubkey(
  message: Uint8Array,
  signatureHex: string,
): Promise<Uint8Array> {
  const digest = await sha256(
    Buffer.concat([
      Buffer.from(DomainSeparatorSign, 'utf8'),
      Buffer.from(message),
    ]),
  )

  const sigBytes = stringToBytes(signatureHex)
  if (sigBytes.length !== 65) {
    throw new Error(
      `Invalid signature length: ${sigBytes.length} (expected 65)`,
    )
  }

  // Normalise pubkey recovery byte
  const sig = Buffer.from(sigBytes)
  if (sig[64] === 0 || sig[64] === 1) {
    sig[64] += 27
  }

  let pubUncompressed: Uint8Array
  try {
    const pubHex = ethers.SigningKey.recoverPublicKey(
      ethers.hexlify(digest),
      ethers.hexlify(sig),
    )
    pubUncompressed = ethers.getBytes(pubHex)
  } catch (e: any) {
    throw new Error(
      `Failed to recover public key from signature: ${e?.message ?? e}`,
    )
  }
  const pubCompressed = compressUncompressedSecp256k1(pubUncompressed)
  return pubCompressed
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}
