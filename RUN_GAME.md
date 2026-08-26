# 🚗 Fumorive - Panduan Menjalankan Game (Full Stack)

Panduan lengkap untuk menjalankan **seluruh sistem Fumorive** dengan semua fiturnya:
- **Frontend** — Game driving simulator (Babylon.js + React)
- **Backend** — API server (FastAPI + PostgreSQL + Redis + Firebase)
- **EEG Processing** — Muse 2 brain signal monitoring

---

## 📋 Prerequisites

Pastikan sudah terinstall di komputer kamu:

| Software | Versi | Keterangan |
|----------|-------|------------|
| **Node.js** | >= 18.x | Untuk frontend (cek: `node -v`) |
| **Python** | 3.10.x atau 3.11.x | Untuk backend & EEG (**BUKAN 3.12+**, muselsl tidak kompatibel) |
| **Docker Desktop** | Terbaru | Untuk PostgreSQL (TimescaleDB) & Redis |
| **Git** | Terbaru | Version control |
| **Muse 2 Headband** | — | Untuk fitur EEG (opsional, bisa skip kalau hanya mau main game) |

---

## � One-Click Launch (Recommended!)

Jika semua setup awal sudah selesai, cukup **double-click** file berikut:

```
📁 Fumorive/
   ├── start_game.bat    ← Double-click untuk START semua service
   └── stop_game.bat     ← Double-click untuk STOP semua service
```

### Cara Pakai:

| Aksi | Command |
|------|--------|
| Start game (tanpa EEG) | Double-click `start_game.bat` |
| Start game (dengan EEG) | `start_game.bat eeg` |
| Start game (skip Docker) | `start_game.bat skipdb` |
| Stop semua service | Double-click `stop_game.bat` |

**Atau via PowerShell:**
```powershell
# Start semua service
.\start_game.ps1

# Start dengan EEG
.\start_game.ps1 -WithEEG

# Start tanpa Docker (jika container sudah running)
.\start_game.ps1 -SkipDocker

# Stop semua service
.\stop_game.ps1
```

Script ini akan otomatis:
1. ✅ Cek semua prerequisites (Docker, Node.js, Python venv)
2. ✅ Start Docker containers (PostgreSQL TimescaleDB + Redis)
3. ✅ Start Backend (FastAPI + Uvicorn) di terminal baru
4. ✅ Start Frontend (Vite + React) di terminal baru
5. ✅ Buka browser ke http://localhost:3000
6. ✅ (Opsional) Start EEG Muse 2 stream

