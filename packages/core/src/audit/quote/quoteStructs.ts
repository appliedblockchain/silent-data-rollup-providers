// quoteStructs.ts
//
// Copyright 2025 - Based on github.com/google/go-tdx-guest (Apache-2.0).
// Modifications (c) Applied Blockchain

import * as pck from './pck'

// Basic constants
export const intelQuoteV4Version = 4
export const QuoteVersion = 4
export const AttestationKeyType = 2
export const rtmrsCount = 4
export const RtmrSize = 0x30
export const qeSvnSize = 0x2
export const pceSvnSize = 0x2
export const TeeTcbSvnSize = 0x10
export const QeVendorIDSize = 0x10
export const userDataSize = 0x14
export const MrSeamSize = 0x30
export const mrSignerSeamSize = 0x30
export const TeeTDX = 0x00000081
export const QuoteMinSize = 0x3fc
export const seamAttributesSize = 0x08
export const TdAttributesSize = 0x08
export const XfamSize = 0x08
export const MrTdSize = 0x30
export const MrConfigIDSize = 0x30
export const MrOwnerSize = 0x30
export const MrOwnerConfigSize = 0x30
export const cpuSvnSize = 0x10
export const attributesSize = 0x10
export const ReportDataSize = 0x40

// Offsets
export const quoteHeaderStart = 0x00
export const quoteHeaderEnd = 0x30
export const headerVersionStart = 0x00
export const headerVersionEnd = 0x02
export const headerAttestationKeyTypeStart = headerVersionEnd
export const headerAttestationKeyTypeEnd = 0x04
export const headerTeeTypeStart = headerAttestationKeyTypeEnd
export const headerTeeTypeEnd = 0x08
export const headerPceSvnStart = headerTeeTypeEnd
export const headerPceSvnEnd = 0x0a
export const headerQeSvnStart = headerPceSvnEnd
export const headerQeSvnEnd = 0x0c
export const headerQeVendorIDStart = headerQeSvnEnd
export const headerQeVendorIDEnd = 0x1c
export const headerUserDataStart = headerQeVendorIDEnd
export const headerUserDataEnd = 0x30

export const tdTeeTcbSvnStart = 0x00
export const tdTeeTcbSvnEnd = 0x10
export const tdMrSeamStart = tdTeeTcbSvnEnd
export const tdMrSeamEnd = 0x40
export const tdMrSignerSeamStart = tdMrSeamEnd
export const tdMrSignerSeamEnd = 0x70
export const tdSeamAttributesStart = tdMrSignerSeamEnd
export const tdSeamAttributesEnd = 0x78
export const tdAttributesStart = tdSeamAttributesEnd
export const tdAttributesEnd = 0x80
export const tdXfamStart = tdAttributesEnd
export const tdXfamEnd = 0x88
export const tdMrTdStart = tdXfamEnd
export const tdMrTdEnd = 0xb8
export const tdMrConfigIDStart = tdMrTdEnd
export const tdMrConfigIDEnd = 0xe8
export const tdMrOwnerStart = tdMrConfigIDEnd
export const tdMrOwnerEnd = 0x118
export const tdMrOwnerConfigStart = tdMrOwnerEnd
export const tdMrOwnerConfigEnd = 0x148
export const tdRtmrsStart = tdMrOwnerConfigEnd
export const tdRtmrsEnd = 0x208
export const tdReportDataStart = tdRtmrsEnd
export const tdReportDataEnd = 0x248

export const headerSize = 0x30
export const tdQuoteBodySize = 0x248
export const qeReportSize = 0x180

// QE
export const qeCPUSvnStart = 0x00
export const qeCPUSvnEnd = 0x10
export const qeMiscSelectStart = qeCPUSvnEnd
export const qeMiscSelectEnd = 0x14
export const qeReserved1Start = qeMiscSelectEnd
export const qeReserved1End = 0x30
export const qeAttributesStart = qeReserved1End
export const qeAttributesEnd = 0x40
export const qeMrEnclaveStart = qeAttributesEnd
export const qeMrEnclaveEnd = 0x60
export const qeReserved2Start = qeMrEnclaveEnd
export const qeReserved2End = 0x80
export const qeMrSignerStart = qeReserved2End
export const qeMrSignerEnd = 0xa0
export const qeReserved3Start = qeMrSignerEnd
export const qeReserved3End = 0x100
export const qeIsvProdIDStart = qeReserved3End
export const qeIsvProdIDEnd = 0x102
export const qeIsvSvnStart = qeIsvProdIDEnd
export const qeIsvSvnEnd = 0x104
export const qeReserved4Start = qeIsvSvnEnd
export const qeReserved4End = 0x140
export const qeReportDataStart = qeReserved4End
export const qeReportDataEnd = 0x180

