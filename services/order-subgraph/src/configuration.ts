import { appConfig } from './config/app.config';
import { authConfig } from './config/auth.config';
import { orderConfig } from './config/order.config';
import { rabbitmqConfig } from './config/rabbitmq.config';

export const configuration = [appConfig, authConfig, orderConfig, rabbitmqConfig];