> ⚠️ **Pertama kali?** Selesaikan [Setup Awal](#-setup-awal-sekali-saja) di bawah dulu sebelum menjalankan script!

---

## �🔧 Setup Awal (Sekali Saja)

### 1. Clone & Masuk Direktori

```bash
cd "C:\Users\ASUS\Documents\Kuliah\Magang LPSKE\Fumorive"
```

### 2. Setup Firebase (Google OAuth)

Firebase digunakan untuk autentikasi Google Sign-In.

#### A. Firebase Console
1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Buat project baru bernama **Fumorive**
3. Masuk ke **Authentication → Sign-in method → Google** → Enablen
4. Masuk ke **Project Settings → General → Your apps → Web (`</>`)** → Register app
5. **Salin Firebase Config** (apiKey, authDomain, projectId, dll.)

#### B. Download Service Account Key
1. **Project Settings → Service accounts → Generate new private key**
2. Rename file JSON yang terdownload lalu letakkan di:
   ```
   backend/fumorive-db-firebase-adminsdk-fbsvc-0353bb0508.json
   ```

> ⚠️ **JANGAN commit file ini ke Git!**

#### C. Setup Frontend Firebase Config
```bash
cd frontend
copy .env.example .env.local
```
Edit `frontend/.env.local` dan isi dengan config dari Firebase Console:
```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=fumorive-xxxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=fumorive-xxxxx
VITE_FIREBASE_STORAGE_BUCKET=fumorive-xxxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef...
```

### 3. Setup Backend Environment

```bash
cd backend
copy .env.example .env
```

Edit `backend/.env` sesuai konfigurasi lokal kamu:
```env
APP_NAME=Fumorive Backend
ENVIRONMENT=development
HOST=0.0.0.0
PORT=8000
RELOAD=true

DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/fumorive
DATABASE_URL_ASYNC=postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/fumorive

REDIS_URL=redis://localhost:6379/0
SECRET_KEY=09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173
```

### 4. Install Dependencies

#### Frontend
```bash
cd frontend
npm install
```

#### Backend
```bash
cd backend
python -m venv venv
.\venv\Scripts\pip install -r requirements.txt
```

#### EEG Processing
```bash
cd eeg-processing
python -m venv venv310
.\venv310\Scripts\pip install -r requirements.txt
```

### 5. Setup Database (Docker)

Database berjalan di Docker containers. Buat container pertama kali:

#### A. Start PostgreSQL (TimescaleDB)
```bash
docker run -d --name fumorive-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=12345 \
  -e POSTGRES_DB=fumorive \
  -p 5432:5432 \
  timescale/timescaledb:latest-pg16
```

#### B. Start Redis
```bash
docker run -d --name fumorive-redis \
  -p 6379:6379 \
  redis:7.2-alpine
```

#### C. Jalankan Schema SQL
```bash
cd backend
docker exec -i fumorive-db psql -U postgres -d fumorive < init_schema.sql
```

> 💡 Setelah container dibuat, selanjutnya cukup `docker start fumorive-db fumorive-redis` atau gunakan `start_game.bat`.

---

## 🚀 Menjalankan Game (Step by Step)

> **PENTING**: Gunakan `start_game.bat` untuk one-click launch, atau buka **3-5 terminal terpisah** secara manual.

### Langkah Urutan:

```
1. Docker (DB + Redis)  →  2. Backend  →  3. Frontend  →  4-5. EEG (opsional)
```

---

### 🟢 Terminal 1 — Docker Containers (PostgreSQL + Redis)

Start kedua container dengan Docker:

```bash
docker start fumorive-db fumorive-redis
```

**Verifikasi:**
```bash
docker ps
# Harus muncul fumorive-db dan fumorive-redis dengan status "Up"

# Test PostgreSQL
docker exec fumorive-db pg_isready -U postgres
# Output: accepting connections

# Test Redis
docker exec fumorive-redis redis-cli ping
# Output: PONG
```

---

### 🟢 Terminal 2 — Backend (FastAPI)

```bash
cd backend
.\venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Verifikasi:**
- Buka browser: [http://localhost:8000](http://localhost:8000) → Harus muncul JSON status
- API Docs: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)

**Output yang diharapkan:**
```
🚀 Fumorive Backend API Starting...
📝 Environment: development
🔧 Initializing Redis...
🔥 Initializing Firebase...
📊 Starting EEG data buffer...
✅ EEG buffer started successfully
```

---

### 🟢 Terminal 3 — Frontend (Vite + React)

```bash
cd frontend
npm run dev
```

**Akses Game:**
- Buka browser: [http://localhost:3000](http://localhost:3000)
- Game akan otomatis terbuka di browser

**Output yang diharapkan:**
```
VITE v6.x.x  ready in xxx ms

➜  Local:   http://localhost:3000/
➜  Network: http://192.168.x.x:3000/
➜  press h + enter to show help
```

---

### 🟢 Terminal 4 & 5 — EEG Processing (Opsional)

> ⚠️ Langkah ini **hanya diperlukan** jika kamu memiliki **Muse 2 headband** dan ingin menggunakan fitur monitoring EEG.

#### A. Nyalakan Muse 2 & Mulai LSL Stream

1. Nyalakan Muse 2 headband
2. Buka terminal baru dan jalankan:
```bash
cd eeg-processing
.\venv310\Scripts\python.exe -m muselsl stream
```
Tunggu sampai muncul `"Connected to Muse"`.

#### B. Jalankan EEG Streaming Server

Buka terminal lain:
```bash
cd eeg-processing
.\venv310\Scripts\python.exe server.py --session-id <SESSION_UUID>
```

**Parameter tambahan:**
```bash
# Dengan save ke database
.\venv310\Scripts\python.exe server.py --session-id <SESSION_UUID> --save-db

# Skip kalibrasi (gunakan default baseline)
.\venv310\Scripts\python.exe server.py --session-id <SESSION_UUID> --no-calibrate

# Custom durasi kalibrasi (default 10 detik)
.\venv310\Scripts\python.exe server.py --session-id <SESSION_UUID> --calibration-time 15
```

> 💡 `SESSION_UUID` didapat setelah login dan membuat session baru di game (frontend).

**Output yang diharapkan:**
```
╔══════════════════════════════════════════════════════════╗
║     🚗 FUMORIVE EEG STREAMING SERVER 🧠                ║
║         Muse 2 → Backend → Frontend                    ║
╚══════════════════════════════════════════════════════════╝

[INFO] Calibration phase...
[SUCCESS] Calibration complete!
[INFO] Streaming EEG data to backend...
```

---

## 📊 Arsitektur & Data Flow

```
┌─────────────┐     LSL      ┌─────────────────┐    HTTP POST    ┌──────────────┐
│   Muse 2    │ ──────────── │  EEG server.py  │ ──────────────  │   Backend    │
│  Headband   │              │  (Python 3.10)  │                 │  (FastAPI)   │
└─────────────┘              └─────────────────┘                 └──────┬───────┘
                                                                        │
            ┌───────────────────────────────────────────────────────────┘
            │ WebSocket
            ▼
     ┌──────────────┐         ┌──────────────┐         ┌─────────────┐
     │   Frontend   │ ◄────── │   Firebase   │         │  PostgreSQL │
     │  (Vite/React │  OAuth  │   (Auth)     │         │  + Redis    │
     │  Babylon.js) │         └──────────────┘         └─────────────┘
     └──────────────┘
```

**Port yang digunakan:**
| Service | Port | URL |
|---------|------|-----|
| Frontend (Vite) | 3000 | http://localhost:3000 |
| Backend (FastAPI) | 8000 | http://localhost:8000 |
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |

---

## 🎮 Cara Bermain

1. Buka [http://localhost:3000](http://localhost:3000)
2. **Login** menggunakan Google Account (Firebase OAuth)
3. **Buat Session** baru untuk mulai bermain
4. **Mainkan** driving simulator
5. Jika EEG aktif, data kelelahan akan ditampilkan secara real-time di dashboard

---

## ❌ Menghentikan Semua Service

Tekan `Ctrl + C` di masing-masing terminal dengan urutan:

**Opsi A: Otomatis (Recommended)**
```bash
# Double-click stop_game.bat atau:
.\stop_game.ps1
```

**Opsi B: Manual** — Tekan `Ctrl + C` di masing-masing terminal:
1. **EEG Server** (Terminal 5) — `Ctrl + C`
2. **Frontend** (Terminal 3) — `Ctrl + C`
3. **Backend** (Terminal 2) — `Ctrl + C`
4. **Docker Containers** (Terminal 1) — `docker stop fumorive-db fumorive-redis`

---

## 🐛 Troubleshooting

### Backend tidak bisa connect ke PostgreSQL
```
✅ Pastikan Docker Desktop sudah running
✅ Cek: docker ps (harus terlihat fumorive-db)
✅ Cek password di backend/.env cocok (default: 12345)
✅ Cek database "fumorive" sudah dibuat
```

### Backend tidak bisa connect ke Redis
```
✅ Pastikan Docker Desktop sudah running
✅ Cek: docker ps (harus terlihat fumorive-redis)
✅ Cek REDIS_URL di backend/.env
```

### Firebase Auth gagal / Google Login error
```
✅ Pastikan Firebase project sudah di-setup dengan benar
✅ Cek VITE_FIREBASE_* di frontend/.env.local sesuai config Firebase Console
✅ Pastikan firebase-service-account.json ada di folder backend/
✅ Pastikan domain "localhost" ada di Firebase Auth → Authorized domains
```

### Frontend tidak bisa connect ke Backend
```
✅ Pastikan backend sudah running di port 8000
✅ Cek VITE_API_URL=http://localhost:8000 di frontend/.env.local
✅ Pastikan CORS origins sudah include port frontend
```

### EEG: "No LSL stream found"
```
✅ Pastikan Muse 2 sudah nyala dan terhubung
✅ Jalankan "muselsl stream" terlebih dahulu
✅ Tunggu sampai muncul "Connected to Muse"
✅ Baru jalankan server.py
```

### EEG: muselsl error di Python 3.12+
```
✅ Gunakan Python 3.10.x atau 3.11.x
✅ muselsl TIDAK kompatibel dengan Python 3.12+
```

---

## 📁 Struktur File Penting

```
Fumorive/
├── frontend/                  # Game (React + Babylon.js)
│   ├── .env.local             # Firebase config (BUAT SENDIRI)
│   ├── package.json           # Dependencies
│   ├── vite.config.ts         # Dev server config (port 3000)
│   └── src/
│       ├── config/firebase.ts # Firebase initialization
│       └── ...
│
├── backend/                   # API Server (FastAPI)
│   ├── .env                   # Environment config (BUAT SENDIRI)
│   ├── main.py                # Entry point
│   ├── requirements.txt       # Python dependencies
│   ├── init_schema.sql        # Database schema
│   ├── firebase-*.json        # Firebase service account (JANGAN COMMIT)
│   └── app/
│       ├── core/config.py     # App settings
│       ├── api/routes/        # API endpoints
│       └── ...
│
├── eeg-processing/            # EEG Monitoring (Python)
│   ├── server.py              # Main EEG → Backend bridge
│   ├── main.py                # Standalone EEG monitor
│   ├── config.py              # EEG settings
│   ├── requirements.txt       # Python dependencies
│   └── eeg/                   # EEG processing modules
│       ├── acquisition.py
│       ├── preprocessing.py
│       ├── features.py
│       └── analysis.py
│
├── start_game.bat             # 🚀 Double-click untuk START
├── start_game.ps1             # 🚀 PowerShell start script
├── stop_game.bat              # 🛑 Double-click untuk STOP
├── stop_game.ps1              # 🛑 PowerShell stop script
└── RUN_GAME.md                # 📄 File ini
```

---

## ⚡ Quick Start (TL;DR)

### Cara Tercepat (One-Click):
```
Double-click:  start_game.bat    → Semua jalan otomatis!
Double-click:  stop_game.bat     → Semua berhenti otomatis!
```

### Cara Manual (4 Terminal):
```bash
# Terminal 1 - Docker Containers
docker start fumorive-db fumorive-redis

# Terminal 2 - Backend
cd backend && .\venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 3 - Frontend
cd frontend && npm run dev

# Terminal 4 & 5 - EEG (OPSIONAL - hanya jika punya Muse 2)
cd eeg-processing && .\venv310\Scripts\python.exe -m muselsl stream   # terminal baru
cd eeg-processing && .\venv310\Scripts\python.exe server.py --session-id <UUID>  # terminal lain
```

Lalu buka: **http://localhost:3000** 🎮