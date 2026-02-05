import { ethers, BytesLike } from 'ethers'
import { quoteExt } from './quote/quoteStructs'
import { sha256 } from './quoteToHash'

// Minimal ABI for the verification-registry contract.
const REGISTRY_ABI = [
  'function isMeasurementRegistered(bytes32 measurement) view returns (bool)',
] as const

async function isMeasurementRegistered(
  provider: ethers.Provider,
  contractAddress: string,
  measurement: Uint8Array,
): Promise<boolean> {
  const contract = new ethers.Contract(contractAddress, REGISTRY_ABI, provider)
  const measurementHex: BytesLike = ethers.hexlify(measurement)
  return contract.isMeasurementRegistered(measurementHex)
}

export async function verifyQuoteRegistered(
  hashAggregates: Uint8Array[],
  ethereumEndpoint: string,
  contractAddress: string,
): Promise<boolean> {
  const provider = new ethers.JsonRpcProvider(ethereumEndpoint)

  // exit early on the first positive match.
  for (const variant of hashAggregates) {
    try {
      if (await isMeasurementRegistered(provider, contractAddress, variant)) {
        return true
      }
    } catch (err) {
      throw new Error(
        `Registry lookup failed for measurement ${ethers.hexlify(variant)}: ${(err as Error).message}`,
      )
    }
  }
  return false
}

function toU8Arr(str: string) {
  return Uint8Array.from(Buffer.from(str, 'hex'))
}

export function aggregateAllMeasurementsPCS(m: quoteExt): Uint8Array {
  const body = m.body
  const exts = m.pckExt
  return concatUint8Arrays([
    body.mrConfigId,
    body.mrOwner,
    body.mrOwnerConfig,
    body.mrSeam,
    body.mrSignerSeam,
    body.mrTd,
    //measurements.ReportData, # differs between quotes
    body.seamAttributes,
    body.tdAttributes,
    //measurements.TeeTcbSvn, # differs between machines and needs to be greater than some value
    body.xfam,
    body.rtmrs[0],
    body.rtmrs[1],
    body.rtmrs[2],
    body.rtmrs[3],
    toU8Arr(exts.fmspc), // Family-Model-Stepping-Platform-Custom SKU
    toU8Arr(exts.ppid), // specific machine
  ])
}

export function aggregateCodeMeasurementsAllPCS(m: quoteExt): Uint8Array {
  const body = m.body
  const exts = m.pckExt
  return concatUint8Arrays([
    body.mrConfigId,
    body.mrOwner,
    body.mrOwnerConfig,
    body.mrSeam,
    body.mrSignerSeam,
    body.mrTd,
    body.rtmrs[0],
    body.rtmrs[1],
    body.rtmrs[2],
    body.rtmrs[3],
    toU8Arr(exts.fmspc), // Family-Model-Stepping-Platform-Custom SKU
  ])
}

export function aggregateCodeMeasurementsTD(m: quoteExt): Uint8Array {
  const body = m.body
  return concatUint8Arrays([
    body.mrTd,
    body.rtmrs[0],
    body.rtmrs[1],
    body.rtmrs[2],
    body.rtmrs[3],
  ])
}

export function aggregateCodeMeasurementsAll(m: quoteExt): Uint8Array {
  const body = m.body
  return concatUint8Arrays([
    body.mrConfigId,
    body.mrOwner,
    body.mrOwnerConfig,
    body.mrSeam,
    body.mrSignerSeam,
    body.mrTd,
    ...body.rtmrs,
  ])
}

export function aggregateAllMeasurements(m: quoteExt): Uint8Array {
  const body = m.body
  return concatUint8Arrays([
    body.mrConfigId,
    body.mrOwner,
    body.mrOwnerConfig,
    body.mrSeam,
    body.mrSignerSeam,
    body.mrTd,
    body.seamAttributes,
    body.tdAttributes,
    body.teeTcbSvn,
    body.xfam,
    ...body.rtmrs,
  ])
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

export async function hashMeasurements(input: Uint8Array): Promise<Uint8Array> {
  const first = await sha256(input)
  const second = await sha256(first)
  return second
}
