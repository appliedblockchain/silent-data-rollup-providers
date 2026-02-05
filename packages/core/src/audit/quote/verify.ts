// verify.ts
//
// Copyright 2025 - Based on github.com/google/go-tdx-guest (Apache-2.0).
// Modifications (c) Applied Blockchain

import * as quote from './quoteStructs'
import * as x509 from '@peculiar/x509'
import * as pck from './pck'
import * as tcb from './tcb'
import * as collateral from './collateral'
import * as util from './base64-utils'

// Errors
export const ErrOptionsNil = new Error('options parameter is empty')
export const ErrRootCaCertExpired = new Error(
  'root CA certificate in PCK certificate chain has expired',
)
export const ErrHashVerificationFail = new Error(
  "unable to verify message digest using quote's signature and ecdsa attestation key",
)
export const ErrSHA256VerificationFail = new Error(
  'QE Report Data does not match with value of SHA 256 calculated over the concatenation of ECDSA Attestation Key and QE Authenticated Data',
)

export interface VerifyOptions {
  checkRevocations: boolean
  getCollateral: boolean
  getter?: collateral.HTTPSGetter
  now?: Date
  trustedRoots?: CertPool
  chain?: pck.PCKCertificateChain
  collateral?: collateral.Collateral
  pckCertExtensions?: pck.PckExtensions
}

export type CertPool = x509.X509Certificate[]

export async function extractChainFromQuoteV4(
  quote: quote.QuoteV4,
): Promise<pck.PCKCertificateChain> {
  const certChainBytes =
    quote.signedData?.certificationData?.qeReportCertificationData
      ?.pckCertificateChainData?.pckCertChain

  if (!certChainBytes) throw pck.ErrPckCertChainNil

  const pemString = new TextDecoder().decode(certChainBytes)
  const pemBlocks = x509.PemConverter.decode(pemString)
  if (pemBlocks.length < 3) {
    throw pck.ErrPCKCertChainInvalid
  }

  const pckCert = new x509.X509Certificate(pemBlocks[0])
  const intermediateCert = new x509.X509Certificate(pemBlocks[1])
  const rootCert = new x509.X509Certificate(pemBlocks[2])
  return {
    pckCertificate: pckCert,
    rootCert: rootCert,
    intermediateCerts: intermediateCert,
  }
}

export async function localVerifyTdxQuote(
  aquote: quote.QuoteV4,
  opts: VerifyOptions | undefined | null,
): Promise<pck.PckExtensions> {
  if (!opts) throw ErrOptionsNil

  quote.checkQuoteV4(aquote)
  const chain = await extractChainFromQuoteV4(aquote)
  const exts = await pck.pckCertificateExtensions(chain.pckCertificate)

  let acollateral: collateral.Collateral | undefined
  if (opts.getCollateral) {
    const ca = pck.extractCaFromPckCert(chain.pckCertificate)
    acollateral = await collateral.obtainCollateral(exts.fmspc, ca, opts)
  }

  opts.collateral = acollateral
  opts.pckCertExtensions = exts
  opts.chain = chain
  if (!opts.now) opts.now = new Date()

  await verifyEvidenceV4(aquote, opts)
  return exts
}

export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export function getHeaderAndTdQuoteBodyInAbiBytes(
  aquote: quote.QuoteV4,
): Uint8Array {
  const header = quote.HeaderToAbiBytes(aquote.header)
  if (!header) {
    throw new Error('could not convert header to ABI bytes')
  }

  const tdQuoteBody = quote.TdQuoteBodyToAbiBytes(aquote.tdQuoteBody)
  if (!tdQuoteBody) {
    throw new Error('could not convert TD Quote Body to ABI bytes')
  }

  const combined = new Uint8Array(header.length + tdQuoteBody.length)
  combined.set(header, 0)
  combined.set(tdQuoteBody, header.length)
  return combined
}

export async function verifyEvidenceV4(
  aquote: quote.QuoteV4,
  options: VerifyOptions,
): Promise<void> {
  if (aquote.header.teeType !== quote.TeeTDX) {
    throw new Error('Invalid TEE type in quote (expected TDX)')
  }
  await pck.verifyPCKCertificationChain(options)
  if (options.getCollateral) {
    await collateral.verifyCollateral(options)
    await tcb.verifyTCBinfo(options)
    await tcb.verifyQeIdentity(options)
  }
  await verifyQuote(aquote, options)
}

export async function verifyQuote(
  aquote: quote.QuoteV4,
  options: VerifyOptions,
): Promise<void> {
  const chain = options.chain
  const collateral = options.collateral
  const pckCertExtensions = options.pckCertExtensions
  const attestKey = aquote.signedData?.ecdsaAttestationKey
  if (!attestKey) {
    throw new Error('Missing attestation key in quote')
  }

  const signature = aquote.signedData?.signature
  if (!signature) {
    throw new Error('Missing signature in quote')
  }

  const message = getHeaderAndTdQuoteBodyInAbiBytes(aquote)
  const isValid = await util.verifyEcdsaSignature(attestKey, message, signature)
  if (!isValid) {
    throw ErrHashVerificationFail
  }

  const qeReportCertificationData =
    aquote.signedData?.certificationData?.qeReportCertificationData
  if (!qeReportCertificationData)
    throw new Error('Missing QE report certification data')

  await tdxProtoQeReportSignature(
    qeReportCertificationData,
    chain!.pckCertificate!,
  )

  await verifyHash256(aquote)
  if (collateral) {
    await tcb.verifyTdQuoteBody(aquote.tdQuoteBody, {
      tcbInfo: collateral.tdxTcbInfo.tcbInfo!,
      pckCertExtensions: pckCertExtensions!,
    })
    await verifyQeReport(qeReportCertificationData.qeReport!, {
      qeIdentity: collateral.qeIdentity.enclaveIdentity!,
    })
  }
}

