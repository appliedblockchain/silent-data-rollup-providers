/**
 * Per-method JSON-RPC parameter validation.
 *
 * Defines the param validators, the per-method whitelist map, and the
 * method/param whitelist enforcement.
 *
 * Each `Validator` throws an `Error` on invalid input. `validateWhitelist`
 * throws when the method is not whitelisted or its params are invalid.
 */

type Validator = (v: unknown) => void
type ArrayValidator = (params: unknown[]) => void

interface FieldSpec {
  v: Validator
  required: boolean
}

export const WHITELIST_BLOCK_TAGS = new Set([
  'earliest',
  'latest',
  'pending',
  'safe',
  'finalized',
])

const reByte = /^0x([0-9a-fA-F]?){1,2}$/
const reData = /^0x([0-9a-fA-F]{2})*$/
const reAddress = /^0x[0-9a-fA-F]{40}$/
const reHash32 = /^0x[0-9a-fA-F]{64}$/
const reHexDigits = /^[0-9a-fA-F]+$/

function asString(v: unknown): string {
  if (typeof v !== 'string') {
    throw new Error('must be a string')
  }
  return v
}

const anAddress: Validator = (v) => {
  const s = asString(v)
  if (!reAddress.test(s)) {
    throw new Error(`invalid address "${s}" (expected 0x + 40 hex chars)`)
  }
}

const anHash: Validator = (v) => {
  const s = asString(v)
  if (!reHash32.test(s)) {
    throw new Error(`invalid 32-byte hash "${s}" (expected 0x + 64 hex chars)`)
  }
}

// some even-length hex string
const someData: Validator = (v) => {
  const s = asString(v)
  if (!reData.test(s)) {
    throw new Error(
      `invalid data "${s}" (expected 0x + even number of hex chars)`,
    )
  }
}

const byteValue: Validator = (v) => {
  const s = asString(v)
  if (!reByte.test(s)) {
    throw new Error(`invalid data "${s}" (expected 0x + one or two hex chars)`)
  }
}

// no leading zeros except 0x0
const aHexQuantity: Validator = (v) => {
  const s = asString(v)
  if (!s.startsWith('0x') && !s.startsWith('0X')) {
    throw new Error(`hex quantity must start with 0x, got "${s}"`)
  }
  const body = s.slice(2)
  if (body === '') {
    throw new Error(`hex quantity missing digits, got "${s}"`)
  }
  if (!reHexDigits.test(body)) {
    throw new Error(`hex quantity has non-hex digits: "${s}"`)
  }
  if (body.toLowerCase() === '0') {
    return
  }
  if (body.length > 1 && body[0] === '0') {
    throw new Error(`hex quantity has leading zeros: "${s}"`)
  }
}

const aBoolean: Validator = (v) => {
  if (typeof v !== 'boolean') {
    throw new Error('must be a boolean')
  }
}

const aBlockTag: Validator = (v) => {
  const s = asString(v)
  if (!WHITELIST_BLOCK_TAGS.has(s.toLowerCase())) {
    throw new Error(
      `invalid block tag "${s}" (expected one of earliest/latest/pending/safe/finalized)`,
    )
  }
}

const aRewardPercentiles: Validator = (v) => {
  if (!Array.isArray(v)) {
    throw new Error('rewardPercentiles must be an array of numbers')
  }
  v.forEach((x, i) => {
    if (typeof x !== 'number' || x < 0 || x > 100) {
      throw new Error(`rewardPercentiles[${i}] out of range [0,100]`)
    }
  })
}

const aPage: Validator = (v) => {
  if (typeof v !== 'number' || v < 1) {
    throw new Error('page must be greater than 0')
  }
}

const aPerPage: Validator = (v) => {
  if (typeof v !== 'number' || v < 1 || v > 100) {
    throw new Error('perPage must be between 1 and 100')
  }
}

function optionally(check: Validator): Validator {
  return (v) => {
    if (v === null || v === undefined) {
      return
    }
    check(v)
  }
}

function homogeneousArrayOfMaxLen(
  check: Validator,
  allowEmpty: boolean,
  maxLen: number,
): Validator {
  return (v) => {
    if (!Array.isArray(v)) {
      throw new Error('expected array')
    }
    if (maxLen >= 0 && v.length > maxLen) {
      throw new Error(`array length ${v.length} exceeds max ${maxLen}`)
    }
    if (v.length === 0 && !allowEmpty) {
      throw new Error('expected non-empty array')
    }
    v.forEach((hv, i) => {
      try {
        check(hv)
      } catch (err) {
        throw new Error(`array[${i}]: ${(err as Error).message}`)
      }
    })
  }
}

function homogeneousArrayOf(check: Validator): Validator {
  return homogeneousArrayOfMaxLen(check, true, -1)
}

function homogeneousNonEmptyArrayOf(check: Validator): Validator {
  return homogeneousArrayOfMaxLen(check, false, -1)
}

