export const UK_GOV_ATOM_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xml:lang="en-US" xmlns="http://www.w3.org/2005/Atom">
  <title>Travel Advice Summary</title>
  <entry>
    <id>https://www.gov.uk/foreign-travel-advice/japan#2026-09-01</id>
    <updated>2026-09-01T12:05:48+01:00</updated>
    <link rel="alternate" href="https://www.gov.uk/foreign-travel-advice/japan"/>
    <title>Japan</title>
    <summary type="html">&lt;p&gt;Updated visa guidance for travelers.&lt;/p&gt;</summary>
  </entry>
  <entry>
    <id>https://www.gov.uk/foreign-travel-advice/kenya#2026-09-01</id>
    <updated>2026-09-01T10:00:00+01:00</updated>
    <link rel="alternate" href="https://www.gov.uk/foreign-travel-advice/kenya"/>
    <title>Kenya</title>
    <summary type="html">&lt;p&gt;Flight delays due to industrial action.&lt;/p&gt;</summary>
  </entry>
</feed>`;

export const NYT_TRAVEL_RSS_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>NYT Travel</title>
    <item>
      <title>How to Plan a Trip to Spain</title>
      <link>https://www.nytimes.com/2026/09/01/travel/spain-trip.html</link>
      <guid>https://www.nytimes.com/2026/09/01/travel/spain-trip.html</guid>
      <pubDate>Mon, 01 Sep 2026 10:00:00 GMT</pubDate>
      <description>Practical tips for booking flights and hotels in Spain this season.</description>
    </item>
    <item>
      <title>Short</title>
      <link>https://www.nytimes.com/2026/09/01/travel/short.html</link>
      <description>Too short</description>
    </item>
  </channel>
</rss>`;

export const MALFORMED_XML = `<not-xml`;
