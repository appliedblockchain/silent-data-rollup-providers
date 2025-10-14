import { Wallet } from 'ethers'
import { useState, useEffect, useCallback } from 'react'
import { formatEther, parseGwei, type Address } from 'viem'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { getPublicClient, getWalletClient, silentDataChain } from './utils.ts'
import './App.css'

localStorage.debug = 'silentdata:*'

function App() {
  const [balance, setBalance] = useState<string>('')
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  const connectWallet = useCallback(() => {
    try {
      connect({ connector: connectors[0] })
    } catch (error) {
      console.error('Error connecting wallet:', error)
    }
  }, [connect, connectors])

  const disconnectWallet = useCallback(() => {
    disconnect()
    setBalance('')
  }, [disconnect])

  const fetchBalance = useCallback(async () => {
    if (!isConnected || !address) {
      return
    }

    try {
      const publicClient = await getPublicClient()

      const balance = await publicClient.getBalance({
        address,
      })

      setBalance(formatEther(balance))
    } catch (error) {
      console.error('Error fetching balance:', error)
    }
  }, [address, isConnected])

  const transferBalance = useCallback(async () => {
    if (!isConnected || !address) {
      return
    }

    try {
      const walletClient = await getWalletClient(address)

      const randomWallet = Wallet.createRandom()

      await walletClient.sendTransaction({
        to: randomWallet.address as Address,
        value: parseGwei('1'),
        account: address,
        chain: silentDataChain,
      })
    } catch (error) {
      console.error('Error transferring:', error)
    }
  }, [address, isConnected])

  useEffect(() => {
    if (!isConnected || !address) {
      return
    }
    fetchBalance()
  }, [isConnected, address, fetchBalance])

  return (
    <div className="wallet-container">
      <div className="wallet-card">
        <h1>Silent Data Wallet</h1>

        <div className="connect-section">
          {isConnected && address ? (
            <div>
              <button
                className="connect-button connected"
                onClick={disconnectWallet}
              >
                <span className="status-dot"></span>
                {`${address.slice(0, 6)}...${address.slice(-4)}`}
              </button>
            </div>
          ) : (
            <button className="connect-button" onClick={connectWallet}>
              Connect Wallet
            </button>
          )}
        </div>

        {balance && (
          <div className="balance-section">
            <div className="balance-card">
              <span className="balance-label">Balance</span>
              <span className="balance-amount">{balance}</span>
              <span className="balance-currency">ETH</span>
            </div>
            <button className="balance-button" onClick={transferBalance}>
              Transfer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