function oneOf(label: string, ...checks: Validator[]): Validator {
  return (v) => {
    const errs: string[] = []
    for (const c of checks) {
      try {
        c(v)
        return
      } catch (err) {
        errs.push((err as Error).message)
      }
    }
    throw new Error(`invalid ${label}: ${errs.join('; ')}`)
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Validates an object against a spec map, lower-casing incoming keys. */
function mapAgainst(specs: Record<string, FieldSpec>): Validator {
  return (v) => {
    if (!isPlainObject(v)) {
      throw new Error('expected map')
    }
    const m: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v)) {
      const lc = k.toLowerCase()
      if (lc in m) {
        throw new Error(`duplicate keys differing only by case: "${k}"`)
      }
      m[lc] = val
    }
    for (const key of Object.keys(m)) {
      if (!(key in specs)) {
        throw new Error(`unknown field "${key}"`)
      }
    }
    for (const [key, check] of Object.entries(specs)) {
      if (!(key in m)) {
        if (check.required) {
          throw new Error(`${key} required and not present`)
        }
        continue
      }
      try {
        check.v(m[key])
      } catch (err) {
        throw new Error(`${key}: ${(err as Error).message}`)
      }
    }
  }
}

/** Validates an object against a spec map, preserving key case. */
function mapAgainstCaseSensitive(specs: Record<string, FieldSpec>): Validator {
  return (v) => {
    if (!isPlainObject(v)) {
      throw new Error('expected map')
    }
    for (const key of Object.keys(v)) {
      if (!(key in specs)) {
        throw new Error(`unknown field "${key}"`)
      }
    }
    for (const [key, check] of Object.entries(specs)) {
      if (!(key in v)) {
        if (check.required) {
          throw new Error(`${key} required and not present`)
        }
        continue
      }
      try {
        check.v(v[key])
      } catch (err) {
        throw new Error(`${key}: ${(err as Error).message}`)
      }
    }
  }
}

const accessListEntry: Record<string, FieldSpec> = {
  address: { v: anAddress, required: true },
  storagekeys: { v: homogeneousArrayOf(anHash), required: true },
}

const txFieldValidators: Record<string, FieldSpec> = {
  from: { v: optionally(anAddress), required: false },
  to: { v: optionally(anAddress), required: false },
  gas: { v: aHexQuantity, required: false },
  value: { v: aHexQuantity, required: false },
  nonce: { v: aHexQuantity, required: false },
  gasprice: { v: aHexQuantity, required: false },
  maxfeepergas: { v: aHexQuantity, required: false },
  maxpriorityfeepergas: { v: aHexQuantity, required: false },
  data: { v: someData, required: false },
  input: { v: someData, required: false },
  accesslist: {
    v: homogeneousArrayOf(mapAgainst(accessListEntry)),
    required: false,
  }, // EIP-2930
  chainid: { v: aHexQuantity, required: false },
  type: { v: byteValue, required: false },
  maxfeeperblobgas: { v: aHexQuantity, required: false }, // EIP-4844
  blobversionedhashes: {
    v: homogeneousNonEmptyArrayOf(anHash),
    required: false,
  },
}

const eip1898bn: Record<string, FieldSpec> = {
  blocknumber: { v: aHexQuantity, required: true },
}

const eip1898bh: Record<string, FieldSpec> = {
  blockhash: { v: anHash, required: true },
  requirecanonical: { v: aBoolean, required: true },
}

const aBlockSpecifier: Validator = oneOf(
  'block specifier',
  aBlockTag,
  aHexQuantity,
  mapAgainst(eip1898bn),
  mapAgainst(eip1898bh),
)

const someTopics = homogeneousArrayOfMaxLen(
  oneOf('topic', optionally(anHash), homogeneousNonEmptyArrayOf(anHash)),
  false,
  4,
)

const filterFieldValidators: Record<string, FieldSpec> = {
  blockhash: { v: anHash, required: false },
  fromblock: { v: aBlockSpecifier, required: false },
  toblock: { v: aBlockSpecifier, required: false },
  address: {
    v: oneOf(
      'address or address[]',
      anAddress,
      homogeneousNonEmptyArrayOf(anAddress),
    ),
    required: false,
  },
  topics: { v: someTopics, required: false },
}

const transactionsByAddressParams: Record<string, FieldSpec> = {
  address: { v: anAddress, required: true },
  page: { v: aPage, required: false },
  perPage: { v: aPerPage, required: false },
}

const aTxObject = mapAgainst(txFieldValidators)
const aFilterObject = mapAgainst(filterFieldValidators)
const aStorageKeysArray = homogeneousNonEmptyArrayOf(anHash)
const aTransactionsByAddressParams = mapAgainstCaseSensitive(
  transactionsByAddressParams,
)

