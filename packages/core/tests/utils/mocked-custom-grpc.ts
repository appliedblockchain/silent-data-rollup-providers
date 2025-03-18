import { ChainId } from '../../src'
import { JsonRpcPayload } from 'ethers'
import http from 'http'

export interface ResponseBody {
  jsonrpc: string
  id: any
  result?: string
}

export interface RequestData {
  headers: http.IncomingHttpHeaders
  requestBody: JsonRpcPayload
  responseBody: ResponseBody
}

let currentPort = 3000
const CHAIN_ID = ChainId.TESTNET

/**
 * Creates a custom RPC server that can be used to mock requests to a custom RPC server.
 * @param callback - A callback function that is called when the server is ready.
 * @returns An object containing the custom RPC server and a function to get the next request.
 */
export function createCustomRpcServer(
  callback?: () => Promise<{
    customRpcServer: http.Server
    getNextRequest: (method: string) => Promise<RequestData>
    customRpcUrl: string
  }>,
) {
  const port = currentPort++
  const customRpcUrl = `http://localhost:${port}`

  const resolveNextRequest: { [method: string]: (value: RequestData) => void } =
    {}

  const getNextRequest = (method: string): Promise<RequestData> => {
    return new Promise((resolve) => {
      resolveNextRequest[method] = resolve
    })
  }

  return new Promise<{
    customRpcServer: http.Server
    getNextRequest: (method: string) => Promise<RequestData>
    customRpcUrl: string
  }>((resolve) => {
    const customRpcServer = http
      .createServer((req, res) => {
        let body = ''
        req.on('data', (chunk) => {
          body += chunk.toString()
        })
        req.on('end', () => {
          const requestBody = JSON.parse(body)
          const responseBody: ResponseBody = {
            jsonrpc: '2.0',
            id: requestBody.id,
          }

          if (requestBody.method === 'eth_chainId') {
            responseBody.result = `0x${CHAIN_ID.toString(16)}`
          } else {
            // TODO: If we need to implement other methods, we can do it here
            responseBody.result = '0x0'
          }

          const requestData = {
            headers: req.headers,
            requestBody,
            responseBody,
          }

          if (resolveNextRequest[requestBody.method]) {
            resolveNextRequest[requestBody.method](requestData)
            delete resolveNextRequest[requestBody.method]
          }

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(responseBody))
        })
      })
      .listen(port, () => {
        console.log(`Custom RPC server listening on ${customRpcUrl}`)
        if (callback) {
          callback()
        }
        resolve({ customRpcServer, getNextRequest, customRpcUrl })
      })
  })
}
