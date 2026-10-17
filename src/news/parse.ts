import { XMLParser } from 'fast-xml-parser';

/** A feed item before keyword/source-specific shaping. Text is plain (HTML stripped). */
export interface RawItem {
  title: string;
  link: string;
  description: string | null; // HTML stripped, not truncated
  source: string | null;
  sourceUrl: string | null;
  publishedAt: string | null; // ISO 8601
}

type XmlNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  htmlEntities: true,
});

function isNode(v: unknown): v is XmlNode {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function toArray(v: unknown): unknown[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function localName(key: string): string {
  const i = key.indexOf(':');
  return (i >= 0 ? key.slice(i + 1) : key).toLowerCase();
}

/** Finds a child by exact key first, then by namespace-less, case-insensitive name. */
function child(node: XmlNode, name: string): unknown {
  if (name in node) return node[name];
  const want = name.toLowerCase();
  for (const key of Object.keys(node)) {
    if (!key.startsWith('@_') && localName(key) === want) return node[key];
  }
  return undefined;
}

/** Text content of a node: string, number, or object with #text. Arrays use the first value. */
function text(v: unknown): string | null {
  if (Array.isArray(v)) return v.length ? text(v[0]) : null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (isNode(v)) return text(v['#text']);
  return null;
}

function attr(v: unknown, name: string): string | null {
  if (!isNode(v)) return null;
  const a = v[`@_${name}`];
  return typeof a === 'string' ? a : null;
}

function clean(v: unknown): string | null {
  const t = text(v);
  if (t === null) return null;
  const s = stripHtml(t);
  return s.length ? s : null;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
  copy: '©',
  reg: '®',
  trade: '™',
  euro: '€',
  pound: '£',
  bull: '•',
  middot: '·',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return m;
      try {
        return String.fromCodePoint(code);
      } catch {
        return m;
      }
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? m;
  });
}

/** Removes tags, decodes entities and collapses whitespace. Output is plain text. */
export function stripHtml(s: string): string {
  const noTags = s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/?[a-z][^>]*>/gi, ' ');
  // Decode after stripping so encoded "&lt;b&gt;" text stays text; a second
  // pass strips tags that were entity-encoded in the feed.
  return decodeEntities(noTags)
    .replace(/<\/?[a-z][^>]*>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Truncates at a word boundary and appends an ellipsis when cut. */
export function truncate(s: string, max = 300): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  const base = space > max * 0.6 ? cut.slice(0, space) : cut;
  return `${base.replace(/[\s.,;:!?-]+$/, '')}…`;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
const ZONES: Record<string, number> = {
  GMT: 0, UT: 0, UTC: 0, Z: 0, EST: -300, EDT: -240, CST: -360, CDT: -300, MST: -420, MDT: -360, PST: -480, PDT: -420,
};

/** RFC 822 / ISO 8601 date to ISO string, or null. Does not rely on engine-specific Date parsing for RFC 822. */
export function toIsoDate(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const m = /^(?:[a-z]{3},?\s+)?(\d{1,2})\s+([a-z]{3})[a-z]*\s+(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([a-z]+|[+-]\d{4})?$/i.exec(s);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month !== undefined) {
      let year = Number(m[3]);
      if (year < 100) year += 2000;
      let offset = 0;
      const zone = m[7];
      if (zone) {
        if (/^[+-]\d{4}$/.test(zone)) {
          const sign = zone[0] === '-' ? -1 : 1;
          offset = sign * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(3, 5)));
        } else {
          offset = ZONES[zone.toUpperCase()] ?? 0;
        }
      }
      const ms = Date.UTC(year, month, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0)) - offset * 60_000;
      return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
    }
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function atomLink(v: unknown): string | null {
  const links = toArray(v);
  let fallback: string | null = null;
  for (const l of links) {
    if (typeof l === 'string') {
      fallback ??= l;
      continue;
    }
    const href = attr(l, 'href');
    if (!href) continue;
    const rel = attr(l, 'rel');
    if (!rel || rel === 'alternate') return href;
    fallback ??= href;
  }
  return fallback;
}

function rssItem(node: XmlNode): RawItem | null {
  const title = clean(child(node, 'title'));
  let link = text(child(node, 'link'))?.trim() || null;
  if (!link) {
    const guid = child(node, 'guid');
    const g = text(guid)?.trim();
    if (g && /^https?:\/\//i.test(g) && attr(guid, 'isPermaLink') !== 'false') link = g;
  }
  if (!title || !link) return null;
  const src = child(node, 'source');
  return {
    title,
    link,
    description: clean(child(node, 'description')) ?? clean(child(node, 'encoded')),
    source: clean(src),
    sourceUrl: attr(src, 'url'),
    publishedAt: toIsoDate(text(child(node, 'pubDate')) ?? text(child(node, 'date'))),
  };
}

function atomEntry(node: XmlNode): RawItem | null {
  const title = clean(child(node, 'title'));
  const link = atomLink(child(node, 'link'));
  if (!title || !link) return null;
  const author = toArray(child(node, 'author'))[0];
  return {
    title,
    link,
    description: clean(child(node, 'summary')) ?? clean(child(node, 'content')),
    source: isNode(author) ? clean(child(author, 'name')) : null,
    sourceUrl: null,
    publishedAt: toIsoDate(text(child(node, 'published')) ?? text(child(node, 'updated'))),
  };
}

/** Parses RSS 2.0 or Atom. Returns [] for unparseable input. */
export function parseFeed(xml: string): RawItem[] {
  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch {
    return [];
  }
  if (!isNode(doc)) return [];

  const out: RawItem[] = [];
  const rss = child(doc, 'rss') ?? child(doc, 'RDF');
  if (isNode(rss)) {
    const channel = toArray(child(rss, 'channel'))[0];
    const items = [
      ...(isNode(channel) ? toArray(child(channel, 'item')) : []),
      ...toArray(child(rss, 'item')), // RSS 1.0 puts items beside channel
    ];
    for (const it of items) {
      const r = isNode(it) ? rssItem(it) : null;
      if (r) out.push(r);
    }
    return out;
  }

  const feed = child(doc, 'feed');
  if (isNode(feed)) {
    for (const e of toArray(child(feed, 'entry'))) {
      const r = isNode(e) ? atomEntry(e) : null;
      if (r) out.push(r);
    }
  }
  return out;
}
