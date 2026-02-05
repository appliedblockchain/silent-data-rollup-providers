import * as validate from './quote/validateTdxQuote'
import * as verify from './quote/verify'
import * as measure from './quote/validate'
import * as quote from './quote/quoteStructs'
import * as registry from './registry'

const CHALLENGE_DOMAIN_SEPARATOR = 'CUSTOM-RPC ATTEST:'

// report data and allowed measurements
interface HashResult {
  challenge: Uint8Array // excludes domain separator
  hashVariants: Uint8Array[]
}

async function parseVerifyRawQuote(
  raw: Uint8Array,
  rootPem: string,
): Promise<quote.quoteExt> {
  const quote = await quoteToProto(raw)
  if (!quote) {
    throw new Error('Failed to parse quote')
  }

  const rot: validate.RootOfTrust = {
    cabundles: [rootPem],
  }
  const verifyOptions = await validate.rootOfTrustToVerifyOptions(rot)
  const exts = await verify.localVerifyTdxQuote(quote, verifyOptions)
  const val_opts: measure.ValidateOptions = {
    // defaults are reasonable
    headerOptions: {},
    tdQuoteBodyOptions: {},
  }
  validate.localValidateTdxQuote(quote, val_opts)
  return { body: quote.tdQuoteBody, pckExt: exts }
}

async function quoteToProto(b: Uint8Array): Promise<quote.QuoteV4> {
  const quoteFormat = validate.determineQuoteFormat(b)
  if (!quoteFormat) {
    throw new Error('Failed to determine quote format')
  }

  switch (quoteFormat) {
    case quote.intelQuoteV4Version:
      return validate.quoteToProtoV4(b)
    default:
      throw new Error('Quote format not supported')
  }
}

// throws if raw TDX quote is invalid
// returns the report data and measurements we should look for in the registry contract
export async function quoteToHash(
  rawQuote: Uint8Array,
  rootPem: string,
): Promise<HashResult> {
  const tdQuoteBody = await parseVerifyRawQuote(rawQuote, rootPem)
  if (!tdQuoteBody) {
    throw new Error('error parsing and verifying TDX quote')
  }

  const reportData = tdQuoteBody.body.reportData as Uint8Array
  const domainSeparator = reportData.slice(0, CHALLENGE_DOMAIN_SEPARATOR.length)
  const expectedDomain = new TextEncoder().encode(CHALLENGE_DOMAIN_SEPARATOR)

  if (!verify.equalBytes(domainSeparator, expectedDomain)) {
    throw new Error('quote constructed for alternate purpose')
  }

  return {
    challenge: reportData.slice(CHALLENGE_DOMAIN_SEPARATOR.length),
    hashVariants: [
      await registry.hashMeasurements(
        registry.aggregateCodeMeasurementsTD(tdQuoteBody),
      ),
      await registry.hashMeasurements(
        registry.aggregateCodeMeasurementsAll(tdQuoteBody),
      ),
      await registry.hashMeasurements(
        registry.aggregateAllMeasurements(tdQuoteBody),
      ),
      await registry.hashMeasurements(
        registry.aggregateAllMeasurementsPCS(tdQuoteBody),
      ),
      await registry.hashMeasurements(
        registry.aggregateCodeMeasurementsAllPCS(tdQuoteBody),
      ),
    ],
  }
}

export async function sha256(input: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', input)
  return new Uint8Array(hashBuffer)
}
