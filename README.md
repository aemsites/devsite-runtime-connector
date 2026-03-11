# devsite-runtime-connector
Runtime function to convert the developer website documentation content from custom MDX to Franklin HTML.

### Install
```sh
npm i
```

### Test
```sh
npm test
```

### Develop
```sh
npm run dev
```

### Deploy
```sh
npm run deploy
```

> Note: deploying requires the env vars `AIO_RUNTIME_NAMESPACE` and `AIO_RUNTIME_AUTH` - they can be set in a `.env` file

### Testing & deployment
- `.plain.html` shows what `devsite-runtime-connector` + AEM sends to `adp-devsite`.
- Content must be redeployed for the latest `devsite-runtime-connector` changes to take effect.
- After deploying `devsite-runtime-connector`, redeploy `dev-docs-reference` as a sanity check that the connector behaves correctly.

### TODO
- better test assertions for whitespace differences