export const reserved1Size = 0x1c
export const mrEnclaveSize = 0x20
export const reserved2Size = 0x20
export const mrSignerSize = 0x20
export const reserved3Size = 0x60
export const reserved4Size = 0x3c

export const ErrQuoteV4AuthDataNil = new Error('QuoteV4 authData is nil')
export const ErrQuoteV4Nil = new Error('QuoteV4 is nil')
export const ErrHeaderNil = new Error('header is nil')
export const ErrAttestationKeyType = new Error(
  'attestation key type not supported',
)
export const ErrTeeType = new Error('TEE type is not TDX')
export const ErrTDQuoteBodyNil = new Error('TD quote body is nil')
export const ErrQeReportNil = new Error('QE Report is nil')

export interface QuoteV4 {
  header: Header
  tdQuoteBody: TDQuoteBody
  signedDataSize: number
  signedData: Ecdsa256BitQuoteV4AuthData
  extraBytes?: Uint8Array
}

export interface Header {
  version: number
  attestationKeyType: number
  teeType: number
  qeSvn: Uint8Array
  pceSvn: Uint8Array
  qeVendorId: Uint8Array
  userData: Uint8Array
}

export interface TDQuoteBody {
  teeTcbSvn: Uint8Array
  mrSeam: Uint8Array
  mrSignerSeam: Uint8Array
  seamAttributes: Uint8Array
  tdAttributes: Uint8Array
  xfam: Uint8Array
  mrTd: Uint8Array
  mrConfigId: Uint8Array
  mrOwner: Uint8Array
  mrOwnerConfig: Uint8Array
  rtmrs: Uint8Array[]
  reportData: Uint8Array
}

export interface quoteExt {
  body: TDQuoteBody
  pckExt: pck.PckExtensions
}

export interface QuoteV4 {
  header: Header
  tdQuoteBody: TDQuoteBody
  signedDataSize: number
  signedData: Ecdsa256BitQuoteV4AuthData
  extraBytes?: Uint8Array
}

export interface Ecdsa256BitQuoteV4AuthData {
  signature: Uint8Array
  ecdsaAttestationKey: Uint8Array
  certificationData: CertificationData
}

export interface CertificationData {
  certificateDataType: number // uint32, expected values 1-7
  size: number // uint32: total size of the certification data
  qeReportCertificationData?: QEReportCertificationData
}

export interface QEReportCertificationData {
  qeReport?: EnclaveReport
  qeReportSignature?: Uint8Array // Should be 64 bytes
  qeAuthData?: QeAuthData
  pckCertificateChainData?: pck.PCKCertificateChainData
}

export interface EnclaveReport {
  cpuSvn: Uint8Array // 16 bytes
  miscSelect: number // 4 bytes (uint32)
  reserved1: Uint8Array // 28 bytes
  attributes: Uint8Array // 16 bytes
  mrEnclave: Uint8Array // 32 bytes
  reserved2: Uint8Array // 32 bytes
  mrSigner: Uint8Array // 32 bytes
  reserved3: Uint8Array // 96 bytes
  isvProdId: number // 2 bytes (uint16)
  isvSvn: number // 2 bytes
  reserved4: Uint8Array // 60 bytes
  reportData: Uint8Array // 64 bytes
}

export interface QeAuthData {
  parsedDataSize: number // 2 bytes
  data: Uint8Array
}

export function checkQuoteV4(q: QuoteV4): void {
  if (!q) {
    throw ErrQuoteV4Nil
  }
  checkHeaderSizes(q.header)
  checkTdQuoteBodySizes(q.tdQuoteBody)
  if (q.signedData.signature.length !== 0x40)
    throw new Error('signature wrong size')
  if (q.signedData.ecdsaAttestationKey.length !== 0x40)
    throw new Error('attestationKey wrong size')
}

