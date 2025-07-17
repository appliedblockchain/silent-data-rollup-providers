import debug from 'debug'
import { Interface, LogDescription } from 'ethers'
import { DEBUG_NAMESPACE } from './constants'

const debugLog = debug(DEBUG_NAMESPACE)

/**
 * Extended LogDescription type that includes private event details
 */
export interface SDLogDescription extends LogDescription {
  /**
   * Only present for PrivateEvents - contains the decoded inner log
   * If decoding failed, this will be null
   */
  innerLog?: LogDescription | null
}

/**
 * Extends ethers Interface to provide support for decoding PrivateEvent logs
 * Make sure to include the PrivateEvent signature in your ABI when using this class
 */
export class SDInterface extends Interface {
  /**
   * Extends the parseLog method to handle PrivateEvent logs
   * @param log - The log to parse
   * @returns The parsed log description with additional private event details if applicable
   */
  parseLog(log: Parameters<Interface['parseLog']>[0]): SDLogDescription | null {
    const parsedLog = super.parseLog(log) as SDLogDescription | null

    // If parsing failed, return null (this is valid behavior)
    if (!parsedLog) {
      debugLog(
        'Failed to parse log - no matching event found or event is anonymous',
      )
      return null
    }

    // Check if this is a PrivateEvent
    if (parsedLog.name === 'PrivateEvent') {
      debugLog('Processing PrivateEvent log')
      const eventType = parsedLog.args.eventType as string
      const payload = parsedLog.args.payload as string

      debugLog(
        `PrivateEvent - eventType: ${eventType}, payload length: ${payload?.length || 0}`,
      )

      // Initialize innerLog to null for PrivateEvents
      parsedLog.innerLog = null

      try {
        // Make sure the payload is not empty
        if (!payload || payload === '0x') {
          debugLog('Empty payload for PrivateEvent, cannot decode inner log')
          return parsedLog
        }

        // Create a synthetic log object for the inner event
        // Ethers expects topic[0] to be the event signature hash
        const syntheticLog = {
          topics: [eventType] as readonly string[],
          data: payload,
        }

        debugLog(`Created synthetic log with topic: ${eventType}`)

        // Try to find the event matching this topic
        const eventFragment = this.getEvent(eventType)
        if (!eventFragment) {
          debugLog(`No matching event found for topic ${eventType}`)
          return parsedLog
        }

        debugLog(`Found matching event fragment: ${eventFragment.name}`)

        // Use ethers' built-in parseLog to decode the inner event
        try {
          const innerLogDescription = super.parseLog(syntheticLog)
          if (innerLogDescription) {
            debugLog(
              `Successfully decoded inner log: ${innerLogDescription.name}`,
            )
            parsedLog.innerLog = innerLogDescription
          } else {
            debugLog(
              'Failed to parse inner log - no matching inner event found',
            )
          }
        } catch (innerError) {
          debugLog(`Failed to parse synthetic log for inner log:`, innerError)
        }
      } catch (error) {
        debugLog(`Failed to decode private event payload:`, error)
      }
    } else {
      debugLog(`Processing regular event: ${parsedLog.name}`)
    }

    return parsedLog
  }
}
