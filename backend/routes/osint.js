const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const RssParser = require('rss-parser');
const cron = require('node-cron');

const rssParser = new RssParser();

const RSS_FEEDS = [
  { name: 'BMKG Gempa', url: 'https://data.bmkg.go.id/DataMKG/TEWS/autogempa.xml', category: 'Gempa Bumi' },
  { name: 'BMKG Cuaca', url: 'https://data.bmkg.go.id/DataMKG/MEWS/DigitalForecast/DigitalForecast-Indonesia.xml', category: 'Berita Umum' },
  { name: 'Detik News', url: 'https://rss.detik.com/index.php/society', category: 'Berita Umum' },
  { name: 'Kompas News', url: 'https://feeds.kompas.com/rss/cilik', category: 'Berita Umum' },
];

let feedResults = [];
let lastCrawl = null;
let isCrawling = false;

async function crawlFeeds() {
  if (isCrawling) return;
  isCrawling = true;
  const results = [];

  for (const feed of RSS_FEEDS) {
    try {
      const parsed = await rssParser.parseURL(feed.url);
      const items = (parsed.items || []).slice(0, 10).map(item => ({
        source: feed.name,
        category: feed.category,
        title: item.title || 'Tanpa Judul',
        url: item.link || '',
        snippet: (item.contentSnippet || item.content || '').substring(0, 200),
        published: item.pubDate || item.isoDate || new Date().toISOString(),
      }));
      results.push(...items);
    } catch (err) {
      console.error(`Crawl ${feed.name} error:`, err.message);
    }
  }

  feedResults = results.sort((a, b) => new Date(b.published) - new Date(a.published));
  lastCrawl = new Date().toISOString();
  isCrawling = false;
  console.log(`OSINT crawl complete: ${results.length} items from ${RSS_FEEDS.length} feeds`);
}

router.get('/feeds', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      items: feedResults,
      sources: RSS_FEEDS.map(f => f.name),
      lastCrawl,
      isCrawling,
      total: feedResults.length,
    },
  });
});

router.post('/crawl', authMiddleware, async (req, res) => {
  if (isCrawling) {
    return res.json({ success: true, message: 'Crawl sudah berjalan' });
  }
  crawlFeeds();
  res.json({ success: true, message: 'Crawl dimulai' });
});

router.get('/feeds/search', authMiddleware, (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ success: true, data: feedResults });
  const filtered = feedResults.filter(f =>
    f.title.toLowerCase().includes(q.toLowerCase()) ||
    f.snippet.toLowerCase().includes(q.toLowerCase()) ||
    f.source.toLowerCase().includes(q.toLowerCase())
  );
  res.json({ success: true, data: filtered });
});

// Auto crawl setiap 30 menit
cron.schedule('*/30 * * * *', () => { crawlFeeds(); });

// Initial crawl saat server start
setTimeout(crawlFeeds, 5000);

module.exports = router;
