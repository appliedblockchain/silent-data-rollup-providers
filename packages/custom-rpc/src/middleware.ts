import { type JsonRpcProvider } from 'ethers'
import { SD_GET_TRANSACTIONS_BY_ADDRESS, SD_GET_VERSION } from './constants'
import { validateAndSanitiseEthGetLogs } from './logs'
import { processGetLogsResult, shouldProcessLogsMethod } from './privateEvents'
import {
  handlePreGethRequest,
  recoverSigner,
  validateSignerAgainstRequests,
  validateSignerAgainstResponses,
  type RpcRequest,
} from './signatures'
import {
  redactTransactionByHash,
  redactTransactionReceipt,
} from './transactions'
import { validateWhitelist } from './whitelist'

type Headers = Record<string, string | string[] | undefined>

// HTTP status codes used by the firewall.
const STATUS_OK = 200
const STATUS_BAD_REQUEST = 400
const STATUS_UNAUTHORIZED = 401
const STATUS_FORBIDDEN = 403
const STATUS_INTERNAL = 500

const STATUS_SEVERITY: Record<number, number> = {
  [STATUS_OK]: 0,
  [STATUS_UNAUTHORIZED]: 1,
  [STATUS_FORBIDDEN]: 2,
  [STATUS_BAD_REQUEST]: 4,
  [STATUS_INTERNAL]: 6,
}

function maxStatusSeverity(current: number, next: number): number {
  const c = STATUS_SEVERITY[current] ?? 6
  const n = STATUS_SEVERITY[next] ?? 6
  return n > c ? next : current
}

// ---------------------------------------------------------------------------
// JSON-RPC error codes (derived from a hash of the error message)
// ---------------------------------------------------------------------------

const UINT64_MASK = (1n << 64n) - 1n

function errorCode(message: string): number {
  let result = 6351n
  for (const ch of message) {
    result = (result * 33n + BigInt(ch.codePointAt(0) ?? 0)) & UINT64_MASK
  }
  let output = -Number(result % 100000n)
  if (output > -32768 || output < -32000) {
    output -= 10000
  }
  return output
}

interface JsonRpcError {
  code: number
  message: string
  data: string
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: unknown
  result?: unknown
  error?: JsonRpcError
}

function successResponse(id: unknown, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, result }
}

function errorResponse(
  id: unknown,
  message: string,
  data = 'Custom RPC',
): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: { code: errorCode(message), message, data },
  }
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

interface Deserialised {
  requests: RpcRequest[]
  isBatch: boolean
}

function deserialise(body: string): Deserialised {
  const parsed = JSON.parse(body)
  if (typeof parsed === 'string') {
    throw new Error('HTTP request body is a string not a JSON RPC object')
  }
  if (Array.isArray(parsed)) {
    return { requests: parsed as RpcRequest[], isBatch: true }
  }
  return { requests: [parsed as RpcRequest], isBatch: false }
}

function basicRequestPreconditions(request: RpcRequest): void {
  if (!('id' in request)) {
    throw new Error('request Id not specified')
  }
  if (request.id !== null) {
    const t = typeof request.id
    if (t !== 'string' && t !== 'number') {
      throw new Error(
        'an identifier MUST contain a String, Number, or NULL value',
      )
    }
  }
  if (typeof request.method !== 'string' || request.method === '') {
    throw new Error('no method in RPC request')
  }
  if (request.jsonrpc !== '2.0') {
    throw new Error('JSON RPC version not supported')
  }
  if (request.method.startsWith('rpc.')) {
    throw new Error('JSON RPC method not supported')
  }
}

// ---------------------------------------------------------------------------
// sd_* methods (no DB: getVersion real, getTransactionsByAddress empty)
// ---------------------------------------------------------------------------

function defaultPerPage(): number {
  const raw = process.env.CUSTOM_RPC_PER_PAGE
  if (raw) {
    const n = Number(raw)
    if (Number.isInteger(n) && n > 0) {
      return n
    }
  }
  return 10
}

