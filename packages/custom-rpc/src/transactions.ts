import {
  EMPTY_DATA,
  HEX_ZERO,
  UNAUTHENTICATED_TO_ADDRESS,
  ZERO_ADDRESS,
  ZERO_LOGS_BLOOM,
} from './constants'
import { filterPrivateLogs } from './privateEvents'

/**
 * Field-level redaction for transaction responses when the requesting signer
 * is not authorized to see the full transaction.
 *
 * The redacted response exposes only the publicly available fields, with the
 * sensitive ones zeroed; all other fields are dropped.
 */

function getField(result: unknown, key: string): unknown {
  if (result && typeof result === 'object') {
    const v = (result as Record<string, unknown>)[key]
    return v === undefined ? null : v
  }
  return null
}

/** Redacts an eth_getTransactionByHash result. */
export function redactTransactionByHash(
  result: unknown,
): Record<string, unknown> {
  return {
    blockHash: getField(result, 'blockHash'),
    blockNumber: getField(result, 'blockNumber'),
    transactionIndex: getField(result, 'transactionIndex'),
    from: ZERO_ADDRESS,
    to: UNAUTHENTICATED_TO_ADDRESS,
    hash: getField(result, 'hash'),
    gas: HEX_ZERO,
    value: HEX_ZERO,
    nonce: HEX_ZERO,
    input: EMPTY_DATA,
    gasPrice: HEX_ZERO,
    r: HEX_ZERO,
    s: HEX_ZERO,
    v: HEX_ZERO,
  }
}

/** Redacts an eth_getTransactionReceipt result (logs filtered by private events). */
export function redactTransactionReceipt(
  result: unknown,
  signer: string | null,
): Record<string, unknown> {
  const rawLogs = getField(result, 'logs')
  const logs = Array.isArray(rawLogs) ? filterPrivateLogs(rawLogs, signer) : []

  return {
    blockHash: getField(result, 'blockHash'),
    blockNumber: getField(result, 'blockNumber'),
    transactionIndex: getField(result, 'transactionIndex'),
    from: ZERO_ADDRESS,
    to: UNAUTHENTICATED_TO_ADDRESS,
    transactionHash: getField(result, 'transactionHash'),
    status: getField(result, 'status'),
    logs,
    logsBloom: ZERO_LOGS_BLOOM,
    gasUsed: HEX_ZERO,
    cumulativeGasUsed: HEX_ZERO,
  }
}
