/**
 * Server-only constants for the custom-rpc firewall.
 *
 * They are intentionally kept local to this package rather than added to
 * `@appliedblockchain/silentdatarollup-core`, because they are firewall
 * (response-redaction / on-chain-verification) details that clients never need.
 *
 * Constants already provided by core (reuse, do not redefine here):
 * - `SignatureType` enum (RAW/EIP191/EIP712)
 * - `HEADER_SIGNER_SWC`, `HEADER_SIGNER_SWC_TYPE`, `HEADER_SIGNATURE_TYPE`
 * - `PRIVATE_EVENT_SIGNATURE_HASH`, `PrivateEvent`, `calculateEventTypeHash`
 */

/**
 * Header carrying the smart wallet version (selects versioned ERC-1271 wrapping).
 * Not present in core, so defined here.
 */
export const HEADER_SIGNER_SWC_VERSION = 'x-signer-swc-version'

/**
 * Predeployed L2ToL1MessagePasser address. `eth_getProof` for this address is
 * allowed without a matching signature (used by the L2->L1 bridge).
 */
export const L2_TO_L1_MESSAGE_PASSER =
  '0x4200000000000000000000000000000000000016'

/** Default maximum block range allowed for a single eth_getLogs request. */
export const DEFAULT_LOGS_LIMIT_RANGE = 10000

// ERC-1271 (https://eips.ethereum.org/EIPS/eip-1271)
/** Magic value returned by `isValidSignature(bytes32,bytes)` on success. */
export const ERC1271_MAGIC_VALUE = '0x1626ba7e'

// Redaction placeholders used to mask sensitive transaction fields.
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
/** Sentinel `to` address used in redacted transaction responses. */
export const UNAUTHENTICATED_TO_ADDRESS =
  '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
export const HEX_ZERO = '0x0'
export const EMPTY_DATA = '0x'
/** 2048-bit (256-byte) zero bloom filter. */
export const ZERO_LOGS_BLOOM = '0x' + '00'.repeat(256)

// Giano smart wallet EIP-712 envelope (must match the Giano client implementation).
export const GIANO_DOMAIN_NAME = 'Giano Smart Wallet'
export const GIANO_DOMAIN_VERSION = '1'

// Smart wallet type values for the x-signer-swc-type header.
export const SIGNER_SWC_TYPE_GIANO = 'giano'
export const SIGNER_SWC_TYPE_SIMPLE = 'simple'

// Smart wallet version values for the x-signer-swc-version header.
export const SIGNER_SWC_VERSION_DEFAULT = '' // empty means use default version
export const SIGNER_SWC_VERSION_V1 = '1'

// Timestamp validity window (minutes relative to now) for replay protection.
export const TIMESTAMP_MIN_OFFSET = -12
export const TIMESTAMP_MAX_OFFSET = 4

// Methods that return logs and therefore need private-event filtering applied.
export const LOG_METHODS = [
  'eth_getLogs',
  'eth_getFilterLogs',
  'eth_getFilterChanges',
]

// Custom Silent Data RPC methods.
export const SD_GET_TRANSACTIONS_BY_ADDRESS = 'sd_getTransactionsByAddress'
export const SD_GET_VERSION = 'sd_getVersion'
