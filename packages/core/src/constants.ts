import { keccak256, toUtf8Bytes } from 'ethers'

export const SIGN_RPC_METHODS = [
  'sd_getTransactionsByAddress',
  'eth_estimateGas',
  'eth_getProof',
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
  'eth_getUserOperationReceipt',
  'eth_getUserOperationByHash',
]

export const eip721Domain = {
  name: 'Silent Data [Rollup]',
  version: '1',
}

export const delegateEIP721Types = {
  Ticket: [
    { name: 'expires', type: 'string' },
    { name: 'ephemeralAddress', type: 'string' },
  ],
}

export const DEBUG_NAMESPACE = 'silentdata:core'
export const DEBUG_NAMESPACE_SILENTDATA_INTERCEPTOR = 'silentdata:interceptor'

export const HEADER_SIGNATURE = 'x-signature'
export const HEADER_TIMESTAMP = 'x-timestamp'
export const HEADER_SIGNATURE_TYPE = 'x-signature-type'
export const HEADER_EIP712_SIGNATURE = 'x-eip712-signature'
export const HEADER_DELEGATE = 'x-delegate'
export const HEADER_DELEGATE_SIGNATURE = 'x-delegate-signature'
export const HEADER_EIP712_DELEGATE_SIGNATURE = 'x-eip712-delegate-signature'
export const HEADER_SIGNER_SWC = 'x-signer-swc'
/**
 * Header used when signing a user operation receipt call to the bundler (eth_getUserOperationReceipt)
 */
export const HEADER_FROM_BLOCK = 'x-from-block'

/**
 * Entrypoint address used when building eth_getLogs payload for signing eth_getUserOperationReceipt calls.
 * This is hardcoded for now as we are just starting and will have support for only one version anyway.
 * We are not worrying about different versions for now.
 * In the future, if we do support other versions, this should be made a config while initializing the provider.
 */
export const ENTRYPOINT_ADDRESS = '0x34F5Bda45f2Ce00B646BD6B19D0F9817b5D8D398'

/**
 * Default number of blocks to look back when fetching user operation receipts.
 * This is used to calculate the fromBlock parameter in eth_getUserOperationReceipt requests.
 */
export const DEFAULT_USER_OPERATION_RECEIPT_LOOKUP_RANGE = 1024

/**
 * The signature for the UserOperationEvent from ERC-4337
 * This is the event emitted by the EntryPoint contract and wrapped in PrivateEvent
 */
export const USER_OPERATION_EVENT_SIGNATURE =
  'UserOperationEvent(bytes32,address,address,uint256,bool,uint256,uint256)'

/**
 * The keccak256 hash of the UserOperationEvent signature
 * Used as the eventType filter when querying for user operation receipts via eth_getLogs
 * Value: 0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f
 */
export const USER_OPERATION_EVENT_HASH = keccak256(
  toUtf8Bytes(USER_OPERATION_EVENT_SIGNATURE),
)

export const DEFAULT_DELEGATE_EXPIRES = 10 * 60 * 60 // 10 hours

/**
 * A buffer time (in seconds) added to the current time when verifying the validity of a delegate.
 * This ensures that if the current time plus the buffer exceeds the delegate's expiry date,
 * the delegate is considered expired.
 */
export const DELEGATE_EXPIRATION_THRESHOLD_BUFFER = 5 // 5 seconds

export const WHITELISTED_METHODS = [
  'sd_getTransactionsByAddress',
  'sd_getVersion',
  'eth_blockNumber',
  'eth_call',
  'eth_chainId',
  'eth_estimateGas',
  'eth_feeHistory',
  'eth_gasPrice',
  'eth_getBalance',
  'eth_getBlockByHash',
  'eth_getBlockByNumber',
  'eth_getCode',
  'eth_getFilterChanges',
  'eth_getFilterLogs',
  'eth_getHeaderByHash',
  'eth_getLogs',
  'eth_getProof',
  'eth_getTransactionByHash',
  'eth_getTransactionCount',
  'eth_getTransactionReceipt',
  'eth_maxPriorityFeePerGas',
  'eth_newBlockFilter',
  'eth_sendRawTransaction',
  'eth_syncing',
  'eth_newFilter',
  'eth_newPendingTransactionFilter',
  'net_listening',
  'net_version',
  'net_peerCount',
  'web3_clientVersion',
  'web3_sha3',
]
