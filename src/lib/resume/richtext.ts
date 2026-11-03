export interface Span {
  text: string;
  bold?: boolean;
  italic?: boolean;
  sup?: boolean;
  href?: string;
  br?: boolean;
}

const LINK_RE = /^\[([^\]]*)\]\(([^)\s]+)\)/;
const ESCAPABLE = "*^[]\\";

/** Parse the resume rich-text markup into flat styled spans. */
export function parseRich(
  src: string,
  inherited: Omit<Span, "text" | "br"> = {},
): Span[] {
  const spans: Span[] = [];
  let bold = !!inherited.bold;
  let italic = !!inherited.italic;
  let sup = !!inherited.sup;
  let buf = "";

  const flush = () => {
    if (!buf) return;
    spans.push({ text: buf, bold, italic, sup, href: inherited.href });
    buf = "";
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "\\" && i + 1 < src.length && ESCAPABLE.includes(src[i + 1])) {
      buf += src[++i];
    } else if (c === "*" && src[i + 1] === "*") {
      flush();
      bold = !bold;
      i++;
    } else if (c === "*") {
      flush();
      italic = !italic;
    } else if (c === "^") {
      flush();
      sup = !sup;
    } else if (c === "\n") {
      flush();
      spans.push({ text: "", br: true });
    } else if (c === "[" && !inherited.href) {
      const m = LINK_RE.exec(src.slice(i));
      if (m) {
        flush();
        spans.push(...parseRich(m[1], { bold, italic, sup, href: m[2] }));
        i += m[0].length - 1;
      } else {
        buf += c;
      }
    } else {
      buf += c;
    }
  }
  flush();
  return spans;
}

/** Plain text with markup removed (links keep their label). */
export function stripRich(src: string): string {
  return parseRich(src)
    .map((s) => (s.br ? "\n" : s.text))
    .join("");
}

/** Wrap the [start, end) range of `text` with a markup token, toggling it off if already wrapped. */
export function toggleWrap(
  text: string,
  start: number,
  end: number,
  token: string,
): { text: string; start: number; end: number } {
  const before = text.slice(0, start);
  const sel = text.slice(start, end);
  const after = text.slice(end);
  const n = token.length;
  if (before.endsWith(token) && after.startsWith(token)) {
    return {
      text: before.slice(0, -n) + sel + after.slice(n),
      start: start - n,
      end: end - n,
    };
  }
  if (sel.startsWith(token) && sel.endsWith(token) && sel.length >= 2 * n) {
    return {
      text: before + sel.slice(n, -n) + after,
      start,
      end: end - 2 * n,
    };
  }
  return {
    text: before + token + sel + token + after,
    start: start + n,
    end: end + n,
  };
}