interface SdResult {
  response: JsonRpcResponse
  status: number
}

function handleSdMethods(request: RpcRequest): SdResult | null {
  switch (request.method) {
    case SD_GET_TRANSACTIONS_BY_ADDRESS: {
      if (!request.params || request.params.length === 0) {
        return {
          response: errorResponse(
            request.id,
            'missing parameters',
            `Custom RPC: ${request.method}`,
          ),
          status: STATUS_BAD_REQUEST,
        }
      }
      const params0 = request.params[0]
      if (!params0 || typeof params0 !== 'object' || Array.isArray(params0)) {
        return {
          response: errorResponse(
            request.id,
            'invalid params structure',
            `Custom RPC: ${request.method}`,
          ),
          status: STATUS_BAD_REQUEST,
        }
      }
      const paramsMap = params0 as Record<string, unknown>
      if (typeof paramsMap.address !== 'string') {
        return {
          response: errorResponse(
            request.id,
            'invalid address parameter',
            `Custom RPC: ${request.method}`,
          ),
          status: STATUS_BAD_REQUEST,
        }
      }
      const page = typeof paramsMap.page === 'number' ? paramsMap.page : 1
      // NOTE: DB is intentionally not wired up in the TS package; return an
      // empty paginated result. perPage is accepted for response-shape compatibility.
      void (typeof paramsMap.perPage === 'number'
        ? paramsMap.perPage
        : defaultPerPage())
      return {
        response: successResponse(request.id, {
          items: [],
          pageNumber: page,
          totalPages: 0,
          totalItems: 0,
        }),
        status: STATUS_OK,
      }
    }
    case SD_GET_VERSION: {
      return {
        response: successResponse(request.id, { commit: 'unknown' }),
        status: STATUS_OK,
      }
    }
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Per-request precheck
// ---------------------------------------------------------------------------

interface PrecheckError {
  response: JsonRpcResponse
  status: number
}

async function singleRequestPrecheck(
  provider: JsonRpcProvider,
  headers: Headers,
  request: RpcRequest,
  signer: string,
): Promise<PrecheckError | null> {
  try {
    basicRequestPreconditions(request)
  } catch (err) {
    return {
      response: errorResponse(request.id, (err as Error).message),
      status: STATUS_BAD_REQUEST,
    }
  }

  try {
    validateWhitelist(request.method, request.params ?? [])
  } catch (err) {
    return {
      response: errorResponse(
        request.id,
        (err as Error).message,
        `Custom RPC: ${request.method}`,
      ),
      status: STATUS_FORBIDDEN,
    }
  }

  try {
    await validateAndSanitiseEthGetLogs(
      provider,
      request.method,
      request.params ?? [],
    )
  } catch (err) {
    return {
      response: errorResponse(request.id, (err as Error).message),
      status: STATUS_BAD_REQUEST,
    }
  }

  try {
    validateSignerAgainstRequests(headers, signer, request)
  } catch (err) {
    return {
      response: errorResponse(request.id, (err as Error).message),
      status: STATUS_UNAUTHORIZED,
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Dispatch to the backing node
// ---------------------------------------------------------------------------

async function callGeth(
  proxyUrl: string,
  payload: RpcRequest | RpcRequest[],
): Promise<unknown> {
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export interface HandlerResult {
  status: number
  body: JsonRpcResponse | JsonRpcResponse[]
}

export async function handleRpcRequest(
  provider: JsonRpcProvider,
  chainId: bigint,
  proxyUrl: string,
  headers: Headers,
  bodyString: string,
): Promise<HandlerResult> {
  if (!bodyString) {
    return {
      status: STATUS_BAD_REQUEST,
      body: errorResponse(null, 'no request body'),
    }
  }

  let parsed: Deserialised
  try {
    parsed = deserialise(bodyString)
  } catch (err) {
    return {
      status: STATUS_BAD_REQUEST,
      body: errorResponse(null, (err as Error).message),
    }
  }
  const { requests, isBatch } = parsed

  let signer: string
  try {
    signer = await recoverSigner(provider, chainId, headers, bodyString)
  } catch {
    return {
      status: STATUS_UNAUTHORIZED,
      body: errorResponse(
        null,
        'Can not recover signer from signature. Please ensure your signature is valid.',
      ),
    }
  }

  let httpStatus = STATUS_OK
  const responses: Array<JsonRpcResponse | null> = new Array(
    requests.length,
  ).fill(null)
  const indexedGethRequests = new Map<number, RpcRequest>()

  // Prepare each request.
  for (let idx = 0; idx < requests.length; idx++) {
    const request = requests[idx]

    const precheckErr = await singleRequestPrecheck(
      provider,
      headers,
      request,
      signer,
    )
    if (precheckErr) {
      httpStatus = maxStatusSeverity(httpStatus, precheckErr.status)
      responses[idx] = precheckErr.response
      continue
    }

    const sd = handleSdMethods(request)
    if (sd) {
      httpStatus = maxStatusSeverity(httpStatus, sd.status)
      responses[idx] = sd.response
      continue
    }

    const preGeth = handlePreGethRequest(signer, request)
    if (preGeth !== null) {
      responses[idx] = successResponse(request.id, preGeth)
      continue
    }

    indexedGethRequests.set(idx, request)
  }

  // Dispatch the remaining requests to the backing node.
  if (indexedGethRequests.size > 0) {
    const keys = [...indexedGethRequests.keys()]
    const reqs = keys.map((k) => indexedGethRequests.get(k) as RpcRequest)
    let gethResponses: unknown[]
    try {
      const raw = await callGeth(proxyUrl, isBatch ? reqs : reqs[0])
      gethResponses = isBatch ? (raw as unknown[]) : [raw]
    } catch {
      httpStatus = maxStatusSeverity(httpStatus, STATUS_INTERNAL)
      for (const k of keys) {
        responses[k] = errorResponse(
          requests[k].id,
          'failed to reach the backing RPC node',
        )
      }
      gethResponses = []
    }

    keys.forEach((idx, i) => {
      if (responses[idx] !== null) {
        return
      }
      const request = requests[idx]
      const gethResponse = gethResponses[i] as
        | Record<string, unknown>
        | undefined

      if (!gethResponse || typeof gethResponse !== 'object') {
        responses[idx] = successResponse(request.id, null)
        return
      }

      if ('error' in gethResponse && gethResponse.error) {
        responses[idx] = {
          jsonrpc: '2.0',
          id: request.id ?? null,
          error: gethResponse.error as JsonRpcError,
        }
        return
      }

      const result = gethResponse.result
      if (result === null || result === undefined) {
        responses[idx] = successResponse(request.id, null)
        return
      }

      // Response-side signer validation -> redact when unauthorized.
      try {
        validateSignerAgainstResponses(signer, request, result)
      } catch {
        if (request.method === 'eth_getTransactionReceipt') {
          responses[idx] = successResponse(
            request.id,
            redactTransactionReceipt(result, signer),
          )
        } else if (request.method === 'eth_getTransactionByHash') {
          responses[idx] = successResponse(
            request.id,
            redactTransactionByHash(result),
          )
        } else {
          responses[idx] = successResponse(request.id, null)
        }
        return
      }

      // Private-event filtering for log methods.
      if (shouldProcessLogsMethod(request.method)) {
        const filtered = processGetLogsResult(result, signer || null)
        responses[idx] = successResponse(
          request.id,
          filtered === null ? null : filtered,
        )
        return
      }

      responses[idx] = successResponse(request.id, result)
    })
  }

  const finalResponses = responses.map(
    (r, i) => r ?? successResponse(requests[i].id, null),
  )

  return {
    status: httpStatus,
    body: isBatch ? finalResponses : finalResponses[0],
  }
}
