/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-disable import/no-extraneous-dependencies */

import typescript from '@rollup/plugin-typescript';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { RollupOptions, Plugin } from 'rollup';
import fs from 'fs';

const fetchPkgJson = fs.readFileSync('./node_modules/@adobe/fetch/package.json', 'utf8');

/**
 * Workaround plugin for `createRequire` usage in @adobe/fetch
 */
function adobeFetchPlugin(): Plugin {
  return {
    name: 'adobe-fetch-plugin',
    resolveId(source, importer) {
      if (source === 'module' && importer.includes('@adobe/fetch')) {
        return source;
      }
      return null;
    },
    load(id) {
      if (id === 'module') {
        return `export const createRequire = () => () => { return ${fetchPkgJson} };`;
      }
      return null;
    },
  };
}

/**
 * Ignores universal's main import,
 * the openwhisk adapter is applied manually.
 */
function helixUniversalPlugin(): Plugin {
  return {
    name: 'helix-universal-plugin',
    resolveId(source, importer) {
      if (source === './main.js' && importer.includes('@adobe/helix-universal')) {
        return source;
      }
      return null;
    },
    load(id) {
      if (id === './main.js') {
        return 'export const main = () => { throw Error("main.js loaded by helix-universal"); }';
      }
      return null;
    },
  };
}

const opts: RollupOptions = {
  input: 'src/index.ts',
  output: {
    inlineDynamicImports: true,
    sourcemap: false,
    file: 'dist/index.js',
    format: 'esm',
    strict: false,
  },
  plugins: [
    adobeFetchPlugin(),
    helixUniversalPlugin(),
    typescript(),
    commonjs(),
    nodeResolve({ preferBuiltins: true, browser: false }),
  ],
};

export default opts;
