// pck.ts
//
// Copyright 2025 - Based on github.com/google/go-tdx-guest (Apache-2.0).
// Modifications (c) Applied Blockchain

import * as x509 from '@peculiar/x509'
import * as asn1js from 'asn1js'
import * as tcb from './tcb'
import * as ver from './verify'

// Ranges
export const pckCertChainCertificationDataTypeStart = 0x00
export const pckCertChainCertificationDataTypeEnd = 0x02
export const pckCertChainSizeStart = pckCertChainCertificationDataTypeEnd
export const pckCertChainSizeEnd = 0x06
export const pckCertChainDataStart = pckCertChainSizeEnd
export const pckReportCertificationDataType = 0x5
export const pckCertExtensionSize = 6
export const sgxExtensionMinSize = 4
export const ppidSize = 16
export const pceIDSize = 2
export const fmspcSize = 6

// Identifiers
export const processorIssuerID = 'processor'
export const platformIssuerID = 'platform'
export const processorIssuer = 'Intel SGX PCK Processor CA'
export const pckCertPhrase = 'Intel SGX PCK Certificate'
export const platformIssuer = 'Intel SGX PCK Platform CA'
export const intermediateCertPhrase = 'Intel SGX PCK Platform CA'

// Object Identifiers (OIDs)
export const OidPPID = '1.2.840.113741.1.13.1.1'
export const OidPCEID = '1.2.840.113741.1.13.1.3'
export const OidTCB = '1.2.840.113741.1.13.1.2'
export const OidFMSPC = '1.2.840.113741.1.13.1.4'
export const OidCPUSvn = '1.2.840.113741.1.13.1.2.18'
export const OidPCESvn = '1.2.840.113741.1.13.1.2.17'
export const OidSgxExtension = '1.2.840.113741.1.13.1'
export const sgxTcbComponentOidPrefix = '1.2.840.113741.1.13.1.2'

// Errors
export const ErrPckCertChainNil = new Error('PCK certificate chain is nil')
export const ErrPCKCertChainInvalid = new Error(
  "incomplete PCK Certificate chain found, should contain 3 concatenated PEM-formatted 'CERTIFICATE'-type block (PCK Leaf Cert||Intermediate CA Cert||Root CA Cert)",
)
export const ErrRootCaCertExpired = new Error(
  'root CA certificate in PCK certificate chain has expired',
)
export const ErrIntermediateCertNil = new Error(
  'intermediate certificate is empty',
)
export const ErrPCKCertNil = new Error('PCK certificate is empty')
export const ErrRevocationCheckFailed = new Error(
  'unable to check for certificate revocation as GetCollateral parameter in the options is set to false',
)
export const ErrIntermediateCaCertExpired = new Error(
  'intermediate CA certificate in PCK certificate chain has expired',
)
export const ErrPckLeafCertExpired = new Error(
  'PCK leaf certificate in PCK certificate chain has expired',
)
export const ErrPckCertCANil = new Error(
  'could not find CA from PCK certificate',
)

export let trustedRootCertificate: x509.X509Certificate | undefined

export interface PCKCertificateChainData {
  certificateDataType: number // uint32 (expected values: 1-7)
  size: number // uint32: size of pckCertChain
  pckCertChain: Uint8Array
}

export interface PckCertTCB {
  pceSvn: number
  cpuSvn: Uint8Array
  cpuSvnComponents: Uint8Array
}

export interface PCKCertificateChain {
  pckCertificate: x509.X509Certificate
  intermediateCerts: x509.X509Certificate
  rootCert: x509.X509Certificate
}

export function unwrapSingleSet(n: asn1js.AsnType): asn1js.AsnType {
  if (n instanceof asn1js.Set) {
    if (n.valueBlock.value.length !== 1) {
      throw new Error('SET wrapper should contain exactly one element')
    }
    return n.valueBlock.value[0]
  }
  return n
}

export function pckCertificateChainToProto(
  b: Uint8Array,
): PCKCertificateChainData {
  const data = b.slice() // Defensive copy
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)

  const certificateDataType = view.getUint16(
    pckCertChainCertificationDataTypeStart,
    true,
  )
  const size = view.getUint32(pckCertChainSizeStart, true)
  const pckCertChain = data.slice(pckCertChainDataStart)

  const pckCertificateChain: PCKCertificateChainData = {
    certificateDataType,
    size,
    pckCertChain,
  }

  checkPCKCertificateChain(pckCertificateChain) // throws if invalid

  return pckCertificateChain
}

