export interface OrderEventMetadata {
  actorId?: string;
  actorRoles?: string[];
  causationId?: string;
  correlationId?: string;
  idempotencyKey?: string;
  requestId?: string;
  source?: string;
}

export interface OrderEventRecord {
  id: string;
  aggregateId: string;
  aggregateType: 'order';
  sequence: number;
  eventType: string;
  eventData: Record<string, unknown>;
  metadata: OrderEventMetadata;
  occurredAt: string;
}
