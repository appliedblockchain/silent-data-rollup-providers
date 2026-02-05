// collateral.ts
//
// Copyright 2025 - Based on github.com/google/go-tdx-guest (Apache-2.0).
// Modifications (c) Applied Blockchain

import * as tcb from './tcb'
import * as verify from './verify'
import * as x509 from '@peculiar/x509'
import * as asn1js from 'asn1js'

// Errors
export const ErrMissingTcbInfoBody = new Error(
  'missing tcbInfo body in the collaterals obtained',
)
export const ErrMissingEnclaveIdentityBody = new Error(
  'missing enclaveIdentity body in the collaterals obtained',
)
export const ErrTcbInfoNil = new Error('tcbInfo is empty in collaterals')
export const ErrQeIdentityNil = new Error('QeIdentity is empty in collaterals')
export const ErrMissingTcbInfoSigningCert = new Error(
  'missing signing certificate in the issuer chain of tcbInfo',
)
export const ErrMissingTcbInfoRootCert = new Error(
  'missing root certificate in the issuer chain of tcbInfo',
)
export const ErrMissingQeIdentitySigningCert = new Error(
  'missing signing certificate in the issuer chain of QeIdentity',
)
export const ErrMissingQeIdentityRootCert = new Error(
  'missing root certificate in the issuer chain of QeIdentity',
)
export const ErrMissingPckCrl = new Error(
  'missing PCK CRL in the collaterals obtained',
)
export const ErrMissingRootCaCrl = new Error(
  'missing ROOT CA CRL in the collaterals obtained',
)
export const ErrMissingPCKCrlSigningCert = new Error(
  'missing signing certificate in the issuer chain of PCK CRL',
)
export const ErrMissingPCKCrlRootCert = new Error(
  'missing root certificate in the issuer chain of PCK CRL',
)
export const ErrTcbInfoExpired = new Error('tcbInfo has expired')
export const ErrQeIdentityExpired = new Error('QeIdentity has expired')
export const ErrTcbInfoSigningCertExpired = new Error(
  'tcbInfo signing certificate has expired',
)
export const ErrTcbInfoRootCertExpired = new Error(
  'tcbInfo root certificate has expired',
)
export const ErrQeIdentityRootCertExpired = new Error(
  'QeIdentity root certificate has expired',
)
export const ErrQeIdentitySigningCertExpired = new Error(
  'QeIdentity signing certificate has expired',
)
export const ErrRootCaCrlExpired = new Error('root CA CRL has expired')
export const ErrPCKCrlExpired = new Error('PCK CRL has expired')
export const ErrPCKCrlSigningCertExpired = new Error(
  'PCK CRL signing certificate has expired',
)
export const ErrPCKCrlRootCertExpired = new Error(
  'PCK CRL root certificate has expired',
)
export const ErrEmptyRootCRLUrl = new Error(
  "empty url found in QeIdentity issuer's chain which is required to receive ROOT CA CRL",
)

// Identifiers
export const sgxPckCrlIssuerChainPhrase = 'Sgx-Pck-Crl-Issuer-Chain'
export const sgxQeIdentityIssuerChainPhrase =
  'Sgx-Enclave-Identity-Issuer-Chain'
export const enclaveIdentityPhrase = 'enclaveIdentity'
export const tcbInfoIssuerChainPhrase = 'Tcb-Info-Issuer-Chain'
export const tcbInfoPhrase = 'tcbInfo'
const OID_CRL_DISTRIBUTION_POINTS = '2.5.29.31'

// URLs
export const pcsTdxBaseURL =
  'https://api.trustedservices.intel.com/tdx/certification/v4'
export const pcsSgxBaseURL =
  'https://api.trustedservices.intel.com/sgx/certification/v4'

export interface Collateral {
  pckCrlIssuerIntermediateCertificate?: x509.X509Certificate
  pckCrlIssuerRootCertificate?: x509.X509Certificate
  pckCrl?: x509.X509Crl

  tcbInfoIssuerIntermediateCertificate?: x509.X509Certificate
  tcbInfoIssuerRootCertificate?: x509.X509Certificate
  tdxTcbInfo: tcb.TdxTcbInfo
  tcbInfoBody: Uint8Array

  qeIdentityIssuerIntermediateCertificate?: x509.X509Certificate
  qeIdentityIssuerRootCertificate?: x509.X509Certificate
  qeIdentity: tcb.QeIdentity
  enclaveIdentityBody: Uint8Array

  rootCaCrl?: x509.X509Crl
}

export interface HTTPSGetter {
  get(url: string): Promise<[Record<string, string[]>, Uint8Array]>
}

