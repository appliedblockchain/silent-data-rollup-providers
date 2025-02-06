/**
 * @jest-environment node
 */

import { jest } from '@jest/globals'
import { Sender } from '../src/sender'
import { SilentDataRollupProvider } from '../src/provider'
import { DELEGATE_EXPIRATION_THRESHOLD_BUFFER } from '@appliedblockchain/silentdatarollup-core'

jest.mock('../src/provider')

describe('Sender', () => {
  let sender: Sender
  let mockProvider: jest.Mocked<SilentDataRollupProvider>
  let mockBaseProvider: any

  beforeEach(() => {
    jest.clearAllMocks()

    mockBaseProvider = {
      _cachedDelegateHeaders: null,
      _cachedHeadersExpiry: 0,
      get cachedDelegateHeaders() {
        return this._cachedDelegateHeaders
      },
      get cachedHeadersExpiry() {
        return this._cachedHeadersExpiry
      }
    }

    mockProvider = {
      send: jest.fn(),
      baseProvider: mockBaseProvider,
      isSignableContractCall: jest.fn().mockReturnValue(false)
    } as unknown as jest.Mocked<SilentDataRollupProvider>

    sender = new Sender(mockProvider)
  })

  afterEach(() => {
    if (sender?.isSigningSession) {
      sender.isSigningSession = false
    }
    if (sender?.queue) {
      sender.queue = []
    }
  })

  describe('send', () => {
    it('sends non-signable transaction immediately', async () => {
      mockProvider.isSignableContractCall.mockReturnValue(false)
      mockProvider.send.mockResolvedValue('result')

      const result = await sender.send('eth_call', ['0x123'])

      expect(result).toBe('result')
      expect(mockProvider.send).toHaveBeenCalledWith('eth_call', ['0x123'])
      expect(sender.queue).toHaveLength(0)
    })

    it('sends transaction immediately if session is valid', async () => {
      const now = Math.floor(Date.now() / 1000)
      mockBaseProvider._cachedDelegateHeaders = {}
      mockBaseProvider._cachedHeadersExpiry = now + DELEGATE_EXPIRATION_THRESHOLD_BUFFER + 100
      mockProvider.isSignableContractCall.mockReturnValue(true)
      mockProvider.send.mockResolvedValue('result')

      const result = await sender.send('eth_call', [{ to: '0x123', data: '0x456' }])

      expect(result).toBe('result')
      expect(mockProvider.send).toHaveBeenCalledWith('eth_call', [{ to: '0x123', data: '0x456' }])
      expect(sender.queue).toHaveLength(0)
    })

    it('queues request if signing session is in progress', async () => {
      mockBaseProvider._cachedDelegateHeaders = null
      mockProvider.isSignableContractCall.mockReturnValue(true)
      mockProvider.send.mockResolvedValue('queued result')
      sender.isSigningSession = true

      const sendPromise = sender.send('eth_call', [{ to: '0x123', data: '0x456' }])
      
      expect(sender.queue).toHaveLength(1)
      expect(sender.queue[0]).toEqual(expect.objectContaining({
        method: 'eth_call',
        params: [{ to: '0x123', data: '0x456' }]
      }))

      sender.isSigningSession = false
      sender['_processQueue']()

      const result = await sendPromise
      expect(result).toBe('queued result')
      expect(sender.queue).toHaveLength(0)
    })

    it('handles errors in queued requests', async () => {
      mockBaseProvider._cachedDelegateHeaders = null
      mockProvider.isSignableContractCall.mockReturnValue(true)
      mockProvider.send.mockRejectedValue(new Error('Transaction failed'))
      sender.isSigningSession = true

      const sendPromise = sender.send('eth_call', [{ to: '0x123', data: '0x456' }])
      
      expect(sender.queue).toHaveLength(1)
      
      sender.isSigningSession = false
      sender['_processQueue']()

      await expect(sendPromise).rejects.toThrow('Transaction failed')
      expect(sender.queue).toHaveLength(0)
    })

    it('processes multiple queued requests in order', async () => {
      mockBaseProvider._cachedDelegateHeaders = null
      mockProvider.isSignableContractCall.mockReturnValue(true)
      sender.isSigningSession = true

      const requests = [
        { method: 'eth_call', params: [{ to: '0x1', data: '0x123' }] },
        { method: 'eth_call', params: [{ to: '0x2', data: '0x456' }] },
        { method: 'eth_call', params: [{ to: '0x3', data: '0x789' }] }
      ]

      mockProvider.send.mockImplementation((method: string, params: any[] | Record<string, any>) => {
        const txParams = Array.isArray(params) ? params[0] : params
        return Promise.resolve(`result-${(txParams as { to: string }).to}`)
      })

      const promises = requests.map(req => sender.send(req.method, req.params))
      expect(sender.queue).toHaveLength(3)
      
      sender.isSigningSession = false
      sender['_processQueue']()

      const results = await Promise.all(promises)
      expect(results).toEqual(['result-0x1', 'result-0x2', 'result-0x3'])
      expect(sender.queue).toHaveLength(0)
    })

    it('processes errors in queued requests independently', async () => {
      mockBaseProvider._cachedDelegateHeaders = null
      mockProvider.isSignableContractCall.mockReturnValue(true)
      sender.isSigningSession = true

      const requests = [
        { method: 'eth_call', params: [{ to: '0x1', data: '0x123' }] },
        { method: 'eth_call', params: [{ to: '0x2', data: '0x456' }] },
        { method: 'eth_call', params: [{ to: '0x3', data: '0x789' }] }
      ]

      // Mock implementation that fails for the second request
      mockProvider.send.mockImplementation((method: string, params: any[] | Record<string, any>) => {
        const txParams = Array.isArray(params) ? params[0] : params
        if (txParams.to === '0x2') {
          return Promise.reject(new Error('Transaction failed'))
        }
        return Promise.resolve(`result-${txParams.to}`)
      })

      // Send all requests
      const promises = requests.map(req => sender.send(req.method, req.params))
      expect(sender.queue).toHaveLength(3)
      
      // Process queue
      sender.isSigningSession = false
      sender['_processQueue']()

      // Wait for all promises to settle
      const results = await Promise.allSettled(promises)
      
      // Verify results
      const firstResult = results[0] as PromiseFulfilledResult<string>
      expect(firstResult.status).toBe('fulfilled')
      expect(firstResult.value).toBe('result-0x1')
      
      const secondResult = results[1] as PromiseRejectedResult
      expect(secondResult.status).toBe('rejected')
      expect(secondResult.reason.message).toBe('Transaction failed')
      
      const thirdResult = results[2] as PromiseFulfilledResult<string>
      expect(thirdResult.status).toBe('fulfilled')
      expect(thirdResult.value).toBe('result-0x3')
      
      expect(sender.queue).toHaveLength(0)
    })

    it('queue more request while others are already waiting', async () => {
      mockBaseProvider._cachedDelegateHeaders = null
      mockProvider.isSignableContractCall.mockReturnValue(true)
      sender.isSigningSession = true

      // Setup initial requests
      const initialRequests = [
        { method: 'eth_call', params: [{ to: '0x1', data: '0x123' }] },
        { method: 'eth_call', params: [{ to: '0x2', data: '0x456' }] }
      ]

      // Track when send is called
      const sendCalls: { to: string }[] = []
      mockProvider.send.mockImplementation((method: string, params: any[] | Record<string, any>) => {
        const txParams = Array.isArray(params) ? params[0] : params
        return Promise.resolve(`result-${(txParams as { to: string }).to}`)
      })

      // Send initial requests
      const initialPromises = initialRequests.map(req => sender.send(req.method, req.params))
      expect(sender.queue).toHaveLength(2)

      const lateRequest = sender.send('eth_call', [{ to: '0x3', data: '0x789' }])
      expect(sender.queue).toHaveLength(3)

      // Process the late request
      sender.isSigningSession = false
      sender['_processQueue']()

      // Wait for all requests to complete
      const allResults = await Promise.all([...initialPromises, lateRequest])

      // Verify results came in correct order
      expect(allResults).toEqual(['result-0x1', 'result-0x2', 'result-0x3'])
      expect(sender.queue).toHaveLength(0)
    })
  })

  describe('_isSignableContractCall', () => {
    it('delegates to provider.isSignableContractCall', () => {
      mockProvider.isSignableContractCall.mockReturnValue(true)

      const result = sender['_isSignableContractCall']('eth_call', { to: '0x123', data: '0x456' })

      expect(result).toBe(true)
      expect(mockProvider.isSignableContractCall).toHaveBeenCalledWith({
        method: 'eth_call',
        params: { to: '0x123', data: '0x456' }
      })
    })
  })

  describe('_isSessionValid', () => {
    it('returns false if no cached headers', () => {
      mockBaseProvider._cachedDelegateHeaders = null
      expect(sender['_isSessionValid']()).toBe(false)
    })

    it('returns false if headers are expired', () => {
      const now = Math.floor(Date.now() / 1000)
      mockBaseProvider._cachedDelegateHeaders = {}
      mockBaseProvider._cachedHeadersExpiry = now + DELEGATE_EXPIRATION_THRESHOLD_BUFFER - 100
      expect(sender['_isSessionValid']()).toBe(false)
    })

    it('returns true if headers are valid and not expired', () => {
      const now = Math.floor(Date.now() / 1000)
      mockBaseProvider._cachedDelegateHeaders = {}
      mockBaseProvider._cachedHeadersExpiry = now + DELEGATE_EXPIRATION_THRESHOLD_BUFFER + 100
      expect(sender['_isSessionValid']()).toBe(true)
    })
  })
}) 