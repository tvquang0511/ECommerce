import { Injectable } from '@nestjs/common';

@Injectable()
export class OrderEventMapper {
  toPersistence(event: unknown) {
    return event;
  }

  toDomain(record: unknown) {
    return record;
  }
}
