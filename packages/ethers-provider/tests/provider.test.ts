import { afterAll, beforeAll, describe, expect } from '@jest/globals'
import {
  HEADER_DELEGATE,
  HEADER_DELEGATE_SIGNATURE,
  HEADER_EIP712_DELEGATE_SIGNATURE,
  HEADER_EIP712_SIGNATURE,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
  NetworkName,
  SignatureType,
  eip721Domain,
  getAuthEIP721Types,
  delegateEIP721Types,
  DelegateSignerMessage,
  SIGN_RPC_METHODS,
} from '@appliedblockchain/silentdatarollup-core'
import {
  createCustomRpcServer,
  RequestData,
} from '@appliedblockchain/silentdatarollup-core/tests'
import { JsonRpcPayload, Wallet, verifyMessage, verifyTypedData } from 'ethers'
import http from 'http'
import { SilentDataRollupProvider } from '../src/provider'
import { SilentDataRollupProviderConfig } from '../src/types'

describe('SilentDataRollupProvider', () => {
  let customRpcServer: http.Server,
    getNextRequest: (method: string) => Promise<RequestData>,
    customRpcUrl: string
  let provider: SilentDataRollupProvider
  const wallet = Wallet.createRandom()
  const NETWORK = NetworkName.TESTNET
  // Valid transaction hash for testing eth_getTransactionReceipt
  const TEST_TX_HASH =
    '0x68ea69fd8b5dfa589a7a983c324ab153a33356320207885a9bba84425598dcaa'

  beforeAll(async () => {
    ;({ customRpcServer, getNextRequest, customRpcUrl } =
      await createCustomRpcServer())
  })

  afterAll((done) => {
    customRpcServer.close(done)
  })

  describe('Headers', () => {
    const testCases = [
      {
        name: 'Raw Signature',
        config: { authSignatureType: SignatureType.Raw, delegate: false },
        expectedHeaders: {
          eth_getTransactionReceipt: [HEADER_TIMESTAMP, HEADER_SIGNATURE],
          eth_blockNumber: [],
        },
      },
      {
        name: 'EIP712 Signature',
        config: { authSignatureType: SignatureType.EIP712, delegate: false },
        expectedHeaders: {
          eth_getTransactionReceipt: [
            HEADER_TIMESTAMP,
            HEADER_EIP712_SIGNATURE,
          ],
          eth_blockNumber: [],
        },
      },
      {
        name: 'Raw Signature with Delegate',
        config: {
          authSignatureType: SignatureType.Raw,
          delegate: true,
        },
        expectedHeaders: {
          eth_getTransactionReceipt: [
            HEADER_TIMESTAMP,
            HEADER_SIGNATURE,
            HEADER_DELEGATE,
            HEADER_DELEGATE_SIGNATURE,
          ],
          eth_blockNumber: [],
        },
      },
      {
        name: 'EIP712 Signature with Delegate',
        config: { authSignatureType: SignatureType.EIP712, delegate: true },
        expectedHeaders: {
          eth_getTransactionReceipt: [
            HEADER_TIMESTAMP,
            HEADER_EIP712_SIGNATURE,
            HEADER_DELEGATE,
            HEADER_EIP712_DELEGATE_SIGNATURE,
          ],
          eth_blockNumber: [],
        },
      },
    ]

    test.each<{
      name: string
      config: Partial<SilentDataRollupProviderConfig>
      expectedHeaders: { [method: string]: string[] }
    }>(testCases)('$name', async ({ config, expectedHeaders }) => {
      const providerConfig: SilentDataRollupProviderConfig = {
        rpcUrl: customRpcUrl,
        network: NETWORK,
        privateKey: wallet.privateKey,
        ...config,
      }
      provider = new SilentDataRollupProvider(providerConfig)
      const { chainId } = await provider.getNetwork()
      for (const [method, expectedHeadersList] of Object.entries(
        expectedHeaders,
      )) {
        const requestDataPromise = getNextRequest(method)
        if (method === 'eth_getTransactionReceipt') {
          await provider.getTransactionReceipt(TEST_TX_HASH)
        } else if (method === 'eth_blockNumber') {
          await provider.getBlockNumber()
        }
        const requestData = await requestDataPromise

        if (SIGN_RPC_METHODS.includes(requestData.requestBody.method)) {
          let recoveredSignerAddress: string | undefined
          if (expectedHeadersList.includes(HEADER_SIGNATURE)) {
            const timestamp = requestData.headers[HEADER_TIMESTAMP]
            const payload =
              chainId.toString() +
              JSON.stringify(requestData.requestBody) +
              timestamp

            const signature = requestData.headers[HEADER_SIGNATURE]
            recoveredSignerAddress = verifyMessage(payload, signature as string)
          }

          if (expectedHeadersList.includes(HEADER_EIP712_SIGNATURE)) {
            const timestamp = requestData.headers[HEADER_TIMESTAMP]
            const signature = requestData.headers[HEADER_EIP712_SIGNATURE]
            const types = getAuthEIP721Types(requestData.requestBody)

            const preparePayload = (p: JsonRpcPayload) => ({
              ...p,
              params: JSON.stringify(p.params),
            })

            const preparedPayload = Array.isArray(requestData.requestBody)
              ? requestData.requestBody.map(preparePayload)
              : preparePayload(requestData.requestBody)

            const message = {
              request: preparedPayload,
              timestamp,
            }

            recoveredSignerAddress = verifyTypedData(
              { ...eip721Domain, chainId },
              types,
              message,
              signature as string,
            )
          }

          let recoveredDelegateSignerAddress: string | undefined
          if (expectedHeadersList.includes(HEADER_DELEGATE)) {
            const xDelegate: DelegateSignerMessage = JSON.parse(
              requestData.headers[HEADER_DELEGATE]! as string,
            )

            if (expectedHeadersList.includes(HEADER_DELEGATE_SIGNATURE)) {
              const signature = requestData.headers[HEADER_DELEGATE_SIGNATURE]
              const signedMessage =
                chainId.toString() +
                (requestData.headers[HEADER_DELEGATE] as string)
              recoveredDelegateSignerAddress = verifyMessage(
                signedMessage,
                signature as string,
              )
            } else if (
              expectedHeadersList.includes(HEADER_EIP712_DELEGATE_SIGNATURE)
            ) {
              const signature =
                requestData.headers[HEADER_EIP712_DELEGATE_SIGNATURE]

              recoveredDelegateSignerAddress = verifyTypedData(
                { ...eip721Domain, chainId },
                delegateEIP721Types,
                xDelegate,
                signature as string,
              )
            }

            // The delegate message should be signed by the original signer
            expect(recoveredDelegateSignerAddress).toBe(wallet.address)

            // If delegate is used, the recovered signer address should be the delegate's address
            expect(recoveredSignerAddress).toBe(xDelegate.ephemeralAddress)

            // Test that the signature was delegated to another signer
            expect(recoveredSignerAddress).not.toBe(
              recoveredDelegateSignerAddress,
            )
          } else {
            // If delegate is not used, the recovered signer address should be the original signer's address
            expect(recoveredSignerAddress).toBe(wallet.address)
          }
        }
      }
    })
  })
})
