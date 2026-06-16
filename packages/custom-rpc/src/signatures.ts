import {
  concat,
  getBytes,
  hashMessage,
  keccak256,
  recoverAddress,
  toUtf8Bytes,
  TypedDataEncoder,
  Wallet,
  type JsonRpcProvider,
} from 'ethers'
import {
  delegateEIP712Types,
  eip712Domain,
  getAuthEIP712Types,
  HEADER_DELEGATE,
  HEADER_DELEGATE_SIGNATURE,
  HEADER_EIP712_DELEGATE_SIGNATURE,
  HEADER_EIP712_SIGNATURE,
  HEADER_SIGNATURE,
  HEADER_SIGNATURE_TYPE,
  HEADER_SIGNER_SWC,
  HEADER_SIGNER_SWC_TYPE,
  HEADER_TIMESTAMP,
  prepareTypedDataPayload,
  SignatureType,
} from '@appliedblockchain/silentdatarollup-core'
import {
  HEADER_SIGNER_SWC_VERSION,
  HEX_ZERO,
  L2_TO_L1_MESSAGE_PASSER,
  TIMESTAMP_MAX_OFFSET,
  TIMESTAMP_MIN_OFFSET,
} from './constants'
import { verifyERC1271Signature, wrapHashForSmartWallet } from './smartWallets'

/**
 * Signature recovery and signer-based access control.
 *
 * The EIP-191 and EIP-712 hash construction here matches the client SDK
 * (`packages/core`): EIP-712 uses the nested `Call`/`JsonRPCRequest` structure
 * via `getAuthEIP712Types`, and EIP-191 signs `chainId + body + timestamp`.
 */

export interface RpcRequest {
  jsonrpc?: string
  method: string
  id?: unknown
  params: unknown[]
}

type Headers = Record<string, string | string[] | undefined>

function header(headers: Headers, name: string): string {
  const v = headers[name.toLowerCase()]
  if (Array.isArray(v)) {
    return v[0] ?? ''
  }
  return v ?? ''
}

// ---------------------------------------------------------------------------
// Hash construction (must match the client SDK signing in packages/core)
// ---------------------------------------------------------------------------

function constructRawMessage(
  chainId: bigint,
  body: string,
  timestamp: string,
): string {
  return `${chainId.toString()}${body}${timestamp}`
}

/** EIP-191 personal-message hash of `chainId + body + timestamp`. */
function constructEIP191Hash(
  chainId: bigint,
  body: string,
  timestamp: string,
): string {
  return hashMessage(constructRawMessage(chainId, body, timestamp))
}

/** Raw keccak256 of `chainId + body + timestamp` (no EIP-191 prefix). */
function constructRawHashForERC1271(
  chainId: bigint,
  body: string,
  timestamp: string,
): string {
  return keccak256(toUtf8Bytes(constructRawMessage(chainId, body, timestamp)))
}

/** EIP-712 digest over the Silent Data `Call` typed structure. */
function constructEIP712Hash(
  chainId: bigint,
  body: string,
  timestamp: string,
): string {
  const parsed = JSON.parse(body)
  const preparedPayload = Array.isArray(parsed)
    ? parsed.map(prepareTypedDataPayload)
    : prepareTypedDataPayload(parsed)
  const message = { request: preparedPayload, timestamp }
  const types = getAuthEIP712Types(parsed)
  const domain = { ...eip712Domain, chainId }
  return TypedDataEncoder.hash(domain, types, message)
}

// ---------------------------------------------------------------------------
// EOA signature recovery
// ---------------------------------------------------------------------------

function recoverSerialSigner(
  chainId: bigint,
  timestamp: string,
  signature: string,
  body: string,
): string {
  return recoverAddress(
    constructEIP191Hash(chainId, body, timestamp),
    signature,
  )
}

function recoverTypedSigner(
  chainId: bigint,
  timestamp: string,
  signature: string,
  body: string,
): string {
  return recoverAddress(
    constructEIP712Hash(chainId, body, timestamp),
    signature,
  )
}

// ---------------------------------------------------------------------------
// Timestamp + address helpers
// ---------------------------------------------------------------------------

