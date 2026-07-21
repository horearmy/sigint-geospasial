const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const RssParser = require('rss-parser');
const https = require('https');
const http = require('http');
const { parseString } = require('xml2js');

const rssParser = new RssParser({ timeout: 10000 });

const RSS_FEEDS = [
  { name: 'Antara Nasional', url: 'https://www.antaranews.com/rss/top-news', category: 'Berita Nasional' },
  { name: 'Antara Ekonomi', url: 'https://www.antaranews.com/rss/ekonomi', category: 'Ekonomi' },
  { name: 'Republika', url: 'https://www.republika.co.id/rss/', category: 'Berita Nasional' },
  { name: 'Tempo Nasional', url: 'https://rss.tempo.co/nasional', category: 'Berita Nasional' },
  { name: 'CNBC Indonesia', url: 'https://www.cnbcindonesia.com/news/rss', category: 'Ekonomi' },
  { name: 'CNN Indonesia', url: 'https://www.cnnindonesia.com/nasional/rss', category: 'Berita Nasional' },
  { name: 'Liputan6', url: 'https://feed.liputan6.com/rss/news', category: 'Berita Umum' },
];

const BMKG_URL = 'https://data.bmkg.go.id/DataMKG/TEWS/autogempa.xml';

let feedResults = [];
let lastCrawl = null;
let isCrawling = false;

function fetchUrl(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const opts = { timeout };
    client.get(url, opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject).on('timeout', function () { this.destroy(); reject(new Error('Timeout')); });
  });
}

async function fetchBMKG() {
  try {
    console.log('  Fetching BMKG gempa...');
    const xml = await fetchUrl(BMKG_URL);
    return new Promise((resolve) => {
      parseString(xml, { explicitArray: false }, (err, result) => {
        if (err) { console.error('  BMKG parse error:', err.message); resolve(null); return; }
        try {
          const g = result.Infogempa.gempa;
          const coords = g.point.coordinates.split(',').map(Number);
          console.log(`  ✓ BMKG Gempa: M${g.Magnitude} ${g.Wilayah}`);
          resolve({
            source: 'BMKG Gempa',
            category: 'Gempa Bumi',
            title: `Gempa M${g.Magnitude} - ${g.Wilayah}`,
            url: `https://data.bmkg.go.id/DataMKG/TEWS/${g.Shakemap}`,
            snippet: `Tanggal: ${g.Tanggal} ${g.Jam} | Kedalaman: ${g.Kedalaman} | Potensi: ${g.Potensi} | Dirasakan: ${g.Dirasakan}`,
            published: g.DateTime || new Date().toISOString(),
            coords: { lat: coords[0], lng: coords[1] },
          });
        } catch (e) { console.error('  BMKG data error:', e.message); resolve(null); }
      });
    });
  } catch (err) {
    console.error('  BMKG fetch error:', err.message);
    return null;
  }
}

async function crawlFeeds() {
  if (isCrawling) return;
  isCrawling = true;
  const results = [];
  console.log(`OSINT crawl started...`);

  const bmkg = await fetchBMKG();
  if (bmkg) results.push(bmkg);

  for (const feed of RSS_FEEDS) {
    try {
      const parsed = await rssParser.parseURL(feed.url);
      const items = (parsed.items || []).slice(0, 15).map(item => ({
        source: feed.name,
        category: feed.category,
        title: item.title || 'Tanpa Judul',
        url: item.link || '',
        snippet: (item.contentSnippet || item.content || '').replace(/<[^>]*>/g, '').substring(0, 200),
        published: item.pubDate || item.isoDate || new Date().toISOString(),
      }));
      results.push(...items);
      console.log(`  ✓ ${feed.name}: ${items.length} items`);
    } catch (err) {
      console.error(`  ✗ ${feed.name}: ${err.message}`);
    }
  }

  feedResults = results.sort((a, b) => new Date(b.published) - new Date(a.published));
  lastCrawl = new Date().toISOString();
  isCrawling = false;
  console.log(`OSINT crawl complete: ${results.length} items`);
}

router.get('/feeds', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      items: feedResults,
      sources: ['BMKG Gempa', ...RSS_FEEDS.map(f => f.name)],
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
    (f.snippet && f.snippet.toLowerCase().includes(q.toLowerCase())) ||
    f.source.toLowerCase().includes(q.toLowerCase())
  );
  res.json({ success: true, data: filtered });
});

const cron = require('node-cron');
cron.schedule('*/30 * * * *', () => { crawlFeeds(); });
setTimeout(crawlFeeds, 3000);

module.exports = router;
