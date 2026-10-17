import { bingItemToArticle, unwrapBingLink } from '../src/news/bing';
import { googleItemToArticle, googleNewsUrl } from '../src/news/google';
import { parseFeed, stripHtml, toIsoDate, truncate } from '../src/news/parse';
import { matchesKeyword } from '../src/news/publishers';

const googleItem = (title: string) =>
  `<item><title>${title}</title><link>https://news.google.com/rss/articles/CBMiek123?oc=5</link><guid isPermaLink="false">CBMi123</guid><pubDate>Sat, 17 Oct 2026 06:42:47 GMT</pubDate><description>&lt;a href="https://news.google.com/rss/articles/CBMiek123?oc=5" target="_blank"&gt;Anthropic proposes AI safety bill to US lawmakers&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;Punch Newspapers&lt;/font&gt;</description><source url="https://punchng.com">Punch Newspapers</source></item>`;

const googleFeed = (items: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>"AI" - Google News</title>${items}</channel></rss>`;

const bingFeed = `<?xml version="1.0" encoding="utf-8" ?><rss version="2.0" xmlns:News="https://www.bing.com:443/news/search?q=tsmc&amp;format=rss"><channel><title>TSMC - Bing News</title>
<item><title>TSMC: The AI Cycle Just Sent Another Signal</title><link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;aid=&amp;tid=6ad3&amp;url=https%3a%2f%2fseekingalpha.com%2farticle%2f4954981-tsmc&amp;c=107&amp;mkt=en-ww</link><description>TSMC&#8217;s Q3 revenue reached $46.7 billion.</description><pubDate>Sat, 17 Oct 2026 06:36:00 GMT</pubDate><News:Source>Seeking Alpha</News:Source></item>
<item><title><![CDATA[Chips & <b>Dips</b>]]></title><link>https://example.com/a</link><description><![CDATA[<p>Hello <em>world</em></p>]]></description><pubDate>Fri, 16 Oct 2026 10:00:00 +0100</pubDate></item>
</channel></rss>`;

const atomFeed = `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>The Verge</title>
<entry><title type="html">Apple announces &lt;i&gt;new&lt;/i&gt; iPad</title><link rel="replies" href="https://www.theverge.com/c/1"/><link rel="alternate" type="text/html" href="https://www.theverge.com/2026/10/17/ipad"/><summary type="html">&lt;p&gt;The new iPad is here.&lt;/p&gt;</summary><updated>2026-10-17T08:00:00-04:00</updated><published>2026-10-17T07:30:00-04:00</published><author><name>Jane Doe</name></author></entry>
<entry><title>Second</title><link href="https://www.theverge.com/second"/><content type="html">&lt;p&gt;Body&lt;/p&gt;</content><updated>2026-10-16T08:00:00Z</updated></entry>
</feed>`;

describe('parseFeed', () => {
  it('parses a single-item Google RSS feed', () => {
    const items = parseFeed(googleFeed(googleItem('Anthropic proposes AI safety bill to US lawmakers - Punch Newspapers')));
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      title: 'Anthropic proposes AI safety bill to US lawmakers - Punch Newspapers',
      link: 'https://news.google.com/rss/articles/CBMiek123?oc=5',
      description: 'Anthropic proposes AI safety bill to US lawmakers Punch Newspapers',
      source: 'Punch Newspapers',
      sourceUrl: 'https://punchng.com',
      publishedAt: '2026-10-17T06:42:47.000Z',
    });
  });

  it('parses multiple items, Bing News:Source, CDATA and numeric entities', () => {
    const items = parseFeed(bingFeed);
    expect(items).toHaveLength(2);
    expect(items[0].source).toBe('Seeking Alpha');
    expect(items[0].description).toBe('TSMC’s Q3 revenue reached $46.7 billion.');
    expect(items[1].title).toBe('Chips & Dips');
    expect(items[1].description).toBe('Hello world');
    expect(items[1].source).toBeNull();
    expect(items[1].publishedAt).toBe('2026-10-16T09:00:00.000Z');
  });

  it('parses Atom with object titles, preferred alternate link and author', () => {
    const items = parseFeed(atomFeed);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      title: 'Apple announces new iPad',
      link: 'https://www.theverge.com/2026/10/17/ipad',
      description: 'The new iPad is here.',
      source: 'Jane Doe',
      publishedAt: '2026-10-17T11:30:00.000Z',
    });
    expect(items[1]).toMatchObject({ link: 'https://www.theverge.com/second', description: 'Body', source: null });
  });

  it('skips items missing title or link and tolerates junk', () => {
    const xml = googleFeed('<item><title>No link</title></item><item><link>https://x.com</link></item>');
    expect(parseFeed(xml)).toEqual([]);
    expect(parseFeed('not xml at all')).toEqual([]);
    expect(parseFeed('')).toEqual([]);
    expect(parseFeed(googleFeed(''))).toEqual([]);
  });
});

describe('text helpers', () => {
  it('strips html and decodes entities', () => {
    expect(stripHtml('<p>A&nbsp;&amp;&#x41;&#66; <script>x()</script>\n\n<b>c</b> &quot;d&quot;</p>')).toBe('A &AB c "d"');
  });
  it('truncates at a word boundary', () => {
    const s = 'word '.repeat(100).trim();
    const t = truncate(s, 300);
    expect(t.length).toBeLessThanOrEqual(300);
    expect(t.endsWith('word…')).toBe(true);
    expect(truncate('short', 300)).toBe('short');
  });
  it('parses dates', () => {
    expect(toIsoDate('Sat, 17 Oct 2026 06:42:47 GMT')).toBe('2026-10-17T06:42:47.000Z');
    expect(toIsoDate('17 Oct 2026 06:42 EST')).toBe('2026-10-17T11:42:00.000Z');
    expect(toIsoDate('2026-10-17T06:42:47Z')).toBe('2026-10-17T06:42:47.000Z');
    expect(toIsoDate('garbage')).toBeNull();
    expect(toIsoDate(null)).toBeNull();
  });
});

describe('google', () => {
  it('builds the search url', () => {
    expect(googleNewsUrl('AI + geopolitics', { lang: 'en', country: 'NG' })).toBe(
      'https://news.google.com/rss/search?q=AI%20%2B%20geopolitics%20when%3A1d&hl=en-NG&gl=NG&ceid=NG:en',
    );
  });
  it('strips the publisher suffix and drops title-only snippets', () => {
    const [item] = parseFeed(googleFeed(googleItem('Anthropic proposes AI safety bill to US lawmakers - Punch Newspapers')));
    expect(googleItemToArticle(item, 'AI')).toEqual({
      keywordLabel: 'AI',
      title: 'Anthropic proposes AI safety bill to US lawmakers',
      snippet: null,
      source: 'Punch Newspapers',
      url: 'https://news.google.com/rss/articles/CBMiek123?oc=5',
      publishedAt: '2026-10-17T06:42:47.000Z',
    });
  });
  it('keeps suffixes that are not the source', () => {
    const [item] = parseFeed(googleFeed(googleItem('Q&amp;A - Part 2 - Punch Newspapers')));
    expect(googleItemToArticle(item, 'AI').title).toBe('Q&A - Part 2');
  });
});

describe('bing', () => {
  it('unwraps apiclick links', () => {
    const [item] = parseFeed(bingFeed);
    const a = bingItemToArticle(item, 'Chips');
    expect(a.url).toBe('https://seekingalpha.com/article/4954981-tsmc');
    expect(a.source).toBe('Seeking Alpha');
    expect(unwrapBingLink('https://example.com/a')).toBe('https://example.com/a');
    expect(unwrapBingLink('http://www.bing.com/x?url=%E0%A4%A')).toBe('http://www.bing.com/x?url=%E0%A4%A');
  });
});

describe('matchesKeyword', () => {
  it('requires all words, case-insensitive, whole words', () => {
    expect(matchesKeyword('Premier League transfers', 'Arsenal lead premier league transfer race')).toBe(true);
    expect(matchesKeyword('Premier League transfers', 'Premier Inn opens')).toBe(false);
    expect(matchesKeyword('AI', 'OpenAI said the AI model ships')).toBe(true);
    expect(matchesKeyword('AI', 'He said it was fine')).toBe(false);
    expect(matchesKeyword('', 'anything')).toBe(false);
  });
});
