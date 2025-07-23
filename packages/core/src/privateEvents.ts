import { keccak256, toUtf8Bytes } from 'ethers'

/**
 * The standard signature for the PrivateEvent as emitted by contracts
 */
export const PRIVATE_EVENT_SIGNATURE = 'PrivateEvent(address[],bytes32,bytes)'

/**
 * The keccak256 hash of the PrivateEvent signature
 * Used for filtering logs by event signature
 */
export const PRIVATE_EVENT_SIGNATURE_HASH = keccak256(
  toUtf8Bytes(PRIVATE_EVENT_SIGNATURE),
)

/**
 * Interface describing the shape of a PrivateEvent
 */
export interface PrivateEvent {
  allowedViewers: string[]
  eventType: string
  payload: string
}

/**
 * Calculate the keccak256 hash of an event signature
 * This is used to create the eventType parameter for PrivateEvent
 *
 * @param eventSignature - The event signature (e.g., "Transfer(address,address,uint256)")
 * @returns The keccak256 hash of the event signature
 */
export function calculateEventTypeHash(eventSignature: string): string {
  return keccak256(toUtf8Bytes(eventSignature))
}
