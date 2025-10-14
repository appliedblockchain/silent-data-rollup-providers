import 'dotenv/config'
import { type Hex } from 'viem'

const REQUIRED_ENV_VARS = ['CHAIN_ID', 'PRIVATE_KEY', 'RPC_URL'] as const
REQUIRED_ENV_VARS.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`${envVar} environment variable is required`)
  }
})

export const CHAIN_ID = process.env.CHAIN_ID as string

export const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex

export const RPC_URL = process.env.RPC_URL as string
