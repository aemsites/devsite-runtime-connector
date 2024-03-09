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

/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */

import { Helix } from '@adobe/helix-universal';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { dereference, remarkGfmNoLink } from '@adobe/helix-markdown-support';
import remarkGridTable from '@adobe/remark-gridtables';
import { removePosition } from 'unist-util-remove-position';
import remarkMdx from 'remark-mdx';
import remarkFrontmatter from 'remark-frontmatter';

export default function toMdast(ctx: Helix.UniversalContext) {
  const { content } = ctx.attributes;

  const converted = content.md.replace(/(\r\n|\n|\r)/gm, '\n');
  content.mdast = unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkMdx)
    .use(remarkGfmNoLink)
    .use(remarkGridTable)
    .parse(converted);

  removePosition(content.mdast, { force: true });
  dereference(content.mdast);
}
