import { ETHEREUM_URL, SEPOLIA_URL, ERC20_ABI } from './constants'
import type { Contract, Log, LogDescription, TransactionReceipt } from 'ethers'
import type { HardhatRuntimeEnvironment } from 'hardhat/types'

export async function getRemoteTokenMetadata(
  {
    remoteTokenAddress,
    remoteTokenNetwork,
  }: {
    remoteTokenAddress: string
    remoteTokenNetwork: string
  },
  hre: HardhatRuntimeEnvironment,
): Promise<{ name: string; symbol: string }> {
  const rpcUrl =
    remoteTokenNetwork === 'ethereum'
      ? ETHEREUM_URL
      : remoteTokenNetwork === 'sepolia'
        ? SEPOLIA_URL
        : null

  if (!rpcUrl) {
    throw new Error(
      `\n❌ Invalid network: ${remoteTokenNetwork}. Must be "ethereum" or "sepolia"`,
    )
  }

  const provider = new hre.ethers.JsonRpcProvider(rpcUrl)
  const tokenContract = new hre.ethers.Contract(
    remoteTokenAddress,
    ERC20_ABI,
    provider,
  )
  const [name, symbol] = await Promise.all([
    tokenContract.name(),
    tokenContract.symbol(),
  ])
  return { name, symbol }
}

export async function getLocalTokenAddress(
  receipt: TransactionReceipt,
  l2StandardBridge: Contract,
): Promise<string> {
  if (!receipt.logs || receipt.logs.length === 0) {
    throw new Error('\n❌ No logs found in transaction receipt')
  }

  const eventLog = receipt.logs
    .map((log: Log) => {
      try {
        return l2StandardBridge.interface.parseLog({
          topics: [...log.topics],
          data: log.data,
        })
      } catch {
        return null
      }
    })
    .find(
      (parsedLog: LogDescription | null) =>
        parsedLog?.name === 'StandardL2TokenCreated',
    )

  if (!eventLog) {
    throw new Error('\n❌ StandardL2TokenCreated event not found in logs')
  }

  const localTokenAddress = eventLog.args._l2Token
  return localTokenAddress
}
