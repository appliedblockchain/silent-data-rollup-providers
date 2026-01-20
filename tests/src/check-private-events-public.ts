import assert from 'node:assert'
import { toQuantity, Wallet } from 'ethers'
import {
  getProviderWithPrivateRpcUrl,
  getProviderWithPublicRpcUrl,
  getPrivateEventsContract,
} from './utils'

export async function main() {
  const providerAllowedViewerAWithPrivateRpcUrl = getProviderWithPrivateRpcUrl()
  const providerAllowedViewerAWithPublicRpcUrl = getProviderWithPublicRpcUrl()
  const contract = await getPrivateEventsContract(
    providerAllowedViewerAWithPrivateRpcUrl,
  )
  const allowedViewerAddressA =
    await providerAllowedViewerAWithPublicRpcUrl.signer.getAddress()

  const allowedViewerB = Wallet.createRandom()
  const allowedViewerAddressB = allowedViewerB.address
  const providerAllowedViewerBWithPublicRpcUrl = getProviderWithPublicRpcUrl(
    allowedViewerB.privateKey,
  )

  const nonAllowedViewer = Wallet.createRandom()
  const nonAllowedViewerAddress = nonAllowedViewer.address
  const providerNonAllowedViewerWithPublicRpcUrl = getProviderWithPublicRpcUrl(
    nonAllowedViewer.privateKey,
  )

  console.log(
    `Emitting events with allowed viewers: ${allowedViewerAddressA}, ${allowedViewerAddressB}`,
  )

  console.log(
    'Checking that transaction submission with public RPC URL fails...',
  )

  const contractWithPublicRpc = await getPrivateEventsContract(
    providerAllowedViewerAWithPublicRpcUrl,
  )

  let publicRpcSubmissionFailed = false
  try {
    await contractWithPublicRpc.triggerEvents(
      'publicMessage1',
      'publicMessage2',
      'privateMessage1',
      'privateMessage2',
      [allowedViewerAddressA, allowedViewerAddressB],
    )
  } catch {
    publicRpcSubmissionFailed = true
  }
  assert(
    publicRpcSubmissionFailed,
    'Transaction submission with public RPC URL should have failed',
  )

  console.log('Sending transaction with private RPC URL...')

  const tx = await contract.triggerEvents(
    'publicMessage1',
    'publicMessage2',
    'privateMessage1',
    'privateMessage2',
    [allowedViewerAddressA, allowedViewerAddressB],
  )
  await tx.wait()

  const txn = await providerAllowedViewerAWithPublicRpcUrl.getTransaction(
    tx.hash,
  )
  console.log(`Transaction: ${JSON.stringify(txn?.toJSON(), null, 2)}`)

  assert(txn, 'Transaction is not defined')
  assert(txn?.blockNumber, 'Block number is not defined')

  console.log(
    `Emitted events with allowed viewers: ${allowedViewerAddressA}, ${allowedViewerAddressB}`,
  )

  console.log(`Getting logs for allowed viewer: ${allowedViewerAddressA}`)

  const logsAllowedViewerA =
    await providerAllowedViewerAWithPublicRpcUrl.getLogs({
      fromBlock: toQuantity(txn.blockNumber),
      toBlock: toQuantity(txn.blockNumber),
      address: contract.target,
    })
  const allLogsAllowedViewerA =
    await providerAllowedViewerAWithPublicRpcUrl.getAllLogs({
      fromBlock: toQuantity(txn.blockNumber),
      toBlock: toQuantity(txn.blockNumber),
      address: contract.target,
    })
  const privateLogsAllowedViewerA =
    await providerAllowedViewerAWithPublicRpcUrl.getPrivateLogs({
      fromBlock: toQuantity(txn.blockNumber),
      toBlock: toQuantity(txn.blockNumber),
      address: contract.target,
    })

  assert(
    logsAllowedViewerA.length === 2,
    `getLogs for allowed viewer ${allowedViewerAddressA} should return 2 logs`,
  )
  assert(
    allLogsAllowedViewerA.length === 4,
    `getAllLogs for allowed viewer ${allowedViewerAddressA} should return 4 logs`,
  )
  assert(
    privateLogsAllowedViewerA.length === 2,
    `getPrivateLogs for allowed viewer ${allowedViewerAddressA} should return 2 logs`,
  )

  console.log(`Getting logs for allowed viewer: ${allowedViewerAddressB}`)

  const logsAllowedViewerB =
    await providerAllowedViewerBWithPublicRpcUrl.getLogs({
      fromBlock: toQuantity(txn.blockNumber),
      toBlock: toQuantity(txn.blockNumber),
      address: contract.target,
    })
  const allLogsAllowedViewerB =
    await providerAllowedViewerBWithPublicRpcUrl.getAllLogs({
      fromBlock: toQuantity(txn.blockNumber),
      toBlock: toQuantity(txn.blockNumber),
      address: contract.target,
    })
  const privateLogsAllowedViewerB =
    await providerAllowedViewerBWithPublicRpcUrl.getPrivateLogs({
      fromBlock: toQuantity(txn.blockNumber),
      toBlock: toQuantity(txn.blockNumber),
      address: contract.target,
    })

  assert(
    logsAllowedViewerB.length === 2,
    `getLogs for allowed viewer ${allowedViewerAddressB} should return 2 logs`,
  )
  assert(
    allLogsAllowedViewerB.length === 4,
    `getAllLogs for allowed viewer ${allowedViewerAddressB} should return 4 logs`,
  )
  assert(
    privateLogsAllowedViewerB.length === 2,
    `getPrivateLogs for allowed viewer ${allowedViewerAddressB} should return 2 logs`,
  )

  console.log(`Getting logs for non-allowed viewer: ${nonAllowedViewerAddress}`)

  const logsNonAllowedViewer =
    await providerNonAllowedViewerWithPublicRpcUrl.getLogs({
      fromBlock: toQuantity(txn.blockNumber),
      toBlock: toQuantity(txn.blockNumber),
      address: contract.target,
    })

  const allLogsNonAllowedViewer =
    await providerNonAllowedViewerWithPublicRpcUrl.getAllLogs({
      fromBlock: toQuantity(txn.blockNumber),
      toBlock: toQuantity(txn.blockNumber),
      address: contract.target,
    })

  const privateLogsNonAllowedViewer =
    await providerNonAllowedViewerWithPublicRpcUrl.getPrivateLogs({
      fromBlock: toQuantity(txn.blockNumber),
      toBlock: toQuantity(txn.blockNumber),
      address: contract.target,
    })

  assert(
    logsNonAllowedViewer.length === 2,
    `getLogs for non-allowed viewer ${nonAllowedViewerAddress} should return 2 logs`,
  )
  assert(
    allLogsNonAllowedViewer.length === 2,
    `getAllLogs for non-allowed viewer ${nonAllowedViewerAddress} should return 2 logs`,
  )
  assert(
    privateLogsNonAllowedViewer.length === 0,
    `getPrivateLogs for non-allowed viewer ${nonAllowedViewerAddress} should return 0 logs`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
