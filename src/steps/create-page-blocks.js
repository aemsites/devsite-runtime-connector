/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { h } from 'hastscript';
import { select } from 'hast-util-select';
import { toString } from 'hast-util-to-string';
import { CONTINUE, SKIP, visit } from 'unist-util-visit';

function childNodes(node) {
  return node.children.filter((n) => n.type === 'element');
}

function toBlockCSSClassNames(text) {
  if (!text) {
    return [];
  }
  const names = [];
  const idx = text.lastIndexOf('(');
  if (idx >= 0) {
    names.push(text.substring(0, idx));
    names.push(...text.substring(idx + 1).split(','));
  } else {
    names.push(text);
  }

  return names.map((name) => name
    .toLowerCase()
    .replace(/[^0-9a-z]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, ''))
    .filter((name) => !!name);
}

/**
 * Creates a "DIV representation" of a table.
 * @param {HTMLTTableElement} $table the table element
 * @returns {HTMLDivElement} the resulting div
 */
function tableToDivs($table) {
  const $cards = h('div');
  const $rows = [];
  for (const child of $table.children) {
    if (child.tagName === 'thead' || child.tagName === 'tbody') {
      $rows.push(...childNodes(child));
    }
  }

  if ($rows.length === 0) {
    return $cards;
  }
  const $headerCols = childNodes($rows.shift());
  if ($headerCols.length === 0) {
    return $cards;
  }

  // special case, only 1 row and 1 column with a nested table
  if ($rows.length === 0 && $headerCols.length === 1) {
    const $nestedTable = select(':scope table', $headerCols[0]);
    if ($nestedTable) {
      return $nestedTable;
    }
  }

  // get columns names
  $cards.properties.className = toBlockCSSClassNames(toString($headerCols[0]));
  if ($cards.properties.className.length === 0) {
    delete $cards.properties.className;
  }

  // construct page block
  for (const $row of $rows) {
    const $card = h('div');
    for (const $cell of childNodes($row)) {
      // convert to div
      $card.children.push(h('div', {
        'data-align': $cell.properties.align,
        'data-valign': $cell.properties.vAlign,
      }, $cell.children));
    }
    $cards.children.push($card);
  }
  return $cards;
}

/**
 * Converts tables into page blocks.
 * @param {import('@adobe/helix-universal').Helix.UniversalContext} ctx
 */
export default function createPageBlocks(ctx) {
  const { attributes: { content: { hast } } } = ctx;
  /** @type {import('../bindings').Content['hast']} */
  const phast = hast;
  visit(phast, (node, idx, parent) => {
    // console.log('******************************************************************');
    // console.log('node:');
    // console.dir(node, { depth: null, colors: true, maxArrayLength: null });
    if (node.tagName === 'table' && parent.tagName === 'div') {
      parent.children[idx] = tableToDivs(node);
      return SKIP;
    }
    if (node.tagName === 'table' && parent.tagName === 'div') {
      parent.children[idx] = tableToDivs(node);
      return SKIP;
    }
    return CONTINUE;
  });
}
