import util from 'node:util'
import { createPublicClient, createWalletClient, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { SilentDataRollupContract } from '@appliedblockchain/silentdatarollup-core'
import { SilentDataRollupProvider } from '@appliedblockchain/silentdatarollup-ethers-provider'
import { sdTransport } from '@appliedblockchain/silentdatarollup-viem'
import {
  CHAIN_ID,
  PRIVATE_KEY,
  RPC_URL_PRIVATE,
  RPC_URL_PUBLIC,
} from './constants'

export const stringifyObject = (txObj: unknown): string => {
  return util.inspect(txObj, { depth: null })
}

export const getProviderWithPrivateRpcUrl = (
  privateKey?: string,
): SilentDataRollupProvider => {
  const provider = new SilentDataRollupProvider({
    chainId: Number(CHAIN_ID),
    privateKey: privateKey || PRIVATE_KEY,
    rpcUrl: RPC_URL_PRIVATE,
  })
  return provider
}

export const getProviderWithPublicRpcUrl = (
  privateKey?: string,
): SilentDataRollupProvider => {
  const provider = new SilentDataRollupProvider({
    chainId: Number(CHAIN_ID),
    privateKey: privateKey || PRIVATE_KEY,
    rpcUrl: RPC_URL_PUBLIC,
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
    runner: provider.signer,
  })
  return contract
}

export const account = privateKeyToAccount(PRIVATE_KEY)

const silentDataChainWithPrivateRpcUrl = defineChain({
  id: Number(CHAIN_ID),
  name: 'Silent Data',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [RPC_URL_PRIVATE],
    },
  },
})

const silentDataChainWithPublicRpcUrl = defineChain({
  id: Number(CHAIN_ID),
  name: 'Silent Data',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [RPC_URL_PUBLIC],
    },
  },
})

const silentDataTransportWithPrivateRpcUrl = sdTransport({
  chainId: Number(CHAIN_ID),
  privateKey: PRIVATE_KEY,
  rpcUrl: RPC_URL_PRIVATE,
})

const silentDataTransportWithPublicRpcUrl = sdTransport({
  chainId: Number(CHAIN_ID),
  privateKey: PRIVATE_KEY,
  rpcUrl: RPC_URL_PUBLIC,
})

export const publicClientWithPrivateRpcUrl = createPublicClient({
  chain: silentDataChainWithPrivateRpcUrl,
  transport: silentDataTransportWithPrivateRpcUrl,
})

export const publicClientWithPublicRpcUrl = createPublicClient({
  chain: silentDataChainWithPublicRpcUrl,
  transport: silentDataTransportWithPublicRpcUrl,
})

export const walletClientWithPrivateRpcUrl = createWalletClient({
  chain: silentDataChainWithPrivateRpcUrl,
  transport: silentDataTransportWithPrivateRpcUrl,
  account,
})

export const walletClientWithPublicRpcUrl = createWalletClient({
  chain: silentDataChainWithPublicRpcUrl,
  transport: silentDataTransportWithPublicRpcUrl,
  account,
})
