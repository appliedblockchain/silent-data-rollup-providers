// tcb.ts
//
// Copyright 2025 - Based on github.com/google/go-tdx-guest (Apache-2.0).
// Modifications (c) Applied Blockchain

import * as pck from './pck'
import * as asn1js from 'asn1js'
import * as quote from './quoteStructs'
import * as util from './base64-utils'
import * as x509 from '@peculiar/x509'
import * as verify from './verify'

export const tcbComponentSize = 16
export const tcbSigningPhrase = 'Intel SGX TCB Signing'
export const tcbInfoID = 'TDX'
export const qeIdentityID = 'TD_QE'
export const qeIdentityVersion = 2.0
export const tcbInfoTdxModuleIDPrefix = 'TDX_'
export const rootCertPhrase = 'Intel SGX Root CA'

export const ErrRootCertNil = new Error('root certificate is empty')
export const ErrCollateralNil = new Error(
  'collateral received is an empty structure',
)
export const ErrTcbInfoTcbLevelsMissing = new Error(
  'tcbInfo contains empty TcbLevels',
)
export const ErrQeIdentityTcbLevelsMissing = new Error(
  'QeIdentity contains empty TcbLevels',
)
export const ErrCrlEmpty = new Error('CRL is empty')
export const ErrTrustedCertEmpty = new Error('trusted certificate is empty')
export const ErrTcbStatus = new Error(
  'unable to find latest status of TCB, it is now OutOfDate',
)

export interface Tcb {
  sgxTcbcomponents: TcbComponent[]
  pcesvn: number // uint16
  tdxTcbcomponents: TcbComponent[]
  isvsvn: number // uint32
}

export interface TcbComponent {
  svn: number // 1 byte
  category: string
  type: string
}

export interface TcbLevel {
  tcb: Tcb
  tcbDate: string
  tcbStatus: TcbComponentStatus
  advisoryIDs: string[]
}

export interface HexBytes {
  bytes: Uint8Array
}

export interface TdxModule {
  mrsigner: HexBytes
  attributes: HexBytes
  attributesMask: HexBytes
}

export interface TcbInfo {
  id: string
  version: number
  issueDate: Date
  nextUpdate: Date
  fmspc: string
  pceID: string
  tcbType: number
  tcbEvaluationDataNumber: number
  tdxModule: TdxModule
  tdxModuleIdentities: TdxModuleIdentity[]
  tcbLevels: TcbLevel[]
}

export interface QeIdentity {
  enclaveIdentity: EnclaveIdentity
  signature: string
}

export interface TdxTcbInfo {
  tcbInfo: TcbInfo
  signature: string
}

export interface TdxModuleIdentity extends TdxModule {
  id: string
  tcbLevels: TcbLevel[]
}

export interface EnclaveIdentity {
  id: string
  version: number
  issueDate: Date
  nextUpdate: Date
  tcbEvaluationDataNumber: number
  miscselect: HexBytes
  miscselectMask: HexBytes
  attributes: HexBytes
  attributesMask: HexBytes
  mrsigner: HexBytes
  isvProdID: number
  tcbLevels: TcbLevel[]
}

export const tcbInfoVersion = 3.0

// Misc
export type TcbComponentStatus =
  | 'UpToDate'
  | 'SWHardeningNeeded'
  | 'ConfigurationNeeded'
export const TcbComponentStatusUpToDate: TcbComponentStatus = 'UpToDate'

export const tcbExtensionSize = 18

export function sgxTcbComponentOid(component: number): string {
  return [...pck.sgxTcbComponentOidPrefix, component].join('.')
}

export function extractTcbExtension(
  components: asn1js.AsnType[],
  atcb: pck.PckCertTCB,
): void {
  const tcbComponents = new Uint8Array(tcbComponentSize)

  for (const ext of components) {
    if (!(ext instanceof asn1js.Sequence))
      throw new Error('TCB component is not a SEQUENCE')

    if (ext.valueBlock.value.length !== 2)
      throw new Error('AttributeTypeAndValue must have 2 elements')

    const [oidBlock, rawVal] = ext.valueBlock.value
    if (!(oidBlock instanceof asn1js.ObjectIdentifier))
      throw new Error('Missing OID in TCB component')

    const value = pck.unwrapSingleSet(rawVal) // peel optional SET
    const oid = oidBlock.valueBlock.toString()

    // sgxTcbComponent{1-16} -> single-byte INTEGER
    for (let i = 0; i < tcbComponentSize; i++) {
      if (oid === sgxTcbComponentOid(i + 1)) {
        tcbComponents[i] = util.decodeU8(value, `sgxTcbComponent${i + 1}`)
        break
      }
    }

    if (oid === pck.OidPCESvn) {
      atcb.pceSvn = util.decodeU16(value, 'PCESvn')
    }

    if (oid === pck.OidCPUSvn) {
      if (!(value instanceof asn1js.OctetString))
        throw new Error('CPUSvn must be an OCTET STRING')

      const buf = new Uint8Array(value.valueBlock.valueHex)
      if (buf.length !== quote.cpuSvnSize)
        throw new Error(
          `CPUSvn length is ${buf.length}, expected ${quote.cpuSvnSize}`,
        )
      atcb.cpuSvn = buf
    }
  }

  atcb.cpuSvnComponents = tcbComponents
}

