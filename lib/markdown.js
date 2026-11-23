// Derived from makefun-site's MIT-licensed Markdown dialect; see ../NOTICE.
import { escapeHtml, slugify, uniqueSlug } from './text.js';

const FENCE_OPEN = /^```([A-Za-z0-9_+-]*)[ \t]*$/;
const FENCE_CLOSE = /^```[ \t]*$/;
const HEADING = /^(#{1,6})[ \t]+(.*?)[ \t]*$/;
const HR = /^(?:---|\*\*\*)[ \t]*$/;
const BULLET = /^[-*] (.*)$/;
const ORDERED = /^(\d{1,9})\. (.*)$/;
const CONTINUED = /^ {2,}\S/;
const WHITE = /\s/;

const escaped = [];
escaped[38] = '&amp;'; escaped[60] = '&lt;'; escaped[62] = '&gt;';
escaped[34] = '&quot;'; escaped[39] = '&#39;';
const escapable = new Uint8Array(128);
for (const c of "\\`*_[]()#+-.!>") escapable[c.charCodeAt(0)] = 1;

// Delimiter search has its own escape state: a search starts just after the
// opener, rather than inheriting state from the enclosing inline span.
function closeAt(s, start, end, c, kind) {
  for (let j = start; j < end; j++) {
    const ch = s.charCodeAt(j);
    if (ch === 92 && j + 1 < end && escapable[s.charCodeAt(j + 1)]) {
      j++;
    } else if (ch === c) {
      if (kind === 0) return j;
      if (j + 1 < end && s.charCodeAt(j + 1) === 42) {
        if (kind === 2) return j;
        j++;
      } else if (kind === 1) return j;
    }
  }
  return -1;
}

function emitInline(s, start, end, env) {
  let out = '', literal = start, i = start;
  while (i < end) {
    const c = s.charCodeAt(i);
    let replacement, next = i + 1;
    switch (c) {
      case 92: {
        const ch = s.charCodeAt(next);
        if (next < end && escapable[ch]) {
          replacement = escaped[ch] ?? s[next];
          next++;
        }
        break;
      }
      case 96: {
        const j = s.indexOf('`', next);
        if (j > next && j < end) {
          replacement = '<code>' + escapeHtml(s.slice(next, j)) + '</code>';
          next = j + 1;
        }
        break;
      }
      case 42: {
        const strong = next < end && s.charCodeAt(next) === 42;
        if (strong) next++;
        const j = closeAt(s, next, end, 42, strong ? 2 : 1);
        if (j > next) {
          const tag = strong ? 'strong' : 'em';
          replacement = '<' + tag + '>' + emitInline(s, next, j, env) + '</' + tag + '>';
          next = j + (strong ? 2 : 1);
        }
        break;
      }
      case 91: {
        const k = closeAt(s, next, end, 93, 0);
        if (k >= 0 && s.charCodeAt(k + 1) === 40) {
          const j = s.indexOf(')', k + 2);
          if (j > k + 2 && j < end) {
            const target = s.slice(k + 2, j);
            if (!WHITE.test(target)) {
              replacement = '<a href="' + escapeHtml(env.link(target)) + '">' + emitInline(s, next, k, env) + '</a>';
              next = j + 1;
            }
          }
        }
        break;
      }
      case 38: case 60: case 62: case 34: case 39:
        replacement = escaped[c];
        break;
    }
    if (replacement !== undefined) {
      if (literal !== i) out += s.slice(literal, i);
      out += replacement;
      literal = next;
    }
    i = next;
  }
  return literal === end ? out : out + s.slice(literal, end);
}

export function inline(s, env) { return emitInline(s, 0, s.length, env); }

function spaceTab(c) { return c === 32 || c === 9; }
function trimLine(s) {
  let a = 0, z = s.length;
  while (a < z && spaceTab(s.charCodeAt(a))) a++;
  while (z > a && spaceTab(s.charCodeAt(z - 1))) z--;
  return a === 0 && z === s.length ? s : s.slice(a, z);
}
function endsParagraph(line) {
  const c = line.charCodeAt(0);
  switch (c) {
    case 35: { const h = HEADING.exec(line); return h !== null && h[2] !== ''; }
    case 96: return FENCE_OPEN.test(line);
    case 45: case 42: return HR.test(line);
    case 32: case 9: return trimLine(line) === '';
    default: return line.length === 0;
  }
}

// Render as each block is closed. Only a block's pending text is retained;
// paragraph line breaks remain visible to inline parsing and its link rules.
export function renderMarkdown(src, env) {
  const lines = src.split('\n');
  let ids, i = 0, out = '', excerpt = null;
  const toc = [];
  while (i < lines.length) {
    const line = lines[i++], c = line.charCodeAt(0);
    if (line === '' || (spaceTab(c) && trimLine(line) === '')) continue;
    if (c === 96) {
      const fence = FENCE_OPEN.exec(line);
      if (fence !== null) {
        out += fence[1] === '' ? '<pre><code>' : '<pre><code class="language-' + fence[1] + '">';
        let body = '', n = i;
        while (i < lines.length && !(lines[i].charCodeAt(0) === 96 && FENCE_CLOSE.test(lines[i]))) i++;
        if (i > n) body = escapeHtml(lines.slice(n, i).join('\n')) + '\n';
        out += body + '</code></pre>\n';
        i++;
        continue;
      }
    } else if (c === 35) {
      const h = HEADING.exec(line);
      if (h !== null && h[2] !== '') {
        const level = h[1].length;
        const id = uniqueSlug(slugify(h[2]), ids ??= new Set());
        const html = inline(h[2], env);
        out += `<h${level} id="${id}">${html}</h${level}>\n`;
        if (level === 2 || level === 3) toc.push({ level, id, html });
        continue;
      }
    } else if ((c === 45 || c === 42) && HR.test(line)) {
      out += '<hr>\n';
      continue;
    } else if (c === 62) {
      let body = '', q = line;
      do {
        const part = trimLine(q.slice(q.charCodeAt(1) === 32 ? 2 : 1));
        if (part !== '') body += body === '' ? part : '\n' + part;
        if (i === lines.length || lines[i].charCodeAt(0) !== 62) break;
        q = lines[i++];
      } while (true);
      out += body === '' ? '<blockquote>\n</blockquote>\n' : '<blockquote>\n<p>' + inline(body, env) + '</p>\n</blockquote>\n';
      continue;
    }
    const bullet = c === 45 || c === 42;
    const ordered = c >= 48 && c <= 57;
    const marker = bullet ? BULLET : ORDERED;
    const head = (bullet || ordered) ? marker.exec(line) : null;
    if (head !== null) {
      const tag = ordered ? 'ol' : 'ul', field = ordered ? 2 : 1;
      const start = ordered ? Number(head[1]) : 1;
      out += start === 1 ? '<' + tag + '>\n' : '<ol start="' + start + '">\n';
      let item = trimLine(head[field]);
      while (i < lines.length) {
        const row = lines[i], m = marker.exec(row);
        if (m !== null) {
          out += '<li>' + inline(item, env) + '</li>\n';
          item = trimLine(m[field]);
        } else if (row.charCodeAt(0) === 32 && CONTINUED.test(row)) {
          item += '\n' + trimLine(row);
        } else break;
        i++;
      }
      out += '<li>' + inline(item, env) + '</li>\n</' + tag + '>\n';
      continue;
    }
    let p = trimLine(line);
    while (i < lines.length && !endsParagraph(lines[i])) p += '\n' + trimLine(lines[i++]);
    const html = inline(p, env);
    if (excerpt === null) excerpt = html;
    out += '<p>' + html + '</p>\n';
  }
  return { html: out, toc, excerpt: excerpt ?? '' };
}
