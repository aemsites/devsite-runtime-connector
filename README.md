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
- Content must be redeployed for the latest `devsite-runtime-connector` changes to take effect, because EDS stores the HTML generated at deploy time and serves that copy. A normal content deploy only regenerates changed files, so use "Force deploy all files" to regenerate a whole repo.
- After deploying `devsite-runtime-connector`, redeploy `dev-docs-reference` to stage ([same connector as prod](https://github.com/aemsites/devsite-runtime-connector/blob/0e97e9f7be3fd7234dc21570850ad022f0b42751/src/index.ts#L78-L84)) with "Force deploy all files" as a sanity check that the connector behaves correctly.
- If a deploy breaks something, revert the commit, run `npm run deploy` again from an up-to-date `main`, and force-redeploy `dev-docs-reference` plus any repo deployed in between.

### TODO
- better test assertions for whitespace differences