export async function verifyTCBinfo(
  options: verify.VerifyOptions,
): Promise<void> {
  const collateral = options.collateral
  if (!collateral) throw ErrCollateralNil

  const tcbInfo = collateral.tdxTcbInfo.tcbInfo
  const signature = collateral.tdxTcbInfo.signature

  if (tcbInfo.id !== tcbInfoID) {
    throw new Error(
      `tcbInfo ID "${tcbInfo.id}" does not match with expected ID "${tcbInfoID}"`,
    )
  }

  if (tcbInfo.version !== tcbInfoVersion) {
    throw new Error(
      `tcbInfo version ${tcbInfo.version} does not match with expected version ${tcbInfoVersion}`,
    )
  }

  if (!Array.isArray(tcbInfo.tcbLevels) || tcbInfo.tcbLevels.length === 0) {
    throw ErrTcbInfoTcbLevelsMissing
  }

  await verifyResponse(
    tcbSigningPhrase,
    collateral.tcbInfoIssuerRootCertificate!,
    collateral.tcbInfoIssuerIntermediateCertificate!,
    collateral.tcbInfoBody,
    signature,
    collateral.rootCaCrl!,
    options,
  )
}

export async function verifyQeIdentity(
  options: verify.VerifyOptions,
): Promise<void> {
  const collateral = options.collateral
  if (!collateral) throw ErrCollateralNil

  const qeIdentity = collateral.qeIdentity.enclaveIdentity
  const signature = collateral.qeIdentity.signature

  if (qeIdentity.id !== qeIdentityID) {
    throw new Error(
      `QeIdentity ID "${qeIdentity.id}" does not match with expected ID "${qeIdentityID}"`,
    )
  }

  if (qeIdentity.version !== qeIdentityVersion) {
    throw new Error(
      `QeIdentity version ${qeIdentity.version} does not match with expected version ${qeIdentityVersion}`,
    )
  }

  if (
    !Array.isArray(qeIdentity.tcbLevels) ||
    qeIdentity.tcbLevels.length === 0
  ) {
    throw ErrQeIdentityTcbLevelsMissing
  }

  await verifyResponse(
    tcbSigningPhrase,
    collateral.qeIdentityIssuerRootCertificate!,
    collateral.qeIdentityIssuerIntermediateCertificate!,
    collateral.enclaveIdentityBody,
    signature,
    collateral.rootCaCrl!,
    options,
  )
}

export async function verifyResponse(
  signingPhrase: string,
  rootCertificate: x509.X509Certificate,
  signingCertificate: x509.X509Certificate,
  rawBody: Uint8Array,
  rawSignature: string,
  crl: x509.X509Crl | null,
  options: verify.VerifyOptions,
): Promise<void> {
  await validateCertificate(rootCertificate, rootCertificate, 'rootCertPhrase')
  await validateCertificate(signingCertificate, rootCertificate, signingPhrase)
  const signature = Uint8Array.from(Buffer.from(rawSignature, 'hex'))

  const publicKey = await x509.cryptoProvider
    .get()
    .subtle.importKey(
      'spki',
      signingCertificate.publicKey.rawData,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )

  const isValid = await x509.cryptoProvider
    .get()
    .subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      signature,
      rawBody,
    )

  if (!isValid) {
    throw new Error(
      'Could not verify response body signature using the signing certificate',
    )
  }

  if (options.checkRevocations) {
    if (options.getCollateral) {
      if (!crl) {
        throw new Error('Missing CRL for revocation check')
      }

      await validateCRL(crl, rootCertificate)

      for (const entry of crl.entries) {
        if (entry.serialNumber === signingCertificate.serialNumber) {
          throw new Error(
            `Signing certificate was revoked at ${entry.revocationDate}`,
          )
        }
      }
    } else {
      throw new Error('Revocation check is enabled, but GetCollateral is false')
    }
  }
}