const RFC3339_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

/** Validates RFC3339 format and the [-12min, +4min] replay window. */
export function validateRFC3339Timestamp(timestamp: string): boolean {
  if (!RFC3339_PATTERN.test(timestamp)) {
    return false
  }
  const ts = new Date(timestamp)
  if (Number.isNaN(ts.getTime())) {
    return false
  }
  const now = Date.now()
  const min = now + TIMESTAMP_MIN_OFFSET * 60 * 1000
  const max = now + TIMESTAMP_MAX_OFFSET * 60 * 1000
  return ts.getTime() >= min && ts.getTime() <= max
}

function addressesEqual(a: string, b: string): boolean {
  if (!a || !b) {
    return false
  }
  return a.toLowerCase() === b.toLowerCase()
}

function validateAddress(signer: string, validAddress: string): void {
  if (!validAddress) {
    throw new Error('no valid address')
  }
  if (!addressesEqual(signer, validAddress)) {
    throw new Error('unauthorised address recovered from x-signature')
  }
}

function validateAddressAgainstAny(signer: string, addresses: string[]): void {
  let lastErr: Error | null = null
  for (const addr of addresses) {
    try {
      validateAddress(signer, addr)
      return
    } catch (err) {
      lastErr = err as Error
    }
  }
  throw lastErr ?? new Error('unauthorised address')
}

// ---------------------------------------------------------------------------
// Delegation
// ---------------------------------------------------------------------------

interface Ticket {
  expires?: string
  ephemeralAddress?: string
}

function validateDelegateExpiry(validUntil: string | undefined): void {
  if (!validUntil) {
    throw new Error('delegate missing expiry')
  }
  const date = new Date(validUntil)
  if (Number.isNaN(date.getTime())) {
    throw new Error('invalid delegate expiry')
  }
  const now = Date.now()
  if (date.getTime() < now) {
    throw new Error('delegate expired')
  }
  if (date.getTime() > now + 12 * 60 * 60 * 1000) {
    throw new Error('delegate expiry too far into the future')
  }
}

/** EIP-191 personal-message hash of `chainId + message`. */
function eip191HashChainId(chainId: bigint, message: string): string {
  return hashMessage(`${chainId.toString()}${message}`)
}

/** EIP-712 digest of the delegation ticket. */
function hashEIP712TicketBytes(chainId: bigint, delegate: string): string {
  const ticket = JSON.parse(delegate) as Ticket
  const domain = { ...eip712Domain, chainId }
  return TypedDataEncoder.hash(domain, delegateEIP712Types, {
    expires: ticket.expires,
    ephemeralAddress: ticket.ephemeralAddress,
  })
}

async function recoverSignerWithDelegate(
  provider: JsonRpcProvider,
  chainId: bigint,
  recoveredKey: string,
  delegate: string,
  delegateSignature: string,
  hashFunc: (delegate: string) => string,
  smartWalletContract: string,
  signatureType: string,
  isEIP712Delegate: boolean,
): Promise<string> {
  const ticket = JSON.parse(delegate) as Ticket

  validateDelegateExpiry(ticket.expires)

  if (
    !ticket.ephemeralAddress ||
    !addressesEqual(ticket.ephemeralAddress, recoveredKey)
  ) {
    throw new Error('invalid ephemeral signature')
  }

  // Smart wallet: verify the delegate signature via ERC-1271.
  if (smartWalletContract) {
    let msgHash: string
    if (isEIP712Delegate) {
      msgHash = hashFunc(delegate)
    } else {
      const rawMessage = `${chainId.toString()}${delegate}`
      if (signatureType === SignatureType.Raw) {
        msgHash = keccak256(toUtf8Bytes(rawMessage))
      } else {
        // signMessage(hashBytes): hash raw message, EIP-191 prefix the 32 bytes, hash again.
        const rawHash = keccak256(toUtf8Bytes(rawMessage))
        const prefixed = concat([
          toUtf8Bytes('\x19Ethereum Signed Message:\n32'),
          getBytes(rawHash),
        ])
        msgHash = keccak256(prefixed)
      }
    }
    const ok = await verifyERC1271Signature(
      provider,
      smartWalletContract,
      msgHash,
      delegateSignature,
    )
    if (!ok) {
      throw new Error('ERC-1271 delegate signature verification failed')
    }
    return smartWalletContract
  }

  // EOA: recover the delegator from the delegate signature.
  const composedHash = hashFunc(delegate)
  return recoverAddress(composedHash, delegateSignature)
}