function checkHeaderSizes(h: Header): void {
  if (h.qeSvn.length !== qeSvnSize) throw new Error('qeSvn wrong size')
  if (h.pceSvn.length !== pceSvnSize) throw new Error('pceSvn wrong size')
  if (h.qeVendorId.length !== QeVendorIDSize)
    throw new Error('qeVendorId wrong size')
  if (h.userData.length !== userDataSize) throw new Error('userData wrong size')
}

function checkTdQuoteBodySizes(b: TDQuoteBody): void {
  if (b.mrSeam.length !== MrSeamSize) throw new Error('mrSeam wrong size')
  if (b.tdAttributes.length !== TdAttributesSize)
    throw new Error('tdAttributes wrong size')
  if (b.xfam.length !== XfamSize) throw new Error('xfam wrong size')
  if (b.mrTd.length !== MrTdSize) throw new Error('mrTd wrong size')
  if (b.mrConfigId.length !== MrConfigIDSize)
    throw new Error('mrConfigId wrong size')
  if (b.mrOwner.length !== MrOwnerSize) throw new Error('mrOwner wrong size')
  if (b.mrOwnerConfig.length !== MrOwnerConfigSize)
    throw new Error('mrOwnerConfig wrong size')
  if (b.reportData.length !== ReportDataSize)
    throw new Error('reportData wrong size')
  if (b.rtmrs.length !== rtmrsCount) throw new Error('rtmrs count != 4')
  for (const r of b.rtmrs)
    if (r.length !== RtmrSize) throw new Error('rtmr wrong size')
}

export function HeaderToAbiBytes(header: Header): Uint8Array {
  if (!header) {
    throw ErrHeaderNil
  }

  checkHeader(header) // throws if invalid

  const data = new Uint8Array(headerSize)
  const view = new DataView(data.buffer)

  view.setUint16(headerVersionStart, header.version, true) // little-endian
  view.setUint16(headerAttestationKeyTypeStart, header.attestationKeyType, true)
  view.setUint32(headerTeeTypeStart, header.teeType, true)

  data.set(header.pceSvn, headerPceSvnStart)
  data.set(header.qeSvn, headerQeSvnStart)
  data.set(header.qeVendorId, headerQeVendorIDStart)
  data.set(header.userData, headerUserDataStart)

  return data
}

export function checkHeader(header: Header): void {
  if (!header) {
    throw ErrHeaderNil
  }

  if (header.version >= 1 << 16) {
    throw new Error(
      `version field size must fit in 2 bytes, got ${header.version}`,
    )
  }
  if (header.version !== QuoteVersion) {
    throw new Error(`version ${header.version} not supported`)
  }

  if (header.attestationKeyType >= 1 << 16) {
    throw new Error(
      `attestation key type field size must fit in 2 bytes, got ${header.attestationKeyType}`,
    )
  }
  if (header.attestationKeyType !== AttestationKeyType) {
    throw ErrAttestationKeyType
  }

  if (header.teeType !== TeeTDX) {
    throw ErrTeeType
  }

  if (header.qeSvn.length !== qeSvnSize) {
    throw new Error(
      `qeSvn size is ${header.qeSvn.length} bytes. Expected ${qeSvnSize} bytes`,
    )
  }
  if (header.pceSvn.length !== pceSvnSize) {
    throw new Error(
      `pceSvn size is ${header.pceSvn.length} bytes. Expected ${pceSvnSize} bytes`,
    )
  }
  if (header.qeVendorId.length !== QeVendorIDSize) {
    throw new Error(
      `qeVendorId size is ${header.qeVendorId.length} bytes. Expected ${QeVendorIDSize} bytes`,
    )
  }
  if (header.userData.length !== userDataSize) {
    throw new Error(
      `user data size is ${header.userData.length} bytes. Expected ${userDataSize} bytes`,
    )
  }
}

