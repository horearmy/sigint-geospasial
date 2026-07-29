const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const https = require('https');
const http = require('http');
const RssParser = require('rss-parser');
const { parseString } = require('xml2js');

const rssParser = new RssParser({ timeout: 10000 });

const KATEGORI_INTEL = [
  { key: 'gangguan_keamanan', label: 'Gangguan Keamanan', icon: '🚨', subkategori: ['Kriminalitas', 'Konflik Sosial', 'Tawuran', 'Narkotika', 'Senjata Ilegal'] },
  { key: 'separatisme', label: 'Separatisme', icon: '🏴', subkategori: ['Aktivitas Kelompok Separatis', 'Wilayah Aktivitas', 'Modus', 'Pola Serangan', 'Rekrutmen'] },
  { key: 'terorisme', label: 'Terorisme', icon: '💣', subkategori: ['Aktivitas Kelompok Teroris', 'Jaringan', 'Pendanaan', 'Propaganda', 'Perekrutan'] },
  { key: 'radikalisme', label: 'Radikalisme', icon: '⚔️', subkategori: ['Organisasi Garis Kiri', 'Organisasi Garis Kanan', 'Penyebaran Ideologi Ekstrem', 'Aktivitas Propaganda'] },
  { key: 'keamanan_nasional', label: 'Keamanan Nasional', icon: '🛡️', subkategori: ['Sabotase', 'Spionase', 'Ancaman Siber', 'Infrastruktur Strategis', 'Gangguan Objek Vital'] },
  { key: 'politik', label: 'Politik', icon: '🏛️', subkategori: ['Dinamika Politik', 'Demonstrasi', 'Konflik Elit', 'Potensi Kerawanan'] },
  { key: 'sosial', label: 'Sosial', icon: '👥', subkategori: ['Konflik SARA', 'Bencana', 'Kerusuhan', 'Migrasi'] },
  { key: 'ekonomi', label: 'Ekonomi', icon: '💰', subkategori: ['Penimbunan', 'Inflasi', 'Penyelundupan', 'Gangguan Distribusi'] },
  { key: 'informasi_lain', label: 'Informasi Lain', icon: '📢', subkategori: ['Isu Viral', 'Disinformasi', 'Hoaks', 'Operasi Pengaruh', 'Ancaman Lain'] },
];

