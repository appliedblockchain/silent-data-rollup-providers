import { type JsonRpcProvider } from 'ethers'
import { DEFAULT_LOGS_LIMIT_RANGE } from './constants'
import { WHITELIST_BLOCK_TAGS } from './whitelist'

/**
 * eth_getLogs block-range validation and sanitisation.
 */

/** Max block range allowed for a single eth_getLogs request (env-overridable). */
export function getLogsLimitRange(): bigint {
  const raw = process.env.CUSTOM_RPC_LOGS_LIMIT_RANGE
  if (raw) {
    try {
      const parsed = BigInt(raw)
      if (parsed > 0n) {
        return parsed
      }
    } catch {
      // fall through to default
    }
  }
  return BigInt(DEFAULT_LOGS_LIMIT_RANGE)
}

async function getBlockNumberByTag(
  provider: JsonRpcProvider,
  tag: string,
): Promise<bigint> {
  if (!WHITELIST_BLOCK_TAGS.has(tag)) {
    throw new Error(`block tag ${tag} is not whitelisted`)
  }
  const block = await provider.send('eth_getBlockByNumber', [tag, false])
  if (!block || typeof block.number !== 'string') {
    throw new Error('block number not found in response')
  }
  return BigInt(block.number)
}

function parseHexBlock(s: string): bigint {
  if (!s.startsWith('0x')) {
    throw new Error('hex prefix 0x not found')
  }
  return BigInt(s)
}

/** Extracts a block string from a raw specifier (string or EIP-1898 object). */
function parseBlockSpecifier(blockRaw: unknown): string {
  if (typeof blockRaw === 'string') {
    return blockRaw
  }
  if (
    blockRaw &&
    typeof blockRaw === 'object' &&
    typeof (blockRaw as Record<string, unknown>).blockNumber === 'string'
  ) {
    return (blockRaw as Record<string, string>).blockNumber
  }
  throw new Error('unsupported block specifier')
}

function getFilter(params: unknown[]): Record<string, unknown> {
  if (params.length === 0) {
    throw new Error('invalid filter params')
  }
  const filter = params[0]
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
    throw new Error('invalid filter params')
  }
  return filter as Record<string, unknown>
}

async function resolveBlock(
  provider: JsonRpcProvider,
  raw: unknown,
  label: string,
): Promise<bigint> {
  const str = parseBlockSpecifier(raw)
  if (WHITELIST_BLOCK_TAGS.has(str)) {
    try {
      return await getBlockNumberByTag(provider, str)
    } catch {
      throw new Error(`failed to get block number for tag '${str}'`)
    }
  }
  try {
    return parseHexBlock(str)
  } catch {
    throw new Error(`invalid ${label} param`)
  }
}

export async function validateEthGetLogs(
  provider: JsonRpcProvider,
  params: unknown[],
): Promise<void> {
  const filter = getFilter(params)

  const fromBlockOk = 'fromBlock' in filter
  const toBlockOk = 'toBlock' in filter

  // If neither is set, let sanitiseEthGetLogs handle defaults.
  if (!fromBlockOk && !toBlockOk) {
    return
  }

  const fromBlockNum = fromBlockOk
    ? await resolveBlock(provider, filter.fromBlock, 'fromBlock')
    : await getBlockNumberByTag(provider, 'earliest').catch(() => {
        throw new Error('failed to get earliest block number')
      })

  const toBlockNum = toBlockOk
    ? await resolveBlock(provider, filter.toBlock, 'toBlock')
    : await getBlockNumberByTag(provider, 'latest').catch(() => {
        throw new Error('failed to get latest block number')
      })

  if (toBlockNum - fromBlockNum > getLogsLimitRange()) {
    throw new Error(
      `eth_getLogs is limited to a range of ${getLogsLimitRange()} blocks`,
    )
  }
}

export async function sanitiseEthGetLogs(
  provider: JsonRpcProvider,
  params: unknown[],
): Promise<void> {
  const filter = getFilter(params)

  // Skip if the user already provided both bounds.
  if ('fromBlock' in filter && 'toBlock' in filter) {
    return
  }

  let latestBlockNumber: bigint
  try {
    latestBlockNumber = await getBlockNumberByTag(provider, 'latest')
  } catch {
    throw new Error('failed to get latest block number')
  }

  const limit = getLogsLimitRange()
  filter.fromBlock =
    latestBlockNumber > limit
      ? `0x${(latestBlockNumber - limit).toString(16)}`
      : '0x0'
  filter.toBlock = 'latest'
  params[0] = filter
}

/**
 * Validates and sanitises an eth_getLogs request in place. No-op for other
 * methods. `params` is mutated in place (defaults filled in).
 */
export async function validateAndSanitiseEthGetLogs(
  provider: JsonRpcProvider,
  method: string,
  params: unknown[],
): Promise<void> {
  if (method !== 'eth_getLogs') {
    return
  }
  await validateEthGetLogs(provider, params)
  await sanitiseEthGetLogs(provider, params)
}