export function TdQuoteBodyToAbiBytes(tdQuoteBody: TDQuoteBody): Uint8Array {
  if (!tdQuoteBody) {
    throw ErrTDQuoteBodyNil
  }

  checkTDQuoteBody(tdQuoteBody) // throws if invalid

  const data = new Uint8Array(tdQuoteBodySize)

  data.set(tdQuoteBody.teeTcbSvn, tdTeeTcbSvnStart)
  data.set(tdQuoteBody.mrSeam, tdMrSeamStart)
  data.set(tdQuoteBody.mrSignerSeam, tdMrSignerSeamStart)
  data.set(tdQuoteBody.seamAttributes, tdSeamAttributesStart)
  data.set(tdQuoteBody.tdAttributes, tdAttributesStart)
  data.set(tdQuoteBody.xfam, tdXfamStart)
  data.set(tdQuoteBody.mrTd, tdMrTdStart)
  data.set(tdQuoteBody.mrConfigId, tdMrConfigIDStart)
  data.set(tdQuoteBody.mrOwner, tdMrOwnerStart)
  data.set(tdQuoteBody.mrOwnerConfig, tdMrOwnerConfigStart)

  let offset = tdRtmrsStart
  for (let i = 0; i < rtmrsCount; i++) {
    const rtmr = tdQuoteBody.rtmrs[i]
    if (!rtmr || rtmr.length !== RtmrSize) {
      throw new Error(`RTMR[${i}] is missing or invalid`)
    }
    data.set(rtmr, offset)
    offset += RtmrSize
  }

  data.set(tdQuoteBody.reportData, tdReportDataStart)

  return data
}

export function enclaveReportToAbiBytes(report: EnclaveReport): Uint8Array {
  if (!report) {
    throw ErrQeReportNil
  }

  checkQeReport(report) // throws if invalid

  const data = new Uint8Array(qeReportSize)

  data.set(report.cpuSvn, qeCPUSvnStart)
  new DataView(data.buffer).setUint32(
    qeMiscSelectStart,
    report.miscSelect,
    true,
  )

  data.set(report.reserved1, qeReserved1Start)
  data.set(report.attributes, qeAttributesStart)
  data.set(report.mrEnclave, qeMrEnclaveStart)
  data.set(report.reserved2, qeReserved2Start)
  data.set(report.mrSigner, qeMrSignerStart)
  data.set(report.reserved3, qeReserved3Start)

  new DataView(data.buffer).setUint16(qeIsvProdIDStart, report.isvProdId, true)
  new DataView(data.buffer).setUint16(qeIsvSvnStart, report.isvSvn, true)

  data.set(report.reserved4, qeReserved4Start)
  data.set(report.reportData, qeReportDataStart)

  return data
}

export function checkQeReport(report: EnclaveReport): void {
  if (!report) {
    throw ErrQeReportNil
  }

  if (report.cpuSvn.length !== cpuSvnSize) {
    throw new Error(
      `cpuSvn size is ${report.cpuSvn.length} bytes. Expected ${cpuSvnSize} bytes`,
    )
  }

  if (report.reserved1.length !== reserved1Size) {
    throw new Error(
      `reserved1 size is ${report.reserved1.length} bytes. Expected ${reserved1Size} bytes`,
    )
  }

  if (report.attributes.length !== attributesSize) {
    throw new Error(
      `attributes size is ${report.attributes.length} bytes. Expected ${attributesSize} bytes`,
    )
  }

  if (report.mrEnclave.length !== mrEnclaveSize) {
    throw new Error(
      `mrEnclave size is ${report.mrEnclave.length} bytes. Expected ${mrEnclaveSize} bytes`,
    )
  }

  if (report.reserved2.length !== reserved2Size) {
    throw new Error(
      `reserved2 size is ${report.reserved2.length} bytes. Expected ${reserved2Size} bytes`,
    )
  }

  if (report.mrSigner.length !== mrSignerSize) {
    throw new Error(
      `mrSigner size is ${report.mrSigner.length} bytes. Expected ${mrSignerSize} bytes`,
    )
  }

  if (report.reserved3.length !== reserved3Size) {
    throw new Error(
      `reserved3 size is ${report.reserved3.length} bytes. Expected ${reserved3Size} bytes`,
    )
  }

  if (report.isvProdId >= 1 << 16) {
    throw new Error(`isvProdId must fit in 2 bytes, got ${report.isvProdId}`)
  }

  if (report.isvSvn >= 1 << 16) {
    throw new Error(`isvSvn must fit in 2 bytes, got ${report.isvSvn}`)
  }

  if (report.reserved4.length !== reserved4Size) {
    throw new Error(
      `reserved4 size is ${report.reserved4.length} bytes. Expected ${reserved4Size} bytes`,
    )
  }

  if (report.reportData.length !== ReportDataSize) {
    throw new Error(
      `reportData size is ${report.reportData.length} bytes. Expected ${ReportDataSize} bytes`,
    )
  }
}

