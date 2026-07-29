# Deployment Guide — SIGINT KOSTRAD

## Pilihan Platform

### A. Google Cloud Compute Engine (~Rp200k/bln) ✅ Rekomendasi
1. Console → Compute Engine → VM Instances → Create Instance
2. Nama: `sigint-server`, Region: `asia-southeast2` (Jakarta), Type: `e2-small`
3. Boot disk: Ubuntu 22.04 LTS, izinkan HTTP/HTTPS traffic
4. Reserve Static IP setelah VM jadi
5. SSH via browser (tombol SSH di dashboard) atau gcloud CLI

### B. Niagahoster Cloud Server Mini (~Rp75k/bln)
1. Beli paket Cloud Server Mini + Ubuntu 22.04
2. SSH via password dari email

---

## Setup (Copy-paste per baris)

### 1. Install Stack
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx curl gnupg2 git

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs

# PostgreSQL + PostGIS
sudo apt install -y postgresql postgresql-contrib postgis
sudo systemctl start postgresql && sudo systemctl enable postgresql
```

### 2. Database
```bash
sudo -u postgres psql -c "CREATE USER sigint_user WITH PASSWORD 'Horearmy2025';"
sudo -u postgres psql -c "CREATE DATABASE geospasial_db OWNER sigint_user;"
sudo -u postgres psql -d geospasial_db -c "CREATE EXTENSION postgis;"
```

### 3. Clone & Setup Backend
```bash
mkdir -p /var/www && cd /var/www

# Clone repo (ganti URL dengan repo masing-masing)
git clone https://github.com/USER/REPO.git sigint-app
cd sigint-app/backend

cat > .env << 'EOF'
DB_USER=sigint_user
DB_PASSWORD=Horearmy2025
DB_HOST=localhost
DB_PORT=5432
DB_NAME=geospasial_db
JWT_SECRET=GantiDenganStringAcakMin32Karakter12345
PORT=5000
EOF

npm install
node db/init.js

sudo npm install -g pm2
pm2 start server.js --name sigint-api
pm2 save && sudo pm2 startup
```

### 4. Build Frontend
```bash
cd /var/www/sigint-app/frontend
npm install
npm run build
```

### 5. Nginx
```bash
sudo tee /etc/nginx/sites-available/sigint > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    root /var/www/sigint-app/frontend/dist;
    index index.html;
    try_files $uri $uri/ /index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:5000;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/sigint /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

### 6. Firewall
```bash
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable
```

### 7. Test
Buka browser: `http://IP_VPS`

---

## Catatan
- Frontend: Vite proxy dihapus, semua request `/api` langsung ke backend via Nginx
- Backend: berjalan via PM2 (auto-restart jika crash/reboot)
- Untuk HTTPS nanti: install certbot + pointed domain