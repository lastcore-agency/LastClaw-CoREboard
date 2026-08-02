export { GatewayClient, type GatewayClientOptions } from './GatewayClient.js';
export { GatewayEventBus, type NormalizedEvent } from './GatewayEvents.js';
export { getOrCreateDeviceIdentity, signNonce, type DeviceIdentity } from './GatewayIdentity.js';
export {
  GATEWAY_PROTOCOL_VERSION,
  type GatewayFrame,
  type GatewayRequest,
  type GatewayResponse,
  type GatewayEvent,
  type GatewayMethodName,
  type GatewayMethodMap,
  type HealthPayload,
  type GatewayAgent,
  type GatewaySession,
  type GatewayChatMessage,
  type GatewayWorkspaceFile,
  type GatewayLogEntry,
  buildRequest,
  isGatewayFrame,
} from './GatewayProtocol.js';
export {
  type GatewayError,
  type GatewayErrorCode,
  classifyWsClose,
  classifyError,
  gatewayError,
} from './GatewayErrors.js';
