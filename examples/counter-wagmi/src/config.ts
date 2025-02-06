import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import { createConfig, http } from 'wagmi'
import { hardhat } from 'wagmi/chains'
import { coinbaseWallet, injectedWallet, ledgerWallet, metaMaskWallet, rainbowWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets'
import { sd_testnet, sdt, NetworkName} from '@appliedblockchain/silentdatarollup-viem-plugin'

const silentdata = sd_testnet({
  chainId: +import.meta.env.VITE_SILENTDATA_CHAIN_ID,
  rpcUrl: import.meta.env.VITE_SILENTDATA_RPC_URL
})

export const config = createConfig({
  chains: [hardhat, silentdata],
  ssr: true,
  transports: {
    [hardhat.id]: http(),
    [silentdata.id]: sdt({
      chain: silentdata,
      network: NetworkName.TESTNET,
      methodsToSign: [
        'getCountPrivate()',
      ]
    }),
  },
  connectors: connectorsForWallets([{
    groupName: 'Supported Wallets',
    wallets: [
      metaMaskWallet,
      walletConnectWallet,
      coinbaseWallet,
      rainbowWallet,
      ledgerWallet,
      injectedWallet,
    ]
  }], {
    appName: 'Simple Counter Web3',
    projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '',
  })
})