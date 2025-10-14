import { SilentDataRollupContract } from '@appliedblockchain/silentdatarollup-core'
import { SilentDataRollupProvider } from '@appliedblockchain/silentdatarollup-ethers-provider'
import {
  BrowserProvider,
  formatEther,
  formatUnits,
  Wallet,
  type ContractRunner,
} from 'ethers'
import { useEffect, useState, useRef } from 'react'
import { ERC20_ABI } from './constants/erc20Abi'
import './App.css'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethereum?: any
  }
}

interface Token {
  address: string
  name: string
  symbol: string
  balance: string
}

const REQUIRED_ENV_VARS = ['VITE_CHAIN_ID', 'VITE_ROLLUP_RPC_URL'] as const
REQUIRED_ENV_VARS.forEach((envVar) => {
  if (!import.meta.env[envVar]) {
    throw new Error(`${envVar} environment variable is required`)
  }
})
const CHAIN_ID = import.meta.env.VITE_CHAIN_ID
const RPC_URL = import.meta.env.VITE_ROLLUP_RPC_URL

const STORAGE_NAMESPACE = 'silentdata-rollup:'
const TOKENS_STORAGE_KEY = `${STORAGE_NAMESPACE}tokens`

localStorage.debug = 'silentdata:*'

function useSilentDataProvider() {
  const providerRef = useRef<{
    provider: SilentDataRollupProvider
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    signer: any
  } | null>(null)

  const createProvider = async () => {
    if (!providerRef.current) {
      const browserProvider = new BrowserProvider(window.ethereum)
      const signer = await browserProvider.getSigner()

      providerRef.current = {
        signer,
        provider: new SilentDataRollupProvider({
          rpcUrl: RPC_URL,
          chainId: Number(CHAIN_ID),
          // @ts-expect-error signer is Signer
          signer,
          delegate: true,
        }),
      }
    }
    return providerRef.current
  }

  return { createProvider }
}

