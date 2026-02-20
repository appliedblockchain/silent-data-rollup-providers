import { ethers } from 'ethers'
import {
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
  HEADER_EIP712_SIGNATURE,
  HEADER_DELEGATE,
  HEADER_DELEGATE_SIGNATURE,
  HEADER_EIP712_DELEGATE_SIGNATURE,
  eip712Domain,
  delegateEIP712Types,
} from '@appliedblockchain/silentdatarollup-core'

const TIMESTAMP_MIN_OFFSET = -12
const TIMESTAMP_MAX_OFFSET = 4

/**
 * Validates that a timestamp is in RFC3339 format and within the allowed time window
 * @param timestamp The timestamp to validate
 * @returns True if the timestamp is valid, false otherwise
 */
export function validateRFC3339Timestamp(timestamp: string): boolean {
  // RFC3339 regex pattern
  const rfc3339Pattern =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

  if (!rfc3339Pattern.test(timestamp)) {
    return false
  }

  const timestampDate = new Date(timestamp)
  if (Number.isNaN(timestampDate.getTime())) {
    return false
  }

  const now = new Date()
  const minAllowedTime = new Date(
    now.getTime() + TIMESTAMP_MIN_OFFSET * 60 * 1000,
  )
  const maxAllowedTime = new Date(
    now.getTime() + TIMESTAMP_MAX_OFFSET * 60 * 1000,
  )

  return timestampDate >= minAllowedTime && timestampDate <= maxAllowedTime
}

/**
 * Recovers the signer's address from an EIP-191 signature
 * @param message The message that was signed
 * @param signature The EIP-191 signature
 * @returns The signer's Ethereum address or null if recovery failed
 */
export function recoverSerialSigner(
  message: string,
  signature: string,
  chainId: bigint,
): string | null {
  try {
    message = chainId.toString() + message
    const messageHash = ethers.hashMessage(message)
    const recoveredAddress = ethers.recoverAddress(messageHash, signature)
    return recoveredAddress
  } catch {
    return null
  }
}

/**
 * Recovers the signer's address from an EIP-712 typed signature
 * @param data The data that was signed
 * @param signature The EIP-712 signature
 * @returns The signer's Ethereum address or null if recovery failed
 */
export function recoverTypedSigner(
  data: any,
  signature: string,
  chainId: bigint,
): string | null {
  try {
    const domain = { ...eip712Domain, chainId }
    const types = {
      Request: [
        { name: 'method', type: 'string' },
        { name: 'params', type: 'string' },
        { name: 'timestamp', type: 'string' },
      ],
    }

    const recoveredAddress = ethers.verifyTypedData(
      domain,
      types,
      data,
      signature,
    )

    return recoveredAddress
  } catch {
    return null
  }
}

/**
 * Validates a delegation ticket and recovers both the delegate and delegator addresses
 * @param delegateTicket The delegation ticket
 * @param delegateSignature The signature of the delegate
 * @param message The message that was signed by the delegate
 * @param isEIP712 Whether the delegate signature is an EIP-712 signature
 * @returns An object containing the delegate and delegator addresses, or null if validation failed
 */
export function recoverSignerWithDelegate(
  delegateTicket: string,
  delegateSignature: string,
  message: string,
  isEIP712: boolean,
  chainId: bigint,
): { delegate: string; delegator: string } | null {
  try {
    // Parse the delegate ticket
    const ticket = JSON.parse(delegateTicket)

    if (!ticket.expires || !ticket.ephemeralAddress) {
      return null
    }

    // Check if the ticket has expired
    const expiryDate = new Date(ticket.expires)
    if (Number.isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
      return null
    }

    // Recover the delegate's address
    let delegateAddress: string | null
    if (isEIP712) {
      const data = {
        method: JSON.parse(message).method,
        params: JSON.stringify(JSON.parse(message).params),
        timestamp: ticket.timestamp,
      }
      delegateAddress = recoverTypedSigner(data, delegateSignature, chainId)
    } else {
      delegateAddress = recoverSerialSigner(message, delegateSignature, chainId)
    }

    if (
      !delegateAddress ||
      delegateAddress.toLowerCase() !== ticket.ephemeralAddress.toLowerCase()
    ) {
      return null
    }

    // Recover the delegator's address from the ticket signature
    const ticketData = {
      expires: ticket.expires,
      ephemeralAddress: ticket.ephemeralAddress,
    }

    const delegatorAddress = ethers.verifyTypedData(
      { ...eip712Domain, chainId },
      delegateEIP712Types,
      ticketData,
      ticket.signature,
    )

    return {
      delegate: delegateAddress,
      delegator: delegatorAddress,
    }
  } catch {
    return null
  }
}

/**
 * Main function to recover the signer's address from request headers and body
 * @param headers The HTTP headers
 * @param body The request body as a string
 * @returns The signer's Ethereum address or null if validation failed
 */
