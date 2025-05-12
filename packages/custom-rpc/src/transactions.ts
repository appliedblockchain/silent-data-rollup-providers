import {
  JsonRpcProvider,
  TransactionReceipt,
  TransactionResponse,
} from 'ethers'

type PublicTransactionResponse = {
  status?: string | null
  blockHash?: string | null
  blockNumber?: string | null
  transactionHash?: string | null
  transactionIndex?: string | null
}

function sanitizeTransaction(
  transaction: TransactionResponse | null,
): PublicTransactionResponse | null {
  if (!transaction) {
    return null
  }

  return {
    blockHash: transaction.blockHash ?? null,
    blockNumber: transaction.blockNumber?.toString() ?? null,
    transactionHash: transaction.hash ?? null,
    transactionIndex: transaction.index?.toString() ?? null,
  }
}

function sanitizeTransactionReceipt(
  transactionReceipt: TransactionReceipt | null,
): PublicTransactionResponse | null {
  if (!transactionReceipt) {
    return null
  }

  return {
    status: transactionReceipt.status?.toString() ?? null,
    blockHash: transactionReceipt.blockHash ?? null,
    blockNumber: transactionReceipt.blockNumber?.toString() ?? null,
    transactionHash: transactionReceipt.hash ?? null,
    transactionIndex: transactionReceipt.index?.toString() ?? null,
  }
}

function validateTransactionAccess(
  transaction: any,
  signer: string | null,
): boolean {
  if (!signer || !transaction) {
    return false
  }

  const signerLower = signer.toLowerCase()

  if (transaction.from && transaction.from.toLowerCase() === signerLower) {
    return true
  }

  if (transaction.to && transaction.to.toLowerCase() === signerLower) {
    return true
  }

  return false
}

function validateSignerAgainstResponse(
  transaction: any,
  signer: string | null,
): boolean {
  return validateTransactionAccess(transaction, signer)
}

async function handleGetTransactionByHash(
  provider: JsonRpcProvider,
  txHash: string,
  signer: string | null,
): Promise<any> {
  const transaction = await provider.getTransaction(txHash)

  if (!transaction) {
    return null
  }

  if (validateSignerAgainstResponse(transaction, signer)) {
    return transaction
  } else {
    const sanitizedData = sanitizeTransaction(transaction)
    return sanitizedData
  }
}

async function handleGetTransactionReceipt(
  provider: JsonRpcProvider,
  txHash: string,
  signer: string | null,
): Promise<any> {
  const transaction = await provider.getTransactionReceipt(txHash)

  if (!transaction) {
    return null
  }

  if (validateSignerAgainstResponse(transaction, signer)) {
    return transaction
  } else {
    const sanitizedData = sanitizeTransactionReceipt(transaction)

    return sanitizedData
  }
}

export async function validateTransactionMethod(
  provider: JsonRpcProvider,
  method: string,
  params: any[],
  signer: string | null,
): Promise<
  PublicTransactionResponse | TransactionResponse | TransactionReceipt | null
> {
  if (!params || !params[0]) {
    return null
  }

  const txHash = params[0]

  try {
    if (method === 'eth_getTransactionByHash') {
      return await handleGetTransactionByHash(provider, txHash, signer)
    } else if (method === 'eth_getTransactionReceipt') {
      return await handleGetTransactionReceipt(provider, txHash, signer)
    }

    return null
  } catch {
    return null
  }
}
