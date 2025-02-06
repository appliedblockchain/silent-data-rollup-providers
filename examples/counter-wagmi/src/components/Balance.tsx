import { useAccount, useBalance } from 'wagmi'

export const Balance = () => {
  const { address } = useAccount()
  const { data: balance } = useBalance({
    address,
  })

  return (
    <div>
      Balance: {balance?.formatted} {balance?.symbol}
    </div>
  )
} 