const KEYWORDS = {
  gangguan_keamanan: [
    'kriminal', 'pembunuhan', 'perampokan', 'pencurian', 'tawuran', 'bentrokan',
    'narkoba', 'narkotika', 'sabu', 'ganja', 'senjata', 'ilegal', 'kejahatan',
    'korupsi', 'curas', 'curat', 'begal', 'penipuan', ' prostitusi', 'penculikan',
    'pemerkosaan', 'kekerasan', 'preman', 'bandar', 'sindikat', 'judi', 'sabu',
    'ekstasi', 'kokain', 'heroin', ' trafficking', 'perdagangan orang', 'scam',
    'penipuan online', 'pinjol ilegal', 'money laundering', ' pencucian uang',
    'rampok', 'jambret', 'copet', 'perusakan', 'pembakaran', 'kerusuhan',
  ],
  separatisme: [
    'separatis', 'separatisme', 'OPM', 'papua merdeka', 'gerakan pembebasan',
    'secession', 'autonomi', 'pemberontakan daerah', 'perjuangan pembebasan',
    'gerakan kemerdekaan', 'referendum', 'penentuan nasib sendiri', 'self determination',
    'TPNPB', 'KKB', 'kelompok kriminal bersenjata', 'angkatan bersenjata',
    'konflik Papua', 'Aceh merdeka', 'GAM', 'separatisme daerah',
    'radikal daerah', 'pemberontak', 'insurgency', 'gerakan separatis',
    'Papua', 'otonomi khusus', 'otsus', 'DOB Papua', 'daerah otonomi baru',
    'HAM Papua', 'kekerasan Papua', 'penembakan Papua', 'akibat konflik',
    'perjuangan rakyat', 'kemerdekaan', 'separat', 'integrasi Papua',
    'pemekaran', 'provinsi baru', 'kewenangan', 'hak otonomi',
    'keistimewaan', 'daerah istimewa', 'khusus Papua',
    'OTK', 'orang tak dikenal', 'Satgas Damai Cartenz', 'Damai Cartenz',
    'Yahukimo', 'Intan Jaya', 'Puncak Jaya', 'Nduga', 'Pegunungan Bintang',
    'operasi militer', 'operasi terukur', 'kontak senjata', 'penembakan',
    'korban jiwa', 'gugur', 'tewas diserang', 'serangan', 'marksman',
    'senjata api', 'laras panjang', 'amunisi', 'bom rakitan',
  ],
  terorisme: [
    'teroris', 'terorisme', 'bom', 'ledakan', 'serangan teroris', 'jihad',
    'isis', 'daulah', 'ekstremis', 'bom bunuh diri', 'serangan bom',
    'sel teroris', 'jaringan teroris', 'radikal teroris', 'radikalisasi',
    'ekstremisme kekerasan', 'VECT', 'foreign terrorist', 'pejuang asing',
    'HTI', 'Jamaah Islamiyah', 'JI', 'Daulah Islamiyah', 'bom rakitan',
    'ancaman teror', 'teror', ' Counter terrorism', 'deradikalisasi',
    'pencegahan radikalisasi', 'tindak terorisme', 'pelatihan teroris',
    'pendanaan teroris', 'propaganda teroris', 'rekrutmen teroris',
    'marjinalisasi', 'eksklusivisme', 'takfiri', 'takfir',
  ],
  radikalisme: [
    'radikal', 'radikalisme', 'ekstrem', 'ideologi', 'propaganda',
    'garis kiri', 'garis kanan', 'komunis', 'fasis', 'anarkis', 'provokasi',
    'ekstremisme', 'fundamentalisme', 'chauvinisme', 'nasionalisme ekstrem',
    'supremasi', 'kebencian', 'hate speech', 'kekerasan ideologis',
    'perubahan rezim', 'revolusi', 'extremism', 'radicalization',
    'polarisasi', 'eksklusivisme ideologis', 'dogmatisme', 'intoleransi',
    'fanatisme', 'provokator', 'hasutan', 'subversif', 'subversion',
    'organisasi terlarang', 'organisasi radikal', 'komunisme', 'maoisme',
    'anarko', 'neo nazi', 'white supremacist', 'ultra nasionalis',
  ],
  keamanan_nasional: [
    'sabotase', 'spionase', 'siber', 'cyber', 'hacker', 'infrastruktur',
    'vital', 'militer', 'pertahanan', 'sipil', 'rudal', 'senjata nuklir',
    'perang', 'konflik bersenjata', 'invasi', 'okupasi', 'pendudukan',
    'perang saudara', 'perang proksi', 'proxy war', ' hybrid warfare',
    'perang informasi', 'perang elektronik', 'electronic warfare',
    'ancaman militer', 'keamanan maritim', 'perbatasan', 'perairan',
    'ZEE', 'eksklusif', 'teritorial', 'pertahanan negara', 'bela negara',
    'TNI', 'polri', 'kemanan negara', 'ancaman negara', 'ketahanan nasional',
    'critical infrastructure', 'vital objects', 'objek vital nasional',
    'national security', 'defense', 'strategic', 'geopolitik', 'geostrategi',
    'ancaman siber', 'serangan siber', 'cyber attack', 'data breach',
    'espionage', 'intelligence', 'counter intelligence',
  ],
  politik: [
    'politik', 'demonstrasi', 'unjuk rasa', 'protes', 'Pilkada', 'Pemilu',
    'koalisi', 'oposisi', 'dpr', 'parpol', 'partai', 'kabinet', 'reshuffle',
    'presiden', 'gubernur', 'bupati', 'walikota', 'anggota dewan',
    'legislatif', 'eksekutif', 'yudikatif', 'mahkamah konstitusi', 'MK',
    'mahkamah agung', 'MA', 'komisi yudisial', 'KY', 'DPR', 'MPR', 'DPD',
    'partai politik', 'pemilihan', 'kampanye', 'suara', 'counting',
    'quick count', 'real count', 'political party', 'election',
    'demokrasi', 'konstitusi', 'amandemen', 'undang-undang', 'regulasi',
    'kebijakan publik', 'governance', 'tata negara', 'political crisis',
    'krisis politik', 'kudeta', 'impeachment', 'pemakzulan',
    'koalisi pemerintahan', 'oposisi parlemen', 'gridlock', 'deadlock',
    'political turbulence', 'konflik elit', 'power struggle',
    'potensi kerawanan politik', 'stabilitas politik',
  ],
  sosial: [
    'sara', 'etnis', 'suku', 'agama', 'bencana', 'gempa', 'banjir',
    'tsunami', 'letusan gunung', 'migrasi', 'pengungsi', 'konflik agraria',
    'kerusuhan', 'demonstrasi massal', 'unrest', 'social unrest',
    'konflik sosial', 'ketegangan', 'diskriminasi', 'rasisme',
    'intoleransi', 'perundungan', 'bullying', 'hate crime', 'kejahatan kebencian',
    'konflik komunal', 'kerusuhan etnis', 'pogrom', 'ethnic cleansing',
    'genosida', 'krisis kemanusiaan', 'humanitarian crisis', 'refugee',
    'IDP', 'internal displacement', 'bencana alam', 'bencana bukan alam',
    'bencana sosial', 'pandemi', 'wabah', 'epidemi', 'outbreak',
    'krisis pangan', 'krisis air', 'krisis energi', 'social conflict',
    'communal violence', 'sectarian', 'conflict', 'riot', 'pemberontakan sosial',
    'perampasan tanah', 'agrarian conflict', 'land grabbing',
  ],
  ekonomi: [
    'inflasi', 'penimbunan', 'kelangkaan', 'smuggling', 'penyelundupan',
    'distribusi', 'supply chain', 'harga', 'pangan', 'subsidi',
    'resesi', 'deflasi', 'stagnasi', 'krisis ekonomi', 'krisis moneter',
    'krisis finansial', 'korupsi ekonomi', 'money laundering', 'cuci uang',
    'korupsi', 'gratifikasi', 'suap', 'pungli', 'pajak',
    'perdagangan ilegal', 'trafficking', 'narkotika', 'judi online',
    'pinjol', 'fintech ilegal', 'investasi bodong', 'ponzi', 'scam',
    'ekonomi gelap', 'shadow economy', 'underground economy',
    'perang dagang', 'trade war', 'sanksi ekonomi', ' embargo',
    'sindikat perdagangan', 'organized crime', 'kartel', 'monopoli',
    'oligopoli', 'persaingan tidak sehat', 'unfair competition',
    'gangguan distribusi', 'supply disruption', 'shortage',
    'inflation', 'hyperinflation', 'cost of living',
  ],
  informasi_lain: [
    'hoaks', 'fake news', 'disinformasi', 'propaganda', 'viral',
    'buzzword', 'trending', 'misinformasi', 'narasi', 'operasi pengaruh',
    'influence operation', 'psychological operation', 'psyop',
    'cognitive warfare', 'perang kognitif', 'information warfare',
    'cyber propaganda', 'social engineering', 'manipulasi',
    'brainwashing', 'indoctrination', 'rekrutmen ideologi',
    'media sosial', 'bot', 'troll', 'sockpuppet', 'astroturfing',
    'naratif palsu', 'black campaign', 'negative campaign',
    'fitnah', 'adu domba', 'divisi', 'polarisasi', 'fragmentasi sosial',
    'deepfake', 'AI generated', 'manipulasi konten', 'konten palsu',
    'fact check', 'verification', 'disinformation campaign',
    'foreign interference', 'campur tangan asing', 'operasi rahasia',
    'ancaman informasi', 'information threat', 'narrative attack',
  ],
};

