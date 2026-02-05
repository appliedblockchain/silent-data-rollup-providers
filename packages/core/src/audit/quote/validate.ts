// validate.ts
//
// Copyright 2025 - Based on github.com/google/go-tdx-guest (Apache-2.0).
// Modifications (c) Applied Blockchain

import * as quote from './quoteStructs'
import * as util from './base64-utils'

// Fixed attribute values
export const xfamFixed1 = 0x00000003n
export const xfamFixed0 = 0x0006dbe7n
export const tdAttributesFixed1 = 0x0n
export const tdxAttributesSeptVeDisSupport = 1n << 28n
export const tdxAttributesPksSupport = 1n << 30n
export const tdxAttributesPerfmonSupport = 1n << 63n
export const tdAttributesFixed0 =
  0x1n |
  tdxAttributesSeptVeDisSupport |
  tdxAttributesPksSupport |
  tdxAttributesPerfmonSupport

export interface HeaderOptions {
  minimumQeSvn?: number
  minimumPceSvn?: number
  qeVendorID?: Uint8Array
}

export interface ValidateOptions {
  headerOptions: HeaderOptions
  tdQuoteBodyOptions: TdQuoteBodyOptions
}

export interface TdQuoteBodyOptions {
  minimumTeeTcbSvn?: Uint8Array | null
  // Must be null or 48 bytes long. Not checked if null.
  mrSeam?: Uint8Array | null
  tdAttributes?: Uint8Array | null
  xfam?: Uint8Array | null
  mrTd?: Uint8Array | null
  mrConfigID?: Uint8Array | null
  mrOwner?: Uint8Array | null
  mrOwnerConfig?: Uint8Array | null
  rtmrs?: (Uint8Array | null)[] | null
  reportData?: Uint8Array | null
}

const must = {
  equalBytes(a: Uint8Array, b: Uint8Array, field: string): void {
    if (a.length !== b.length) throw new Error(`${field} length mismatch`)
    for (let i = 0; i < a.length; ++i)
      if (a[i] !== b[i]) {
        throw new Error(`${field} mismatch - byte ${i}`)
      }
  },
}

export function validateTdxQuoteV4(
  q: quote.QuoteV4,
  opts: ValidateOptions,
): void {
  quote.checkQuoteV4(q)
  exactByteMatch(q, opts)
  minVersionCheck(q, opts)
  validateXfam(q.tdQuoteBody.xfam, xfamFixed1, xfamFixed0)
  validateTdAttributes(
    q.tdQuoteBody.tdAttributes,
    tdAttributesFixed1,
    tdAttributesFixed0,
  )
}

function exactByteMatch(q: quote.QuoteV4, opts: ValidateOptions): void {
  const b = q.tdQuoteBody
  const h = q.header
  const bo = opts.tdQuoteBodyOptions
  const ho = opts.headerOptions
  const cmp = (
    name: string,
    given: Uint8Array,
    expected?: Uint8Array,
    size?: number,
  ) => {
    if (!expected) return
    if (size && expected.length !== size)
      throw new Error(`${name} option must be ${size} bytes`)
    must.equalBytes(given, expected, name)
  }
  cmp('MR_SEAM', b.mrSeam, bo.mrSeam!, quote.MrSeamSize)
  cmp('TD_ATTRIBUTES', b.tdAttributes, bo.tdAttributes!, quote.TdAttributesSize)
  cmp('XFAM', b.xfam, bo.xfam!, quote.XfamSize)
  cmp('MR_TD', b.mrTd, bo.mrTd!, quote.MrTdSize)
  cmp('MR_CONFIG_ID', b.mrConfigId, bo.mrConfigID!, quote.MrConfigIDSize)
  cmp('MR_OWNER', b.mrOwner, bo.mrOwner!, quote.MrOwnerSize)
  cmp(
    'MR_OWNER_CONFIG',
    b.mrOwnerConfig,
    bo.mrOwnerConfig!,
    quote.MrOwnerConfigSize,
  )
  if (bo.rtmrs) {
    if (bo.rtmrs.length !== quote.rtmrsCount)
      throw new Error('RTMR option len != 4')
    bo.rtmrs.forEach((exp, i) =>
      cmp(`RTMR[${i}]`, b.rtmrs[i], exp!, quote.RtmrSize),
    )
  }
  cmp('REPORT_DATA', b.reportData, bo.reportData!, quote.ReportDataSize)
  cmp('QE_VENDOR_ID', h.qeVendorId, ho.qeVendorID, quote.QeVendorIDSize)
}

