type CopyToClipboardOptions = {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
};

export async function copyToClipboard(text: string, options?: CopyToClipboardOptions) {
  try {
    await navigator.clipboard.writeText(text);
    options?.onSuccess?.();
    return true;
  } catch (error) {
    options?.onError?.(error);
    return false;
  }
} 