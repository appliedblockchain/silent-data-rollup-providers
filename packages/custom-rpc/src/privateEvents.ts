import { AbiCoder, getAddress } from 'ethers'
import { PRIVATE_EVENT_SIGNATURE_HASH } from '@appliedblockchain/silentdatarollup-core'
import { LOG_METHODS, ZERO_ADDRESS } from './constants'

/**
 * Server-side PrivateEvent decoding and log filtering.
 *
 * IMPORTANT: This assumes the PrivateEvent ABI:
 *   PrivateEvent(address[] allowedViewers, bytes32 indexed eventType, bytes payload)
 * - data encodes [allowedViewers (address[]), payload (bytes)]
 * - eventType is indexed and therefore lives in topics[1]
 * If that ABI changes, this logic must change too.
 */

export interface DecodedPrivateEvent {
  allowedViewers: string[]
  eventType: string
  payload: string
}

interface RpcLog {
  topics?: string[]
  data?: string
  [key: string]: unknown
}

/**
 * Checks whether a log is a PrivateEvent by matching its first topic against
 * the PrivateEvent signature hash.
 */
export function isPrivateEvent(log: RpcLog): boolean {
  const topics = log?.topics
  if (!Array.isArray(topics) || topics.length === 0) {
    return false
  }
  const firstTopic = topics[0]
  if (typeof firstTopic !== 'string') {
    return false
  }
  return firstTopic.toLowerCase() === PRIVATE_EVENT_SIGNATURE_HASH.toLowerCase()
}

/**
 * Decodes a PrivateEvent log into its components. Throws on malformed input.
 */
export function decodePrivateEvent(log: RpcLog): DecodedPrivateEvent {
  const topics = log?.topics
  if (!Array.isArray(topics) || topics.length < 2) {
    throw new Error('invalid private event log structure')
  }

  const eventType = topics[1]
  if (typeof eventType !== 'string') {
    throw new Error('invalid event type in private event')
  }

  const data = log?.data
  if (typeof data !== 'string') {
    throw new Error('invalid data field in private event')
  }

  // Non-indexed params in declaration order: allowedViewers (address[]), payload (bytes)
  const [allowedViewers, payload] = AbiCoder.defaultAbiCoder().decode(
    ['address[]', 'bytes'],
    data,
  )

  return {
    allowedViewers: (allowedViewers as string[]).map((a) => a),
    eventType,
    payload: payload as string,
  }
}

/**
 * Returns true if `address` is a non-zero address present in `allowedViewers`.
 */
export function isAddressInAllowedViewers(
  address: string,
  allowedViewers: string[],
): boolean {
  if (!address || address.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
    return false
  }

  let normalised: string
  try {
    normalised = getAddress(address)
  } catch {
    return false
  }

  return allowedViewers.some((viewer) => {
    try {
      return getAddress(viewer) === normalised
    } catch {
      return false
    }
  })
}

/**
 * Filters logs based on authentication and private-event rules. Returns all
 * public logs and only the private logs the authenticated address may view.
 * Any private log that cannot be decoded is dropped (fail closed).
 */
export function filterPrivateLogs(
  logs: unknown[],
  authenticatedAddress: string | null,
): unknown[] {
  const filtered: unknown[] = []

  for (const entry of logs) {
    const log = entry as RpcLog
    if (!log || typeof log !== 'object') {
      // Skip invalid log entries.
      continue
    }

    if (isPrivateEvent(log)) {
      // No authenticated address -> remove all private logs.
      if (!authenticatedAddress) {
        continue
      }

      let decoded: DecodedPrivateEvent
      try {
        decoded = decodePrivateEvent(log)
      } catch {
        // Could not decode -> drop to avoid leaking.
        continue
      }

      if (
        !isAddressInAllowedViewers(authenticatedAddress, decoded.allowedViewers)
      ) {
        continue
      }
    }

    filtered.push(log)
  }

  return filtered
}

/**
 * Processes an eth_getLogs-style result to filter private events.
 * Returns `null` when the result is not an array of logs, signalling the
 * caller to return a null response (avoids leaking information).
 */
export function processGetLogsResult(
  result: unknown,
  authenticatedAddress: string | null,
): unknown[] | null {
  if (!Array.isArray(result)) {
    return null
  }
  const filtered = filterPrivateLogs(result, authenticatedAddress)
  return filtered
}

/** Whether the method returns logs and should be private-event filtered. */
export function shouldProcessLogsMethod(method: string): boolean {
  return LOG_METHODS.includes(method)
}