export function recoverSigner(
  headers: Record<string, string>,
  body: string,
  chainId: bigint,
): string | null {
  // Check if required headers are present
  const timestamp = headers[HEADER_TIMESTAMP]
  if (!timestamp) {
    return null
  }

  // Validate timestamp
  if (!validateRFC3339Timestamp(timestamp)) {
    return null
  }

  // Check for delegation
  const delegateTicket = headers[HEADER_DELEGATE]
  const delegateSignature = headers[HEADER_DELEGATE_SIGNATURE]
  const eip712DelegateSignature = headers[HEADER_EIP712_DELEGATE_SIGNATURE]

  // Check for regular signatures
  const signature = headers[HEADER_SIGNATURE]
  const eip712Signature = headers[HEADER_EIP712_SIGNATURE]

  // Ensure signature types aren't mixed
  if (
    (signature && eip712Signature) ||
    (delegateSignature && eip712DelegateSignature)
  ) {
    return null
  }

  // Handle delegation
  if (delegateTicket && (delegateSignature || eip712DelegateSignature)) {
    const result = recoverSignerWithDelegate(
      delegateTicket,
      delegateSignature || eip712DelegateSignature || '',
      body,
      !!eip712DelegateSignature,
      chainId,
    )

    return result ? result.delegator : null
  }

  // Handle regular signatures
  if (signature) {
    // For EIP-191 signatures, we sign the request body + timestamp
    const message = `${body}${timestamp}`
    return recoverSerialSigner(message, signature, chainId)
  }

  if (eip712Signature) {
    // For EIP-712 signatures, we create a typed data structure
    try {
      const parsedBody = JSON.parse(body)
      const data = {
        method: parsedBody.method,
        params: JSON.stringify(parsedBody.params),
        timestamp,
      }

      return recoverTypedSigner(data, eip712Signature, chainId)
    } catch {
      return null
    }
  }

  // No valid signature found
  return null
}

/**
 * Generates a random Ethereum key pair
 * @returns An object containing the private key and address
 */
export function generateRandomKeyPair(): {
  privateKey: string
  address: string
} {
  const wallet = ethers.Wallet.createRandom()
  return {
    privateKey: wallet.privateKey,
    address: wallet.address,
  }
}

/**
 * Validates that an address matches the expected signer
 * @param signer The recovered signer's address
 * @param address The address to validate
 * @returns Error if validation fails, null otherwise
 */
export function validateAddress(signer: string, address: string): Error | null {
  if (!signer || !address) {
    return new Error('Missing signer or address')
  }

  if (signer.toLowerCase() !== address.toLowerCase()) {
    return new Error(`Signer ${signer} does not match address ${address}`)
  }

  return null
}

/**
 * Validates that the signer is authorized to access the requested method and parameters
 * @param method The RPC method being called
 * @param params The parameters for the RPC method
 * @param signer The recovered signer's address
 * @param headers Optional HTTP headers for additional validation
 * @returns True if the signer is authorized, false otherwise
 */
export function validateMethodAccess(
  method: string,
  params: any[],
  signer: string | null,
  headers?: Record<string, string>,
): boolean {
  switch (method) {
    case 'eth_getProof':
      // Only validate if signer is not empty
      if (!signer) {
        return true
      }

      // Validate that the signer matches the address in the first parameter
      if (!params || !params[0]) {
        return false
      }
      return params[0].toLowerCase() === signer.toLowerCase()

    case 'eth_call':
      // For eth_call, use sanitiseEthCallFrom function
      return sanitiseEthCallFrom(params, signer ?? '', headers)

    default:
      return false
  }
}

/**
 * Sanitizes the 'from' field in eth_call parameters
 * @param params The parameters for the eth_call method
 * @param signer The recovered signer's address
 * @param headers Optional HTTP headers for additional validation
 * @returns True if validation passes, false otherwise
 */
function sanitiseEthCallFrom(
  params: any[],
  signer: string,
  headers?: Record<string, string>,
): boolean {
  // Check if params exist
  if (!params || params.length === 0) {
    return false
  }

  // Validate the signer for eth_call
  const validationError = validateSignerForEthCall(params, signer, headers)

  if (validationError) {
    // If validation fails, set a random address as 'from'
    try {
      let param0: Record<string, any>

      if (typeof params[0] === 'object' && params[0] !== null) {
        param0 = params[0]
      } else {
        return false
      }

      const { address } = generateRandomKeyPair()
      param0.from = address
      params[0] = param0

      return true
    } catch {
      return false
    }
  }

  return true
}

/**
 * Validates the signer for eth_call method
 * @param params The parameters for the eth_call method
 * @param signer The recovered signer's address
 * @param headers Optional HTTP headers for additional validation
 * @returns Error if validation fails, null otherwise
 */
function validateSignerForEthCall(
  params: any[],
  signer: string,
  headers?: Record<string, string>,
): Error | null {
  if (params.length === 0) {
    const err = new Error('empty params for eth_call')
    return err
  }

  let param0: Record<string, any>

  if (typeof params[0] === 'object' && params[0] !== null) {
    param0 = params[0]
  } else {
    const err = new Error('eth_call param[0] is not a json object')
    return err
  }

  // Check if signature is provided in headers
  const hasSignature =
    headers && (headers[HEADER_SIGNATURE] || headers[HEADER_EIP712_SIGNATURE])
  if (!hasSignature) {
    const err = new Error('no signature provided')
    return err
  }

  // Handle the 'from' field
  if (param0.from === undefined || param0.from === null) {
    // If 'from' is not specified, use the recovered signer
    param0.from = signer
    return null
  } else if (typeof param0.from === 'string') {
    // If 'from' is explicitly set, validate it matches the signer
    const validationError = validateAddress(signer, param0.from)
    if (validationError) {
      return validationError
    }
    return null
  } else {
    const err = new Error(
      "'from' field in eth_call must be a valid address or null",
    )
    return err
  }
}
