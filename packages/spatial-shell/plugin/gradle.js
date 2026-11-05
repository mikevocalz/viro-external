'use strict';

/**
 * Quest flavor ordering in `app/build.gradle`.
 *
 * Gradle creates `questImplementation` (and the other `quest*`
 * configurations) when the `quest` product flavor is declared. A block that
 * calls `questImplementation` above that declaration fails the build with
 * "Could not find method questImplementation()". The Meta Layout SDK block
 * (MetaVRX BOM as `questImplementation`) and the flavor block come from
 * different plugins, and Expo runs mods in reverse registration order, so
 * which lands first depends on plugin order. expo-pico #45 fixed this inside
 * expo-horizon-quest; this does the same for any plugin pair, after every
 * other mod has written the file.
 */

const QUEST_CONFIGURATION = /\bquest(?:Implementation|Api|CompileOnly|RuntimeOnly|AnnotationProcessor)\b/g;
const QUEST_FLAVOR = /(^|[\s{;])quest\s*\{/g;
const MARKED_REGION_BEGIN = /^[ \t]*\/\/ [^\n]*: begin quest flavor[^\n]*$/m;
const MARKED_REGION_END = /^[ \t]*\/\/ [^\n]*: end quest flavor[^\n]*$/m;

/**
 * Brace depth before every character, skipping strings and comments.
 * `depth[i]` is the depth just before `contents[i]`.
 *
 * @param {string} contents
 * @returns {Int32Array}
 */
function depthMap(contents) {
  const depth = new Int32Array(contents.length + 1);
  let level = 0;
  let index = 0;
  /** @param {number} to */
  const skipTo = (to) => {
    depth.fill(level, index, to);
    index = to;
  };
  while (index < contents.length) {
    const char = contents[index];
    const next = contents[index + 1];
    if (char === '/' && next === '/') {
      const end = contents.indexOf('\n', index);
      skipTo(end === -1 ? contents.length : end);
    } else if (char === '/' && next === '*') {
      const end = contents.indexOf('*/', index + 2);
      skipTo(end === -1 ? contents.length : end + 2);
    } else if (char === '"' || char === "'") {
      const quote = contents.startsWith(char.repeat(3), index) ? char.repeat(3) : char;
      let cursor = index + quote.length;
      while (cursor < contents.length && !contents.startsWith(quote, cursor)) {
        cursor += contents[cursor] === '\\' ? 2 : 1;
      }
      skipTo(Math.min(contents.length, cursor + quote.length));
    } else {
      depth[index] = level;
      if (char === '{') level += 1;
      else if (char === '}') level = Math.max(0, level - 1);
      index += 1;
    }
  }
  depth[contents.length] = level;
  return depth;
}

/**
 * Start of the line holding `index`.
 *
 * @param {string} contents
 * @param {number} index
 * @returns {number}
 */
function lineStart(contents, index) {
  return contents.lastIndexOf('\n', index - 1) + 1;
}

/**
 * End of the line holding `index`, past its newline.
 *
 * @param {string} contents
 * @param {number} index
 * @returns {number}
 */
function lineEnd(contents, index) {
  const newline = contents.indexOf('\n', index);
  return newline === -1 ? contents.length : newline + 1;
}

/**
 * The top-level statement that contains `index`: from the start of its first
 * line, pulled up over comment lines directly above it, to the end of the
 * line where its outermost braces close.
 *
 * @param {string} contents
 * @param {Int32Array} depth
 * @param {number} index
 * @returns {{ start: number, end: number }}
 */
function topLevelBlockAt(contents, depth, index) {
  let head = index;
  while (head > 0 && depth[head] !== 0) head -= 1;
  let start = lineStart(contents, head);
  while (start > 0) {
    const previous = lineStart(contents, start - 1);
    if (!/^[ \t]*\/\//.test(contents.slice(previous, start - 1))) break;
    start = previous;
  }
  let open = head;
  while (open < contents.length && !(contents[open] === '{' && depth[open] === 0)) {
    if (open > index && contents[open] === '\n') return { start, end: lineEnd(contents, index) };
    open += 1;
  }
  let close = open + 1;
  while (close < contents.length && !(contents[close] === '}' && depth[close + 1] === 0)) close += 1;
  return { start, end: lineEnd(contents, close) };
}

/**
 * The region holding the quest flavor declaration, or undefined when the
 * file declares no quest flavor. A `// ...: begin quest flavor` / `// ...:
 * end quest flavor` marker pair wins over brace matching, so a plugin's whole
 * managed region moves as one piece.
 *
 * @param {string} contents
 * @param {Int32Array} depth
 * @returns {{ start: number, end: number } | undefined}
 */
function questFlavorRegion(contents, depth) {
  const begin = MARKED_REGION_BEGIN.exec(contents);
  const end = MARKED_REGION_END.exec(contents);
  if (begin && end && end.index > begin.index) {
    const close = contents.indexOf('\n', end.index);
    return { start: begin.index, end: close === -1 ? contents.length : close + 1 };
  }
  QUEST_FLAVOR.lastIndex = 0;
  for (let match = QUEST_FLAVOR.exec(contents); match; match = QUEST_FLAVOR.exec(contents)) {
    const at = match.index + (match[1] ?? '').length;
    if ((depth[at] ?? 0) < 2) continue;
    const enclosing = contents.slice(lineStart(contents, Math.max(0, at - 400)), at);
    if (!/productFlavors\s*\{/.test(enclosing)) continue;
    return topLevelBlockAt(contents, depth, at);
  }
  return undefined;
}

/**
 * Index of the first `quest*` configuration call outside comments and
 * strings, or -1.
 *
 * @param {string} contents
 * @returns {number}
 */
function firstQuestConfigurationUse(contents) {
  const stripped = contents
    .replace(/\/\*[\s\S]*?\*\//g, (text) => ' '.repeat(text.length))
    .replace(/\/\/[^\n]*/g, (text) => ' '.repeat(text.length));
  QUEST_CONFIGURATION.lastIndex = 0;
  const match = QUEST_CONFIGURATION.exec(stripped);
  return match ? match.index : -1;
}

/**
 * Moves the quest flavor declaration above the first top-level block that
 * uses a `quest*` configuration. Returns the input unchanged when the order
 * is already right, the file uses no quest configuration, or it declares no
 * quest flavor. Pure and idempotent.
 *
 * @param {string} contents `app/build.gradle`.
 * @returns {string}
 */
function placeQuestFlavorBeforeQuestDependencies(contents) {
  const use = firstQuestConfigurationUse(contents);
  if (use === -1) return contents;
  const depth = depthMap(contents);
  const flavor = questFlavorRegion(contents, depth);
  if (flavor === undefined) return contents;
  const usage = topLevelBlockAt(contents, depth, use);
  if (flavor.start <= usage.start) return contents;
  const region = contents.slice(flavor.start, flavor.end).replace(/\n*$/, '\n');
  const before = contents.slice(0, flavor.start);
  const after = contents.slice(flavor.end);
  // Drop the blank line that separated the moved region from what preceded it.
  const without = after === '' || after.startsWith('\n') ? before.replace(/\n+$/, '\n') + after.replace(/^\n+/, after === '' ? '' : '\n') : before + after;
  return without.slice(0, usage.start) + region + '\n' + without.slice(usage.start);
}

module.exports = { placeQuestFlavorBeforeQuestDependencies };