function App() {
  const [balance, setBalance] = useState<string>('')
  const [address, setAddress] = useState<string>('')
  const [tokens, setTokens] = useState<Token[]>(() => {
    const saved = localStorage.getItem(TOKENS_STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  })
  const [newTokenAddress, setNewTokenAddress] = useState('')
  const { createProvider } = useSilentDataProvider()

  useEffect(() => {
    localStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(tokens))
  }, [tokens])

  async function getBalance(address: string) {
    try {
      const { provider } = await createProvider()
      const balance = await provider.getBalance(address)
      setBalance(formatEther(balance.toString()))
    } catch (error) {
      console.error('Error fetching balance:', error)
    }
  }

  async function connectWallet() {
    if (!window.ethereum) {
      alert('Please install MetaMask!')
      return
    }

    try {
      const { provider } = await createProvider()
      const address = await provider.signer.getAddress()
      setAddress(address)
      await getBalance(address)

      await Promise.all(
        tokens.map(async (token) => {
          try {
            const tokenContract = new SilentDataRollupContract({
              address: token.address,
              abi: ERC20_ABI,
              runner: provider as unknown as ContractRunner,
              contractMethodsToSign: ['balanceOf'],
            })

            const [decimals, balance] = await Promise.all([
              tokenContract.decimals(),
              tokenContract.balanceOf(address),
            ])

            const formattedBalance = formatUnits(balance, decimals)

            setTokens((prev) =>
              prev.map((t) =>
                t.address === token.address
                  ? { ...t, balance: formattedBalance }
                  : t,
              ),
            )
          } catch (error) {
            setTokens((prev) =>
              prev.map((t) =>
                t.address === token.address ? { ...t, balance: '-' } : t,
              ),
            )

            console.error(`Error refreshing token ${token.address}:`, error)
          }
        }),
      )
    } catch (error) {
      console.error('Error:', error)
    }
  }

  async function addToken(tokenAddress: string) {
    if (
      tokens.some(
        (token) => token.address.toLowerCase() === tokenAddress.toLowerCase(),
      )
    ) {
      alert('This token has already been added')
      return
    }

    try {
      const { provider } = await createProvider()
      const tokenContract = new SilentDataRollupContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        runner: provider as unknown as ContractRunner,
        contractMethodsToSign: ['balanceOf'],
      })

      const [name, symbol, decimals, balance] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.balanceOf(address),
      ])

      const formattedBalance = formatUnits(balance, decimals)

      setTokens((prev) => [
        ...prev,
        {
          address: tokenAddress,
          name,
          symbol,
          balance: formattedBalance,
        },
      ])

      setNewTokenAddress('')
    } catch (error) {
      console.error('Error adding token:', error)
      alert('Error adding token. Please check the address and try again.')
    }
  }

  const removeToken = (tokenAddress: string) => {
    setTokens((prev) => prev.filter((token) => token.address !== tokenAddress))
  }

  const transferToken = async (tokenAddress: string) => {
    try {
      const { provider } = await createProvider()

      const tokenContract = new SilentDataRollupContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        runner: provider.signer as unknown as ContractRunner,
        contractMethodsToSign: [],
      })

      const randomWallet = Wallet.createRandom()

      const transferTx = await tokenContract.transfer(randomWallet.address, 100)

      await transferTx.wait()
    } catch (error) {
      console.error('Error transferring token:', error)
    }
  }

  async function refreshBalances() {
    if (address) {
      await getBalance(address)
      // Refresh all token balances
      const updatedTokens = await Promise.all(
        tokens.map(async (token) => {
          try {
            const { provider } = await createProvider()
            const tokenContract = new SilentDataRollupContract({
              address: token.address,
              abi: ERC20_ABI,
              runner: provider as unknown as ContractRunner,
              contractMethodsToSign: ['balanceOf'],
            })

            const [decimals, balance] = await Promise.all([
              tokenContract.decimals(),
              tokenContract.balanceOf(address),
            ])

            const formattedBalance = formatUnits(balance, decimals)
            return { ...token, balance: formattedBalance }
          } catch (error) {
            console.error(`Error refreshing token ${token.address}:`, error)
            return token
          }
        }),
      )
      setTokens(updatedTokens)
    }
  }

  return (
    <div className="wallet-container">
      <div className="wallet-card">
        <h1>Silent Data Wallet</h1>

        <div className="connect-section">
          <button
            className={`connect-button ${address ? 'connected' : ''}`}
            onClick={connectWallet}
          >
            {address ? (
              <>
                <span className="status-dot"></span>
                {`${address.slice(0, 6)}...${address.slice(-4)}`}
              </>
            ) : (
              'Connect Wallet'
            )}
          </button>
        </div>

        {address ? (
          <button className="refresh-button" onClick={refreshBalances}>
            ↻ Refresh Balances
          </button>
        ) : null}

        {balance && (
          <div className="balance-section">
            <div className="balance-card">
              <span className="balance-label">Balance</span>
              <span className="balance-amount">{balance}</span>
              <span className="balance-currency">ETH</span>
            </div>
          </div>
        )}

        {address && (
          <div className="tokens-section">
            <h2 className="tokens-title">Tokens </h2>
            <div className="add-token">
              <input
                type="text"
                placeholder="Token Contract Address"
                value={newTokenAddress}
                onChange={(e) => setNewTokenAddress(e.target.value)}
              />
              <button onClick={() => addToken(newTokenAddress)}>
                Import Token
              </button>
            </div>

            <div className="tokens-list">
              {tokens.map((token) => (
                <div key={token.address} className="token-card">
                  <div>
                    <span className="token-name">{token.name}</span>
                  </div>
                  <div>
                    <span className="token-address">{token.address}</span>
                  </div>
                  <div>
                    <span className="token-balance">{token.balance}</span>
                    <span className="token-symbol">{token.symbol}</span>
                  </div>
                  <div className="token-actions">
                    <button
                      className="token-action-button"
                      onClick={() => removeToken(token.address)}
                    >
                      Remove
                    </button>
                    <button
                      className="token-action-button"
                      onClick={() => transferToken(token.address)}
                    >
                      Transfer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
