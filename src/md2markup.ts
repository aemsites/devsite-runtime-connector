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

import type { Helix } from '@adobe/helix-universal';

import createPageBlocks from './steps/create-page-blocks.js';
import fixSections from './steps/fix-sections.js';
import mdxToGridtables from './steps/mdx-to-gridtables.js';
import splitSections from './steps/split-sections.js';
import stringify from './steps/stringify.js';
import toMdast from './steps/to-mdast.js';
import toHast from './steps/to-hast.js';

/**
 * Converts markdown to markup.
 *
 * Each step mutates the context's `content` attribute, which contains the different ASTs.
 *
 * Heavily inspired by {@link https://github.com/adobe/helix-html-pipeline/blob/462296fbf64e608ff345ef14188cabbecddd839e/src/html-pipe.js#L158-L174 | helix-html-pipeline},
 * with the main difference being that we also handle MDX, including the
 * custom MDX syntax used for content blocks.
 *
 * @throws {Error} if there's a problem with the input.
 */
export default function md2markup(ctx: Helix.UniversalContext) {
  toMdast(ctx);
  mdxToGridtables(ctx); // must come before splitSections
  splitSections(ctx);
  toHast(ctx);
  fixSections(ctx);
  createPageBlocks(ctx);
  stringify(ctx);
  return ctx.attributes.content.html;
}