function isSvnHigherOrEqual(
  quoteSvn: Uint8Array,
  optionSvn?: Uint8Array | null,
): boolean {
  if (!optionSvn) {
    return true
  }
  for (let i = 0; i < quoteSvn.length; i++) {
    if (quoteSvn[i] < optionSvn[i]) {
      return false
    }
  }
  return true
}

function minVersionCheck(quote: quote.QuoteV4, opts: ValidateOptions) {
  if (
    !isSvnHigherOrEqual(
      quote.tdQuoteBody.teeTcbSvn,
      opts.tdQuoteBodyOptions?.minimumTeeTcbSvn,
    )
  ) {
    throw new Error(
      `TEE TCB security-version number ${util.toBigIntLE(
        quote.tdQuoteBody.teeTcbSvn,
      )} is less than the required minimum ${util.toBigIntLE(
        opts.tdQuoteBodyOptions.minimumTeeTcbSvn!,
      )}`,
    )
  }

  const qeSvn = util.leU16(quote.header.qeSvn)
  const pceSvn = util.leU16(quote.header.pceSvn)

  if (qeSvn < opts.headerOptions.minimumQeSvn!) {
    throw new Error(
      `QE security-version number ${qeSvn} is less than the required minimum ${opts.headerOptions.minimumQeSvn}`,
    )
  }

  if (pceSvn < opts.headerOptions.minimumPceSvn!) {
    throw new Error(
      `PCE security-version number ${pceSvn} is less than the required minimum ${opts.headerOptions.minimumPceSvn}`,
    )
  }

  return
}

export function validateXfam(
  value: Uint8Array,
  fixed1: bigint,
  fixed0: bigint,
): void {
  if (value.length === 0) return

  if (value.length !== quote.XfamSize) {
    throw new Error('xfam size is invalid')
  }

  const xfam = new DataView(
    value.buffer,
    value.byteOffset,
    value.byteLength,
  ).getBigUint64(0, true)

  if ((xfam & fixed1) !== fixed1) {
    throw new Error(
      `unauthorized xfam 0x${xfam.toString(16)} as xfamFixed1 0x${fixed1.toString(16)} bits are unset`,
    )
  }

  if ((xfam & ~fixed0) !== BigInt(0)) {
    throw new Error(
      `unauthorized xfam 0x${xfam.toString(16)} as xfamFixed0 0x${fixed0.toString(16)} bits are set`,
    )
  }
}

export function validateTdAttributes(
  value: Uint8Array,
  fixed1: bigint,
  fixed0: bigint,
): void {
  if (value.length === 0) return

  if (value.length !== quote.TdAttributesSize) {
    throw new Error('tdAttributes size is invalid')
  }

  const tdAttributes = new DataView(
    value.buffer,
    value.byteOffset,
    value.byteLength,
  ).getBigUint64(0, true)

  if ((tdAttributes & fixed1) !== fixed1) {
    throw new Error(
      `unauthorized tdAttributes 0x${tdAttributes.toString(16)} as tdAttributesFixed1 0x${fixed1.toString(16)} bits are unset`,
    )
  }

  if ((tdAttributes & ~fixed0) !== 0n) {
    throw new Error(
      `unauthorized tdAttributes 0x${tdAttributes.toString(16)} as tdAttributesFixed0 0x${fixed0.toString(16)} bits are set`,
    )
  }
}
