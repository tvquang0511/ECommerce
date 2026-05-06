import { appConfig } from './config/app.config';
import { authConfig } from './config/auth.config';
import { databaseConfig } from './config/database.config';

/**
 * configuration
 * Danh sách config factories được load bởi ConfigModule
 */
export const configuration = [appConfig, databaseConfig, authConfig];