export function checkPCKCertificateChain(chain: PCKCertificateChainData): void {
  if (!chain) {
    throw ErrPckCertChainNil
  }

  const { certificateDataType, size, pckCertChain } = chain

  if (certificateDataType >= 1 << 16) {
    throw new Error(
      `certification data type expected to be 2 bytes, got ${certificateDataType}`,
    )
  }

  if (certificateDataType !== pckReportCertificationDataType) {
    throw new Error(
      `PCK certificate chain data type invalid, got ${certificateDataType}, expected ${pckReportCertificationDataType}`,
    )
  }

  if (size !== pckCertChain.length) {
    throw new Error(
      `PCK certificate chain size is ${pckCertChain.length}. Expected size ${size}`,
    )
  }
}

export function findMatchingExtension(
  extns: ReadonlyArray<x509.Extension>,
  oid: string,
): x509.Extension {
  const match = extns.find((ext) => ext.type === oid)
  if (!match) {
    throw new Error(
      `Unable to find extension with OID ${oid} in PCK certificate`,
    )
  }
  return match
}

export async function pckCertificateExtensions(
  cert: x509.X509Certificate,
): Promise<PckExtensions> {
  if (cert.extensions.length !== pckCertExtensionSize) {
    throw new Error(
      `PCK certificate extensions length found ${cert.extensions.length}. Expected ${pckCertExtensionSize}`,
    )
  }

  const sgxExt = findMatchingExtension(cert.extensions, OidSgxExtension)
  if (!sgxExt) {
    throw new Error(
      'Could not find SGX extension present in the PCK certificate',
    )
  }

  // Decode outer OCTET STRING
  const { result: inner, offset } = asn1js.fromBER(sgxExt.value)
  if (offset === -1 || !(inner instanceof asn1js.Sequence)) {
    throw new Error('Expected SGX extension to be a SEQUENCE')
  }

  const remaining = sgxExt.value.slice(offset)
  if (remaining.byteLength !== 0) {
    throw new Error('SGX extension has trailing bytes')
  }
  return extractSgxExtensions(inner.valueBlock.value)
}

export interface PckExtensions {
  ppid: string
  tcb: PckCertTCB
  pceid: string
  fmspc: string
}

export function extractCaFromPckCert(pckCert: x509.X509Certificate): string {
  const cnList = pckCert.issuerName.getField('CN')
  const pckIssuer = cnList.length > 0 ? cnList[0] : null

  if (pckIssuer === platformIssuer) {
    return platformIssuerID
  }
  if (pckIssuer === processorIssuer) {
    return processorIssuerID
  }

  throw ErrPckCertCANil // ErrPckCertCANil
}

export function extractSgxExtensions(
  extensions: asn1js.AsnType[],
): PckExtensions {
  if (extensions.length < sgxExtensionMinSize) {
    throw new Error(
      `SGX Extension has length ${extensions.length}. It should have a minimum length of ${sgxExtensionMinSize}`,
    )
  }

  let ppid: string | undefined
  let tcb: PckCertTCB | undefined
  let pceid: string | undefined
  let fmspc: string | undefined

  for (const ext of extensions) {
    if (!(ext instanceof asn1js.Sequence)) {
      throw new Error('Expected each SGX extension to be a SEQUENCE')
    }

    const bytes = ext.toBER(false)
    const { result: parsed, offset } = asn1js.fromBER(bytes)
    if (offset === -1 || !(parsed instanceof asn1js.Sequence)) {
      throw new Error('Could not parse SGX extension entry')
    }

    const typeOidBlock = parsed.valueBlock.value[0]
    if (!(typeOidBlock instanceof asn1js.ObjectIdentifier)) {
      throw new Error('Missing Object Identifier in SGX extension entry')
    }

    const oid = typeOidBlock.valueBlock.toString()

    if (oid === OidPPID) {
      ppid = extractAsn1OctetStringExtension(
        'PPID',
        ext as asn1js.Sequence,
        ppidSize,
      )
    } else if (oid === OidTCB) {
      tcb = extractAsn1SequenceTcbExtension(ext)
    } else if (oid === OidPCEID) {
      pceid = extractAsn1OctetStringExtension(
        'PCEID',
        ext as asn1js.Sequence,
        pceIDSize,
      )
    } else if (oid === OidFMSPC) {
      fmspc = extractAsn1OctetStringExtension(
        'FMSPC',
        ext as asn1js.Sequence,
        fmspcSize,
      )
    }
  }

  if (!ppid || !tcb || !pceid || !fmspc) {
    throw new Error(
      'Missing one or more required SGX extensions in PCK certificate',
    )
  }

  return { ppid, tcb, pceid, fmspc }
}

function extractAsn1OctetStringExtension(
  name: string,
  seq: asn1js.Sequence,
  expectedSize: number,
): string {
  // SEQUENCE must contain exactly [OID, value]
  if (seq.valueBlock.value.length !== 2) {
    throw new Error(`${name} extension should have 2 elements`)
  }

  // peel off optional SET
  const valueNode = unwrapSingleSet(seq.valueBlock.value[1])

  if (!(valueNode instanceof asn1js.OctetString)) {
    throw new Error(`${name} extension expected OCTET STRING`)
  }

  const bytes = new Uint8Array(valueNode.valueBlock.valueHex)
  if (bytes.length !== expectedSize) {
    throw new Error(
      `${name} has length ${bytes.length}, expected ${expectedSize}`,
    )
  }
  return Buffer.from(bytes).toString('hex')
}

