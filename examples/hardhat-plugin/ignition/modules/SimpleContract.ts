import { buildModule } from '@nomicfoundation/hardhat-ignition/modules'

const SimpleContract = buildModule('SimpleContract', (m) => {
  const simpleContract = m.contract('SimpleContract')

  return { simpleContract }
})

export default SimpleContract
