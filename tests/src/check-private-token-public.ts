import assert from 'node:assert'
import { formatUnits, parseUnits, Wallet } from 'ethers'
import {
  getProviderWithPrivateRpcUrl,
  getProviderWithPublicRpcUrl,
  getPrivateTokenContract,
} from './utils'

export async function main() {
  const providerWithPrivateRpcUrl = getProviderWithPrivateRpcUrl()
  const providerWithPublicRpcUrl = getProviderWithPublicRpcUrl()
  const contractWithProviderWithPrivateRpcUrl = await getPrivateTokenContract(
    providerWithPrivateRpcUrl,
  )
  const contractWithProviderWithPublicRpcUrl = await getPrivateTokenContract(
    providerWithPublicRpcUrl,
  )

  const fromAddress = await providerWithPublicRpcUrl.signer.getAddress()
  const toAddress = Wallet.createRandom().address

  const [decimals, name, symbol] = await Promise.all([
    contractWithProviderWithPublicRpcUrl.decimals(),
    contractWithProviderWithPublicRpcUrl.name(),
    contractWithProviderWithPublicRpcUrl.symbol(),
  ])

  console.log(
    `Contract address: ${contractWithProviderWithPublicRpcUrl.target}`,
  )
  console.log(`Contract name: ${name}`)

  const balanceBefore =
    await contractWithProviderWithPublicRpcUrl.balanceOf(fromAddress)
  console.log(
    `Balance of ${fromAddress}: ${formatUnits(
      balanceBefore,
      decimals,
    )} ${symbol}`,
  )

  const amount = parseUnits('1', decimals)

  console.log(
    `Sending ${formatUnits(
      amount,
      decimals,
    )} ${symbol} from ${fromAddress} to ${toAddress}`,
  )

  console.log(
    'Checking that transaction submission with public RPC URL fails...',
  )

  let publicRpcSubmissionFailed = false
  try {
    await contractWithProviderWithPublicRpcUrl.transfer(toAddress, amount)
  } catch {
    publicRpcSubmissionFailed = true
  }
  assert(
    publicRpcSubmissionFailed,
    'Transaction submission with public RPC URL should have failed',
  )

  console.log('Sending transaction with private RPC URL...')

  const tx = await contractWithProviderWithPrivateRpcUrl.transfer(
    toAddress,
    amount,
  )
  await tx.wait()

  const txn = await providerWithPublicRpcUrl.getTransaction(tx.hash)
  console.log(`Transaction: ${JSON.stringify(txn?.toJSON(), null, 2)}`)

  console.log(
    `Sent ${formatUnits(
      amount,
      decimals,
    )} ${symbol} from ${fromAddress} to ${toAddress}`,
  )

  const balanceAfter =
    await contractWithProviderWithPublicRpcUrl.balanceOf(fromAddress)
  console.log(
    `Balance of ${fromAddress}: ${formatUnits(
      balanceAfter,
      decimals,
    )} ${symbol}`,
  )

  assert(
    balanceAfter === balanceBefore - amount,
    `Balance of ${fromAddress} is not correct`,
  )
  await assert.rejects(
    contractWithProviderWithPublicRpcUrl.balanceOf(toAddress),
    new Error('execution reverted: UnauthorizedBalanceQuery(address,address)'),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