function expectInternal(
  minParams: number,
  clue: string,
  ...checks: Array<Validator | null>
): ArrayValidator {
  return (params) => {
    const max = checks.length
    const n = params.length
    if (n < minParams || n > max) {
      if (clue !== '') {
        throw new Error(
          `expected ${minParams}-${max} params, got ${n} (${clue})`,
        )
      }
      if (minParams === max) {
        throw new Error(`expected ${minParams} params, got ${n}`)
      }
      throw new Error(`expected ${minParams}-${max} params, got ${n}`)
    }
    for (let i = 0; i < n; i++) {
      const check = checks[i]
      if (!check) {
        continue
      }
      try {
        check(params[i])
      } catch (err) {
        throw new Error(`param[${i}]: ${(err as Error).message}`)
      }
    }
  }
}

function ParamsAre(...specification: Array<Validator | null>): ArrayValidator {
  return expectInternal(specification.length, '', ...specification)
}

function AtLeastParamsAre(
  min: number,
  clue: string,
  ...specification: Array<Validator | null>
): ArrayValidator {
  return expectInternal(min, clue, ...specification)
}

const noParams = expectInternal(0, '')

/** Read-only methods and their param validators. */
const readWhitelistMethods: Record<string, ArrayValidator> = {
  sd_getTransactionsByAddress: ParamsAre(aTransactionsByAddressParams),
  sd_getVersion: noParams,
  eth_blockNumber: noParams,
  eth_call: AtLeastParamsAre(
    1,
    'txObject, [blockSpecifier]',
    aTxObject,
    aBlockSpecifier,
  ),
  eth_chainId: noParams,
  eth_estimateGas: AtLeastParamsAre(
    1,
    'txObject, [blockSpecifier]',
    aTxObject,
    aBlockSpecifier,
  ),
  eth_feeHistory: AtLeastParamsAre(
    2,
    'blockCount, newestBlock, [rewardPercentiles]',
    aHexQuantity,
    aBlockSpecifier,
    aRewardPercentiles,
  ),
  eth_gasPrice: noParams,
  eth_getBalance: ParamsAre(anAddress, aBlockSpecifier),
  eth_getBlockByHash: ParamsAre(anHash, aBoolean),
  eth_getBlockByNumber: ParamsAre(aBlockSpecifier, aBoolean),
  eth_getCode: ParamsAre(anAddress, aBlockSpecifier),
  eth_getFilterChanges: ParamsAre(aHexQuantity),
  eth_getFilterLogs: ParamsAre(aHexQuantity),
  eth_getHeaderByHash: ParamsAre(anHash),
  eth_getLogs: ParamsAre(aFilterObject),
  eth_getProof: ParamsAre(anAddress, aStorageKeysArray, aBlockSpecifier),
  eth_getTransactionByHash: ParamsAre(anHash),
  eth_getTransactionCount: ParamsAre(anAddress, aBlockSpecifier),
  eth_getTransactionReceipt: ParamsAre(anHash),
  eth_maxPriorityFeePerGas: noParams,
  eth_newBlockFilter: noParams,
  eth_syncing: noParams,
  eth_newFilter: ParamsAre(aFilterObject),
  eth_newPendingTransactionFilter: noParams,
  net_listening: noParams,
  net_version: noParams,
  net_peerCount: noParams,
  web3_clientVersion: noParams,
  web3_sha3: ParamsAre(someData),
}

/**
 * Full whitelist = read methods + write methods.
 * This single whitelist applies to everyone (no token-gated read-only
 * fallback); write methods are allowed without a token.
 */
const whitelistMethods: Record<string, ArrayValidator> = {
  ...readWhitelistMethods,
  eth_sendRawTransaction: ParamsAre(someData),
}

/**
 * Dev/test escape hatch: comma-separated method-name prefixes that bypass the
 * whitelist (e.g. `hardhat,anvil`). Lets local Hardhat/Anvil tooling reach the
 * backing node through the gateway. Unset (the default) means no bypass, so the
 * production privacy posture is unchanged. Do NOT set in production.
 */
const bypassPrefixes: string[] = (
  process.env.CUSTOM_RPC_BYPASS_METHOD_PREFIXES ?? ''
)
  .split(',')
  .map((p) => p.trim())
  .filter((p) => p.length > 0)

export function isBypassedMethod(method: string): boolean {
  return bypassPrefixes.some((p) => method.startsWith(p))
}

/**
 * Enforces the method whitelist + per-method param validation.
 * Also rejects full-block-detail requests (the boolean param of
 * eth_getBlockBy* must be `false`) to avoid leaking transaction details.
 * Throws an Error on any violation.
 */
export function validateWhitelist(method: string, params: unknown[]): void {
  if (isBypassedMethod(method)) {
    return
  }

  if (method === 'eth_getBlockByNumber' || method === 'eth_getBlockByHash') {
    if (params.length < 2 || params[1] !== false) {
      throw new Error('param values not whitelisted for JSON RPC method')
    }
  }

  const paramsWhitelist = whitelistMethods[method]
  if (!paramsWhitelist) {
    throw new Error('JSON RPC method not whitelisted')
  }

  paramsWhitelist(params)
}
