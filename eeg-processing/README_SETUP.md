xket# EEG Processing Setup - Python 3.10

## Mengapa Python 3.10?

`muselsl` library tidak kompatibel dengan Python 3.11+ karena dependency issues. Python 3.10 adalah versi tertinggi yang stabil untuk EEG processing.

## Prerequisites

1. ✅ Python 3.10.11 sudah terinstall
   - Download dari: https://www.python.org/downloads/release/python-31011/
   - Pilih: **Windows installer (64-bit)**
   - **PENTING**: Jangan centang "Add to PATH" saat install

2. ✅ Muse 2 headband
3. ✅ Bluetooth adapter/built-in Bluetooth

## Setup Instructions

### Langkah 1: Jalankan Setup Script

Buka PowerShell di folder `eeg-processing`, lalu jalankan:

```powershell
.\setup_venv.ps1
```

Script ini akan otomatis:
- ✓ Mencari Python 3.10 di sistem Anda
- ✓ Membuat virtual environment (`venv310`)
- ✓ Menginstall semua dependencies dari `requirements.txt`
- ✓ Memverifikasi instalasi `muselsl`
- ✓ Membuat shortcut aktivasi (`activate.ps1`)

### Langkah 2: Pair Muse 2 Device

1. Buka **Settings** → **Bluetooth & devices**
2. Klik **Add device** → **Bluetooth**
3. Nyalakan Muse 2 headband (lampu LED berkedip)
4. Pilih **Muse-XXXX** dari daftar
5. Tunggu sampai status "Connected"

### Langkah 3: Test EEG Streaming

Di PowerShell yang sama (sudah ada venv aktif):

```powershell
# Test muselsl stream
python -m muselsl stream
```

**Expected output:**
```
Looking for Muse devices...
Found Muse-XXXX
Connecting to Muse-XXXX...
Subscribed to 10Hz stream
```

Jika berhasil, Anda akan lihat data streaming. Tekan `Ctrl+C` untuk stop.

### Langkah 4: Jalankan EEG Server

```powershell
# Ganti <session-id> dengan UUID session Anda
python server.py --session-id <session-id> --backend-url http://localhost:8000
```

## Daily Usage

**Setiap kali** ingin menjalankan EEG processing:

```powershell
# 1. Buka PowerShell di folder eeg-processing
cd C:\Users\User\Fumorive\eeg-processing

# 2. Aktifkan virtual environment
.\activate.ps1

# 3. Jalankan muselsl stream (terminal terpisah atau background)
python -m muselsl stream

# 4. Jalankan server (di terminal lain atau setelah muselsl background)
python server.py --session-id YOUR_SESSION_ID
```

## Troubleshooting

### Error: "ExecutionPolicy"

Jika PowerShell block script:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Error: "Python 3.10 not found"

Verifikasi instalasi Python 3.10:

```powershell
# Cek di lokasi default
C:\Users\User\AppData\Local\Programs\Python\Python310\python.exe --version
```

Jika tidak ada, install ulang Python 3.10.

### Error: "No Muse devices found"

1. Pastikan Muse 2 sudah paired via Bluetooth Settings
2. Pastikan device status "Connected" (bukan hanya "Paired")
3. Restart Muse 2 headband
4. Restart Bluetooth service di Windows

### Error: "Module not found: muselsl"

Virtual environment mungkin tidak aktif:

```powershell
.\activate.ps1
```

Verifikasi dengan:

```powershell
python --version  # Harus menampilkan Python 3.10.x
```

## File Structure

```
eeg-processing/
├── venv310/              # Virtual environment (dibuat oleh setup script)
├── setup_venv.ps1        # Setup script (run sekali)
├── activate.ps1          # Shortcut aktivasi venv (run setiap kali)
├── server.py             # EEG server utama
├── requirements.txt      # Python dependencies
└── README_SETUP.md       # File ini
```

## Next Steps

Setelah setup berhasil:

1. ✓ Pastikan backend (FastAPI) sudah running di `http://localhost:8000`
2. ✓ Dapatkan valid session ID dari backend atau user login
3. ✓ Jalankan EEG processing sesuai instruksi di atas
4. ✓ Monitor frontend untuk real-time EEG data

## Support

Jika ada masalah, check:
- [Main EEG Setup Guide](../EEG_SETUP_GUIDE.md)
- [Muse Documentation](https://choosemuse.com/muse-2/)
- [muselsl GitHub](https://github.com/alexandrebarachant/muse-lsl)
