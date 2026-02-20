import { SignatureType } from '@appliedblockchain/silentdatarollup-core'

export interface SilentdataNetworkConfig {
  /**
   * Signature type to use for authentication headers.
   * If not provided, defaults to SignatureType.Raw.
   */
  authSignatureType?: SignatureType
}
