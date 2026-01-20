export const ETHEREUM_URL = process.env.ETHEREUM_URL as string
export const SEPOLIA_URL = process.env.SEPOLIA_URL as string

export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
]

export const L2_STANDARD_BRIDGE_ADDRESS =
  '0x4200000000000000000000000000000000000010'

export const OPTIMISM_MINTABLE_ERC20_FACTORY = {
  address: '0x4200000000000000000000000000000000000012',
  abi: [
    'function createOptimismMintableERC20(address _remoteToken, string memory _name, string memory _symbol) returns (address)',
    'event StandardL2TokenCreated(address indexed _l1Token, address indexed _l2Token)',
  ],
}
