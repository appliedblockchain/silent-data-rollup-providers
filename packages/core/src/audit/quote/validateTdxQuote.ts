// validateTdxQuote.ts
//
// Copyright 2025 - Based on github.com/google/go-tdx-guest (Apache-2.0).
// Modifications (c) Applied Blockchain

import * as x509 from '@peculiar/x509'

import * as validate from './validate'
import * as verify from './verify'
import * as quote from './quoteStructs'

import * as util from './base64-utils'
import * as pck from './pck'

export const CA_ROOT_PEM = `
-----BEGIN CERTIFICATE-----
MIICjzCCAjSgAwIBAgIUImUM1lqdNInzg7SVUr9QGzknBqwwCgYIKoZIzj0EAwIw
aDEaMBgGA1UEAwwRSW50ZWwgU0dYIFJvb3QgQ0ExGjAYBgNVBAoMEUludGVsIENv
cnBvcmF0aW9uMRQwEgYDVQQHDAtTYW50YSBDbGFyYTELMAkGA1UECAwCQ0ExCzAJ
BgNVBAYTAlVTMB4XDTE4MDUyMTEwNDUxMFoXDTQ5MTIzMTIzNTk1OVowaDEaMBgG
A1UEAwwRSW50ZWwgU0dYIFJvb3QgQ0ExGjAYBgNVBAoMEUludGVsIENvcnBvcmF0
aW9uMRQwEgYDVQQHDAtTYW50YSBDbGFyYTELMAkGA1UECAwCQ0ExCzAJBgNVBAYT
AlVTMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEC6nEwMDIYZOj/iPWsCzaEKi7
1OiOSLRFhWGjbnBVJfVnkY4u3IjkDYYL0MxO4mqsyYjlBalTVYxFP2sJBK5zlKOB
uzCBuDAfBgNVHSMEGDAWgBQiZQzWWp00ifODtJVSv1AbOScGrDBSBgNVHR8ESzBJ
MEegRaBDhkFodHRwczovL2NlcnRpZmljYXRlcy50cnVzdGVkc2VydmljZXMuaW50
ZWwuY29tL0ludGVsU0dYUm9vdENBLmRlcjAdBgNVHQ4EFgQUImUM1lqdNInzg7SV
Ur9QGzknBqwwDgYDVR0PAQH/BAQDAgEGMBIGA1UdEwEB/wQIMAYBAf8CAQEwCgYI
KoZIzj0EAwIDSQAwRgIhAOW/5QkR+S9CiSDcNoowLuPRLsWGf/Yi7GSX94BgwTwg
AiEA4J0lrHoMs+Xo5o/sX6O9QWxHRAvZUGOdRQ7cvqRXaqI=
-----END CERTIFICATE-----
`

export interface Collateral {
  fmspc: string
  issuerChain: string
}

export const ErrCertificationDataNil = new Error('certification data is nil')
export const ErrQeReportCertificationDataNil = new Error(
  'QE Report certification data is nil',
)
export const ErrQeAuthDataNil = new Error('QE AuthData is nil')
export const ErrCertNil = new Error('certificate is nil')
export const ErrParentCertNil = new Error('parent certificate is nil')
export const ErrCertPubKeyType = new Error(
  'certificate public key is not of type ecdsa public key',
)
export const ErrRootCaCertExpired = new Error(
  'root CA certificate in PCK certificate chain has expired',
)
export const ErrPublicKeySize = new Error('public key is of unexpected size')
export const ErrPckExtInvalid = new Error(
  "unexpected leftover bytes for PCK certificate's extension",
)
export const ErrSgxExtInvalid = new Error(
  'unexpected leftover bytes when parsing SGX extensions',
)
export const ErrTcbExtInvalid = new Error(
  'unexpected leftover bytes for TCB extension inside SGX extension field',
)
export const ErrTcbCompInvalid = new Error(
  'unexpected leftover bytes for TCB components in TCB Extension inside SGX extension field',
)

export const quoteBodyStart = 0x30
export const quoteBodyEnd = 0x278
export const quoteSignedDataSizeStart = 0x278
export const quoteSignedDataSizeEnd = 0x27c
export const quoteSignedDataStart = quoteSignedDataSizeEnd

export const signedDataSignatureStart = 0x00
export const signedDataSignatureEnd = 0x40
export const signedDataAttestationKeyStart = signedDataSignatureEnd
export const signedDataAttestationKeyEnd = 0x80
export const signedDataCertificationDataStart = signedDataAttestationKeyEnd

