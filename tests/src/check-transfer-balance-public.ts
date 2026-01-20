import assert from 'node:assert'
import { formatEther, parseEther, Wallet } from 'ethers'
import { type Address } from 'viem'
import {
  account,
  getProviderWithPrivateRpcUrl,
  getProviderWithPublicRpcUrl,
  publicClientWithPublicRpcUrl,
  stringifyObject,
  walletClientWithPrivateRpcUrl,
  walletClientWithPublicRpcUrl,
} from './utils'

async function withEthersProvider() {
  const providerWithPrivateRpcUrl = getProviderWithPrivateRpcUrl()
  const providerWithPublicRpcUrl = getProviderWithPublicRpcUrl()

  const fromAddress = await providerWithPublicRpcUrl.signer.getAddress()
  const toAddress = Wallet.createRandom().address

  const balanceBeforeFrom =
    await providerWithPublicRpcUrl.getBalance(fromAddress)
  console.log(
    `Balance of ${fromAddress}: ${formatEther(balanceBeforeFrom)} ETH`,
  )

  const balanceBeforeTo = await providerWithPublicRpcUrl.getBalance(toAddress)
  console.log(`Balance of ${toAddress}: ${formatEther(balanceBeforeTo)} ETH`)

  const amount = parseEther('0.000000000000000001')

  console.log(
    `Sending ${formatEther(amount)} ETH from ${fromAddress} to ${toAddress}`,
  )

  console.log(
    'Checking that transaction submission with public RPC URL fails...',
  )

  let publicRpcSubmissionFailed = false
  try {
    await providerWithPublicRpcUrl.signer.sendTransaction({
      to: toAddress,
      value: amount,
    })
  } catch {
    publicRpcSubmissionFailed = true
  }
  assert(
    publicRpcSubmissionFailed,
    'Transaction submission with public RPC URL should have failed',
  )

  console.log('Sending transaction with private RPC URL...')

  const tx = await providerWithPrivateRpcUrl.signer.sendTransaction({
    to: toAddress,
    value: amount,
  })
  await providerWithPublicRpcUrl.waitForTransaction(tx.hash)

  const txn = await providerWithPublicRpcUrl.getTransaction(tx.hash)
  console.log(`Transaction: ${JSON.stringify(txn?.toJSON(), null, 2)}`)

  console.log(
    `Sent ${formatEther(amount)} ETH from ${fromAddress} to ${toAddress}`,
  )

  const balanceFromAfter =
    await providerWithPublicRpcUrl.getBalance(fromAddress)
  console.log(`Balance of ${fromAddress}: ${formatEther(balanceFromAfter)} ETH`)

  const balanceToAfter = await providerWithPublicRpcUrl.getBalance(toAddress)
  console.log(`Balance of ${toAddress}: ${formatEther(balanceToAfter)} ETH`)

  assert(
    balanceBeforeFrom > balanceFromAfter,
    `Balance of ${fromAddress} is not correct`,
  )
  assert(
    balanceToAfter === balanceBeforeTo + amount,
    `Balance of ${toAddress} is not correct`,
  )
}

async function withViemProvider() {
  const fromAddress = account.address
  const toAddress = Wallet.createRandom().address as Address

  const balanceBeforeFrom = await publicClientWithPublicRpcUrl.getBalance({
    address: fromAddress,
  })
  console.log(
    `Balance of ${fromAddress}: ${formatEther(balanceBeforeFrom)} ETH`,
  )

  const balanceBeforeTo = await publicClientWithPublicRpcUrl.getBalance({
    address: toAddress,
  })
  console.log(`Balance of ${toAddress}: ${formatEther(balanceBeforeTo)} ETH`)

  const amount = parseEther('0.000000000000000001')

  console.log(
    `Sending ${formatEther(amount)} ETH from ${fromAddress} to ${toAddress}`,
  )

  console.log(
    'Checking that transaction submission with public RPC URL fails...',
  )

  let publicRpcSubmissionFailed = false
  try {
    await walletClientWithPublicRpcUrl.sendTransaction({
      to: toAddress,
      value: amount,
    })
  } catch {
    publicRpcSubmissionFailed = true
  }
  assert(
    publicRpcSubmissionFailed,
    'Transaction submission with public RPC URL should have failed',
  )

  console.log('Sending transaction with private RPC URL...')

  const txHash = await walletClientWithPrivateRpcUrl.sendTransaction({
    to: toAddress,
    value: amount,
  })
  await publicClientWithPublicRpcUrl.waitForTransactionReceipt({ hash: txHash })

  const txn = await publicClientWithPublicRpcUrl.getTransaction({
    hash: txHash,
  })
  console.log(`Transaction: ${stringifyObject(txn)}`)

  console.log(
    `Sent ${formatEther(amount)} ETH from ${fromAddress} to ${toAddress}`,
  )

  const balanceFromAfter = await publicClientWithPublicRpcUrl.getBalance({
    address: fromAddress,
  })
  console.log(`Balance of ${fromAddress}: ${formatEther(balanceFromAfter)} ETH`)

  const balanceToAfter = await publicClientWithPublicRpcUrl.getBalance({
    address: toAddress,
  })
  console.log(`Balance of ${toAddress}: ${formatEther(balanceToAfter)} ETH`)

  assert(
    balanceBeforeFrom > balanceFromAfter,
    `Balance of ${fromAddress} is not correct`,
  )
  assert(
    balanceToAfter === balanceBeforeTo + amount,
    `Balance of ${toAddress} is not correct`,
  )
}

async function main() {
  console.log('Using ethers provider')
  await withEthersProvider()

  console.log('\nUsing viem provider')
  await withViemProvider()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
