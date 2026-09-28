# Planning & Requirement Map Baru Fumorive

## 1. Konsep Map

Membuat map baru dengan nuansa lingkungan Indonesia yang sederhana, natural, dan terasa seperti lingkungan masyarakat sehari-hari.

Konsep lingkungan tidak menggunakan pembagian zona yang terlalu kaku. Area rumah, warung, toko, bengkel, dan fasilitas lainnya dapat bercampur seperti kondisi lingkungan di Indonesia.

Contoh:

Rumah → Warung → Rumah → Bengkel → Rumah

atau:

Rumah → Ruko → Rumah → Minimarket → Rumah

Map ini merupakan map tambahan dan tidak menggantikan map yang sudah ada.

Fokus pengerjaan adalah membuat map beserta isi dan aktivitas di dalamnya, tanpa mengubah sistem utama game yang sudah berjalan.


## 2. Struktur Jalan

### Jalan Utama
- Jalan paling lebar.
- Dua arah.
- Menjadi jalur utama kendaraan.
- Memiliki marka jalan.
- Dilengkapi rambu dan lampu jalan.
- Memiliki beberapa zebra cross.

### Jalan Sekunder
- Menghubungkan jalan utama dengan lingkungan.
- Lebih kecil dari jalan utama.
- Tetap dapat dilewati kendaraan.
- Memiliki percabangan sederhana.

### Jalan Lingkungan
- Berada di area permukiman.
- Lebih kecil dari jalan sekunder.
- Tetap dapat dilewati mobil.
- Tidak menggunakan gang yang terlalu sempit.
- Bentuk sederhana seperti jalan lurus, belokan, dan persimpangan T.


## 3. Bangunan

Menggunakan model 3D yang sudah tersedia.

### Asset Bangunan
- Rumah tipe 1.
- Rumah tipe 2.
- Rumah tipe 3.
- Ruko 1 lantai.
- Ruko 2 lantai.
- Warung makan.
- Minimarket.
- Bengkel.
- SPBU.
- Sekolah.
- Gedung perkantoran sederhana.

Model yang sama dapat digunakan kembali dengan posisi, rotasi, dan susunan yang berbeda.

Dapur MBG tidak digunakan karena belum tersedia model 3D yang sesuai.


## 4. Penataan Lingkungan

Lingkungan dibuat seperti permukiman Indonesia yang memiliki berbagai aktivitas.

### Area Permukiman
- Rumah warga.
- Warung.
- Minimarket.
- Pohon.
- Semak.
- Jalan lingkungan.

### Area Pertokoan
- Ruko.
- Warung makan.
- Minimarket.
- Bengkel.

Pertokoan tidak dibuat sebagai kawasan khusus, tetapi dapat bercampur dengan rumah warga.

### Area Sekolah
- Sekolah.
- Rumah warga di sekitar.
- Warung.
- Trotoar.
- Zebra cross.
- NPC siswa dan warga.

### Area Lain
- SPBU dekat jalan utama.
- Bengkel di sekitar jalan yang mudah diakses kendaraan.
- Gedung perkantoran di area yang lebih ramai.
- Area hijau dan vegetasi di beberapa bagian map.


## 5. Environment

Asset environment yang digunakan:

- Pohon.
- Rumput.
- Semak.
- Pot tanaman.
- Bangku.
- Tempat sampah.
- Pagar.
- Lampu jalan.
- Tiang listrik.
- Kabel listrik.
- Rambu lalu lintas.
- Papan nama jalan.


## 6. Kendaraan NPC

Map akan memiliki kendaraan NPC agar lingkungan terasa lebih hidup.

Jenis kendaraan:

- Mobil NPC.
- Motor NPC.

Jika sistem kendaraan NPC sudah tersedia di project, sistem tersebut akan digunakan kembali.

Tidak melakukan perubahan besar pada sistem kendaraan NPC yang sudah ada.


## 7. NPC Pejalan Kaki

Map akan memiliki NPC pejalan kaki.

Jenis NPC:

- Warga.
- Siswa.
- Pedagang.

Aktivitas:

- Berjalan di trotoar.
- Berjalan di sekitar pertokoan.
- Berjalan di sekitar sekolah.
- Berjalan di lingkungan permukiman.
- Menyeberang menggunakan zebra cross.

Untuk tahap awal, NPC dapat menggunakan model sederhana/prototype terlebih dahulu untuk menguji sistem pergerakan dan waypoint.


## 8. Traffic & Safety

Karena Fumorive merupakan simulator mengemudi, map dibuat dengan memperhatikan keselamatan berkendara.

- Kendaraan NPC mengikuti jalur jalan.
- NPC pejalan kaki menggunakan area pedestrian.
- NPC tidak berjalan di tengah jalan secara normal.
- NPC menggunakan zebra cross ketika menyeberang.
- Zebra cross ditempatkan di lokasi yang sesuai.
- Jalan dibuat cukup lebar untuk kendaraan.
- Collision bangunan dan kendaraan diperhatikan.
- Persimpangan dibuat sederhana agar mudah dimainkan.