export async function validateCertificate(
  cert: x509.X509Certificate,
  parent: x509.X509Certificate,
  expectedPhrase: string,
): Promise<void> {
  if (!cert) throw new Error('certificate is nil')
  if (!parent) throw new Error('parent certificate is nil')

  const cnList = cert.subjectName.getField('CN')
  const subjectCN = cnList.length > 0 ? cnList[0] : null
  if (subjectCN !== expectedPhrase) {
    throw new Error(
      `"${subjectCN}" is not expected in certificate's subject name. Expected "${expectedPhrase}"`,
    )
  }

  const issuerName = cert.issuerName.toString()
  const parentSubject = parent.subjectName.toString()
  if (issuerName !== parentSubject) {
    throw new Error(
      `Certificate issuer name ("${issuerName}") does not match parent certificate subject name ("${parentSubject}")`,
    )
  }

  const verified = await cert.verify({ publicKey: parent })
  if (!verified) {
    throw new Error(
      'Certificate signature verification using parent certificate failed',
    )
  }
}

export async function validateCRL(
  crl: x509.X509Crl | null | undefined,
  trustedCertificate: x509.X509Certificate | null | undefined,
): Promise<void> {
  if (!crl) {
    throw ErrCrlEmpty
  }
  if (!trustedCertificate) {
    throw ErrTrustedCertEmpty
  }

  if (crl.issuer.toString() !== trustedCertificate.subject.toString()) {
    throw new Error(
      `CRL issuer's name "${crl.issuer.toString()}" does not match expected name "${trustedCertificate.subject.toString()}"`,
    )
  }

  try {
    await crl.verify(trustedCertificate)
  } catch (err) {
    throw new Error(
      `CRL signature verification failed using trusted certificate: ${err}`,
    )
  }
}

export async function verifyTdQuoteBody(
  tdQuoteBody: quote.TDQuoteBody,
  options: {
    tcbInfo: TcbInfo
    pckCertExtensions: pck.PckExtensions
  },
): Promise<void> {
  const { tcbInfo, pckCertExtensions } = options

  if (pckCertExtensions.fmspc !== tcbInfo.fmspc) {
    throw new Error(
      `FMSPC mismatch: PCK Certificate(${pckCertExtensions.fmspc}) vs Intel PCS(${tcbInfo.fmspc})`,
    )
  }

  if (pckCertExtensions.pceid !== tcbInfo.pceID) {
    throw new Error(
      `PCEID mismatch: PCK Certificate(${pckCertExtensions.pceid}) vs Intel PCS(${tcbInfo.pceID})`,
    )
  }

  const reportedMrSigner = tdQuoteBody.mrSignerSeam
  const expectedMrSigner = tcbInfo.tdxModule.mrsigner.bytes

  if (!verify.equalBytes(reportedMrSigner, expectedMrSigner)) {
    throw new Error(
      `MRSIGNERSEAM mismatch: quote(${toHex(reportedMrSigner)}) vs PCS(${toHex(expectedMrSigner)})`,
    )
  }

  const mask = tcbInfo.tdxModule.attributesMask.bytes
  const seamAttrs = tdQuoteBody.seamAttributes
  if (mask.length !== seamAttrs.length) {
    throw new Error(
      `SeamAttributes length mismatch: quote(${seamAttrs.length}) vs PCS mask(${mask.length})`,
    )
  }

  const maskedAttrs = applyMask(mask, seamAttrs)
  const expectedAttrs = tcbInfo.tdxModule.attributes.bytes

  if (!verify.equalBytes(maskedAttrs, expectedAttrs)) {
    throw new Error(
      `AttributesMask mismatch: quote(${toHex(maskedAttrs)}) vs PCS(${toHex(expectedAttrs)})`,
    )
  }

  checkTcbInfoTcbStatus(tcbInfo, tdQuoteBody, pckCertExtensions)
}

