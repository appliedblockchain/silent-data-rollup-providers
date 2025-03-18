import { SilentDataRollupContract } from '@appliedblockchain/silentdatarollup-core'
import { SilentDataRollupProvider } from '@appliedblockchain/silentdatarollup-ethers-provider'
import { BrowserProvider, formatUnits, Wallet } from 'ethers'
import { useEffect, useState, useRef } from 'react'
import { ERC20_ABI } from './constants/erc20Abi'
import './App.css'

declare global {
  interface Window {
    ethereum?: any
  }
}

interface Token {
  address: string
  name: string
  symbol: string
  balance: string
}

const STORAGE_NAMESPACE = 'silentdata-rollup:'
const TOKENS_STORAGE_KEY = `${STORAGE_NAMESPACE}tokens`

localStorage.debug = 'silentdata:*'

function useSilentDataProvider() {
  const providerRef = useRef<{
    provider: SilentDataRollupProvider
    signer: any
  } | null>(null)

  const createProvider = async () => {
    if (!providerRef.current) {
      const browserProvider = new BrowserProvider(window.ethereum)
      const signer = await browserProvider.getSigner()

      providerRef.current = {
        signer,
        provider: new SilentDataRollupProvider({
          rpcUrl: process.env.REACT_APP_ROLLUP_RPC_URL!,
          chainId: Number(process.env.REACT_APP_CHAIN_ID!),
          // @ts-expect-error - signer is a Signer
          signer: signer,
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
      setBalance(balance.toString())
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
      const { signer, provider } = await createProvider()
      const address = await signer.getAddress()
      setAddress(address)
      await getBalance(address)

      await Promise.all(
        tokens.map(async (token) => {
          try {
            const tokenContract = new SilentDataRollupContract(
              token.address,
              ERC20_ABI,
              // @ts-expect-error - provider is a SilentDataRollupProvider
              provider,
              ['balanceOf'],
            )

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
      const tokenContract = new SilentDataRollupContract(
        tokenAddress,
        ERC20_ABI,
        // @ts-expect-error - provider is a SilentDataRollupProvider
        provider,
        ['balanceOf'],
      )

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
      const { signer } = await createProvider()

      const tokenContract = new SilentDataRollupContract(
        tokenAddress,
        ERC20_ABI,
        signer,
        ['transfer'],
      )

      const randomWallet = Wallet.createRandom()

      const transferTx = await tokenContract.transfer(randomWallet.address, 100)

      console.log('transferTx=', transferTx)

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
            const tokenContract = new SilentDataRollupContract(
              token.address,
              ERC20_ABI,
              // @ts-expect-error - provider is a SilentDataRollupProvider
              provider,
              ['balanceOf'],
            )

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
        <button className="refresh-button" onClick={refreshBalances}>
          ↻ Refresh
        </button>
        <h1>Silent Data [Rollup] Wallet</h1>

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
                  <div className="token-info">
                    <span className="token-name">{token.name}</span>
                    <span className="token-symbol">({token.symbol})</span>
                    <span className="token-balance">{token.balance}</span>
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
