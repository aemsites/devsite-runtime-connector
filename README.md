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


### TODO
- `tableToGridtable` step to wrap md tables in gridtables to be treated as a `table` block
- better test assertions for whitespace differences