import { buildModule } from '@nomicfoundation/hardhat-ignition/modules'

const ERC20TestToken = buildModule('ERC20TestToken', (m) => {
  const erc20TestToken = m.contract('ERC20TestToken')

  return { erc20TestToken }
})

export default ERC20TestToken