const RSS_FEEDS = [
  { name: 'Antara Nasional', url: 'https://www.antaranews.com/rss/top-news', category: 'Berita Nasional' },
  { name: 'Antara Politik', url: 'https://www.antaranews.com/rss/politik', category: 'Politik' },
  { name: 'Tempo Nasional', url: 'https://rss.tempo.co/nasional', category: 'Berita Nasional' },
  { name: 'CNBC Indonesia', url: 'https://www.cnbcindonesia.com/news/rss', category: 'Ekonomi' },
  { name: 'CNN Indonesia', url: 'https://www.cnnindonesia.com/nasional/rss', category: 'Berita Nasional' },
  { name: 'Liputan6', url: 'https://feed.liputan6.com/rss/news', category: 'Berita Umum' },
  { name: 'Republika', url: 'https://www.republika.co.id/rss/', category: 'Berita Nasional' },
];

const BMKG_URL = 'https://data.bmkg.go.id/DataMKG/TEWS/autogempa.xml';

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

function categorizeText(text) {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  const textLen = words.length || 1;
  let bestCategory = 'informasi_lain';
  let bestScore = 0;

  for (const [cat, kwList] of Object.entries(KEYWORDS)) {
    let matches = 0;
    for (const kw of kwList) {
      if (lower.includes(kw.toLowerCase())) matches++;
    }
    const score = matches / Math.sqrt(textLen);
    if (score > bestScore) { bestScore = score; bestCategory = cat; }
  }
  return bestCategory;
}

