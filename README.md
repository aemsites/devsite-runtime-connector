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
- Redocly API blocks get an escaped `<noscript>` summary during Markdown-to-HTML conversion. The connector fetches YAML/JSON specs from `raw.githubusercontent.com`; private specs use `DEVSITE_CONNECTOR_PUBLIC_ORIGIN`. Fetching is limited to 15 seconds and 20 documents per page, with at most four referenced documents fetched concurrently. Failed or unsupported fetches leave the interactive block unchanged.
- This summary is generated when the connector converts a page, not in a separate static build. Focused regression tests are in `test/md2markup.test.ts`.

### TODO
- better test assertions for whitespace differences
