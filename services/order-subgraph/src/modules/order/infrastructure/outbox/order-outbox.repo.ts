import { Injectable } from '@nestjs/common';

@Injectable()
export class OrderOutboxRepo {
  async enqueue(eventType: string, payload: unknown): Promise<void> {
    void eventType;
    void payload;
  }
}