export function extractAsn1SequenceTcbExtension(
  ext: asn1js.AsnType,
): PckCertTCB {
  const raw = ext.toBER(false)

  const { result: outerSeq, offset } = asn1js.fromBER(raw)
  if (offset === -1 || !(outerSeq instanceof asn1js.Sequence)) {
    throw new Error('Could not parse TCB extension inside SGX extension')
  }

  const values = outerSeq.valueBlock.value
  if (values.length !== 2) {
    throw new Error(
      `TCB extension sequence has ${values.length} elements, expected 2`,
    )
  }

  const inner = values[1] // the second element contains the nested TCB structure
  const innerRaw = inner.toBER(false)

  const { result: innerSeq, offset: innerOffset } = asn1js.fromBER(innerRaw)
  if (innerOffset === -1 || !(innerSeq instanceof asn1js.Sequence)) {
    throw new Error('Could not parse TCB components inside TCB extension')
  }

  const components = innerSeq.valueBlock.value
  if (components.length !== tcb.tcbExtensionSize) {
    throw new Error(
      `TCB components length is ${components.length}, expected ${tcb.tcbExtensionSize}`,
    )
  }

  const tcbv: PckCertTCB = {} as PckCertTCB
  tcb.extractTcbExtension(components, tcbv)

  return tcbv
}

export async function verifyPCKCertificationChain(
  options: ver.VerifyOptions,
): Promise<void> {
  const { chain, collateral } = options

  if (!chain?.rootCert) throw tcb.ErrRootCertNil
  if (!chain.intermediateCerts) throw ErrIntermediateCertNil
  if (!chain.pckCertificate) throw ErrPCKCertNil

  const rootCert = chain.rootCert
  const intermediateCert = chain.intermediateCerts
  const pckCert = chain.pckCertificate

  await validateCertificate(rootCert, rootCert, tcb.rootCertPhrase)
  await validateCertificate(intermediateCert, rootCert, intermediateCertPhrase)
  await validateCertificate(pckCert, intermediateCert, pckCertPhrase)

  const opts = x509Options(options.trustedRoots, intermediateCert, options.now!)
  const ok = await pckCert.verify(opts)
  if (!ok) {
    throw new Error('error verifying PCK Certificate')
  }

  // Revocation checks
  if (options.checkRevocations) {
    if (!options.getCollateral) throw ErrRevocationCheckFailed

    await tcb.validateCRL(collateral?.rootCaCrl, rootCert)
    await tcb.validateCRL(collateral?.pckCrl, intermediateCert)

    if (collateral?.pckCrl?.issuer !== pckCert.issuer) {
      throw new Error(
        `issuer "${collateral!.pckCrl!.issuer}" of PCK CRL does not match PCK Certificate issuer "${pckCert.issuer}"`,
      )
    }
    for (const entry of collateral.rootCaCrl?.entries ?? []) {
      if (intermediateCert.serialNumber === entry.serialNumber) {
        throw new Error(
          `Intermediate certificate was revoked at ${entry.revocationDate}`,
        )
      }
    }
    for (const entry of collateral.pckCrl?.entries ?? []) {
      if (pckCert.serialNumber === entry.serialNumber) {
        throw new Error(
          `PCK Leaf certificate was revoked at ${entry.revocationDate}`,
        )
      }
    }
  }

  await checkCertificateExpiration(chain, options)
}

export async function checkCertificateExpiration(
  chain: PCKCertificateChain,
  options: ver.VerifyOptions,
): Promise<void> {
  const currentTime = options.now // `now` is a Date supplied in VerifyOptions

  if (currentTime! > chain.rootCert.notAfter) {
    throw ErrRootCaCertExpired
  }
  if (currentTime! > chain.intermediateCerts.notAfter) {
    throw ErrIntermediateCaCertExpired
  }
  if (currentTime! > chain.pckCertificate.notAfter) {
    throw ErrPckLeafCertExpired
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

export function x509Options(
  trustedRoots: x509.X509Certificate[] | null | undefined,
  intermediateCert: x509.X509Certificate | null | undefined,
  now: Date,
): x509.X509CertificateVerifyParams {
  let publicKeySource: x509.PublicKeyType | undefined

  if (intermediateCert) {
    publicKeySource = intermediateCert
  } else if (trustedRoots && trustedRoots.length > 0) {
    publicKeySource = trustedRoots[0] // assumes first trusted root is valid
  } else {
    publicKeySource = trustedRootCertificate
  }

  return {
    date: now,
    publicKey: publicKeySource,
  }
}
