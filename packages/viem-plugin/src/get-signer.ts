import { getWalletClient, getAccount, Config } from '@wagmi/core'

export const getSigner = async (config: Config) => {
  const client = await getWalletClient(config)
  const account = await getAccount(config)

  if (!account || !client) {
    throw new Error('No account or client found')
  }

	return {
    getAddress: async () => (account.address as string),
    signMessage: (message: string) => client.signMessage({ message }),
  }
}