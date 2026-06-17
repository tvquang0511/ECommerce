import { createNestServiceConfig } from '@repo/eslint-config';

export default createNestServiceConfig({
  tsconfigRootDir: import.meta.dirname,
});