export class RetryHTTPSGetter implements HTTPSGetter {
  constructor(
    private readonly underlying: HTTPSGetter = new SimpleHTTPSGetter(),
    private readonly timeoutMs = 120_000, // total wall-clock timeout
    private readonly maxRetryDelayMs = 30_000, // max delay between retries
  ) {}
  async get(url: string): Promise<[Record<string, string[]>, Uint8Array]> {
    const deadline = Date.now() + this.timeoutMs
    let delay = 2_000 // first back-off = 2 s

    for (;;) {
      try {
        return await this.underlying.get(url) // return a tuple
      } catch (err) {
        if (Date.now() + delay > deadline) {
          throw err
        }
        await new Promise((r) => setTimeout(r, delay))
        delay = Math.min(delay * 2, this.maxRetryDelayMs)
      }
    }
  }
}

export class SimpleHTTPSGetter implements HTTPSGetter {
  async get(url: string): Promise<[Record<string, string[]>, Uint8Array]> {
    const resp = await fetch(url)
    if (!resp.ok) {
      throw new Error(`failed to retrieve ${url}, status code ${resp.status}`)
    }

    const headers: Record<string, string[]> = {}
    resp.headers.forEach((value, key) => {
      if (!headers[key]) headers[key] = []
      headers[key].push(value)
    })

    const body = new Uint8Array(await resp.arrayBuffer())
    return [headers, body]
  }
}

export class CRLUnavailableError extends Error {
  readonly causes: Error[]

  constructor(causes: Error[]) {
    super('CRL is unavailable')
    this.name = 'CRLUnavailableError'
    this.causes = causes
  }
}

export class AttestationRecreationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AttestationRecreationError'
  }
}

export function defaultHTTPSGetter(): HTTPSGetter {
  return new RetryHTTPSGetter()
}

export async function verifyCollateral(
  options: verify.VerifyOptions,
): Promise<void> {
  const collateral = options.collateral
  if (!collateral) throw tcb.ErrCollateralNil
  if (!collateral.tcbInfoBody) throw ErrMissingTcbInfoBody
  if (!collateral.enclaveIdentityBody) throw ErrMissingEnclaveIdentityBody

  if (Object.keys(collateral.tdxTcbInfo || {}).length === 0) throw ErrTcbInfoNil
  if (Object.keys(collateral.qeIdentity || {}).length === 0)
    throw ErrQeIdentityNil

  if (!collateral.tcbInfoIssuerIntermediateCertificate)
    throw ErrMissingTcbInfoSigningCert
  if (!collateral.tcbInfoIssuerRootCertificate) throw ErrMissingTcbInfoRootCert
  if (!collateral.qeIdentityIssuerIntermediateCertificate)
    throw ErrMissingQeIdentitySigningCert
  if (!collateral.qeIdentityIssuerRootCertificate)
    throw ErrMissingQeIdentityRootCert

  if (options.checkRevocations) {
    if (!collateral.pckCrl) throw ErrMissingPckCrl
    if (!collateral.rootCaCrl) throw ErrMissingRootCaCrl
    if (!collateral.pckCrlIssuerIntermediateCertificate)
      throw ErrMissingPCKCrlSigningCert
    if (!collateral.pckCrlIssuerRootCertificate) throw ErrMissingPCKCrlRootCert
  }

  await checkCollateralExpiration(collateral, options)
}

export async function checkCollateralExpiration(
  collateral: Collateral,
  options: verify.VerifyOptions,
): Promise<void> {
  const currentTime = options.now

  const tcbInfo = collateral.tdxTcbInfo.tcbInfo
  const qeIdentity = collateral.qeIdentity.enclaveIdentity

  if (currentTime! > tcbInfo.nextUpdate) {
    throw ErrTcbInfoExpired
  }
  if (currentTime! > qeIdentity.nextUpdate) {
    throw ErrQeIdentityExpired
  }

  if (
    currentTime! > collateral.tcbInfoIssuerIntermediateCertificate!.notAfter
  ) {
    throw ErrTcbInfoSigningCertExpired
  }
  if (currentTime! > collateral.tcbInfoIssuerRootCertificate!.notAfter) {
    throw ErrTcbInfoRootCertExpired
  }
  if (currentTime! > collateral.qeIdentityIssuerRootCertificate!.notAfter) {
    throw ErrQeIdentityRootCertExpired
  }
  if (
    currentTime! > collateral.qeIdentityIssuerIntermediateCertificate!.notAfter
  ) {
    throw ErrQeIdentitySigningCertExpired
  }

  if (options.checkRevocations) {
    if (currentTime! > collateral.rootCaCrl!.nextUpdate!) {
      throw ErrRootCaCrlExpired
    }
    if (currentTime! > collateral.pckCrl!.nextUpdate!) {
      throw ErrPCKCrlExpired
    }
    if (
      currentTime! > collateral.pckCrlIssuerIntermediateCertificate!.notAfter
    ) {
      throw ErrPCKCrlSigningCertExpired
    }
    if (currentTime! > collateral.pckCrlIssuerRootCertificate!.notAfter) {
      throw ErrPCKCrlRootCertExpired
    }
  }
}

