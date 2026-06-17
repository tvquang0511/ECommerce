import { Injectable } from '@nestjs/common';

@Injectable()
export class OrderEventStoreRepo {
  async append(
    aggregateId: string,
    expectedVersion: number,
    events: unknown[],
  ): Promise<void> {
    void aggregateId;
    void expectedVersion;
    void events;
  }
}
