import { buildModule } from '@nomicfoundation/hardhat-ignition/modules'
import { parseEther } from 'viem'

const PrivateToken = buildModule('PrivateToken', (m) => {
  const initialSupply = parseEther('1000000')

  const privateToken = m.contract('PrivateToken', [initialSupply])

  return { privateToken }
})

export default PrivateToken
