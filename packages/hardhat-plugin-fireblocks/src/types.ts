import { SignatureType } from '@appliedblockchain/silentdatarollup-core'

export interface SilentdataNetworkConfig {
  authSignatureType?: SignatureType
  maxRetries?: number
  pollingInterval?: number
}
