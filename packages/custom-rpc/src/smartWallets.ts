import { Interface, TypedDataEncoder, type JsonRpcProvider } from 'ethers'
import {
  ERC1271_MAGIC_VALUE,
  GIANO_DOMAIN_NAME,
  GIANO_DOMAIN_VERSION,
  SIGNER_SWC_TYPE_GIANO,
  SIGNER_SWC_TYPE_SIMPLE,
  SIGNER_SWC_VERSION_DEFAULT,
  SIGNER_SWC_VERSION_V1,
} from './constants'

/**
 * Smart-wallet (ERC-1271) support.
 *
 * Provides smart-wallet hash wrapping and on-chain ERC-1271
 * `isValidSignature` verification.
 */

const erc1271Interface = new Interface([
  'function isValidSignature(bytes32 hash, bytes signature) view returns (bytes4)',
])

/**
 * Wraps a base hash into a Giano replay-safe EIP-712 digest (version 1).
 * Giano smart wallets wrap all signed hashes in an additional EIP-712 layer
 * for replay protection across chains and contracts.
 */
export function wrapHashForGianoV1(
  baseHash: string,
  walletAddress: string,
  chainId: bigint,
): string {
  const domain = {
    name: GIANO_DOMAIN_NAME,
    version: GIANO_DOMAIN_VERSION,
    chainId,
    verifyingContract: walletAddress,
  }
  const types = {
    GianoSmartWalletMessage: [{ name: 'hash', type: 'bytes32' }],
  }
  return TypedDataEncoder.hash(domain, types, { hash: baseHash })
}

function wrapHashForGianoVersioned(
  baseHash: string,
  walletAddress: string,
  chainId: bigint,
  version: string,
): string {
  if (
    version === SIGNER_SWC_VERSION_DEFAULT ||
    version === SIGNER_SWC_VERSION_V1
  ) {
    return wrapHashForGianoV1(baseHash, walletAddress, chainId)
  }
  // Future versions can be added here.
  throw new Error(
    `unsupported version '${version}' for ${SIGNER_SWC_TYPE_GIANO} wallet`,
  )
}

/**
 * Dispatches to the appropriate wallet-specific hash wrapper based on the
 * wallet type and version. Defaults to Giano when type is empty.
 */
export function wrapHashForSmartWallet(
  baseHash: string,
  walletAddress: string,
  chainId: bigint,
  walletType: string,
  walletVersion: string,
): string {
  switch (walletType) {
    case SIGNER_SWC_TYPE_SIMPLE:
      // Simple: use base hash directly (no wrapping).
      return baseHash
    case SIGNER_SWC_TYPE_GIANO:
    case '':
      return wrapHashForGianoVersioned(
        baseHash,
        walletAddress,
        chainId,
        walletVersion,
      )
    default:
      throw new Error(`unsupported smart wallet type: ${walletType}`)
  }
}

/**
 * Calls `isValidSignature(bytes32,bytes)` on the smart contract wallet and
 * returns true when it returns the ERC-1271 magic value.
 */
export async function verifyERC1271Signature(
  provider: JsonRpcProvider,
  contractAddress: string,
  messageHash: string,
  signature: string,
): Promise<boolean> {
  const data = erc1271Interface.encodeFunctionData('isValidSignature', [
    messageHash,
    signature,
  ])

  let resultHex: string
  try {
    resultHex = await provider.call({ to: contractAddress, data })
  } catch {
    return false
  }

  try {
    const [magic] = erc1271Interface.decodeFunctionResult(
      'isValidSignature',
      resultHex,
    )
    return (
      typeof magic === 'string' &&
      magic.toLowerCase() === ERC1271_MAGIC_VALUE.toLowerCase()
    )
  } catch {
    return false
  }
}