// ---------------------------------------------------------------------------
// ERC-1271 smart wallet auth signature
// ---------------------------------------------------------------------------

interface Erc1271SignerRequest {
  timestamp: string
  signature: string
  typedSignature: string
  signatureType: string
  signerSwcType: string
  signerSwcVersion: string
  body: string
}

async function verifyERC1271Signer(
  provider: JsonRpcProvider,
  chainId: bigint,
  contractAddress: string,
  req: Erc1271SignerRequest,
): Promise<string> {
  let baseHash: string
  let signature: string

  if (req.typedSignature && req.signature) {
    throw new Error('both EIP712 and EIP191 signatures provided')
  }

  if (req.typedSignature) {
    baseHash = constructEIP712Hash(chainId, req.body, req.timestamp)
    signature = req.typedSignature
  } else if (req.signature) {
    if (req.signatureType === SignatureType.Raw) {
      baseHash = constructRawHashForERC1271(chainId, req.body, req.timestamp)
    } else {
      baseHash = constructEIP191Hash(chainId, req.body, req.timestamp)
    }
    signature = req.signature
  } else {
    throw new Error('no signature provided')
  }

  const finalHash = wrapHashForSmartWallet(
    baseHash,
    contractAddress,
    chainId,
    req.signerSwcType,
    req.signerSwcVersion,
  )

  const ok = await verifyERC1271Signature(
    provider,
    contractAddress,
    finalHash,
    signature,
  )
  if (!ok) {
    throw new Error('ERC-1271 signature verification failed')
  }

  return contractAddress
}

// ---------------------------------------------------------------------------
// Main recovery entry point
// ---------------------------------------------------------------------------

/**
 * Recovers the effective signer from the request headers + body.
 * Returns '' when the request carries no signature at all.
 * Throws when signatures are malformed / invalid.
 */
