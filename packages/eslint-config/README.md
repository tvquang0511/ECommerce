# @repo/eslint-config

Shared ESLint flat config for workspace services.

## Exports

- createNodeTsConfig(options)
- createNestServiceConfig(options)

## Example

```js
import { createNestServiceConfig } from '@repo/eslint-config';

export default createNestServiceConfig({
  tsconfigRootDir: import.meta.dirname,
});
```
