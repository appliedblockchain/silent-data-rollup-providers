export const SIGN_RPC_METHODS = [
  'eth_estimateGas',
  'eth_getProof',
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
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
export const HEADER_EIP712_SIGNATURE = 'x-eip712-signature'
export const HEADER_DELEGATE = 'x-delegate'
export const HEADER_DELEGATE_SIGNATURE = 'x-delegate-signature'
export const HEADER_EIP712_DELEGATE_SIGNATURE = 'x-eip712-delegate-signature'

export const DEFAULT_DELEGATE_EXPIRES = 10 * 60 * 60 // 10 hours

/**
 * A buffer time (in seconds) added to the current time when verifying the validity of a delegate.
 * This ensures that if the current time plus the buffer exceeds the delegate's expiry date,
 * the delegate is considered expired.
 */
export const DELEGATE_EXPIRATION_THRESHOLD_BUFFER = 5 // 5 seconds

export const WHITELISTED_METHODS = [
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
  'eth_getHashrate',
  'eth_getHeaderByHash',
  'eth_getLogs',
  'eth_getProof',
  'eth_getTransactionByHash',
  'eth_getTransactionCount',
  'eth_getTransactionReceipt',
  'eth_hashrate',
  'eth_maxPriorityFeePerGas',
  'eth_mining',
  'eth_newBlockFilter',
  'eth_sendRawTransaction',
  'eth_submitTransaction',
  'eth_syncing',
  'eth_newFilter',
  'eth_newPendingTransactionFilter',
  'net_listening',
  'net_version',
  'net_peerCount',
  'web3_clientVersion',
  'web3_sha3',
  'zkevm_batchNumber',
  'zkevm_batchNumberByBlockNumber',
  'zkevm_consolidatedBlockNumber',
  'zkevm_estimateGasPrice',
  'zkevm_getBatchByNumber',
  'zkevm_getFullBlockByHash',
  'zkevm_getFullBlockByNumber',
  'zkevm_getLatestGlobalExitRoot',
  'zkevm_isBlockConsolidated',
  'zkevm_isBlockVirtualized',
  'zkevm_verifiedBatchNumber',
  'zkevm_virtualBatchNumber',
]