export function checkTDQuoteBody(tdQuoteBody: TDQuoteBody): void {
  if (!tdQuoteBody) {
    throw ErrTDQuoteBodyNil
  }

  if (tdQuoteBody.teeTcbSvn.length !== TeeTcbSvnSize) {
    throw new Error(
      `teeTcbSvn size is ${tdQuoteBody.teeTcbSvn.length} bytes. Expected ${TeeTcbSvnSize} bytes`,
    )
  }
  if (tdQuoteBody.mrSeam.length !== MrSeamSize) {
    throw new Error(
      `mrSeam size is ${tdQuoteBody.mrSeam.length} bytes. Expected ${MrSeamSize} bytes`,
    )
  }
  if (tdQuoteBody.mrSignerSeam.length !== mrSignerSeamSize) {
    throw new Error(
      `mrSignerSeam size is ${tdQuoteBody.mrSignerSeam.length} bytes. Expected ${mrSignerSeamSize} bytes`,
    )
  }
  if (tdQuoteBody.seamAttributes.length !== seamAttributesSize) {
    throw new Error(
      `seamAttributes size is ${tdQuoteBody.seamAttributes.length} bytes. Expected ${seamAttributesSize} bytes`,
    )
  }
  if (tdQuoteBody.tdAttributes.length !== TdAttributesSize) {
    throw new Error(
      `tdAttributes size is ${tdQuoteBody.tdAttributes.length} bytes. Expected ${TdAttributesSize} bytes`,
    )
  }
  if (tdQuoteBody.xfam.length !== XfamSize) {
    throw new Error(
      `xfam size is ${tdQuoteBody.xfam.length} bytes. Expected ${XfamSize} bytes`,
    )
  }
  if (tdQuoteBody.mrTd.length !== MrTdSize) {
    throw new Error(
      `mrTd size is ${tdQuoteBody.mrTd.length} bytes. Expected ${MrTdSize} bytes`,
    )
  }
  if (tdQuoteBody.mrConfigId.length !== MrConfigIDSize) {
    throw new Error(
      `mrConfigId size is ${tdQuoteBody.mrConfigId.length} bytes. Expected ${MrConfigIDSize} bytes`,
    )
  }
  if (tdQuoteBody.mrOwner.length !== MrOwnerSize) {
    throw new Error(
      `mrOwner size is ${tdQuoteBody.mrOwner.length} bytes. Expected ${MrOwnerSize} bytes`,
    )
  }
  if (tdQuoteBody.mrOwnerConfig.length !== MrOwnerConfigSize) {
    throw new Error(
      `mrOwnerConfig size is ${tdQuoteBody.mrOwnerConfig.length} bytes. Expected ${MrOwnerConfigSize} bytes`,
    )
  }
  if (tdQuoteBody.rtmrs.length !== rtmrsCount) {
    throw new Error(
      `rtmrs count is ${tdQuoteBody.rtmrs.length}. Expected ${rtmrsCount}`,
    )
  }

  for (let i = 0; i < rtmrsCount; i++) {
    if (tdQuoteBody.rtmrs[i].length !== RtmrSize) {
      throw new Error(
        `rtmr${i} size is ${tdQuoteBody.rtmrs[i].length} bytes. Expected ${RtmrSize} bytes`,
      )
    }
  }
}

export function enclaveReportToProto(b: Uint8Array): EnclaveReport {
  const data = b.slice() // Defensive copy

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const enclaveReport: EnclaveReport = {
    cpuSvn: data.slice(qeCPUSvnStart, qeCPUSvnEnd),
    miscSelect: view.getUint32(qeMiscSelectStart, true),
    reserved1: data.slice(qeReserved1Start, qeReserved1End),
    attributes: data.slice(qeAttributesStart, qeAttributesEnd),
    mrEnclave: data.slice(qeMrEnclaveStart, qeMrEnclaveEnd),
    reserved2: data.slice(qeReserved2Start, qeReserved2End),
    mrSigner: data.slice(qeMrSignerStart, qeMrSignerEnd),
    reserved3: data.slice(qeReserved3Start, qeReserved3End),
    isvProdId: view.getUint16(qeIsvProdIDStart, true),
    isvSvn: view.getUint16(qeIsvSvnStart, true),
    reserved4: data.slice(qeReserved4Start, qeReserved4End),
    reportData: data.slice(qeReportDataStart, qeReportDataEnd),
  }

  checkQeReport(enclaveReport) // Throws if validation fails
  return enclaveReport
}