export async function checkTcbInfoTcbStatus(
  tcbInfo: TcbInfo,
  tdQuoteBody: quote.TDQuoteBody,
  pckCertExtensions: pck.PckExtensions,
): Promise<void> {
  const tcbLevels = tcbInfo.tcbLevels
  const matchingTcbLevel = getMatchingTcbLevel(
    tcbLevels,
    tdQuoteBody,
    pckCertExtensions.tcb.pceSvn,
    pckCertExtensions.tcb.cpuSvnComponents,
  )
  if (!matchingTcbLevel) {
    throw new Error('Failed to find matching TCB Level')
  }

  if (tdQuoteBody.teeTcbSvn[1] > 0) {
    const matchingTdxModuleTcbLevel = await getMatchingTdxModuleTcbLevel(
      tcbInfo.tdxModuleIdentities,
      tdQuoteBody.teeTcbSvn,
    )
    if (!matchingTdxModuleTcbLevel) {
      throw new Error('Failed to find matching TDX Module TCB Level')
    }

    if (matchingTdxModuleTcbLevel.tcbStatus !== TcbComponentStatusUpToDate) {
      throw new Error(
        `TDX Module TCB Status is not "${TcbComponentStatusUpToDate}", found "${matchingTdxModuleTcbLevel.tcbStatus}"`,
      )
    }
    return
  }

  if (matchingTcbLevel.tcbStatus !== TcbComponentStatusUpToDate) {
    throw new Error(
      `TCB Status is not "${TcbComponentStatusUpToDate}", found "${matchingTcbLevel.tcbStatus}"`,
    )
  }
}

export async function getMatchingTdxModuleTcbLevel(
  tcbInfoTdxModuleIdentities: TdxModuleIdentity[],
  teeTcbSvn: Uint8Array,
): Promise<TcbLevel> {
  const tdxModuleVersion = teeTcbSvn.slice(1, 2)
  const tdxModuleIdentityID = tcbInfoTdxModuleIDPrefix + toHex(tdxModuleVersion)
  const tdxModuleIsvSvn = teeTcbSvn[0]

  for (const tdxModuleIdentity of tcbInfoTdxModuleIdentities) {
    if (tdxModuleIdentityID === tdxModuleIdentity.id) {
      for (const tcbLevel of tdxModuleIdentity.tcbLevels) {
        if (tdxModuleIsvSvn >= tcbLevel.tcb.isvsvn) {
          return tcbLevel
        }
      }
      throw new Error(
        `could not find a TDX Module Identity TCB Level matching the TDX Module's ISVSVN (${tdxModuleIsvSvn})`,
      )
    }
  }

  throw new Error(
    `could not find a TDX Module Identity (${tdxModuleIdentityID}) matching the given TEE TDX version (${toHex(tdxModuleVersion)})`,
  )
}

export function checkQeTcbStatus(tcbLevels: TcbLevel[], isvSvn: number): void {
  for (const level of tcbLevels) {
    if (level.tcb.isvsvn <= isvSvn) {
      if (level.tcbStatus !== 'UpToDate') {
        throw new Error(
          `TCB Status is not "UpToDate", found "${level.tcbStatus}"`,
        )
      }
      return
    }
  }
  throw ErrTcbStatus
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function applyMask(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length !== b.length) {
    throw new Error(
      `applyMask: input lengths differ (a: ${a.length}, b: ${b.length})`,
    )
  }

  const result = new Uint8Array(a.length)
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] & b[i]
  }
  return result
}

export function getMatchingTcbLevel(
  tcbLevels: TcbLevel[],
  tdReport: quote.TDQuoteBody,
  pckCertPceSvn: number,
  pckCertCPUSvnComponents: Uint8Array,
): TcbLevel {
  for (const tcbLevel of tcbLevels) {
    if (
      isCPUSvnHigherOrEqual(
        pckCertCPUSvnComponents,
        tcbLevel.tcb.sgxTcbcomponents,
      ) &&
      pckCertPceSvn >= tcbLevel.tcb.pcesvn &&
      isTdxTcbSvnHigherOrEqual(
        tdReport.teeTcbSvn,
        tcbLevel.tcb.tdxTcbcomponents,
      )
    ) {
      return tcbLevel
    }
  }
  throw new Error('no matching TCB level found')
}

export function isCPUSvnHigherOrEqual(
  pckCertCPUSvnComponents: Uint8Array,
  sgxTcbcomponents: TcbComponent[],
): boolean {
  if (pckCertCPUSvnComponents.length !== sgxTcbcomponents.length) {
    return false
  }
  for (let i = 0; i < pckCertCPUSvnComponents.length; i++) {
    if (pckCertCPUSvnComponents[i] < sgxTcbcomponents[i].svn) {
      return false
    }
  }
  return true
}

export function isTdxTcbSvnHigherOrEqual(
  teeTcbSvn: Uint8Array,
  tdxTcbcomponents: TcbComponent[],
): boolean {
  if (teeTcbSvn.length !== tdxTcbcomponents.length) {
    return false
  }

  let start = 0
  if (teeTcbSvn[1] > 0) {
    start = 2
  }

  for (let i = start; i < teeTcbSvn.length; i++) {
    if (teeTcbSvn[i] < tdxTcbcomponents[i].svn) {
      return false
    }
  }

  return true
}
