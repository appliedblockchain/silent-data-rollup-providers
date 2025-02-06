import { Calculator } from 'lucide-react'
import { ConnectButton } from '@rainbow-me/rainbowkit'


export function Header() {
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto pl-4 pr-0 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="h-6 w-6 text-gray-700" />
          <span className="text-lg font-semibold text-gray-800">Counter App</span>
        </div>
        <ConnectButton chainStatus="icon" />
      </div>
    </header>
  );
} 