export async function recoverSigner(
  provider: JsonRpcProvider,
  chainId: bigint,
  headers: Headers,
  body: string,
): Promise<string> {
  const xDelegationTicket = header(headers, HEADER_DELEGATE)
  const xDelegationSignature = header(headers, HEADER_DELEGATE_SIGNATURE)
  const xTypedDelegationSignature = header(
    headers,
    HEADER_EIP712_DELEGATE_SIGNATURE,
  )
  const xTimestamp = header(headers, HEADER_TIMESTAMP)
  const xSignature = header(headers, HEADER_SIGNATURE)
  const xTypedSignature = header(headers, HEADER_EIP712_SIGNATURE)
  const xSmartWalletContract = header(headers, HEADER_SIGNER_SWC)
  const xSignatureType = header(headers, HEADER_SIGNATURE_TYPE)
  const xSignerSwcType = header(headers, HEADER_SIGNER_SWC_TYPE)
  const xSignerSwcVersion = header(headers, HEADER_SIGNER_SWC_VERSION)

  if (
    !xDelegationTicket &&
    !xDelegationSignature &&
    !xTimestamp &&
    !xSignature &&
    !xTypedSignature &&
    !xSmartWalletContract
  ) {
    return ''
  }
  if (!xTimestamp) {
    throw new Error('signatures should be sent with a timestamp')
  }
  if (xSignature && xTypedSignature) {
    throw new Error('EIP712 and EIP191 signatures should not be sent together')
  }
  if (!xSignature && !xTypedSignature) {
    throw new Error('timestamp should be accompanied by signature')
  }
  if (xDelegationSignature && xTypedDelegationSignature) {
    throw new Error(
      'EIP712 and EIP191 delegation signatures should not be sent together',
    )
  }
  if (
    (xDelegationTicket === '') !==
    (xDelegationSignature === '' && xTypedDelegationSignature === '')
  ) {
    throw new Error(
      'delegation ticket should be sent with a delegation signature',
    )
  }
  if (!validateRFC3339Timestamp(xTimestamp)) {
    throw new Error('x-timestamp is outdated')
  }

  const hasDelegation =
    xDelegationTicket !== '' &&
    (xDelegationSignature !== '' || xTypedDelegationSignature !== '')

  let payloadSigner = ''

  if (xSmartWalletContract) {
    if (hasDelegation) {
      // With delegation, recover the ephemeral address like an EOA;
      // the delegate signature carries the ERC-1271 authorization.
      if (xTypedSignature) {
        payloadSigner = recoverTypedSigner(
          chainId,
          xTimestamp,
          xTypedSignature,
          body,
        )
      } else if (xSignature) {
        // Auth signature is ALWAYS EIP-191 when delegation + smart wallet.
        payloadSigner = recoverSerialSigner(
          chainId,
          xTimestamp,
          xSignature,
          body,
        )
        const ticket = JSON.parse(xDelegationTicket) as Ticket
        if (
          ticket.ephemeralAddress &&
          !addressesEqual(payloadSigner, ticket.ephemeralAddress)
        ) {
          throw new Error(
            `recovered address ${payloadSigner} doesn't match ticket ephemeral address ${ticket.ephemeralAddress}`,
          )
        }
      }
    } else {
      // No delegation: ERC-1271 verification for the smart wallet contract.
      payloadSigner = await verifyERC1271Signer(
        provider,
        chainId,
        xSmartWalletContract,
        {
          timestamp: xTimestamp,
          signature: xSignature,
          typedSignature: xTypedSignature,
          signatureType: xSignatureType,
          signerSwcType: xSignerSwcType,
          signerSwcVersion: xSignerSwcVersion,
          body,
        },
      )
    }
  } else {
    // Traditional EOA recovery.
    if (xTypedSignature) {
      payloadSigner = recoverTypedSigner(
        chainId,
        xTimestamp,
        xTypedSignature,
        body,
      )
    }
    if (xSignature) {
      payloadSigner = recoverSerialSigner(chainId, xTimestamp, xSignature, body)
    }
  }

  if (xDelegationSignature) {
    return recoverSignerWithDelegate(
      provider,
      chainId,
      payloadSigner,
      xDelegationTicket,
      xDelegationSignature,
      (d) => eip191HashChainId(chainId, d),
      xSmartWalletContract,
      xSignatureType,
      false,
    )
  }
  if (xTypedDelegationSignature) {
    return recoverSignerWithDelegate(
      provider,
      chainId,
      payloadSigner,
      xDelegationTicket,
      xTypedDelegationSignature,
      (d) => hashEIP712TicketBytes(chainId, d),
      xSmartWalletContract,
      xSignatureType,
      true,
    )
  }

  return payloadSigner
}

// ---------------------------------------------------------------------------
// Request-side validation (may mutate the request)
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function validateSignerForGetters(signer: string, request: RpcRequest): void {
  const params = request.params
  if (!params || params.length === 0) {
    throw new Error('empty params in RPC request')
  }
  if (typeof params[0] !== 'string') {
    throw new Error('bad param type in request')
  }
  validateAddress(signer, params[0])
}

function validateSignerForGettersObject(
  signer: string,
  request: RpcRequest,
): void {
  const params = request.params
  if (!params || params.length === 0) {
    throw new Error('empty params in RPC request')
  }
  if (!isPlainObject(params[0])) {
    throw new Error('bad param type in request, expected object')
  }
  const address = params[0].address
  if (typeof address !== 'string') {
    throw new Error('missing or invalid address field in params')
  }
  validateAddress(signer, address)
}

