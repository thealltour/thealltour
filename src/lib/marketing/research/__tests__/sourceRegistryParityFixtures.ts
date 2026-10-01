const LONG_FCDO_SUMMARY =
  "Latest update: the security situation remains unpredictable. Terrorists are very likely to try to carry out attacks. " +
  "You should stay aware of your surroundings at all times, keep up to date with local media reports and follow the advice " +
  "of local authorities, including any curfews or restrictions on movement that may be introduced at short notice.";

export const UK_ATOM_PARITY = `<?xml version="1.0" encoding="UTF-8"?>
<feed xml:lang="en-US" xmlns="http://www.w3.org/2005/Atom">
  <title>Travel Advice Summary</title>
  <entry>
    <id>https://www.gov.uk/foreign-travel-advice/japan#2026-09-30</id>
    <updated>2026-09-30T12:05:48+01:00</updated>
    <link rel="alternate" href="https://www.gov.uk/foreign-travel-advice/japan"/>
    <title>Japan</title>
    <summary type="html">&lt;p&gt;Updated visa guidance for travelers.&lt;/p&gt;</summary>
  </entry>
  <entry>
    <id>https://www.gov.uk/foreign-travel-advice/thailand#2026-09-30</id>
    <updated>2026-09-30T10:00:00+01:00</updated>
    <link rel="alternate" href="https://www.gov.uk/foreign-travel-advice/thailand"/>
    <title>Thailand</title>
    <summary type="html">&lt;p&gt;${LONG_FCDO_SUMMARY}&lt;/p&gt;</summary>
  </entry>
  <entry>
    <id>https://www.gov.uk/foreign-travel-advice/italy#2026-09-29</id>
    <updated>2026-09-29T09:00:00+01:00</updated>
    <link rel="alternate" href="https://www.gov.uk/foreign-travel-advice/italy"/>
    <title>Italy</title>
    <summary type="html">&lt;p&gt;Holidays.&lt;/p&gt;</summary>
  </entry>
</feed>`;

export const NYT_RSS_PARITY = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>NYT Travel</title>
    <item>
      <title>How to Plan a Trip to Spain</title>
      <link>https://www.nytimes.com/2026/09/29/travel/spain-trip.html</link>
      <guid>https://www.nytimes.com/2026/09/29/travel/spain-trip.html</guid>
      <pubDate>Tue, 29 Sep 2026 10:00:00 GMT</pubDate>
      <description>Practical tips for booking flights and hotels in Spain this season.</description>
    </item>
    <item>
      <title>A Long Weekend in Lisbon</title>
      <link>https://www.nytimes.com/2026/09/28/travel/lisbon.html</link>
      <guid>https://www.nytimes.com/2026/09/28/travel/lisbon.html</guid>
      <pubDate>Mon, 28 Sep 2026 10:00:00 GMT</pubDate>
      <description>${"Tiled facades, custard tarts and late-night fado: a guide to three days in the Portuguese capital, from the hills of Alfama to the riverside warehouses of Marvila. ".repeat(2)}</description>
    </item>
    <item>
      <title>Short</title>
      <link>https://www.nytimes.com/2026/09/27/travel/short.html</link>
      <description>Too short</description>
    </item>
  </channel>
</rss>`;

export const KR_RSS_PARITY = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>여행 매체</title>
    <item>
      <title>추석 앞두고 도쿄권 태풍 변수…275편 결항 뒤 상황은</title>
      <link>https://example.co.kr/news/articleView.html?idxno=1001</link>
      <guid>https://example.co.kr/news/articleView.html?idxno=1001</guid>
      <pubDate>Tue, 29 Sep 2026 08:00:00 +0900</pubDate>
      <description>태풍 영향으로 하네다와 나리타 공항 항공편이 대거 결항됐다. 항공사들은 추석 연휴 일정 변경을 안내하고 있다.</description>
    </item>
    <item>
      <title>짧은 글</title>
      <link>https://example.co.kr/news/articleView.html?idxno=1002</link>
      <description>짧음</description>
    </item>
    <item>
      <title>가을엔 3대가 함께 코타키나발루로</title>
      <link>https://example.co.kr/news/articleView.html?idxno=1003</link>
      <pubDate>Mon, 28 Sep 2026 08:00:00 +0900</pubDate>
      <description>${"가족 여행객을 위한 리조트 패키지와 직항 노선 정보를 정리했다. 키즈 클럽과 스파, 반딧불 투어까지 일정별로 소개한다. ".repeat(4)}</description>
    </item>
  </channel>
</rss>`;

