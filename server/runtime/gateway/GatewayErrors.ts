/* ────────────────────────────────────────────────────────────
   Gateway error taxonomy
   ──────────────────────────────────────────────────────────── */

export type GatewayErrorCode =
  | 'GATEWAY_UNAVAILABLE'
  | 'GATEWAY_AUTH_FAILED'
  | 'GATEWAY_PROTOCOL_ERROR'
  | 'GATEWAY_TIMEOUT'
  | 'GATEWAY_DISCONNECTED'
  | 'GATEWAY_NOT_CONNECTED'
  | 'GATEWAY_REQUEST_FAILED'
  | 'GATEWAY_RATE_LIMITED'
  | 'GATEWAY_INTERNAL_ERROR';

export interface GatewayError {
  code: GatewayErrorCode;
  message: string;
  retryable: boolean;
  ts: number;
}

export function gatewayError(
  code: GatewayErrorCode,
  message: string,
  retryable = false,
): GatewayError {
  return { code, message, retryable, ts: Date.now() };
}

export function classifyWsClose(code: number, reason: string): GatewayError {
  if (code === 1000) return gatewayError('GATEWAY_DISCONNECTED', 'Clean close', true);
  if (code === 1001) return gatewayError('GATEWAY_DISCONNECTED', 'Going away', true);
  if (code === 1006) return gatewayError('GATEWAY_DISCONNECTED', 'Abnormal closure', true);
  if (code === 1008) return gatewayError('GATEWAY_AUTH_FAILED', `Policy violation: ${reason}`, false);
  if (code === 1011) return gatewayError('GATEWAY_INTERNAL_ERROR', `Server error: ${reason}`, true);
  if (code === 1012) return gatewayError('GATEWAY_INTERNAL_ERROR', 'Server restarting', true);
  if (code === 1013) return gatewayError('GATEWAY_RATE_LIMITED', 'Try again later', true);
  if (code >= 4000) return gatewayError('GATEWAY_PROTOCOL_ERROR', `Custom close: ${code} ${reason}`, false);
  return gatewayError('GATEWAY_DISCONNECTED', `Close ${code}: ${reason}`, true);
}

export function classifyError(err: unknown): GatewayError {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const e = err as { code: string; message?: string };
    if (e.code === 'ECONNREFUSED') return gatewayError('GATEWAY_UNAVAILABLE', 'Connection refused', true);
    if (e.code === 'ECONNRESET') return gatewayError('GATEWAY_DISCONNECTED', 'Connection reset', true);
    if (e.code === 'ETIMEDOUT') return gatewayError('GATEWAY_TIMEOUT', 'Connection timed out', true);
    if (e.code === 'ENOTFOUND') return gatewayError('GATEWAY_UNAVAILABLE', 'Host not found', false);
  }
  const msg = err instanceof Error ? err.message : String(err);
  return gatewayError('GATEWAY_INTERNAL_ERROR', msg, false);
}