export const certificateDataTypeStart = 0x00
export const certificateDataTypeEnd = 0x02
export const certificateSizeStart = certificateDataTypeEnd
export const certificateSizeEnd = 0x06
export const certificateDataStart = certificateSizeEnd

export const qeReportCertificationDataType = 0x6
export const signatureSize = 0x40

export const enclaveReportStart = 0x00
export const enclaveReportEnd = 0x180

export const qeReportCertificationDataSignatureStart = enclaveReportEnd
export const qeReportCertificationDataSignatureEnd = 0x1c0
export const qeReportCertificationDataAuthDataStart =
  qeReportCertificationDataSignatureEnd
export const authDataParsedDataSizeStart = 0x00
export const authDataParsedDataSizeEnd = 0x02
export const authDataStart = authDataParsedDataSizeEnd
export const attestationKeySize = 0x40

// Strings and identifiers
export const certificateType = 'CERTIFICATE'

export const pubKeySize = 64

export interface RootOfTrust {
  cabundles?: string[]
  checkCrl?: boolean
  getCollateral?: boolean
}

export async function getTrustedRoots(
  rot: RootOfTrust,
): Promise<verify.CertPool | null> {
  const inlines = rot.cabundles ?? []

  if (inlines.length === 0) return null

  const pool: verify.CertPool = []

  for (const pemString of inlines) {
    const cert = new x509.X509Certificate(pemString)
    pool.push(cert)
  }

  return pool
}

export async function rootOfTrustToVerifyOptions(
  rot: RootOfTrust,
): Promise<verify.VerifyOptions> {
  return {
    checkRevocations: !!rot.checkCrl,
    getCollateral: !!rot.getCollateral,
    trustedRoots: (await getTrustedRoots(rot)) ?? undefined,
  }
}

export function headerToProto(buf: Uint8Array): quote.Header {
  if (buf.length !== 48) throw new Error('header must be 48 bytes')
  return {
    version: util.leU16(buf, 0),
    attestationKeyType: util.leU16(buf, 2),
    teeType: util.leU32(buf, 4),
    pceSvn: buf.slice(8, 10),
    qeSvn: buf.slice(10, 12),
    qeVendorId: buf.slice(12, 28),
    userData: buf.slice(28, 48),
  }
}

export function tdQuoteBodyToProto(buf: Uint8Array): quote.TDQuoteBody {
  if (buf.length !== 0x248) throw new Error('TDQuoteBody must be 0x248 bytes')
  const body: quote.TDQuoteBody = {
    teeTcbSvn: buf.slice(0x00, 0x10),
    mrSeam: buf.slice(0x10, 0x40),
    mrSignerSeam: buf.slice(0x40, 0x70),
    seamAttributes: buf.slice(0x70, 0x78),
    tdAttributes: buf.slice(0x78, 0x80),
    xfam: buf.slice(0x80, 0x88),
    mrTd: buf.slice(0x88, 0xb8),
    mrConfigId: buf.slice(0xb8, 0xe8),
    mrOwner: buf.slice(0xe8, 0x118),
    mrOwnerConfig: buf.slice(0x118, 0x148),
    rtmrs: [
      buf.slice(0x148, 0x178),
      buf.slice(0x178, 0x1a8),
      buf.slice(0x1a8, 0x1d8),
      buf.slice(0x1d8, 0x208),
    ],
    reportData: buf.slice(0x208, 0x248),
  }
  return body
}

export function signedDataToProto(
  b: Uint8Array,
): quote.Ecdsa256BitQuoteV4AuthData {
  const data = b.slice() // defensive clone

  const signedData: quote.Ecdsa256BitQuoteV4AuthData = {
    signature: data.slice(signedDataSignatureStart, signedDataSignatureEnd),
    ecdsaAttestationKey: data.slice(
      signedDataAttestationKeyStart,
      signedDataAttestationKeyEnd,
    ),
    certificationData: certificationDataToProto(
      data.slice(signedDataCertificationDataStart),
    ),
  }

  checkEcdsa256BitQuoteV4AuthData(signedData) // throws if invalid

  return signedData
}

