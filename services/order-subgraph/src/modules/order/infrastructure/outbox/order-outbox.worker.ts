import { Injectable } from '@nestjs/common';

@Injectable()
export class OrderOutboxWorker {
  async flushPending(): Promise<void> {}
}
