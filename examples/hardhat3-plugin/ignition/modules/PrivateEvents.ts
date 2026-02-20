import { buildModule } from '@nomicfoundation/hardhat-ignition/modules'

const PrivateEvents = buildModule('PrivateEvents', (m) => {
  const privateEvents = m.contract('PrivateEvents')

  return { privateEvents }
})

export default PrivateEvents