async function fetchBMKG() {
  try {
    const xml = await fetchUrl(BMKG_URL);
    return new Promise((resolve) => {
      parseString(xml, { explicitArray: false }, (err, result) => {
        if (err) { resolve(null); return; }
        try {
          const g = result.Infogempa.gempa;
          const coords = g.point.coordinates.split(',').map(Number);
          resolve({
            kategori: 'sosial',
            subkategori: 'Bencana',
            judul: `Gempa M${g.Magnitude} - ${g.Wilayah}`,
            deskripsi: `Tanggal: ${g.Tanggal} ${g.Jam} | Kedalaman: ${g.Kedalaman} | Potensi: ${g.Potensi} | Dirasakan: ${g.Dirasakan}`,
            sumber: 'BMKG',
            sumber_url: `https://data.bmkg.go.id/DataMKG/TEWS/${g.Shakemap}`,
            ancaman_level: g.Magnitude >= 6 ? 4 : g.Magnitude >= 5 ? 3 : 2,
            lokasi_nama: g.Wilayah,
            coords,
          });
        } catch (e) { resolve(null); }
      });
    });
  } catch (err) {
    console.error('  BMKG error:', err.message);
    return null;
  }
}

let crawlStatus = { running: false, lastCrawl: null, totalItems: 0 };

const LOCATION_PATTERNS = [
  /(?:di|Wilayah|Kabupaten|Kota|Provinsi|Kab\.|Kota)\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,3})/g,
  /(?:Kab\.|Kabupaten)\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,2})/,
  /(?:Kota)\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,2})/,
  /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s*,\s*(?:Jawa|Sumatera|Kalimantan|Sulawesi|Bali|NTT|NTB|Papua|Maluku|Gorontalo|Bengkulu|Riau|Jambi|Palembang|Lampung|Banten)/,
  /REPUBLIKA\.CO\.ID,\s*([A-Z][A-Za-z\s]{2,20})\s*[-–—]/,
  /(?:CNN|TEMPO|CNBC|LIPUTAN6|ANTARA)[\s.]+([A-Z][A-Za-z\s]{2,20})\s*[-–—]/,
  /\b(Jakarta|Bandung|Surabaya|Medan|Semarang|Yogyakarta|Makassar|Palembang|Manado|Banjarmasin|Pontianak|Batam|Lampung|Banten|Jabar|Jatim|Jateng|Jogja|Aceh|Papua|NTT|NTB|Bali|Sulsel|Sulut|Kaltim|Kalteng|Kalsel|Riau|Jambi|Sumut|Sumbar|Sumsel|Bengkulu|Maluku|Gorontalo|Sultra|Sulbar|Malut|Papbar|Papua Barat|Bogor|Bekasi|Tangerang|Depok|Karawang|Purwakarta|Subang|Indramayu|Cirebon|Tasikmalaya|Garut|Ciamis|Kuningan|Cimahi|Sukabumi|Cianjur|Pandeglang|Lebak|Serang|Cilegon|Tangerang Selatan)\b/,
];

function extractLocation(text) {
  if (!text) return null;
  const EXCLUDE = new Set(['Asia', 'Eropa', 'Amerika', 'China', 'Israel', 'Gaza', 'Ukraina', 'Rusia', 'Timur', 'Barat', 'Utara', 'Selatan', 'Tengah', 'Dukuh', 'ini', 'yang', 'untuk', 'dari', 'dengan', 'oleh', 'akan', 'belum', 'sudah', 'dalam']);
  for (const pattern of LOCATION_PATTERNS) {
    pattern.lastIndex = 0;
    const match = text.match(pattern);
    if (match) {
      const loc = (match[1] || match[0]).replace(/^(di|Wilayah|Kabupaten|Kota|Provinsi|Kab\.|Kota)\s+/i, '').trim();
      if (loc.length >= 3 && loc.length <= 40 && !EXCLUDE.has(loc) && !/^\d+\s/.test(loc)) return loc;
    }
  }
  return null;
}

