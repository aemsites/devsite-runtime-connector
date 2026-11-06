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

> After deploying, check that `npx aio rt action list md2markup` shows a new version and date. If it doesn't, rerun with `npm run deploy -- --force-deploy`: aio marks the action as deployed before uploading it, so a plain rerun can skip it.

### Notes
- `.plain.html` shows what `devsite-runtime-connector` + AEM sends to [`adp-devsite`](https://github.com/AdobeDocs/adp-devsite).
- Content must be redeployed for the latest `devsite-runtime-connector` changes to take effect, because EDS stores the HTML generated at deploy time and serves that copy. A normal content deploy only regenerates changed files, so use "Force deploy all files" to regenerate a whole repo.
- After deploying `devsite-runtime-connector`, run `dev-docs-reference`'s [Staging workflow](https://github.com/AdobeDocs/dev-docs-reference/actions/workflows/stage.yml) with "Force deploy all files" ([same connector as prod](https://github.com/aemsites/devsite-runtime-connector/blob/0e97e9f7be3fd7234dc21570850ad022f0b42751/src/index.ts#L78-L84)), then check [the stage site](https://developer-stage.adobe.com/dev-docs-reference/) as a sanity check that the connector behaves correctly.
- Private sites (`AdobeDocsPrivate`) don't use the Runtime action: every private deploy runs the connector from `main` and rebuilds all pages, so merges reach them on their next deploy. Test link or asset changes on a private repo's stage deploy too.
- If a deploy breaks something, revert the commit, run `npm run deploy` again from an up-to-date `main`, and force-redeploy `dev-docs-reference` plus any repo deployed in between.

### TODO
- better test assertions for whitespace differences
