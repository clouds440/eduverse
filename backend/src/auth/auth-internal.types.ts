export interface RequestMetadata {
  ip?: string;
  userAgent?: string;
}

export interface AuditLogInput extends RequestMetadata {
  actorUserId?: string;
  targetUserId?: string;
  organizationId?: string;
  sessionId?: string;
  details?: Record<string, unknown>;
}

export interface SessionDeviceInput {
  rememberMe?: boolean;
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
}
