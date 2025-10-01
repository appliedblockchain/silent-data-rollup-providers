import assert from 'node:assert'
import { formatEther, parseEther, Wallet } from 'ethers'
import { getProvider } from './utils'

export async function main() {
  const provider = getProvider()

  const fromAddress = await provider.signer.getAddress()
  const toAddress = Wallet.createRandom().address

  const balanceBeforeFrom = await provider.getBalance(fromAddress)
  console.log(
    `Balance of ${fromAddress}: ${formatEther(balanceBeforeFrom)} ETH`,
  )

  const balanceBeforeTo = await provider.getBalance(toAddress)
  console.log(`Balance of ${toAddress}: ${formatEther(balanceBeforeTo)} ETH`)

  const amount = parseEther('0.000000000000000001')

  console.log(
    `Sending ${formatEther(amount)} ETH from ${fromAddress} to ${toAddress}`,
  )

  const tx = await provider.signer.sendTransaction({
    to: toAddress,
    value: amount,
  })
  await provider.waitForTransaction(tx.hash)

  const txn = await provider.getTransaction(tx.hash)
  console.log(`Transaction: ${JSON.stringify(txn?.toJSON(), null, 2)}`)

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

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