export async function obtainCollateral(
  fmspc: string,
  ca: string,
  options: verify.VerifyOptions,
): Promise<Collateral> {
  const getter: HTTPSGetter = options.getter ?? defaultHTTPSGetter()
  const collateral: Collateral = {} as Collateral

  await getTcbInfo(fmspc, getter, collateral)
  await getQeIdentity(getter, collateral)

  if (options.checkRevocations) {
    await getPckCrl(ca, getter, collateral)
    await getRootCrl(getter, collateral)
  }

  return collateral
}

export function pckCrlURL(ca: string): string {
  return `${pcsSgxBaseURL}/pckcrl?ca=${encodeURIComponent(ca)}&encoding=der`
}

export async function getPckCrl(
  ca: string,
  getter: HTTPSGetter,
  collateral: Collateral,
): Promise<void> {
  const pckCrlURLStr = pckCrlURL(ca)
  let headers: Record<string, string[]>
  let body: Uint8Array

  try {
    ;[headers, body] = await getter.get(pckCrlURLStr)
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    throw new CRLUnavailableError([error, new Error('could not fetch PCK CRL')])
  }

  let intermediateCert: x509.X509Certificate
  let rootCert: x509.X509Certificate

  try {
    ;[intermediateCert, rootCert] = headerToIssuerChain(
      headers,
      sgxPckCrlIssuerChainPhrase,
    )
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    throw error
  }

  collateral.pckCrlIssuerIntermediateCertificate = intermediateCert
  collateral.pckCrlIssuerRootCertificate = rootCert

  try {
    collateral.pckCrl = bodyToCrl(body)
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    throw new CRLUnavailableError([error, new Error('could not fetch PCK CRL')])
  }
}

export function headerToIssuerChain(
  headers: Record<string, string[]>,
  phrase: string,
): [x509.X509Certificate, x509.X509Certificate] {
  const values = headers[phrase]
  if (!values || values.length !== 1) {
    throw new Error(
      `issuer chain is expected to be of size 1, found ${values?.length ?? 0}`,
    )
  }
  const encodedChain = values[0]
  if (!encodedChain) {
    throw new Error(`issuer chain certificates missing in "${phrase}"`)
  }

  let certChain: string
  try {
    certChain = decodeURIComponent(encodedChain)
  } catch (err) {
    throw new Error(`unable to decode issuer chain in "${phrase}": ${err}`)
  }

  const pemBlocks = x509.PemConverter.decode(certChain)
  if (pemBlocks.length !== 2) {
    throw new Error(
      `expected 2 PEM blocks (intermediate + root), found ${pemBlocks.length}`,
    )
  }

  const intermediate = new x509.X509Certificate(pemBlocks[0])
  const root = new x509.X509Certificate(pemBlocks[1])

  return [intermediate, root]
}

export async function getQeIdentity(
  getter: HTTPSGetter,
  collateral: Collateral,
): Promise<void> {
  const QeIdentityURL = qeIdentityURL()
  let headers: Record<string, string[]>
  let body: Uint8Array

  try {
    ;[headers, body] = await getter.get(QeIdentityURL)
  } catch (err) {
    throw new AttestationRecreationError(
      `could not receive QeIdentity response: ${err}`,
    )
  }

  let intermediateCert: x509.X509Certificate
  let rootCert: x509.X509Certificate

  try {
    ;[intermediateCert, rootCert] = headerToIssuerChain(
      headers,
      sgxQeIdentityIssuerChainPhrase,
    )
  } catch (err: any) {
    throw new AttestationRecreationError(err.message)
  }

  collateral.qeIdentityIssuerIntermediateCertificate = intermediateCert
  collateral.qeIdentityIssuerRootCertificate = rootCert

  try {
    collateral.qeIdentity = JSON.parse(
      new TextDecoder().decode(body),
    ) as tcb.QeIdentity
  } catch (err) {
    throw new AttestationRecreationError(
      `unable to unmarshal QeIdentity response: ${err}`,
    )
  }

  try {
    collateral.enclaveIdentityBody = bodyToRawMessage(
      enclaveIdentityPhrase,
      body,
    )
  } catch (err: any) {
    throw new AttestationRecreationError(err.message)
  }
}

export function bodyToRawMessage(name: string, body: Uint8Array): Uint8Array {
  if (body.length === 0) {
    throw new Error(`"${name}" is empty`)
  }

  const decoded = new TextDecoder().decode(body)
  let rawBody: Record<string, unknown>

  try {
    rawBody = JSON.parse(decoded)
  } catch (err) {
    throw new Error(`could not convert "${name}" body to raw message: ${err}`)
  }

  const val = rawBody[name]
  if (val === undefined) {
    throw new Error(`"${name}" field is missing in the response received`)
  }

  const json = JSON.stringify(val)
  return new TextEncoder().encode(json)
}

