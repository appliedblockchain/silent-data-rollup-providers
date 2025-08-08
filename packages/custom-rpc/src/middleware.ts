import {
  WHITELISTED_METHODS,
  SIGN_RPC_METHODS,
} from '@appliedblockchain/silentdatarollup-core'
import { type NextFunction, type Request, type Response } from 'express'
import { type JsonRpcProvider } from 'ethers'
import { recoverSigner, validateMethodAccess } from './signatures'
import { validateTransactionMethod } from './transactions'

function errorResponse(
  id: string,
  jsonrpc: string,
): {
  id: string
  jsonrpc: string
  error: {
    code: number
    message: string
    data: string
  }
} {
  return {
    id,
    jsonrpc,
    error: {
      code: -1,
      message: 'An error occurred',
      data: 'An error occurred',
    },
  }
}

function parseRpcRequest(req: Request): {
  rpcRequest: {
    method: string
    id: string
    jsonrpc: string
    params: any[]
  } | null
  bodyString: string
} {
  let rpcRequest: any = null
  let bodyString: string = ''

  if (req.method !== 'POST') {
    return { rpcRequest: null, bodyString }
  }

  try {
    bodyString = req.body.toString()
    rpcRequest = JSON.parse(bodyString)
    req.body = rpcRequest
  } catch {
    return { rpcRequest: null, bodyString }
  }

  if (
    !rpcRequest ||
    typeof rpcRequest !== 'object' ||
    !('method' in rpcRequest) ||
    !('id' in rpcRequest) ||
    !('jsonrpc' in rpcRequest)
  ) {
    return { rpcRequest: null, bodyString }
  }

  return {
    rpcRequest,
    bodyString,
  }
}

export function createRpcValidationMiddleware(
  provider: JsonRpcProvider,
): (req: Request, res: Response, next: NextFunction) => void {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { rpcRequest, bodyString } = parseRpcRequest(req)
    if (!rpcRequest) {
      next()
      return
    }

    const { method, id, jsonrpc, params } = rpcRequest

    console.log(`Received request with method: ${method}`)

    if (!WHITELISTED_METHODS.includes(method)) {
      console.log(`Method ${method} is not whitelisted`)
      return res.status(403).json(errorResponse(id, jsonrpc))
    }

    if (!SIGN_RPC_METHODS.includes(method)) {
      next()
      return
    }
    const { chainId } = await provider.getNetwork()
    const signer = recoverSigner(
      req.headers as Record<string, string>,
      bodyString,
      chainId,
    )

    if (
      ['eth_getTransactionByHash', 'eth_getTransactionReceipt'].includes(method)
    ) {
      const transaction = await validateTransactionMethod(
        provider,
        method,
        params,
        signer,
      )

      console.log(`Sending transaction response for method: ${method}`)
      return res.status(200).json({
        id,
        jsonrpc,
        result: transaction,
      })
    }

    if (!validateMethodAccess(method, params, signer)) {
      console.log(`Failed to validate method access for method: ${method}`)
      return res.status(403).json(errorResponse(id, jsonrpc))
    }

    next()
  }
}
