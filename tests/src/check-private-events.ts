import assert from 'node:assert'
import { toQuantity, Wallet } from 'ethers'
import { getProvider, getPrivateEventsContract, stringifyObject } from './utils'

async function main() {
  const providerAllowedViewerA = getProvider()
  const contract = await getPrivateEventsContract(providerAllowedViewerA)
  const allowedViewerAddressA = await providerAllowedViewerA.signer.getAddress()

  const allowedViewerB = Wallet.createRandom()
  const allowedViewerAddressB = allowedViewerB.address
  const providerAllowedViewerB = getProvider(allowedViewerB.privateKey)

  const nonAllowedViewer = Wallet.createRandom()
  const nonAllowedViewerAddress = nonAllowedViewer.address
  const providerNonAllowedViewer = getProvider(nonAllowedViewer.privateKey)

  console.log(
    `Emitting events with allowed viewers: ${allowedViewerAddressA}, ${allowedViewerAddressB}`,
  )

  const tx = await contract.triggerEvents(
    'publicMessage1',
    'publicMessage2',
    'privateMessage1',
    'privateMessage2',
    [allowedViewerAddressA, allowedViewerAddressB],
  )
  await tx.wait()

  const txn = await providerAllowedViewerA.getTransaction(tx.hash)
  console.log(`Transaction: ${stringifyObject(txn?.toJSON())}`)

  assert(txn, 'Transaction is not defined')
  assert(txn?.blockNumber, 'Block number is not defined')

  console.log(
    `Emitted events with allowed viewers: ${allowedViewerAddressA}, ${allowedViewerAddressB}`,
  )

  console.log(`Getting logs for allowed viewer: ${allowedViewerAddressA}`)

  const logsAllowedViewerA = await providerAllowedViewerA.getLogs({
    fromBlock: toQuantity(txn.blockNumber),
    toBlock: toQuantity(txn.blockNumber),
    address: contract.target,
  })
  const allLogsAllowedViewerA = await providerAllowedViewerA.getAllLogs({
    fromBlock: toQuantity(txn.blockNumber),
    toBlock: toQuantity(txn.blockNumber),
    address: contract.target,
  })
  const privateLogsAllowedViewerA = await providerAllowedViewerA.getPrivateLogs(
    {
      fromBlock: toQuantity(txn.blockNumber),
      toBlock: toQuantity(txn.blockNumber),
      address: contract.target,
    },
  )

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

  const logsAllowedViewerB = await providerAllowedViewerB.getLogs({
    fromBlock: toQuantity(txn.blockNumber),
    toBlock: toQuantity(txn.blockNumber),
    address: contract.target,
  })
  const allLogsAllowedViewerB = await providerAllowedViewerB.getAllLogs({
    fromBlock: toQuantity(txn.blockNumber),
    toBlock: toQuantity(txn.blockNumber),
    address: contract.target,
  })
  const privateLogsAllowedViewerB = await providerAllowedViewerB.getPrivateLogs(
    {
      fromBlock: toQuantity(txn.blockNumber),
      toBlock: toQuantity(txn.blockNumber),
      address: contract.target,
    },
  )

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

  const logsNonAllowedViewer = await providerNonAllowedViewer.getLogs({
    fromBlock: toQuantity(txn.blockNumber),
    toBlock: toQuantity(txn.blockNumber),
    address: contract.target,
  })

  const allLogsNonAllowedViewer = await providerNonAllowedViewer.getAllLogs({
    fromBlock: toQuantity(txn.blockNumber),
    toBlock: toQuantity(txn.blockNumber),
    address: contract.target,
  })

  const privateLogsNonAllowedViewer =
    await providerNonAllowedViewer.getPrivateLogs({
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
