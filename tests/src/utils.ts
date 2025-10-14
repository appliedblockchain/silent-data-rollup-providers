import util from 'node:util'
import { createPublicClient, createWalletClient, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { SilentDataRollupContract } from '@appliedblockchain/silentdatarollup-core'
import { SilentDataRollupProvider } from '@appliedblockchain/silentdatarollup-ethers-provider'
import { sdTransport } from '@appliedblockchain/silentdatarollup-viem'
import { CHAIN_ID, PRIVATE_KEY, RPC_URL } from './constants'

export const stringifyObject = (txObj: unknown): string => {
  return util.inspect(txObj, { depth: null })
}

export const getProvider = (privateKey?: string): SilentDataRollupProvider => {
  const provider = new SilentDataRollupProvider({
    chainId: Number(CHAIN_ID),
    privateKey: privateKey || PRIVATE_KEY,
    rpcUrl: RPC_URL,
  })
  return provider
}

export const getPrivateTokenContract = async (
  provider: SilentDataRollupProvider,
): Promise<SilentDataRollupContract> => {
  const key = 'PrivateToken#PrivateToken'
  const contractArtifact = await import(
    `../ignition/deployments/chain-${CHAIN_ID}/artifacts/${key}.json`
  )
  const deployedAddresses = await import(
    `../ignition/deployments/chain-${CHAIN_ID}/deployed_addresses.json`
  )
  const abi = contractArtifact.abi
  const address = deployedAddresses[key]

  const contract = new SilentDataRollupContract({
    abi,
    address,
    contractMethodsToSign: ['balanceOf'],
    // @ts-expect-error Runner is a Signer
    runner: provider.signer,
  })
  return contract
}

export const getPrivateEventsContract = async (
  provider: SilentDataRollupProvider,
): Promise<SilentDataRollupContract> => {
  const key = 'PrivateEvents#PrivateEvents'
  const contractArtifact = await import(
    `../ignition/deployments/chain-${CHAIN_ID}/artifacts/${key}.json`
  )
  const deployedAddresses = await import(
    `../ignition/deployments/chain-${CHAIN_ID}/deployed_addresses.json`
  )
  const abi = contractArtifact.abi
  const address = deployedAddresses[key]

  const contract = new SilentDataRollupContract({
    abi,
    address,
    contractMethodsToSign: [],
    // @ts-expect-error Runner isa Signer
    runner: provider.signer,
  })
  return contract
}

export const account = privateKeyToAccount(PRIVATE_KEY)

const silentDataChain = defineChain({
  id: Number(CHAIN_ID),
  name: 'Silent Data',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [RPC_URL],
    },
  },
})

const silentDataTransport = sdTransport({
  chainId: Number(CHAIN_ID),
  privateKey: PRIVATE_KEY,
  rpcUrl: RPC_URL,
})

export const publicClient = createPublicClient({
  chain: silentDataChain,
  transport: silentDataTransport,
})

export const walletClient = createWalletClient({
  chain: silentDataChain,
  transport: silentDataTransport,
  account,
})