export async function verifyQeReport(
  qeReport: quote.EnclaveReport,
  options: {
    qeIdentity: tcb.EnclaveIdentity
  },
): Promise<void> {
  const { qeIdentity } = options

  const miscSelectMaskBytes = qeIdentity.miscselectMask.bytes
  const miscSelectBytes = qeIdentity.miscselect.bytes

  if (miscSelectMaskBytes.length !== 4) {
    throw new Error(
      `MISCSELECTMask field size (${miscSelectMaskBytes.length}) is not 4`,
    )
  }
  if (miscSelectBytes.length !== 4) {
    throw new Error(
      `MISCSELECT field size (${miscSelectBytes.length}) is not 4`,
    )
  }

  const viewMask = new DataView(
    miscSelectMaskBytes.buffer,
    miscSelectMaskBytes.byteOffset,
    4,
  )
  const viewSelect = new DataView(
    miscSelectBytes.buffer,
    miscSelectBytes.byteOffset,
    4,
  )
  const miscSelectMask = qeReport.miscSelect & viewMask.getUint32(0, true)
  const miscSelect = viewSelect.getUint32(0, true)

  if (miscSelectMask !== miscSelect) {
    throw new Error(
      `MISCSELECT mismatch: expected ${miscSelect}, got masked ${miscSelectMask}`,
    )
  }

  const attrsMask = qeIdentity.attributesMask.bytes
  const reportAttrs = qeReport.attributes

  if (attrsMask.length !== reportAttrs.length) {
    throw new Error(
      `AttributesMask size (${attrsMask.length}) does not match report attributes size (${reportAttrs.length})`,
    )
  }

  const maskedAttrs = tcb.applyMask(attrsMask, reportAttrs)
  const expectedAttrs = qeIdentity.attributes.bytes

  if (!equalBytes(maskedAttrs, expectedAttrs)) {
    throw new Error(
      `Attributes mismatch: masked=${tcb.toHex(maskedAttrs)} expected=${tcb.toHex(expectedAttrs)}`,
    )
  }

  const mrSignerReport = qeReport.mrSigner
  const mrSignerExpected = qeIdentity.mrsigner.bytes

  if (!equalBytes(mrSignerReport, mrSignerExpected)) {
    throw new Error(
      `MRSIGNER mismatch: report=${tcb.toHex(mrSignerReport)} expected=${tcb.toHex(mrSignerExpected)}`,
    )
  }

  if (qeReport.isvProdId !== qeIdentity.isvProdID) {
    throw new Error(
      `ISV PRODID mismatch: report=${qeReport.isvProdId} expected=${qeIdentity.isvProdID}`,
    )
  }

  tcb.checkQeTcbStatus(qeIdentity.tcbLevels, qeReport.isvSvn)
}

export async function verifyHash256(aquote: quote.QuoteV4): Promise<void> {
  const qeReportCertData =
    aquote.signedData?.certificationData?.qeReportCertificationData
  if (!qeReportCertData) throw new Error('missing QE Report certification data')

  const qeReportData = qeReportCertData.qeReport?.reportData
  const qeAuthData = qeReportCertData.qeAuthData?.data
  const attestKey = aquote.signedData?.ecdsaAttestationKey

  if (!qeReportData || !qeAuthData || !attestKey) {
    throw new Error('missing fields for QE report SHA-256 verification')
  }

  // Concatenate attestKey || qeAuthData
  const concat = new Uint8Array(attestKey.length + qeAuthData.length)
  concat.set(attestKey, 0)
  concat.set(qeAuthData, attestKey.length)

  // Compute SHA-256
  const hashBuffer = await x509.cryptoProvider
    .get()
    .subtle.digest('SHA-256', concat)
  let hashedMessage = new Uint8Array(hashBuffer)

  // Pad to match qeReportData length if needed
  if (hashedMessage.length < qeReportData.length) {
    const padded = new Uint8Array(qeReportData.length)
    padded.set(hashedMessage, 0)
    hashedMessage = padded
  }

  if (!equalBytes(hashedMessage, qeReportData)) {
    throw ErrSHA256VerificationFail
  }
}

export async function tdxProtoQeReportSignature(
  qeReportCertificationData: quote.QEReportCertificationData,
  pckCertX509: x509.X509Certificate,
): Promise<void> {
  const rawReport = quote.enclaveReportToAbiBytes(
    qeReportCertificationData.qeReport!,
  )
  if (!rawReport) {
    throw new Error('could not parse QE report')
  }

  await tdxQeReportSignature(
    rawReport,
    qeReportCertificationData.qeReportSignature!,
    pckCertX509,
  )
}

export async function tdxQeReportSignature(
  qeReport: Uint8Array,
  signature: Uint8Array,
  pckCert: x509.X509Certificate,
): Promise<void> {
  const cryptoKey = await x509.cryptoProvider
    .get()
    .subtle.importKey(
      'spki',
      pckCert.publicKey.rawData,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )

  const isValid = await x509.cryptoProvider
    .get()
    .subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      cryptoKey,
      signature,
      qeReport,
    )

  if (!isValid) {
    throw new Error(
      "QE report's signature verification using PCK Leaf Certificate failed",
    )
  }
}
