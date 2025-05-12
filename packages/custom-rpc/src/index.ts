#!/usr/bin/env node

import 'dotenv/config'
import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import bodyParser from 'body-parser'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { JsonRpcProvider } from 'ethers'
import { createRpcValidationMiddleware } from './middleware'
import {
  HEADER_TIMESTAMP,
  HEADER_SIGNATURE,
  HEADER_DELEGATE,
  HEADER_DELEGATE_SIGNATURE,
  HEADER_EIP712_DELEGATE_SIGNATURE,
  HEADER_EIP712_SIGNATURE,
} from '@appliedblockchain/silentdatarollup-core'

const CUSTOM_RPC_PORT = process.env.CUSTOM_RPC_PORT || 54321
const CUSTOM_RPC_PROXY_URL =
  process.env.CUSTOM_RPC_PROXY_URL || 'http://localhost:8545'

const provider = new JsonRpcProvider(CUSTOM_RPC_PROXY_URL)

const app = express()

app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Credentials', 'true')
  res.header(
    'Access-Control-Allow-Headers',
    `Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, ${HEADER_TIMESTAMP}, ${HEADER_SIGNATURE}, ${HEADER_DELEGATE}, ${HEADER_DELEGATE_SIGNATURE}, ${HEADER_EIP712_DELEGATE_SIGNATURE}, ${HEADER_EIP712_SIGNATURE}`,
  )
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS, GET, PUT')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204)
  }
  next()
})

app.use(bodyParser.raw({ type: '*/*' }))

app.use(createRpcValidationMiddleware(provider))

app.use(
  createProxyMiddleware<Request, Response>({
    target: CUSTOM_RPC_PROXY_URL,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq, req) => {
        if (req.body) {
          const bodyData = JSON.stringify(req.body)
          console.log(`Proxying request with body: ${bodyData}`)
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData))
          proxyReq.write(bodyData)
        }
      },
    },
  }),
)

app.disable('x-powered-by')

app.listen(CUSTOM_RPC_PORT, () => {
  console.log(`Custom RPC listening at http://localhost:${CUSTOM_RPC_PORT}`)
})
