import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from './config'
import { Counter } from './components/Counter';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ToastContainer } from './components/ToastContainer';
import '@rainbow-me/rainbowkit/styles.css'
import { SDProviderSession } from '@appliedblockchain/silentdatarollup-viem-plugin'
import { ToastProvider } from './hooks/useToast'

const queryClient = new QueryClient()

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <ToastProvider>
            <div className="min-h-screen bg-gray-50 flex flex-col">
              <ToastContainer />
              <Header />
              <main className="flex-1 flex items-center justify-center">
                <Counter />
              </main>
              <Footer />
              <SDProviderSession />
            </div>
          </ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;