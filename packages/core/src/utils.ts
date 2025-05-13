import debug from 'debug'
import { Contract, JsonRpcPayload, Signer, Wallet } from 'ethers'
import {
  DEBUG_NAMESPACE,
  delegateEIP721Types,
  eip721Domain,
  HEADER_EIP712_SIGNATURE,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
} from './constants'
import {
  AuthHeaders,
  AuthSignatureMessageRequest,
  DelegateSignerMessage,
  SignatureType,
} from './types'

const log = debug(DEBUG_NAMESPACE)

export function getAuthEIP721Types(payload: JsonRpcPayload | JsonRpcPayload[]) {
  return {
    Call: [
      {
        name: 'request',
        type: Array.isArray(payload) ? 'JsonRPCRequest[]' : 'JsonRPCRequest',
      },
      { name: 'timestamp', type: 'string' },
    ],
    JsonRPCRequest: [
      { name: 'jsonrpc', type: 'string' },
      { name: 'method', type: 'string' },
      { name: 'params', type: 'string' },
      { name: 'id', type: 'uint256' },
    ],
  }
}

export async function signAuthHeaderTypedData(
  signer: any,
  payload: JsonRpcPayload | JsonRpcPayload[],
  timestamp: string,
): Promise<string> {
  log('Preparing payload for signTypedData')
  const preparePayload = (p: JsonRpcPayload) => ({
    ...p,
    params: JSON.stringify(p.params),
  })

  const preparedPayload = Array.isArray(payload)
    ? payload.map(preparePayload)
    : preparePayload(payload)

  const message = {
    request: preparedPayload,
    timestamp,
  }

  const types = getAuthEIP721Types(payload)

  log(
    'Signing typed data',
    JSON.stringify({ eip721Domain, types, message }, null, 2),
  )
  const signature = await signer.signTypedData(eip721Domain, types, message)

  log('Signature generated:', signature)
  return signature
}

export async function signAuthHeaderRawMessage(
  signer: any,
  payload: JsonRpcPayload | JsonRpcPayload[],
  timestamp: string,
): Promise<string> {
  log('Preparing raw message for signing')
  const serialRequest = JSON.stringify(payload)
  const xMessage = serialRequest + timestamp
  log('Raw message:', xMessage)
  const signature = await signer.signMessage(xMessage)
  log('Raw signature generated:', signature)
  return signature
}

export async function signTypedDelegateHeader(
  signer: any,
  message: DelegateSignerMessage,
) {
  log('Signing typed delegate header')

  const signature = await signer.signTypedData(
    eip721Domain,
    delegateEIP721Types,
    message,
  )

  log('Signature generated:', signature)
  return signature
}

export async function signRawDelegateHeader(
  signer: any,
  message: DelegateSignerMessage,
): Promise<string> {
  log('Signing raw delegate header')
  log('Raw message:', message)

  const signature = await signer.signMessage(JSON.stringify(message))

  log('Raw signature generated:', signature)
  return signature
}

export async function getAuthHeaders(
  signer: Signer,
  payload: JsonRpcPayload | JsonRpcPayload[],
  signatureType: SignatureType,
): Promise<AuthHeaders> {
  const xTimestamp = new Date().toISOString()
  const headers: AuthHeaders = {
    [HEADER_TIMESTAMP]: xTimestamp,
  }

  switch (signatureType) {
    case SignatureType.Raw:
      log('Generating raw signature')
      headers[HEADER_SIGNATURE] = await signAuthHeaderRawMessage(
        signer,
        payload,
        xTimestamp,
      )
      break
    case SignatureType.EIP712:
      log('Generating EIP712 signature')
      headers[HEADER_EIP712_SIGNATURE] = await signAuthHeaderTypedData(
        signer,
        payload,
        xTimestamp,
      )
      break
    default:
      throw new Error(`Unsupported signature type: ${signatureType}`)
  }

  return headers
}

/**
 * Determines if a given JSON-RPC payload represents a call to a contract method that requires signing.
 *
 * This function is crucial for identifying "private" read calls on smart contracts - methods that
 * require authenticated `msg.sender`. It helps ensure proper authentication for accessing
 * sensitive data or functionality on the contract side.
 *
 * The function performs the following checks:
 * 1. Verifies if the payload is an `eth_call`.
 * 2. Extracts the method signature from the call data.
 * 3. Compares the signature against a provided list of methods requiring signing.
 * 4. Uses the contract's ABI to match the method signature with known methods.
 *
 * By accurately identifying these calls, we can add appropriate authentication headers
 * to the request, enabling the smart contract to verify the caller's identity.
 *
 * @param payload - The JSON-RPC payload to analyze.
 * @param contractMethodsToSign - An array of method names that require signing.
 * @param contract - The contract instance containing the ABI information.
 * @returns {boolean} True if the call is to a method that requires signing, false otherwise.
 * @throws {Error} If contractMethodsToSign or contract is not provided.
 */
export function isSignableContractCall(
  payload: JsonRpcPayload,
  contractMethodsToSign?: string[],
  contract?: Contract | null,
): boolean {
  // Return false if contractMethodsToSign or contract is not provided
  if (!contractMethodsToSign || !contract) {
    return false
  }
  log('Checking if contract call is signable')
  log('Contract methods to sign:', contractMethodsToSign)

  if (payload.method !== 'eth_call') {
    log('Payload method is not eth_call, returning false')
    return false
  }

  const params = payload.params as any[]
  if (!params || params.length === 0 || typeof params[0] !== 'object') {
    log('Invalid params, returning false')
    return false
  }

  const methodSignature = params[0].data.slice(2, 10)
  log('Method signature:', methodSignature)

  const isSignable = contractMethodsToSign.some((methodName) => {
    const fragment = contract.interface.getFunction(methodName)
    return !!fragment && methodSignature.startsWith(fragment.selector.slice(2))
  })

  log('Is signable contract call:', isSignable)
  return isSignable
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const defaultGetDelegate = async (provider: any): Promise<Signer> => {
  return Wallet.createRandom()
}

export const prepareTypedDataPayload = (
  p: JsonRpcPayload,
): AuthSignatureMessageRequest => ({
  ...p,
  params: JSON.stringify(p.params),
})