export function checkEcdsa256BitQuoteV4AuthData(
  signedData: quote.Ecdsa256BitQuoteV4AuthData,
): void {
  if (!signedData) {
    throw quote.ErrQuoteV4AuthDataNil
  }

  if (signedData.signature.length !== signatureSize) {
    throw new Error(
      `signature size is ${signedData.signature.length} bytes. Expected ${signatureSize} bytes`,
    )
  }

  if (signedData.ecdsaAttestationKey.length !== attestationKeySize) {
    throw new Error(
      `ecdsa attestation key size is ${signedData.ecdsaAttestationKey.length} bytes. Expected ${attestationKeySize} bytes`,
    )
  }

  checkCertificationData(signedData.certificationData)
}

export function checkCertificationData(
  certification: quote.CertificationData,
): void {
  if (!certification) {
    throw ErrCertificationDataNil
  }

  const { certificateDataType } = certification

  if (certificateDataType >= 1 << 16) {
    throw new Error(
      `certification data type field size must fit in 2 bytes, got ${certificateDataType}`,
    )
  }

  if (certificateDataType !== qeReportCertificationDataType) {
    throw new Error(
      `certification data type invalid, got ${certificateDataType}, expected ${qeReportCertificationDataType}`,
    )
  }

  checkQeReportCertificationData(certification.qeReportCertificationData!)
}

export function checkQeReportCertificationData(
  qeReport: quote.QEReportCertificationData,
): void {
  if (!qeReport) {
    throw ErrQeReportCertificationDataNil
  }

  quote.checkQeReport(qeReport.qeReport!) //throws if invalid

  if (qeReport.qeReportSignature!.length !== signatureSize) {
    throw new Error(
      `signature size is ${qeReport.qeReportSignature!.length} bytes. Expected ${signatureSize} bytes`,
    )
  }

  checkQeAuthData(qeReport.qeAuthData!) // throws if invalid
  pck.checkPCKCertificateChain(qeReport.pckCertificateChainData!) // throws if invalid
}

export function checkQeAuthData(authData: quote.QeAuthData): void {
  if (!authData) {
    throw ErrQeAuthDataNil
  }

  const { parsedDataSize, data } = authData

  if (parsedDataSize >= 1 << 16) {
    throw new Error(
      `parsed data size field must fit in 2 bytes, got ${parsedDataSize}`,
    )
  }

  if (parsedDataSize !== data.length) {
    throw new Error(
      `parsed data size is ${data.length} bytes. Expected ${parsedDataSize} bytes`,
    )
  }
}

export function certificationDataToProto(
  b: Uint8Array,
): quote.CertificationData {
  const data = b.slice() // Defensive copy

  const certificateDataType = new DataView(
    data.buffer,
    data.byteOffset,
    data.byteLength,
  ).getUint16(certificateDataTypeStart, true)

  const size = new DataView(
    data.buffer,
    data.byteOffset,
    data.byteLength,
  ).getUint32(certificateSizeStart, true)

  const rawCertificateData = data.slice(certificateDataStart)

  if (rawCertificateData.length !== size) {
    throw new Error(
      `size of certificate data is 0x${rawCertificateData.length.toString(16)}. Expected size 0x${size.toString(16)}`,
    )
  }

  const qeReportCertificationData =
    qeReportCertificationDataToProto(rawCertificateData)

  const certification: quote.CertificationData = {
    certificateDataType,
    size,
    qeReportCertificationData,
  }

  checkCertificationData(certification) // throws if invalid

  return certification
}

export function qeReportCertificationDataToProto(
  b: Uint8Array,
): quote.QEReportCertificationData {
  const data = b.slice() // defensive clone
  const qeReportCertificationData: quote.QEReportCertificationData = {}

  // Parse the EnclaveReport
  const enclaveReport = quote.enclaveReportToProto(
    data.slice(enclaveReportStart, enclaveReportEnd),
  )
  qeReportCertificationData.qeReport = enclaveReport

  // Parse the QE Report Signature
  qeReportCertificationData.qeReportSignature = data.slice(
    qeReportCertificationDataSignatureStart,
    qeReportCertificationDataSignatureEnd,
  )

  // Parse AuthData (returns both object and length consumed)
  const { authData, authDataSize } = qeAuthDataToProto(
    data.slice(qeReportCertificationDataAuthDataStart),
  )
  qeReportCertificationData.qeAuthData = authData

  // Parse PCK Certificate Chain starting after authData
  const pckCertStart = qeReportCertificationDataAuthDataStart + authDataSize
  const pckCertChain = pck.pckCertificateChainToProto(data.slice(pckCertStart))
  qeReportCertificationData.pckCertificateChainData = pckCertChain

  // Final validation
  checkQeReportCertificationData(qeReportCertificationData)

  return qeReportCertificationData
}

