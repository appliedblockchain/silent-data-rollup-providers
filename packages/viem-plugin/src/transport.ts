import {
	Chain,
	custom,
	Transport,
} from 'viem'
import { NetworkName, SignatureType } from '@appliedblockchain/silentdatarollup-core'
import { SilentDataRollupProvider } from './provider'
import { getSigner as defaultGetSigner } from './get-signer'
import { Sender } from './sender'
export type SilentDataTransportConfig = {
	/**
	 * The RPC URL
	 */
	rpcUrl?: string

	delegate?: boolean

	chainId?: number

	signatureType?: SignatureType

	network?: NetworkName

	methodsToSign?: string[]

	chain?: Chain

	/**
	 * Custom signer function to override the default one
	 * Useful for instantiating a SD transport with viem client
	 */
	getSigner?: () => Promise<{
		getAddress: () => Promise<string>
		signMessage: (message: string) => Promise<string>
	}>

}

/**
 * Creates a Viem transport for SilentData RPC
 */
export function sdt({
	rpcUrl,
	chainId,
	signatureType,
	network,
	delegate = true,
	methodsToSign,
	chain,
	getSigner: customGetSigner,
}: SilentDataTransportConfig = {}): Transport {
	const chainId_ = chain?.id ?? chainId
	const rpcUrl_ = chain?.rpcUrls.default.http[0] || rpcUrl || 'https://rollup.silentdata.com/'
	
	const provider = SilentDataRollupProvider.configure({
		rpcUrl: rpcUrl_,
		chainId: chainId_,
		delegate,
		signatureType,
		network,
		methodsToSign
	})

	const sender = new Sender(provider)
	
	return custom({
		async request({ method, params }) {	
			if (!provider.wagmiConfig) {
				throw new Error('wagmiConfig is not set')
			}

			provider.signer = await (customGetSigner || defaultGetSigner)(provider.wagmiConfig)

			// SilentData RPC does not allow passing `true` for the second param with these methods
			// TODO: find better solution for this
			if (['eth_getBlockByNumber', 'eth_getBlockByHash'].includes(method)) {
				params[1] = false
			}

			// Use sender.send instead to manage concurrent requests with signed session
			return sender.send(method, params)
		},
	}, {
		key: 'silentdata',
		name: 'SilentData JSON-RPC',
	})
} 