export const VN_RSS_PARITY = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Vietnam Travel</title>
    <item>
      <title>A celestial journey through Vietnam</title>
      <link>https://vietnam.travel/things-to-do/celestial-journey</link>
      <guid>https://vietnam.travel/things-to-do/celestial-journey</guid>
      <pubDate>Wed, 30 Sep 2026 03:00:00 GMT</pubDate>
      <description>Stargazing nights in the northern highlands and quiet mountain homestays.</description>
    </item>
    <item>
      <title>Vietnam extends e-visa validity</title>
      <link>https://vietnam.travel/plan-your-trip/e-visa</link>
      <pubDate>Tue, 29 Sep 2026 03:00:00 GMT</pubDate>
      <description>Visitors can now stay longer on a single-entry e-visa.</description>
    </item>
    <item>
      <title>New flight connects Da Nang and Busan</title>
      <link>https://vietnam.travel/news/da-nang-busan</link>
      <pubDate>Mon, 28 Sep 2026 03:00:00 GMT</pubDate>
      <description>Service begins next month with daily departures.</description>
    </item>
  </channel>
</rss>`;

export const PARITY_FIXTURE_BY_FEED: Record<string, string> = {
  "https://www.gov.uk/foreign-travel-advice.atom": UK_ATOM_PARITY,
  "https://rss.nytimes.com/services/xml/rss/nyt/Travel.xml": NYT_RSS_PARITY,
  "https://www.traveltimes.co.kr/rss/allArticle.xml": KR_RSS_PARITY,
  "https://www.travie.com/rss/allArticle.xml": KR_RSS_PARITY,
  "https://www.traveldaily.co.kr/rss/allArticle.xml": KR_RSS_PARITY,
  "https://vietnam.travel/rss.xml": VN_RSS_PARITY,
};

export function mockFeedFetch(payload: Record<string, string>, requested: string[] = []) {
  return (async (url: string | URL) => {
    const key = String(url);
    requested.push(key);
    const body = payload[key];
    if (!body) {
      return { ok: false, status: 404, headers: { get: () => null }, body: null };
    }
    const encoded = new TextEncoder().encode(body);
    return {
      ok: true,
      status: 200,
      headers: { get: () => "application/xml" },
      body: {
        getReader: () => {
          let done = false;
          return {
            read: async () => {
              if (done) return { done: true, value: undefined };
              done = true;
              return { done: false, value: encoded };
            },
          };
        },
      },
    };
  }) as unknown as typeof fetch;
}

/** Source row as it was before `metadata.semantics` existed; key order is preserved. */
export function withoutSemantics<T extends { metadata?: Record<string, unknown> | null } | null>(row: T): T {
  if (!row?.metadata || !("semantics" in row.metadata)) return row;
  const metadata = { ...row.metadata };
  delete metadata.semantics;
  return { ...row, metadata };
}

/**
 * Legacy row without the dead metadata keys the projection no longer writes
 * (`destinationFocus`, `portfolio.evidenceAuthorityWeight`); key order is preserved.
 */
export function withoutRemovedDeadMetadata<T extends { metadata?: Record<string, unknown> | null } | null>(row: T): T {
  if (!row?.metadata) return row;
  const metadata: Record<string, unknown> = { ...row.metadata };
  delete metadata.destinationFocus;
  const portfolio = metadata.portfolio;
  if (portfolio && typeof portfolio === "object" && !Array.isArray(portfolio)) {
    const live = { ...(portfolio as Record<string, unknown>) };
    delete live.evidenceAuthorityWeight;
    metadata.portfolio = live;
  }
  return { ...row, metadata };
}
