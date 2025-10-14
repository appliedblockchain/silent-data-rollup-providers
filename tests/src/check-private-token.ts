import assert from 'node:assert'
import { formatUnits, parseUnits, Wallet } from 'ethers'
import { getProvider, getPrivateTokenContract, stringifyObject } from './utils'

async function main() {
  const provider = getProvider()
  const contract = await getPrivateTokenContract(provider)

  const fromAddress = await provider.signer.getAddress()
  const toAddress = Wallet.createRandom().address

  const [decimals, name, symbol] = await Promise.all([
    contract.decimals(),
    contract.name(),
    contract.symbol(),
  ])

  console.log(`Contract address: ${contract.target}`)
  console.log(`Contract name: ${name}`)

  const balanceBefore = await contract.balanceOf(fromAddress)
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

  const tx = await contract.transfer(toAddress, amount)
  await tx.wait()

  const txn = await provider.getTransaction(tx.hash)
  console.log(`Transaction: ${stringifyObject(txn?.toJSON())}`)

  console.log(
    `Sent ${formatUnits(
      amount,
      decimals,
    )} ${symbol} from ${fromAddress} to ${toAddress}`,
  )

  const balanceAfter = await contract.balanceOf(fromAddress)
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
    contract.balanceOf(toAddress),
    new Error('execution reverted: UnauthorizedBalanceQuery(address,address)'),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
