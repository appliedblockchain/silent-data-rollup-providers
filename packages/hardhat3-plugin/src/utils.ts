import {
  getAuthHeaders,
  HEADER_EIP712_SIGNATURE,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
  SignatureType,
} from '@appliedblockchain/silentdatarollup-core'
import debug from 'debug'
import { type JsonRpcPayload, Signer } from 'ethers'
import { DEBUG_NAMESPACE } from './constants'

const log = debug(DEBUG_NAMESPACE)

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  method: string
  params: unknown[]
  id: number | string
}

/**
 * Makes an authenticated JSON-RPC request.
 * In Hardhat 3, we can't inject headers into the provider's HTTP transport,
 * so we make the HTTP request ourselves (similar pattern to hardhat-plugin's cloneWrappedProvider).
 */
export async function makeAuthenticatedRequest(
  rpcUrl: string,
  request: JsonRpcRequest,
  signer: Signer,
  chainId: string,
  signatureType: SignatureType,
): Promise<unknown> {
  const authHeaders = await getAuthHeaders(
    signer,
    request as unknown as JsonRpcPayload,
    chainId,
    signatureType,
  )

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    [HEADER_TIMESTAMP]: authHeaders[HEADER_TIMESTAMP],
  }

  if (authHeaders[HEADER_SIGNATURE]) {
    headers[HEADER_SIGNATURE] = authHeaders[HEADER_SIGNATURE]
  }
  if (authHeaders[HEADER_EIP712_SIGNATURE]) {
    headers[HEADER_EIP712_SIGNATURE] = authHeaders[HEADER_EIP712_SIGNATURE]
  }

  log('Making authenticated request to chain %s', chainId)

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const responseText = await response.text()
    log(
      `Request failed with status ${response.status} and response:`,
      responseText,
    )
    throw new Error(`HTTP error ${response.status}: ${responseText}`)
  }

  const jsonResponse = (await response.json()) as {
    jsonrpc: '2.0'
    id: number | string
    result?: unknown
    error?: { code: number; message: string; data?: unknown }
  }

  if (jsonResponse.error) {
    const error = new Error(jsonResponse.error.message) as Error & {
      code?: number
      data?: unknown
    }
    error.code = jsonResponse.error.code
    error.data = jsonResponse.error.data
    throw error
  }

  return jsonResponse.result
}
