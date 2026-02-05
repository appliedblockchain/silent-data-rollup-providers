// base64-utils.ts
//
// Copyright 2025 - Based on github.com/google/go-tdx-guest (Apache-2.0).
// Modifications (c) Applied Blockchain

import * as asn1js from 'asn1js'
import * as x509 from '@peculiar/x509'

export function decodeBase64(b64: string): Uint8Array {
  const binary = globalThis.atob(b64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function encodeBase64(data: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < data.byteLength; i++) {
    binary += String.fromCharCode(data[i])
  }
  return globalThis.btoa(binary)
}

export function leU16(buf: Uint8Array, off = 0): number {
  return buf[off] | (buf[off + 1] << 8)
}

export function leU32(buf: Uint8Array, off = 0): number {
  return (
    (buf[off] |
      (buf[off + 1] << 8) |
      (buf[off + 2] << 16) |
      (buf[off + 3] << 24)) >>>
    0
  )
}

export function toBigIntLE(u: Uint8Array): bigint {
  let r = 0n
  for (let i = u.length - 1; i >= 0; --i) r = (r << 8n) | BigInt(u[i])
  return r
}

export function decodeU8FromSet(value: asn1js.AsnType, label: string): number {
  if (!(value instanceof asn1js.Integer)) {
    throw new Error(`${label} must be an INTEGER`)
  }
  return value.valueBlock.valueDec
}

export function decodeU16(node: asn1js.AsnType, name: string): number {
  if (!(node instanceof asn1js.Integer))
    throw new Error(`${name} must be INTEGER`)
  const v = node.valueBlock.valueDec
  if (v < 0 || v > 0xffff) throw new Error(`${name} out of range`)
  return v
}

export function decodeU16FromSet(value: asn1js.AsnType, label: string): number {
  if (!(value instanceof asn1js.Integer)) {
    throw new Error(`${label} must be an INTEGER`)
  }
  return value.valueBlock.valueDec
}

export function decodeU8(node: asn1js.AsnType, name: string): number {
  if (!(node instanceof asn1js.Integer))
    throw new Error(`${name} must be INTEGER`)
  const v = node.valueBlock.valueDec
  if (v < 0 || v > 0xff) throw new Error(`${name} out of range`)
  return v
}

export async function verifyEcdsaSignature(
  pubKey: Uint8Array, // 64-byte X||Y
  msg: Uint8Array, // hashed message
  sig: Uint8Array, // 64-byte r||s
): Promise<boolean> {
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: b64url(pubKey.slice(0, 32)),
    y: b64url(pubKey.slice(32)),
    ext: true,
  }

  const key = await x509.cryptoProvider
    .get()
    .subtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )

  return x509.cryptoProvider
    .get()
    .subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig, msg)
}

export function b64url(data: Uint8Array): string {
  return encodeBase64(data)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
