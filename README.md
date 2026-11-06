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

### Notes
- `.plain.html` shows what `devsite-runtime-connector` + AEM sends to `adp-devsite`.
- Content must be redeployed for the latest `devsite-runtime-connector` changes to take effect.
- After deploying `devsite-runtime-connector`, redeploy `dev-docs-reference` as a sanity check that the connector behaves correctly.
- Redocly API blocks include the complete fetched YAML/JSON OpenAPI document as escaped text in a `<noscript>` code block. `$ref` values remain as written; external referenced files are not expanded. The connector fetches specs from `raw.githubusercontent.com`; private specs use `DEVSITE_CONNECTOR_PUBLIC_ORIGIN`. Fetching is limited to 15 seconds and 20 documents per page, with a 2 MiB limit per document. Failed or unsupported fetches leave the interactive block unchanged.

### TODO
- better test assertions for whitespace differences