export function qeAuthDataToProto(b: Uint8Array): {
  authData: quote.QeAuthData
  authDataSize: number
} {
  const data = b.slice() // Defensive copy

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const parsedDataSize = view.getUint16(authDataParsedDataSizeStart, true) // 2 bytes (little-endian)

  const authDataStart = authDataParsedDataSizeEnd
  const authDataEnd = authDataStart + parsedDataSize

  const authData: quote.QeAuthData = {
    parsedDataSize,
    data: data.slice(authDataStart, authDataEnd),
  }

  checkQeAuthData(authData) // throws if invalid

  return {
    authData,
    authDataSize: authDataEnd,
  }
}

export function quoteToProtoV4(buf: Uint8Array): quote.QuoteV4 {
  if (buf.length < 0x3fc) {
    throw new Error('quote too small - min 0x3fc')
  }
  const header = headerToProto(buf.slice(0x00, 0x30))
  const body = tdQuoteBodyToProto(buf.slice(0x30, 0x278))
  const signedDataSize = util.leU32(buf, 0x278)
  const signedDataStart = 0x27c
  if (buf.length < signedDataStart + signedDataSize)
    throw new Error('signedDataSize exceeds buffer')
  const signedData = signedDataToProto(
    buf.slice(signedDataStart, signedDataStart + signedDataSize),
  )
  const extra = buf.slice(signedDataStart + signedDataSize)
  return {
    header,
    tdQuoteBody: body,
    signedDataSize,
    signedData,
    extraBytes: extra.length ? extra : undefined,
  }
}

export function determineQuoteFormat(buf: Uint8Array): number {
  if (buf.length < 2) throw new Error('buffer too small to detect format')
  return util.leU16(buf)
}

export function quoteToProto(buf: Uint8Array): quote.QuoteV4 {
  const version = determineQuoteFormat(buf)
  if (version !== quote.intelQuoteV4Version) {
    throw new Error('unsupported quote version')
  }
  return quoteToProtoV4(buf)
}

export function localValidateTdxQuote(
  quote: unknown,
  opts: validate.ValidateOptions,
): void {
  if (!opts) {
    throw verify.ErrOptionsNil
  }
  if (!quote || (quote as quote.QuoteV4).tdQuoteBody === undefined) {
    throw new Error('unsupported quote type')
  }
  validate.validateTdxQuoteV4(quote as quote.QuoteV4, opts)
}

interface X509VerifyOptions {
  roots: x509.X509Certificate[]
  intermediates: x509.X509Certificate[]
  currentTime: Date
}

export function createX509VerifyOptions(
  trustedRoots: x509.X509Certificate[] | null,
  intermediateCert: x509.X509Certificate | null,
  now: Date,
): X509VerifyOptions {
  if (!trustedRoots || trustedRoots.length === 0) {
    trustedRoots = [pck.trustedRootCertificate!]
  }

  const intermediates: x509.X509Certificate[] = []
  if (intermediateCert) {
    intermediates.push(intermediateCert)
  }

  return {
    roots: trustedRoots,
    intermediates,
    currentTime: now,
  }
}

export function signatureToDER(sig: Uint8Array): Uint8Array {
  if (sig.length !== 0x40) throw new Error('signature must be 64 bytes')
  const r = trimLeadingZeros(sig.slice(0, 32))
  const s = trimLeadingZeros(sig.slice(32))
  const seqLen = 2 + r.length + 2 + s.length
  const out = new Uint8Array(2 + seqLen)
  out.set([0x30, seqLen], 0)
  out.set([0x02, r.length], 2)
  out.set(r, 4)
  out.set([0x02, s.length], 4 + r.length)
  out.set(s, 6 + r.length)
  return out
}

function trimLeadingZeros(arr: Uint8Array): Uint8Array {
  let i = 0
  while (i < arr.length - 1 && arr[i] === 0) {
    ++i
  }
  return arr.slice(i)
}

export const Quote = {
  toProto: quoteToProto,
  validate: localValidateTdxQuote,
  verify: verify.localVerifyTdxQuote,
}
