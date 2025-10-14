import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { http, createConfig, WagmiProvider } from 'wagmi'
import { metaMask } from 'wagmi/connectors'
import { silentDataChain } from './utils.ts'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient()

const config = createConfig({
  chains: [silentDataChain],
  connectors: [metaMask()],
  transports: {
    [silentDataChain.id]: http(),
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