function validateAndSetFrom(
  headers: Headers,
  signer: string,
  request: RpcRequest,
): void {
  const method = request.method
  if (!request.params || request.params.length === 0) {
    throw new Error(`empty params for ${method}`)
  }
  const param0 = request.params[0]
  if (!isPlainObject(param0)) {
    throw new Error(`${method} param[0] is not a json object`)
  }
  const xSignature = header(headers, HEADER_SIGNATURE)
  const xTypedSignature = header(headers, HEADER_EIP712_SIGNATURE)
  const xSmartWalletContract = header(headers, HEADER_SIGNER_SWC)

  if (!xSignature && !xTypedSignature) {
    throw new Error(`no signature provided for ${method}`)
  }

  const from = param0.from
  if (typeof from === 'string') {
    if (xSmartWalletContract) {
      param0.from = signer
    } else {
      validateAddress(signer, from)
    }
  } else if (from === undefined || from === null) {
    if (xSmartWalletContract) {
      throw new Error(
        "'from' field must be specified for smart wallet requests",
      )
    }
    param0.from = signer
  } else {
    throw new Error(`'from' field in ${method} must be a valid address or null`)
  }
}

/**
 * Validates the signature for eth_call / eth_estimateGas and sets `from`.
 * If validation fails, `from` is replaced with a random address (privacy).
 */
function sanitiseFrom(
  headers: Headers,
  signer: string,
  request: RpcRequest,
): void {
  try {
    validateAndSetFrom(headers, signer, request)
  } catch {
    const param0 = request.params[0]
    if (!isPlainObject(param0)) {
      throw new Error('bad params')
    }
    param0.from = Wallet.createRandom().address
    request.params[0] = param0
  }
}

/**
 * Validates the signer against the request params before forwarding.
 * May mutate the request (e.g. sanitising the `from` field). Throws on
 * unauthorized access.
 */
export function validateSignerAgainstRequests(
  headers: Headers,
  signer: string,
  request: RpcRequest,
): void {
  switch (request.method) {
    case 'sd_getTransactionsByAddress':
      validateSignerForGettersObject(signer, request)
      return
    case 'eth_getProof':
      if (signer) {
        const addr = request.params[0]
        if (
          typeof addr === 'string' &&
          addressesEqual(addr, L2_TO_L1_MESSAGE_PASSER)
        ) {
          return
        }
        validateSignerForGetters(signer, request)
      }
      return
    case 'eth_call':
    case 'eth_estimateGas':
      if (request.params.length > 2) {
        throw new Error('state override is not supported')
      }
      sanitiseFrom(headers, signer, request)
      return
    default:
      return
  }
}

// ---------------------------------------------------------------------------
// Response-side validation
// ---------------------------------------------------------------------------

/**
 * Validates the signer against a geth response. Throws when the signer is not
 * authorized to see the full response (the caller then redacts).
 */
export function validateSignerAgainstResponses(
  signer: string,
  request: RpcRequest,
  result: unknown,
): void {
  if (result === null || result === undefined) {
    return
  }
  const r = result as Record<string, unknown>
  switch (request.method) {
    case 'eth_getTransactionByHash':
      validateAddressAgainstAny(signer, [
        typeof r.to === 'string' ? r.to : '',
        typeof r.from === 'string' ? r.from : '',
      ])
      return
    case 'eth_getTransactionReceipt':
      validateAddress(signer, typeof r.from === 'string' ? r.from : '')
      return
    default:
      return
  }
}

// ---------------------------------------------------------------------------
// Pre-geth handling (eth_getProof)
// ---------------------------------------------------------------------------

/**
 * Returns a pre-computed response for requests that can be answered without
 * forwarding to the backing node, or null to forward:
 * unsigned/mismatched eth_getProof (non-bridge) returns an empty proof.
 */
export function handlePreGethRequest(
  signer: string,
  request: RpcRequest,
): unknown | null {
  if (request.method !== 'eth_getProof') {
    return null
  }
  const addr = request.params[0]
  if (
    typeof addr === 'string' &&
    addressesEqual(addr, L2_TO_L1_MESSAGE_PASSER)
  ) {
    return null
  }
  try {
    validateSignerForGetters(signer, request)
    return null
  } catch {
    return {
      address: typeof addr === 'string' ? addr : '',
      accountProof: [],
      balance: HEX_ZERO,
      codeHash:
        '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
      nonce: HEX_ZERO,
      storageHash:
        '0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421',
      storageProof: [],
    }
  }
}