Fokus utama adalah membuat pemain dapat melihat dan merespons kondisi lalu lintas dan aktivitas NPC.


## 9. Integrasi dengan Sistem Existing

Map baru hanya menambahkan map dan isi lingkungan.

Sistem game yang sudah ada tetap digunakan, seperti:

- Sistem kendaraan pemain.
- Kontrol kendaraan.
- Kamera.
- Gameplay driving.
- Sistem delivery.
- Sistem kendaraan NPC yang sudah tersedia.
- Sistem pemilihan map.
- Sistem lainnya yang sudah berjalan.

Perubahan kode hanya dilakukan jika diperlukan untuk mengintegrasikan map baru.

Map lama tidak boleh terganggu.


## 10. Optimasi

Agar map tetap ringan:

- Menggunakan asset yang sudah tersedia.
- Menggunakan kembali model yang sama.
- Tidak terlalu banyak menggunakan model high-poly.
- Membatasi jumlah NPC dalam satu area.
- Membatasi objek dekorasi yang tidak diperlukan.
- Memperhatikan jumlah collision.
- Melakukan pengujian FPS.


## 11. Urutan Pengerjaan

### Tahap 1 — Konsep & Layout
- Menentukan ukuran map.
- Menentukan batas map.
- Membuat rancangan jalan.
- Menentukan posisi bangunan.
- Menentukan area NPC dan kendaraan.

### Tahap 2 — Pembuatan Map
- Membuat terrain.
- Membuat jalan utama.
- Membuat jalan sekunder.
- Membuat jalan lingkungan.
- Menambahkan trotoar dan zebra cross.
- Menempatkan bangunan.

### Tahap 3 — Environment
- Menambahkan pohon.
- Rumput.
- Semak.
- Lampu jalan.
- Tiang listrik.
- Rambu.
- Dekorasi lingkungan.

### Tahap 4 — NPC & Traffic
- Menambahkan kendaraan NPC.
- Menentukan jalur kendaraan.
- Menambahkan NPC pejalan kaki.
- Menentukan waypoint.
- Menambahkan sistem zebra cross.
- Menguji collision.

### Tahap 5 — Integrasi & Testing
- Menghubungkan map dengan menu pemilihan map.
- Menguji spawn kendaraan.
- Menguji gameplay existing.
- Menguji NPC.
- Menguji collision.
- Menguji FPS.
- Memperbaiki bug.


## 12. Pembagian Tugas Tim

Pengerjaan dilakukan oleh 4 orang secara kolaboratif tanpa sistem leader.

### Anggota 1 — Programmer / Implementasi
- Implementasi map ke project.
- Membuat layout jalan.
- Menempatkan asset.
- Integrasi map dengan sistem existing.
- Testing teknis.

### Anggota 2 — 3D Asset
- Mengecek asset yang tersedia.
- Mencari asset tambahan jika diperlukan.
- Menyiapkan model 3D.
- Mengecek format dan ukuran asset.
- Menyiapkan asset untuk digunakan pada map.

### Anggota 3 — Map Concept & Layout
- Membuat konsep lingkungan Indonesia.
- Membuat rancangan layout.
- Menentukan jalan.
- Menentukan posisi bangunan.
- Menentukan area hijau.
- Menentukan lokasi trotoar dan zebra cross.

### Anggota 4 — NPC & Traffic Concept
- Menentukan aktivitas NPC.
- Menentukan jalur NPC.
- Menentukan waypoint.
- Menentukan lokasi zebra cross.
- Menentukan jalur kendaraan NPC.
- Membantu testing dan mencari bug.

Setiap anggota tetap dapat membantu anggota lain apabila mengalami kendala.


## 13. Prioritas Requirement

### Prioritas Utama
- Layout map.
- Jalan utama.
- Jalan sekunder.
- Jalan lingkungan.
- Bangunan.
- Kendaraan NPC.
- NPC pejalan kaki.
- Trotoar.
- Zebra cross.
- Collision.
- Integrasi dengan sistem existing.

### Prioritas Tambahan
- Variasi NPC.
- Variasi kendaraan.
- Detail dekorasi.
- Aktivitas NPC tambahan.
- Detail lingkungan.


## 14. Target Akhir

Menghasilkan satu map baru Fumorive dengan nuansa lingkungan Indonesia yang:

- Dapat dimainkan seperti map lainnya.
- Memiliki jalan yang dapat dilalui kendaraan.
- Memiliki bangunan dan lingkungan yang sesuai.
- Memiliki kendaraan NPC.
- Memiliki NPC pejalan kaki.
- Memiliki trotoar dan zebra cross.
- Memiliki aktivitas lingkungan yang membuat map terasa hidup.
- Tetap menggunakan sistem game yang sudah ada.
- Tidak mengganggu map dan fitur yang sudah berjalan.
- Memiliki performa yang tetap baik.