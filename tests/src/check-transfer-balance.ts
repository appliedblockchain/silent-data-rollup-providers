import assert from 'node:assert'
import { formatEther, parseEther, Wallet } from 'ethers'
import { type Address } from 'viem'
import {
  account,
  getProviderWithPrivateRpcUrl as getProvider,
  publicClientWithPrivateRpcUrl as publicClient,
  stringifyObject,
  walletClientWithPrivateRpcUrl as walletClient,
} from './utils'

const amount = parseEther('1')

async function withEthersProvider() {
  const provider = getProvider()

  const fromAddress = await provider.signer.getAddress()
  const toAddress = Wallet.createRandom().address

  const balanceBeforeFrom = await provider.getBalance(fromAddress)
  console.log(
    `Balance of ${fromAddress}: ${formatEther(balanceBeforeFrom)} ETH`,
  )

  const balanceBeforeTo = await provider.getBalance(toAddress)
  console.log(`Balance of ${toAddress}: ${formatEther(balanceBeforeTo)} ETH`)

  console.log(
    `Sending ${formatEther(amount)} ETH from ${fromAddress} to ${toAddress}`,
  )

  const tx = await provider.signer.sendTransaction({
    to: toAddress,
    value: amount,
  })
  await provider.waitForTransaction(tx.hash)

  const txn = await provider.getTransaction(tx.hash)
  console.log(`Transaction: ${stringifyObject(txn?.toJSON())}`)

  console.log(
    `Sent ${formatEther(amount)} ETH from ${fromAddress} to ${toAddress}`,
  )

  const balanceFromAfter = await provider.getBalance(fromAddress)
  console.log(`Balance of ${fromAddress}: ${formatEther(balanceFromAfter)} ETH`)

  const balanceToAfter = await provider.getBalance(toAddress)
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

  const balanceBeforeFrom = await publicClient.getBalance({
    address: fromAddress,
  })
  console.log(
    `Balance of ${fromAddress}: ${formatEther(balanceBeforeFrom)} ETH`,
  )

  const balanceBeforeTo = await publicClient.getBalance({ address: toAddress })
  console.log(`Balance of ${toAddress}: ${formatEther(balanceBeforeTo)} ETH`)

  console.log(
    `Sending ${formatEther(amount)} ETH from ${fromAddress} to ${toAddress}`,
  )

  const txHash = await walletClient.sendTransaction({
    to: toAddress,
    value: amount,
  })
  await publicClient.waitForTransactionReceipt({ hash: txHash })

  const txn = await publicClient.getTransaction({ hash: txHash })
  console.log(`Transaction: ${stringifyObject(txn)}`)

  console.log(
    `Sent ${formatEther(amount)} ETH from ${fromAddress} to ${toAddress}`,
  )

  const balanceFromAfter = await publicClient.getBalance({
    address: fromAddress,
  })
  console.log(`Balance of ${fromAddress}: ${formatEther(balanceFromAfter)} ETH`)

  const balanceToAfter = await publicClient.getBalance({ address: toAddress })
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
