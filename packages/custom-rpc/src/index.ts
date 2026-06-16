#!/usr/bin/env node

import 'dotenv/config'
import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import bodyParser from 'body-parser'
import { JsonRpcProvider } from 'ethers'
import {
  HEADER_DELEGATE,
  HEADER_DELEGATE_SIGNATURE,
  HEADER_EIP712_DELEGATE_SIGNATURE,
  HEADER_EIP712_SIGNATURE,
  HEADER_SIGNATURE,
  HEADER_SIGNATURE_TYPE,
  HEADER_SIGNER_SWC,
  HEADER_SIGNER_SWC_TYPE,
  HEADER_TIMESTAMP,
} from '@appliedblockchain/silentdatarollup-core'
import { HEADER_SIGNER_SWC_VERSION } from './constants'
import { handleRpcRequest } from './middleware'

const CUSTOM_RPC_PORT = process.env.CUSTOM_RPC_PORT || 54321
const CUSTOM_RPC_PROXY_URL =
  process.env.CUSTOM_RPC_PROXY_URL || 'http://localhost:8545'

const provider = new JsonRpcProvider(CUSTOM_RPC_PROXY_URL)

// Cache the chain id (used for signature verification) after the first lookup.
let cachedChainId: bigint | null = null
async function getChainId(): Promise<bigint> {
  if (cachedChainId === null) {
    cachedChainId = (await provider.getNetwork()).chainId
  }
  return cachedChainId
}

const ALLOWED_HEADERS = [
  'Content-Type',
  'Content-Length',
  'Accept-Encoding',
  'X-CSRF-Token',
  'Authorization',
  'accept',
  'origin',
  'Cache-Control',
  'X-Requested-With',
  HEADER_TIMESTAMP,
  HEADER_SIGNATURE,
  HEADER_DELEGATE,
  HEADER_DELEGATE_SIGNATURE,
  HEADER_EIP712_DELEGATE_SIGNATURE,
  HEADER_EIP712_SIGNATURE,
  HEADER_SIGNER_SWC,
  HEADER_SIGNER_SWC_TYPE,
  HEADER_SIGNER_SWC_VERSION,
  HEADER_SIGNATURE_TYPE,
].join(', ')

const app = express()

app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Credentials', 'true')
  res.header('Access-Control-Allow-Headers', ALLOWED_HEADERS)
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS, GET, PUT')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204)
  }
  next()
})

app.use(bodyParser.raw({ type: '*/*' }))

// Token may be supplied in the URL path (ignored — the firewall has no token
// concept) or omitted entirely. Both `/` and `/:urlToken` are handled.
app.post('/:urlToken?', async (req: Request, res: Response) => {
  try {
    const bodyString = Buffer.isBuffer(req.body) ? req.body.toString() : ''
    const chainId = await getChainId()
    const result = await handleRpcRequest(
      provider,
      chainId,
      CUSTOM_RPC_PROXY_URL,
      req.headers,
      bodyString,
    )
    return res.status(result.status).json(result.body)
  } catch (err) {
    console.error('Unhandled error in custom-rpc handler:', err)
    return res.status(500).json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -1, message: 'An error occurred', data: 'Custom RPC' },
    })
  }
})

app.disable('x-powered-by')

app.listen(CUSTOM_RPC_PORT, () => {
  console.log(`Custom RPC listening at http://localhost:${CUSTOM_RPC_PORT}`)
})
