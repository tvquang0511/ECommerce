import { appConfig } from './config/app.config';
import { authConfig } from './config/auth.config';
import { cartConfig } from './config/cart.config';
import { redisConfig } from './config/redis.config';

export const configuration = [appConfig, authConfig, cartConfig, redisConfig];