export function qeIdentityURL(): string {
  return `${pcsTdxBaseURL}/qe/identity`
}

export function TcbInfoURL(fmspc: string): string {
  return `${pcsTdxBaseURL}/tcb?fmspc=${fmspc}`
}

export async function getTcbInfo(
  fmspc: string,
  getter: HTTPSGetter,
  collateral: Collateral,
): Promise<void> {
  const tcbInfoURL = TcbInfoURL(fmspc)
  let header: Record<string, string[]>
  let body: Uint8Array
  try {
    ;[header, body] = await getter.get(tcbInfoURL)
  } catch (err) {
    throw new AttestationRecreationError(
      `could not receive tcbInfo response: ${err}`,
    )
  }

  let intermediateCert, rootCert
  try {
    ;[intermediateCert, rootCert] = headerToIssuerChain(
      header,
      tcbInfoIssuerChainPhrase,
    )
  } catch (err: any) {
    throw new AttestationRecreationError(err.message)
  }

  collateral.tcbInfoIssuerIntermediateCertificate = intermediateCert
  collateral.tcbInfoIssuerRootCertificate = rootCert

  try {
    collateral.tdxTcbInfo = JSON.parse(
      new TextDecoder().decode(body),
    ) as tcb.TdxTcbInfo
  } catch (err) {
    throw new AttestationRecreationError(
      `unable to unmarshal tcbInfo response: ${err}`,
    )
  }

  try {
    collateral.tcbInfoBody = bodyToRawMessage(tcbInfoPhrase, body)
  } catch (err: any) {
    throw new AttestationRecreationError(err.message)
  }
}

// Extracts every URI from the CRL-Distribution-Points extension.
export function getCrlDistributionPoints(cert: x509.X509Certificate): string[] {
  const ext = cert.extensions.find(
    (e) => e.type === OID_CRL_DISTRIBUTION_POINTS,
  )
  if (!ext) return []

  const outer = asn1js.fromBER(ext.value)
  if (outer.offset === -1 || !(outer.result instanceof asn1js.OctetString))
    return []

  const inner = asn1js.fromBER(outer.result.valueBlock.valueHex)
  if (inner.offset === -1 || !(inner.result instanceof asn1js.Sequence))
    return []

  // spec: only the first DistributionPoint is used
  const seq = inner.result as asn1js.Sequence
  if (seq.valueBlock.value.length === 0) return []

  const dp = seq.valueBlock.value[0] as asn1js.Constructed
  if (!(dp instanceof asn1js.Constructed) || dp.valueBlock.value.length === 0)
    return []

  const dpn = dp.valueBlock.value[0] as asn1js.Constructed
  if (!(dpn instanceof asn1js.Constructed)) return []

  const names = new GeneralNames({ schema: dpn })
  return names.names
    .filter((n) => n.type === 6) // uniformResourceIdentifier
    .map((n) => n.value)
}

export class GeneralName {
  type: number
  value: string

  constructor(type: number, value: string) {
    this.type = type
    this.value = value
  }
}

export class GeneralNames {
  names: GeneralName[] = []

  constructor(params: { schema: asn1js.Constructed }) {
    const items = params.schema.valueBlock.value

    for (const el of items) {
      if (el.idBlock.tagClass === 3) {
        const tag = el.idBlock.tagNumber
        // Only support type 6 = URI (IA5String)
        if (tag === 6 && el instanceof asn1js.Primitive) {
          const uri = new asn1js.IA5String({ valueHex: el.valueBlock.valueHex })
          this.names.push(new GeneralName(tag, uri.valueBlock.value))
        }
      }
    }
  }
}

export async function getRootCrl(
  getter: HTTPSGetter,
  collateral: Collateral,
): Promise<void> {
  const rootCrlURLs = getCrlDistributionPoints(
    collateral.qeIdentityIssuerRootCertificate!,
  )

  if (rootCrlURLs.length === 0) {
    throw ErrEmptyRootCRLUrl
  }
  const errors: Error[] = []

  for (const url of rootCrlURLs) {
    try {
      const [, body] = await getter.get(url) // tuple: [headers, body]
      collateral.rootCaCrl = bodyToCrl(body)
      return // success
    } catch (err) {
      errors.push(err instanceof Error ? err : new Error(String(err)))
    }
  }

  throw new CRLUnavailableError([
    ...errors,
    new Error('could not fetch root CRL'),
  ])
}

export function bodyToCrl(body: Uint8Array): x509.X509Crl {
  try {
    return new x509.X509Crl(body)
  } catch (err) {
    throw new Error(`unable to parse DER bytes of CRL: ${err}`)
  }
}