async function geocodeLocation(name) {
  return new Promise((resolve) => {
    const query = encodeURIComponent(name + ', Indonesia');
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=id`;
    const req = https.get(url, { headers: { 'User-Agent': 'SIGINT-KOSTRAD/1.0' }, timeout: 8000 }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed?.length > 0) {
            resolve({ lat: parseFloat(parsed[0].lat), lng: parseFloat(parsed[0].lon), display: parsed[0].display_name.split(',').slice(0, 3).join(',') });
          } else { resolve(null); }
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

async function crawlAndCategorize() {
  if (crawlStatus.running) return;
  crawlStatus.running = true;
  const items = [];
  console.log('[INTEL] Crawl started...');

  const bmkg = await fetchBMKG();
  if (bmkg) { items.push(bmkg); console.log('  ✓ BMKG Gempa'); }

  for (const feed of RSS_FEEDS) {
    try {
      const parsed = await rssParser.parseURL(feed.url);
      const feedItems = (parsed.items || []).slice(0, 20).map(item => {
        const text = `${item.title || ''} ${item.contentSnippet || item.content || ''}`;
        const kategori = categorizeText(text);
        const lokasi_nama = extractLocation(item.title || '') || extractLocation(item.contentSnippet || item.content || '');
        return {
          kategori,
          subkategori: null,
          judul: item.title || 'Tanpa Judul',
          deskripsi: (item.contentSnippet || item.content || '').replace(/<[^>]*>/g, '').substring(0, 500),
          sumber: feed.name,
          sumber_url: item.link || '',
          ancaman_level: 1,
          lokasi_nama: lokasi_nama || null,
        };
      });
      items.push(...feedItems);
      console.log(`  ✓ ${feed.name}: ${feedItems.length} items`);
    } catch (err) {
      console.error(`  ✗ ${feed.name}: ${err.message}`);
    }
  }

  const client = await pool.connect();
  try {
    let inserted = 0;
    for (const item of items) {
      const exists = await client.query(
        'SELECT id FROM intelligence WHERE judul = $1 AND sumber = $2',
        [item.judul, item.sumber]
      );
      if (exists.rows.length === 0) {
        if (item.coords) {
          await client.query(
            'INSERT INTO intelligence (kategori, subkategori, judul, deskripsi, sumber, sumber_url, ancaman_level, lokasi_nama, koordinat) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,ST_SetSRID(ST_MakePoint($9,$10),4326)::geography)',
            [item.kategori, item.subkategori, item.judul, item.deskripsi, item.sumber, item.sumber_url, item.ancaman_level, item.lokasi_nama, item.coords[1], item.coords[0]]
          );
        } else {
          await client.query(
            'INSERT INTO intelligence (kategori, subkategori, judul, deskripsi, sumber, sumber_url, ancaman_level, lokasi_nama) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
            [item.kategori, item.subkategori, item.judul, item.deskripsi, item.sumber, item.sumber_url, item.ancaman_level, item.lokasi_nama]
          );
        }
        inserted++;
      }
    }
    console.log(`[INTEL] Inserted ${inserted} new items`);
  } finally {
    client.release();
  }

  crawlStatus.lastCrawl = new Date().toISOString();
  crawlStatus.totalItems = items.length;
  crawlStatus.running = false;
  console.log(`[INTEL] Crawl complete: ${items.length} items processed`);
}

router.get('/kategori', authMiddleware, (req, res) => {
  res.json({ success: true, data: KATEGORI_INTEL });
});

router.get('/list', authMiddleware, async (req, res) => {
  try {
    const { kategori, subkategori, status, search, page = 1, limit = 50 } = req.query;
    let query = 'SELECT *, ST_Y(koordinat::geometry) AS latitude, ST_X(koordinat::geometry) AS longitude FROM intelligence WHERE 1=1';
    const params = [];
    let idx = 1;

    if (kategori) { query += ` AND kategori = $${idx++}`; params.push(kategori); }
    if (subkategori) { query += ` AND subkategori = $${idx++}`; params.push(subkategori); }
    if (status) { query += ` AND status = $${idx++}`; params.push(status); }
    if (search) { query += ` AND (judul ILIKE $${idx} OR deskripsi ILIKE $${idx} OR sumber ILIKE $${idx})`; params.push(`%${search}%`); idx++; }

    const countRes = await pool.query(query.replace('SELECT *, ST_Y(koordinat::geometry) AS latitude, ST_X(koordinat::geometry) AS longitude', 'SELECT COUNT(*)'), params);
    const total = parseInt(countRes.rows[0].count);

    query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const result = await pool.query(query, params);
    res.json({ success: true, data: { items: result.rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) {
    console.error('GET /intelligence/list error:', err.message);
    res.status(500).json({ success: false, error: 'Gagal mengambil data' });
  }
});

router.post('/add', authMiddleware, roleMiddleware('admin', 'analis'), async (req, res) => {
  try {
    const { kategori, subkategori, judul, deskripsi, sumber, sumber_url, ancaman_level, lokasi_nama, latitude, longitude, tags } = req.body;
    if (!kategori || !judul) {
      return res.status(400).json({ success: false, error: 'Kategori dan judul wajib diisi' });
    }
    let query, params;
    if (latitude && longitude) {
      query = 'INSERT INTO intelligence (kategori, subkategori, judul, deskripsi, sumber, sumber_url, ancaman_level, lokasi_nama, koordinat, tags, reported_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,ST_SetSRID(ST_MakePoint($9,$10),4326)::geography,$11,$12) RETURNING *';
      params = [kategori, subkategori, judul, deskripsi, sumber || '', sumber_url || '', ancaman_level || 1, lokasi_nama || '', longitude, latitude, tags || [], req.user.id];
    } else {
      query = 'INSERT INTO intelligence (kategori, subkategori, judul, deskripsi, sumber, sumber_url, ancaman_level, lokasi_nama, tags, reported_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *';
      params = [kategori, subkategori, judul, deskripsi, sumber || '', sumber_url || '', ancaman_level || 1, lokasi_nama || '', tags || [], req.user.id];
    }
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST /intelligence/add error:', err.message);
    res.status(500).json({ success: false, error: 'Gagal menyimpan data' });
  }
});

router.put('/update/:id', authMiddleware, roleMiddleware('admin', 'analis'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, ancaman_level, subkategori } = req.body;
    const result = await pool.query(
      'UPDATE intelligence SET status = COALESCE($1, status), ancaman_level = COALESCE($2, ancaman_level), subkategori = COALESCE($3, subkategori), updated_at = NOW() WHERE id = $4 RETURNING *',
      [status, ancaman_level, subkategori, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('PUT /intelligence/update error:', err.message);
    res.status(500).json({ success: false, error: 'Gagal update data' });
  }
});

router.delete('/delete/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM intelligence WHERE id = $1', [id]);
    res.json({ success: true, message: 'Data dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal hapus data' });
  }
});

router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT kategori, COUNT(*) as count,
        AVG(ancaman_level)::int as avg_level,
        MAX(created_at) as latest
      FROM intelligence GROUP BY kategori ORDER BY count DESC
    `);
    const total = await pool.query('SELECT COUNT(*) FROM intelligence');
    res.json({ success: true, data: { by_kategori: result.rows, total: parseInt(total.rows[0].count) } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal mengambil stats' });
  }
});

router.post('/crawl', authMiddleware, roleMiddleware('admin', 'analis'), async (req, res) => {
  if (crawlStatus.running) return res.json({ success: true, message: 'Crawl sudah berjalan' });
  crawlAndCategorize();
  res.json({ success: true, message: 'Crawl dimulai' });
});

router.get('/crawl-status', authMiddleware, (req, res) => {
  res.json({ success: true, data: crawlStatus });
});

const ALLOWED_FETCH_HOSTS = ['antaranews.com', 'tempo.co', 'cnbcindonesia.com', 'cnnindonesia.com', 'liputan6.com', 'republika.co.id', 'bmkg.go.id'];

router.get('/fetch-image', authMiddleware, async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ success: false, message: 'URL required' });
  try {
    const parsedUrl = new (require('url').URL)(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ success: false, message: 'Protocol tidak diizinkan' });
    }
    if (!ALLOWED_FETCH_HOSTS.some(h => parsedUrl.hostname.endsWith(h))) {
      return res.status(400).json({ success: false, message: 'Domain tidak diizinkan' });
    }
    const html = await fetchUrl(url);
    if (!html) return res.json({ success: true, data: { imageUrl: null } });
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const twitterMatch = !ogMatch && html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
      || !ogMatch && html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    const imageUrl = ogMatch?.[1] || twitterMatch?.[1] || null;
    return res.json({ success: true, data: { imageUrl } });
  } catch (err) {
    return res.json({ success: true, data: { imageUrl: null } });
  }
});

const cron = require('node-cron');
cron.schedule('*/30 * * * *', () => { crawlAndCategorize(); });
setTimeout(crawlAndCategorize, 5000);

module.exports = router;
