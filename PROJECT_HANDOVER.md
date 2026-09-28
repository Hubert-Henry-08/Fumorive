# PROJECT HANDOVER — Fumorive
## Resume, Planning & Progress Ngawi City

> Dokumen ini digunakan sebagai acuan utama untuk melanjutkan pengembangan Map Ngawi City.
> Fokus utama: menambahkan dan menyempurnakan 1 map baru tanpa merusak atau mengubah sistem/map yang sudah ada.

---

# 1. PROJECT OVERVIEW

- Fumorive adalah simulator mengemudi 3D berbasis web.
- Game memiliki sistem kendaraan, waypoint/checkpoint, NPC, traffic light, violation/point, collision, dan sistem gameplay lainnya.
- Map yang tersedia:
  - Solo City
  - Sriwedari Park
  - Ngawi City

Ngawi City merupakan map baru dengan suasana lingkungan Indonesia.

Fokus pekerjaan adalah membuat dan menyempurnakan Ngawi City dengan tetap menggunakan sistem existing.

---

# 2. PRINSIP UTAMA PENGEMBANGAN

## ADD, DON'T BREAK

Prinsip utama:

> ADD, DON'T BREAK.

Artinya:

- Tambahkan Ngawi City.
- Jangan merusak Solo City.
- Jangan merusak Sriwedari Park.
- Jangan mengganti sistem gameplay existing.
- Jangan membuat ulang sistem yang sudah tersedia.
- Gunakan sistem existing sebanyak mungkin.
- Perubahan khusus Ngawi harus tetap scoped ke Ngawi.
- Map lama harus tetap dapat dimainkan.

Jika membutuhkan sistem existing:

`GUNAKAN SISTEM EXISTING`

bukan:

`BUAT ULANG SISTEM DARI NOL`

---

# 3. 10 REMINDER WAJIB

10 reminder ini WAJIB dipertahankan dalam setiap pengembangan/prompt berikutnya.

1. Hanya menambahkan 1 map baru.

2. Tidak mengubah mekanisme/sistem game yang sudah ada.

3. Map baru harus otomatis memiliki mekanisme yang memang sudah dimiliki map-map lainnya.

4. Fitur/objek khusus map baru hanya berlaku di map baru.

5. Tidak melakukan perubahan pada sistem yang sudah dibuat/paten.

6. Untuk tahap awal, map dibuat tanpa model 3D final.

7. Struktur dan posisi objek map dibuat sebagai placeholder/prototype terlebih dahulu.

8. Setelah model 3D sudah final, placeholder nantinya diganti dengan model 3D tanpa mengubah konsep/layout map.

9. NPC pejalan kaki tidak menggunakan model 3D final; menggunakan prototype/pendekatan sementara.

10. Fokus utama adalah MENAMBAHKAN MAP BARU, bukan memodifikasi game yang sudah ada.

---

# 4. KONSEP NGAWI CITY

Ngawi City dibuat sebagai kota Indonesia yang:

- luas,
- natural,
- rapi,
- mudah dimainkan,
- memiliki road network yang jelas,
- memiliki berbagai zona,
- tidak terlalu padat,
- memiliki jalur alternatif,
- memiliki lingkungan Indonesia yang mudah dikenali.

Map tidak harus merepresentasikan satu daerah secara persis.

Tujuannya adalah menciptakan suasana kota Indonesia yang believable.

---

# 5. ROAD NETWORK

Road network Ngawi saat ini menggunakan ring luar sekitar ±245.

Road network harus:

- tersambung,
- tidak buntu,
- tidak terputus,
- memiliki koneksi antar-area,
- memiliki ring road,
- memiliki jalan utama,
- memiliki jalan sekunder,
- memiliki jalan lingkungan,
- memiliki persimpangan,
- memiliki T-junction,
- memiliki jalur alternatif.

Tidak boleh ada:

- jalan yang berhenti tiba-tiba,
- jalan terpotong,
- jalan yang diblokir pembatas,
- jalan yang tertutup objek,
- aspal keluar dari jalur jalan,
- jalan yang saling overlap secara visual secara tidak wajar.

---

# 6. ROAD PRECISION & CLEANUP

Road network harus dibuat serapi dan sepresisi mungkin.

Wajib diperiksa:

- tidak ada aspal keluar dari batas jalan,
- tidak ada aspal menutupi area yang seharusnya rumput,
- tidak ada objek di tengah jalan,
- tidak ada pohon di tengah jalan,
- tidak ada semak di tengah jalan,
- tidak ada tiang di tengah jalan,
- tidak ada lampu jalan di badan jalan,
- tidak ada bangunan masuk jalan,
- tidak ada pagar/pembatas yang memblokir jalan,
- tidak ada trotoar yang memotong jalan,
- tidak ada jalan yang tertutup jalan lain,
- tidak ada visual road overlap yang terlihat seperti jalan "over" atau bertumpuk tidak semestinya.

Setiap perubahan road harus diverifikasi terhadap `ROADS` aktual di `IndonesiaMap.ts`.

---

# 7. ROAD BARRIER & SIDEWALK

Pembatas harus:

- berada di sisi jalan,
- menyambung dengan benar,
- tidak berada di tengah jalan,
- tidak memblokir persimpangan,
- tidak menutup akses jalan,
- memiliki opening yang sesuai.

Trotoar harus:

- mengikuti jalan,
- tidak masuk ke badan jalan,
- berhenti pada opening/persimpangan yang benar,
- tidak memblokir kendaraan.

Struktur:

`JALAN ASPAL → TROTOAR/BAHU → PEMBATAS → AREA ENVIRONMENT`

Bukan:

`JALAN ASPAL → PEMBATAS DI TENGAH JALAN`

---

# 8. AREA PARKIR & SPAWN

Ngawi memiliki area parkir khusus untuk spawn kendaraan pemain.

Kondisi terbaru:

- Spawn berada di area parkir.
- Parkiran menggunakan area aspal.
- Parkiran memiliki akses menuju road network.
- Parking rect masuk ke area yang dianggap drivable.
- Spawn tidak lagi berada di rumput.

Posisi spawn terbaru:

`(-165, 24)`

Parking area sekitar:

`36 × 24 m`

---

# 9. ROAD CONSTRAINT

Road constraint Ngawi telah diperbaiki.

Masalah sebelumnya:

- normal collision terbalik,
- kendaraan off-road justru terdorong semakin menjauh dari jalan,
- dapat menyebabkan glitch/jitter.

Perbaikan:

- normal sekarang mengarah menuju jalan terdekat,
- pull dibatasi maksimal sekitar 2.5 m/frame,
- menghindari snap besar dalam satu frame,
- parkiran dianggap sebagai area drivable.

Perubahan ini tetap harus scoped untuk Ngawi.

---

# 10. TRAFFIC LIGHT

Traffic light digunakan pada persimpangan yang membutuhkan.

Saat ini:

- Traffic light Ngawi: 1 unit utama.
- Berada di persimpangan pusat `(0,0)`.

Traffic light harus memiliki:

- merah,
- kuning,
- hijau.

Jika pemain melanggar lampu merah:

`RED LIGHT → EXISTING VIOLATION → POINT BERKURANG`

Jangan membuat sistem violation baru.

---

# 11. WRONG WAY / LHT

Indonesia menggunakan Left-Hand Traffic.

Pemain dan NPC harus:

- menggunakan sisi jalan yang benar,
- tidak melawan arah,
- mengikuti road network Ngawi.

## Temuan audit terbaru

Ditemukan satu bug nyata:

`WrongWayDetector.ts`

masih memiliki sebagian koordinat lama sebelum map diperbesar.

Road network aktual menggunakan ring ±245, sedangkan WrongWayDetector masih memiliki koordinat lama sekitar ±200.

Dampak:

- sebagian ring luar tidak terdeteksi dengan benar,
- beberapa junction masih menggunakan koordinat stale,
- wrong-way detection berpotensi tidak aktif pada beberapa area.

## Tindakan berikutnya

WrongWayDetector Ngawi harus disinkronkan dengan:

`IndonesiaMap.ts → ROADS aktual`

Jangan menggunakan tool audit lama sebagai sumber koordinat.

Sumber kebenaran:

`frontend/src/game/components/IndonesiaMap.ts`

---

# 12. NPC KENDARAAN

Untuk Ngawi:

- HANYA MOBIL NPC.
- MOTOR NPC DIHILANGKAN.

NPC mobil:

- mengikuti waypoint,
- mengikuti road network,
- tidak keluar jalan,
- tidak melawan arah,
- tidak melayang,
- tidak menembus kendaraan,
- dapat berkeliling kota.

---

# 13. NPC TRUCK

Ngawi memiliki NPC truck.

Kondisi saat ini:

- 3 truck telah terdaftar.
- Truck route berada di road network.
- Truck mesh berhasil dibuat.
- Truck tidak melayang.
- Truck menyentuh tanah.
- Truck memiliki collision radius existing.

## Ukuran truck

Audit runtime menemukan:

Truck:
- panjang sekitar 8.09 m
- tinggi sekitar 3.65 m

Mobil pemain:
- panjang sekitar 7.4 m
- tinggi sekitar 2.71 m

Target yang diinginkan:

- panjang truck ≈ 2× mobil pemain
- tinggi truck ≈ 2× mobil pemain

Target ukuran berdasarkan mobil aktual:

- panjang ≈ 14.8 m
- tinggi ≈ 5.4 m

Namun perubahan ukuran truck BELUM dilakukan karena dapat berhubungan dengan:

- NpcSystem,
- collision,
- truck radius,
- road corridor.

Jangan mengubah ukuran truck sebelum ada instruksi khusus.

---

# 14. NPC MOBIL BERKELILING KOTA

NPC tidak boleh hanya berputar pada satu area.

Route harus dapat melewati:

- jalan utama,
- pusat kota,
- pertokoan,
- perumahan,
- sekolah,
- SPBU,
- bengkel,
- perkantoran,
- ring road.

Route harus bervariasi.

NPC dapat memilih route berbeda secara bergantian/random selama tetap mengikuti road network.

---

# 15. NPC MENYALIP

Jika NPC menemukan kendaraan lambat:

- NPC memperlambat jika belum aman.
- Jika memungkinkan NPC dapat menyalip.
- Menyalip HANYA dari kanan.
- Tidak boleh masuk jalur lawan arah.
- Tidak boleh keluar jalan.
- Tidak boleh teleport.
- Setelah menyalip kembali ke jalur.

Jika tidak aman:

`NPC → WAIT / SLOW DOWN`

bukan:

`NPC → MENEMBUS KENDARAAN`

---

# 16. NPC COLLISION

NPC mobil:

- tidak boleh menembus pemain,
- tidak boleh menembus NPC lain,
- tidak boleh melayang,
- tidak boleh menembus environment.

Gunakan collision existing.

Jangan membuat sistem physics global baru.

---

# 17. NPC PEJALAN KAKI

NPC pejalan kaki masih menggunakan prototype.

Tidak menggunakan model manusia final.

Prototype dapat menggunakan:

- sphere,
- capsule,
- box,
- primitive Babylon.js.

NPC harus:

- berjalan di trotoar,
- berjalan di area aman,
- tidak berjalan di tengah jalan,
- menyeberang melalui zebra cross,
- tidak teleport,
- tidak menembus kendaraan.

---

# 18. ZEBRA CROSS

NPC pedestrian harus:

1. Berjalan menuju zebra cross.
2. Menunggu jika diperlukan.
3. Menyeberang melalui zebra cross.
4. Kembali ke trotoar.

NPC tidak boleh menyeberang sembarangan.

---

# 19. PEDESTRIAN VIOLATION

Jika pemain menabrak NPC pedestrian:

`PEMAIN → TABRAK NPC → EXISTING VIOLATION → POINT BERKURANG`

Gunakan:

- violation system existing,
- violationStore existing,
- cooldown existing.

Jangan membuat sistem point baru.

Satu tabrakan tidak boleh mengurangi point berkali-kali setiap frame.

---

# 20. ENVIRONMENT SAFETY

Environment harus benar-benar berada di luar road corridor.

Audit terbaru telah melakukan pengecekan terhadap:

- tree,
- bush,
- lamp,
- pole,
- bin,
- bench,
- pot,
- rambu.

Hasil audit:

`0 konflik dengan badan jalan`

Artinya berdasarkan koordinat terkini:

- tidak ditemukan pohon di tengah jalan,
- tidak ditemukan semak di tengah jalan,
- tidak ditemukan lampu di badan jalan,
- tidak ditemukan tiang di badan jalan,
- tidak ditemukan bangku di badan jalan,
- tidak ditemukan pot di badan jalan,
- tidak ditemukan rambu di badan jalan.

Hal ini WAJIB dipertahankan.

Setiap penambahan environment baru harus diverifikasi lagi.

---

# 21. BANGUNAN

Bangunan harus:

- berada di luar jalan,
- tidak menghalangi kendaraan,
- tidak menutup persimpangan,
- tidak menutup trotoar,
- tidak menghalangi traffic light,
- tidak menutup zebra cross.

Audit runtime terbaru:

`57 bangunan → 0 overlap dengan jalan`

---

# 22. ASSET 3D NGAWI

Asset 3D final sudah mulai digunakan untuk menggantikan placeholder.

Folder asset:

`D:\PROJECT\Fumorive\frontend\public\assets\Model 3d map Ngawi City`

Asset yang sudah digunakan:

### Rumah

- rumah1.glb
- rumah2.glb
- rumah3.glb

### Ruko

- rumah&ruko.glb

### Warung

- nasi_padang.glb
- pecel_lele.glb
- dapur&kopdes.glb

### Fasilitas

- Kopdes.glb
- bengkel.glb
- spbu.glb
- gedung1.glb

---

# 23. STATUS REPLACEMENT ASSET

Replacement terbaru:

- house1 × 9 → rumah1.glb
- house2 × 8 → rumah2.glb
- house3 × 4 → rumah3.glb
- ruko × 12 → rumah&ruko.glb
- warung × 6 → nasi_padang.glb / pecel_lele.glb / dapur&kopdes.glb
- Kopdes × 1 → Kopdes.glb
- bengkel × 3 → bengkel.glb
- SPBU × 1 → spbu.glb
- kantor × 7 → gedung1.glb

Masih placeholder:

- minimarket
- sekolah

Alasan:

Belum tersedia asset GLB yang sesuai pada asset set saat audit dilakukan.

---

# 24. HASIL AUDIT RUNTIME ASSET 3D

Audit runtime dilakukan menggunakan:

- production build,
- Vite preview,
- headless Chrome,
- SwiftShader WebGL,
- temporary debug hook.

Debug hook hanya digunakan untuk audit dan SUDAH DIHAPUS.

Build setelah hook dihapus:

`PASS`

Hasil:

`11/11 asset berhasil tampil`

Tidak ditemukan:

- model gagal load permanen,
- model floating,
- model tenggelam,
- model terbalik,
- model masuk jalan.

---

# 25. HASIL AUDIT GEOMETRI MODEL

Semua model:

- grounded di y=0,
- rotasi normal,
- tidak terbalik,
- footprint berada dalam area placeholder,
- tidak masuk road corridor.

Tidak ada bangunan final yang masuk jalan.

---

# 26. TEMUAN VISUAL ASSET

Beberapa model memiliki footprint lebih kecil dari placeholder.

### Kopdes

Kopdes.glb:

`9 × 2.4 m`

Placeholder:

`9 × 7 m`

Model aman tetapi terlihat relatif tipis.

### SPBU

spbu.glb:

`16 × 7 m`

Placeholder:

`16 × 12 m`

Model aman tetapi tidak memenuhi seluruh footprint.

### Dapur/Kopdes

dapur&kopdes.glb:

`7 × 2.8 m`

Model relatif kecil dibanding placeholder.

Ini merupakan masalah kosmetik, bukan bug collision.

---

# 27. BUG LOADING ASSET YANG SUDAH DIPERBAIKI

Ditemukan bug pada asset dengan karakter:

`&`

Contoh:

- rumah&ruko.glb
- dapur&kopdes.glb

Babylon SceneLoader sebelumnya melakukan encoding `%26`, menyebabkan server memberikan SPA fallback HTML.

Akibatnya:

`Unexpected magic`

Perbaikan dilakukan menggunakan URL/rootUrl yang sesuai agar file dengan karakter `&` dapat dimuat.

Hasil setelah perbaikan:

- rumah&ruko.glb → berhasil.
- dapur&kopdes.glb → berhasil.

---

# 28. OPTIMASI LOADING

Sebelumnya:

Asset dimuat secara sequential.

Jika satu asset lambat/hang:

`Asset A → Asset B → Asset C → ...`

Asset berikutnya dapat tertahan.

Perbaikan:

Asset final sekarang dapat dimuat secara parallel dengan error handling per asset.

Tujuan:

- tidak membuat satu asset lambat memblokir seluruh asset,
- mempercepat proses loading,
- asset lain tetap dapat dimuat jika salah satu gagal.

---

# 29. PERFORMANCE / FPS

Audit runtime menemukan:

Total scene setelah model final:

- sekitar 19.374 mesh.
- sekitar 15,09 juta vertex.

Sumber berat terbesar:

`gedung1.glb`

Karena:

- sekitar 1.443 child mesh per instance.
- digunakan 7 instance.

Selain itu:

- rumah1.glb sekitar 39 MB.
- beberapa asset besar membutuhkan waktu parsing/clone.

Temuan:

- terdapat frame drop/stutter saat initial loading.
- Setelah asset selesai dimuat, kondisi lebih stabil.
- Solo City dan Sriwedari Park tidak terdampak.

## Status

Optimasi BELUM dilakukan.

Jangan langsung melakukan optimasi besar sebelum ada keputusan.

Prioritas optimasi berikutnya dapat berupa:

- mengurangi detail gedung1,
- menggabungkan mesh jika memungkinkan,
- instancing,
- mengurangi asset high-poly,
- optimasi asset 3D.

Tetap harus scoped untuk Ngawi.

---

# 30. COLLIDER

Audit terbaru:

`2733 colliders`

Jumlah collider tetap sama setelah replacement model.

Model final menggunakan:

`checkCollisions = false`

untuk visual mesh.

Collision tetap menggunakan collider existing.

Tujuannya:

- visual tidak menambah collision baru,
- collision kendaraan tetap stabil,
- tidak mengubah mekanisme collision global.

---

# 31. HASIL AUDIT JALAN & OBJEK

Audit terbaru berdasarkan koordinat `IndonesiaMap.ts` TERKINI:

### Environment

`0 object overlap road`

### Bangunan

`57 bangunan → 0 overlap`

### Spawn

Spawn berada di parkiran.

### NPC lane

Semua lane NPC berada di jalan.

### Waypoint

Semua waypoint berada di road network.

### Jalan

Tidak ditemukan:

- pohon di tengah jalan,
- bangunan di tengah jalan,
- objek environment di tengah jalan,
- aspal keluar dari batas jalan,
- jalan terblokir.

Kondisi ini harus dipertahankan.

---

# 32. SUMBER KEBENARAN KOORDINAT

Sumber kebenaran Ngawi:

`IndonesiaMap.ts`

Tool audit lama:

- ngawi_verify.cjs
- ngawi_audit_v2.mjs
- ngawi_detailed_audit.mjs
- verifikasi_ngawi.mjs

memiliki koordinat lama dan tidak boleh dijadikan sumber kebenaran.

Tool tersebut dapat:

- ditandai stale/deprecated,
- diperbarui,
- atau tidak digunakan.

Jangan mengambil koordinat Ngawi dari tool lama.

---

# 33. WRONGWAY DETECTOR — PEKERJAAN BERIKUTNYA

Prioritas berikutnya:

Sinkronisasi `WrongWayDetector.ts` dengan `IndonesiaMap.ts`.

Yang harus diperiksa:

- ring ±245,
- main road aktual,
- secondary road aktual,
- connector road aktual,
- junction aktual,
- T-junction,
- ring junction.

Jangan menambahkan segment fiktif.

Jangan memasukkan jalan yang sudah tidak ada.

Jangan membuat sistem wrong-way baru.

Gunakan sistem existing.

---

# 34. WAYPOINT SYSTEM

Waypoint Ngawi sudah menggunakan koordinat terbaru.

Masih ditemukan komentar stale seperti:

- ring ±200,
- spawn (-170,0).

Komentar tersebut harus diperbarui agar dokumentasi tidak menyesatkan.

Jangan mengubah route hanya karena komentar lama.

---

# 35. FILE YANG BERKAITAN

Prioritas file Ngawi:

- `frontend/src/game/components/IndonesiaMap.ts`
- `frontend/src/game/components/NpcSystem.ts`
- `frontend/src/game/components/WaypointSystem.ts`
- `frontend/src/game/components/WrongWayDetector.ts`
- `frontend/src/game/components/DemoScene.ts`
- `frontend/src/game/components/SimpleMap.ts`
- `frontend/src/game/components/MapSelection.tsx`
- `frontend/src/game/components/map.types.ts`

Sebelum mengubah file global:

1. Audit penggunaannya.
2. Pastikan hanya Ngawi yang terpengaruh.
3. Gunakan konfigurasi khusus Ngawi jika memungkinkan.

---

# 36. FILE YANG TIDAK BOLEH DIUBAH SEMBARANGAN

Jangan mengubah:

- `violationStore.ts`
- `CarPhysics.ts`
- `CarController.ts`
- sistem waypoint global
- sistem gameplay global
- Solo City
- Sriwedari Park

kecuali benar-benar terbukti diperlukan.

Jika perubahan dapat dilakukan di `IndonesiaMap.ts`, prioritaskan perubahan di sana.

---

# 37. STATUS IMPLEMENTASI TERKINI

## Sudah selesai

- [x] Map Ngawi City.
- [x] Road network.
- [x] Ring road ±245.
- [x] Parkiran spawn.
- [x] Spawn dipindahkan ke parkiran.
- [x] Road constraint diperbaiki.
- [x] Bangunan placeholder.
- [x] Environment.
- [x] NPC kendaraan.
- [x] NPC truck.
- [x] NPC pedestrian prototype.
- [x] Waypoint/checkpoint.
- [x] Traffic light.
- [x] Wrong-way detector existing.
- [x] Collision.
- [x] Violation integration.
- [x] Map selection.
- [x] Replacement sebagian besar asset 3D.
- [x] Asset loading parallel.
- [x] Fix loading asset dengan karakter `&`.
- [x] Audit runtime asset.
- [x] Audit environment vs road.
- [x] Audit bangunan vs road.
- [x] Audit spawn.
- [x] Build berhasil.

---

# 38. MASIH HARUS DIKERJAKAN

## Prioritas Tinggi

- [ ] Sinkronisasi WrongWayDetector dengan ring ±245.
- [ ] Periksa semua junction WrongWay Ngawi.
- [ ] Pastikan tidak ada koordinat stale ±200.
- [ ] Runtime test wrong-way setelah perbaikan.
- [ ] Pastikan tidak ada false violation.

## Prioritas Menengah

- [ ] Tambahkan/replacement asset sekolah jika asset final tersedia.
- [ ] Tambahkan/replacement minimarket jika asset tersedia.
- [ ] Verifikasi NPC collision secara runtime.
- [ ] Verifikasi red-light behavior NPC.
- [ ] Verifikasi FPS pada mesin target.

## Prioritas Tambahan

- [ ] Perbesar truck menjadi sekitar 2× mobil pemain jika diputuskan.
- [ ] Optimasi gedung1.glb.
- [ ] Optimasi asset 3D berat.
- [ ] Perbaiki proporsi Kopdes.
- [ ] Perbaiki proporsi SPBU.
- [ ] Perbaiki ukuran visual dapur&kopdes.

---

# 39. CHECKLIST AUDIT MAP

## Map

- [ ] Ngawi dapat dibuka.
- [ ] Spawn benar.
- [ ] Semua jalan dapat dilewati.
- [ ] Tidak ada jalan buntu.
- [ ] Tidak ada jalan terputus.
- [ ] Semua persimpangan tersambung.
- [ ] Tidak ada pembatas menghalangi jalan.
- [ ] Tidak ada bangunan di jalan.
- [ ] Tidak ada pohon di jalan.
- [ ] Tidak ada objek environment di jalan.
- [ ] Tidak ada aspal keluar dari road boundary.
- [ ] Tidak ada visual road overlap yang tidak semestinya.

## NPC Mobil

- [ ] Hanya mobil NPC.
- [ ] Tidak ada motor NPC.
- [ ] Mobil tidak melayang.
- [ ] Mobil tidak tembus.
- [ ] Mobil tidak keluar jalan.
- [ ] Mobil tidak melawan arah.
- [ ] Mobil dapat berkeliling kota.
- [ ] Route NPC bervariasi.
- [ ] NPC tidak hanya berputar di satu tempat.
- [ ] NPC dapat menyalip.
- [ ] Menyalip hanya dari kanan.
- [ ] NPC tidak menembus kendaraan saat menyalip.

## Truck

- [ ] Truck tampil.
- [ ] Truck tidak melayang.
- [ ] Truck tidak menembus kendaraan.
- [ ] Truck mengikuti road network.
- [ ] Truck tidak melawan arah.
- [ ] Ukuran truck sesuai target jika perubahan ukuran sudah disetujui.

## NPC Orang

- [ ] NPC prototype.
- [ ] Berjalan di trotoar.
- [ ] Menyeberang melalui zebra cross.
- [ ] Tidak berjalan di tengah jalan.
- [ ] Tidak tembus kendaraan.
- [ ] Jika ditabrak pemain → violation.
- [ ] Jika ditabrak pemain → point berkurang.
- [ ] Tidak spam violation.

## Traffic

- [ ] Traffic light terlihat.
- [ ] Merah terlihat.
- [ ] Kuning terlihat.
- [ ] Hijau terlihat.
- [ ] Traffic light berada di persimpangan yang benar.
- [ ] Pelanggaran lampu merah menggunakan sistem existing.

## Gameplay

- [ ] Checkpoint bekerja.
- [ ] Checkpoint tidak dekat spawn.
- [ ] Checkpoint bervariasi.
- [ ] Checkpoint berada di jalan.
- [ ] Alert checkpoint sama seperti map lain.
- [ ] Violation bekerja.
- [ ] Point bekerja.
- [ ] Collision bekerja.
- [ ] Wrong-way bekerja di seluruh road network.

## Asset 3D

- [x] Rumah final tampil.
- [x] Ruko final tampil.
- [x] Warung final tampil.
- [x] Kopdes final tampil.
- [x] Bengkel final tampil.
- [x] SPBU final tampil.
- [x] Gedung kantor final tampil.
- [ ] Minimarket final.
- [ ] Sekolah final.

## Performance

- [ ] FPS stabil pada mesin target.
- [ ] Initial loading tidak terlalu berat.
- [ ] Tidak ada stutter berlebihan.
- [ ] Asset besar sudah dioptimasi jika diperlukan.

## Compatibility

- [x] Solo City tidak berubah.
- [x] Sriwedari Park tidak berubah.
- [x] Sistem existing tetap digunakan.
- [x] Build berhasil.
- [ ] Runtime final selesai.
- [ ] Tidak ada error runtime Ngawi.

---

# 40. HASIL PEKERJAAN TERBARU — AUDIT RUNTIME

Audit runtime terbaru dilakukan menggunakan production build.

Hasil:

- 11/11 asset final berhasil tampil.
- Tidak ada asset gagal permanen.
- Tidak ada model floating.
- Tidak ada model tenggelam.
- Tidak ada model terbalik.
- Tidak ada bangunan masuk jalan.
- Tidak ada environment masuk jalan.
- Tidak ada aspal keluar jalan.
- Tidak ada pohon di tengah jalan.
- Tidak ada jalan terblokir.
- Collider tetap 2733.
- Build berhasil.

Solo City dan Sriwedari Park tetap aman.

---

# 41. PERUBAHAN KODE TERBARU

Perubahan terbaru yang sudah dilakukan:

File:

`frontend/src/game/components/IndonesiaMap.ts`

Perubahan:

1. Replacement placeholder → GLB.
2. Asset loading parallel.
3. Perbaikan loading file dengan karakter `&`.
4. Asset final ditempatkan berdasarkan posisi placeholder.
5. Model final tidak menambah collision visual.
6. Placeholder collider tetap digunakan.
7. Temporary debug hook untuk audit runtime sudah dihapus.

Build terakhir:

`npm run build → PASS`

---

# 42. CATATAN PERFORMANCE

Current scene:

- ±19.374 mesh.
- ±15,09 juta vertex.

Masalah utama:

`gedung1.glb`

dengan sekitar:

`1.443 child mesh × 7 instance`

Asset rumah1.glb:

`±39 MB`

Initial load dapat menyebabkan:

- CPU spike,
- frame drop,
- stutter.

Optimasi belum dilakukan karena replacement asset merupakan fokus utama sebelumnya.

Optimasi harus dilakukan terpisah dan tetap scoped ke Ngawi.

---

# 43. TARGET AKHIR

Ngawi City harus terasa seperti kota Indonesia yang:

- luas,
- natural,
- rapi,
- presisi,
- playable,
- tidak berantakan,
- tidak memiliki objek di tengah jalan,
- tidak memiliki aspal keluar dari jalan,
- tidak memiliki jalan yang terblokir,
- memiliki traffic yang masuk akal,
- memiliki NPC yang hidup,
- memiliki berbagai zona,
- menggunakan asset 3D final secara bertahap.

Pemain dapat:

- berkendara mengelilingi kota,
- memilih berbagai jalan,
- melewati pertokoan,
- melewati perumahan,
- melewati sekolah,
- melewati SPBU,
- melewati perkantoran,
- menggunakan ring road,
- melewati berbagai persimpangan,
- mengikuti checkpoint bervariasi,
- bertemu NPC mobil,
- bertemu truck,
- bertemu NPC pedestrian,
- melihat traffic light,
- berkendara tanpa menemukan jalan buntu.

---

# 44. ATURAN UNTUK OPENCODE

Setiap kali OpenCode melanjutkan pekerjaan Ngawi:

1. Baca `PROJECT_HANDOVER.md` terlebih dahulu.
2. Audit kondisi kode saat ini sebelum melakukan perubahan.
3. Jangan mengandalkan asumsi atau koordinat lama.
4. Gunakan `IndonesiaMap.ts` sebagai sumber kebenaran koordinat Ngawi.
5. Pastikan perubahan hanya berdampak pada Ngawi.
6. Jangan mengubah Solo City.
7. Jangan mengubah Sriwedari Park.
8. Jangan mengubah sistem global jika tidak diperlukan.
9. Jangan membuat sistem baru jika sistem existing sudah tersedia.
10. Setelah perubahan lakukan build.
11. Jika memungkinkan lakukan runtime verification.
12. Periksa kembali:
   - jalan,
   - pembatas,
   - trotoar,
   - pohon,
   - bangunan,
   - aspal,
   - NPC,
   - traffic light,
   - checkpoint,
   - collision.
13. Jangan sekaligus mengubah fitur lain yang tidak berhubungan dengan task.
14. Laporkan file yang diubah.
15. Laporkan hasil build.
16. Laporkan hasil runtime.
17. Laporkan masalah yang masih tersisa.
18. Update dokumen ini setelah perubahan besar.

---

# 45. STATUS TERAKHIR / HANDOVER

Status Ngawi City saat ini:

`LAYAK DILANJUTKAN`

Kondisi:

- Road network sudah menggunakan ring ±245.
- Spawn sudah berada di parkiran.
- Environment dan bangunan telah diaudit terhadap road.
- Tidak ditemukan pohon/objek di tengah jalan.
- Tidak ditemukan aspal keluar dari jalan.
- Tidak ditemukan jalan terblokir pada audit runtime.
- Asset 3D utama sudah berhasil direplace.
- Asset loading sudah diperbaiki.
- Build berhasil.
- Solo City aman.
- Sriwedari Park aman.

Masalah utama yang masih perlu ditangani:

`WrongWayDetector Ngawi belum sepenuhnya sinkron dengan road network ±245.`

Masalah tambahan:

- sekolah masih placeholder,
- minimarket masih placeholder,
- truck belum 2× ukuran mobil pemain,
- optimasi FPS belum dilakukan,
- beberapa asset secara visual lebih kecil dari footprint placeholder.

Jangan mengerjakan semua masalah tersebut sekaligus.

Gunakan prioritas.

---

# 46. PRIORITAS NEXT TASK

Urutan pengerjaan yang disarankan:

1. Sinkronisasi WrongWayDetector Ngawi dengan `IndonesiaMap.ts`.
2. Verifikasi seluruh junction Ngawi.
3. Build.
4. Runtime test.
5. Pastikan wrong-way bekerja di ring ±245.
6. Pastikan tidak ada false violation.
7. Audit ulang jalan dan objek.
8. Setelah stabil, lanjutkan asset sekolah/minimarket.
9. Setelah itu evaluasi ukuran truck.
10. Terakhir lakukan optimasi FPS jika diperlukan.

---

> REMINDER PALING PENTING:
>
> **ADD, DON'T BREAK.**
>
> **HANYA NGAWI CITY.**
>
> **JANGAN MERUSAK SISTEM YANG SUDAH ADA.**
>
> **INDONESIAMAP.TS TERKINI ADALAH SUMBER KEBENARAN KOORDINAT.**
>
> **SETIAP PERUBAHAN HARUS DIAUDIT DAN DIVERIFIKASI.**

# 47. UPDATE TERBARU — VISUAL & PERFORMA NGAWI CITY

Bagian ini merupakan pembaruan terbaru setelah integrasi model 3D final, perbaikan visual, dan optimasi performance.

Jika terdapat perbedaan dengan catatan performance sebelumnya, bagian ini menjadi status terbaru.

## 47.1 Masalah Awal

Sebelum perbaikan, ditemukan beberapa masalah:

- Placeholder bangunan terlihat melayang.
- Penempatan GLB menggunakan bounding box minY yang tidak sesuai dengan pivot beberapa model.
- Ukuran visual bangunan terlalu seragam.
- Model GLB memiliki jumlah child mesh yang sangat banyak.
- Asset besar dapat menyebabkan loading dan frame drop.

Masalah tersebut diperbaiki tanpa mengubah layout X/Z Ngawi City.

## 47.2 Placeholder Footprint

Ukuran placeholder yang digunakan sebagai acuan:

| Tipe | Ukuran |
|---|---:|
| rumah1 | 8 × 7 m |
| rumah2 | 10 × 9 m |
| rumah3 | 12 × 11 m |
| ruko | 6 × 10 m |
| warung/nasi_padang | 7 × 6 m |
| Kopdes | 9 × 7 m |
| bengkel | 9 × 10 m |
| SPBU | 16 × 12 m |
| gedung/kantor | 18 × 14 m |

## 47.3 Perbaikan Grounding

Model GLB sekarang ditempatkan menggunakan dasar dunia:

`y = 0`

Hasil:

- Model tidak lagi melayang.
- Model tidak tenggelam.
- Model tetap berada pada posisi X/Z placeholder.
- Layout jalan tidak berubah.
- Collider existing tetap digunakan.

## 47.4 Scaling Model

Model tidak dibuat memiliki ukuran yang sama.

Setiap tipe bangunan menggunakan konfigurasi visual tersendiri:

- target height,
- overflow cap,
- minimum fraction,
- minimum world height.

Scaling mempertimbangkan:

1. Orientasi model.
2. Bounding box asli.
3. Target tinggi.
4. Footprint placeholder.
5. Batas ukuran maksimum.
6. Batas ukuran minimum.

Tujuannya:

- Rumah memiliki ukuran yang berbeda.
- Ruko memiliki ukuran berbeda.
- Gedung memiliki ukuran lebih besar.
- Fasilitas memiliki ukuran sesuai karakter masing-masing.
- Proporsi asli model tetap dipertahankan.
- Tidak ada model yang menjadi terlalu besar.
- Tidak ada model yang menjadi sangat kecil.
- Posisi X/Z tidak berubah.

## 47.5 Flatten & Merge

Hierarchy model GLB diproses menggunakan:

`flattenInstToRenderables()`

Kemudian mesh digabung berdasarkan material/side orientation jika memungkinkan.

Tujuan:

- Mengurangi jumlah mesh.
- Mengurangi overhead rendering.
- Tetap mempertahankan bentuk visual.
- Tidak mengubah gameplay.
- Tidak mengubah collision system.

## 47.6 Prewarm Asset

Asset GLB besar dipersiapkan terlebih dahulu sebelum proses placement.

Perhatian khusus diberikan kepada:

`rumah1.glb`

yang memiliki ukuran sekitar 39 MB.

Prewarm digunakan untuk mengurangi masalah loading asset besar.

## 47.7 Watchdog

Setelah proses replacement selesai dilakukan pengecekan setiap instance.

Setiap bangunan final harus memiliki mesh:

`_final`

Watchdog memastikan:

- Tidak ada asset yang terlewat.
- Tidak ada placeholder visual yang tertinggal.
- Semua replacement berhasil.

---

# 48. HASIL UKURAN MODEL FINAL

Hasil audit model final:

| Model | Ukuran Dunia |
|---|---:|
| gedung1 | 19.41 × 6.50 × 16.80 m |
| rumah2 | 13.50 × 4.01 × 7.00 m |
| rumah3 | 13.09 × 6.00 × 6.55 m |
| rumah&ruko | 11.02 × 5.61 × 7.20 m |
| rumah1 | 9.60 × 4.38 × 5.17 m |
| bengkel | 10.35 × 4.71 × 7.14 m |
| SPBU | 17.60 × 3.50 × 7.77 m |
| Kopdes | 11.70 × 2.60 × 3.09 m |
| dapur&kopdes | 12.13 × 2.00 × 4.89 m |
| nasi_padang | 7.37 × 3.40 × 3.03 m |
| pecel_lele | 7.50 × 2.04 × 7.50 m |

Ukuran tidak dibuat seragam.

Model mempertahankan rasio/aspect ratio masing-masing.

Hasil visual memiliki variasi tinggi dan ukuran sehingga lingkungan terlihat lebih natural.

## 48.1 Batas Ukuran

Hasil audit:

- Tidak ada model yang menjadi sangat besar.
- Tidak ada model yang menjadi sangat kecil secara ekstrem.
- Tidak ada model yang masuk road corridor.
- Tidak ada model yang mengganggu kendaraan.
- Anchor X/Z tetap.
- Tinggi model dibatasi menggunakan konfigurasi per tipe.

---

# 49. PLACEHOLDER VISUAL

Setelah replacement:

- Placeholder visual = 0.
- Final model 3D berhasil ditempatkan.
- Model final grounded.
- Collider placeholder tetap digunakan.

Visual GLB menggunakan:

`checkCollisions = false`

Collision tidak dipindahkan ke mesh visual.

Collider existing tetap digunakan agar mekanisme collision tidak berubah.

---

# 50. HASIL OPTIMASI MESH

Perbandingan kondisi:

| Metric | Sebelum Optimasi | Sesudah Optimasi |
|---|---:|---:|
| Total mesh | ±19.374 | 6.670 |
| Mesh aktif | ±19.374 | 6.652 |
| Vertices | ±15,09 juta | 13.098.726 |
| Triangles | — | 30.028.928 |
| Placeholder | 108 | 0 |
| Final mesh | 0 | 2.537 |

Jumlah mesh berhasil dikurangi secara signifikan.

Pengurangan jumlah mesh sekitar:

`±56%`

## 50.1 Merge per Asset

| Asset | Mesh Awal | Sesudah Merge |
|---|---:|---:|
| gedung1 ×7 | 1.443/instance | 64/instance |
| rumah1 ×9 | 102/instance | 88/instance |
| rumah3 ×4 | 104/instance | 100/instance |
| rumah2 ×8 | 55/instance | 43/instance |
| nasi_padang ×3 | 212/instance | 23/instance* |
| ruko ×12 | 26/instance | 23/instance |
| warung ×6 | 26/instance | 13/instance |
| bengkel ×3 | 52/instance | 41/instance |
| spbu ×1 | 18 | 3 |
| dapur&kopdes ×1 | 8 | 7 |
| Kopdes ×1 | 11 | 1 |

`*` Pada nasi_padang terdapat 2 grup kecil yang tidak berhasil di-merge.

---

# 51. OPTIMASI TAMBAHAN

Optimasi yang telah diterapkan:

- `computeWorldMatrix(true)`
- `isPickable = false`
- Visual GLB menggunakan `checkCollisions = false`
- Collider existing tetap aktif.
- Mesh final tidak menambah collision baru.
- Flatten hierarchy.
- Merge mesh.
- Prewarm asset.
- Error handling per asset.
- Watchdog replacement.

Optimasi tersebut tetap scoped pada Ngawi City.

Tidak dilakukan perubahan pada sistem gameplay global.

---

# 52. PERFORMANCE TERBARU

Hasil pengujian menggunakan headless Chrome:

| Kondisi | FPS |
|---|---:|
| Fresh entry setelah loading | 60.9 FPS |
| Re-entry Ngawi | 60.9 FPS |

Mesh scene:

`6.670 mesh`

FPS setelah asset selesai dimuat berada sekitar 60 FPS pada environment pengujian.

Catatan:

- Initial loading asset besar tetap dapat membutuhkan waktu.
- `rumah1.glb` sekitar 39 MB.
- FPS headless Chrome bukan jaminan FPS pada semua laptop.
- Tetap perlu pengujian pada mesin target.

---

# 53. FRESH ENTRY & RE-ENTRY

Fresh entry:

- 11/11 asset berhasil.
- 0 placeholder visual.
- 0 failure.
- 0 exception.

Re-entry:

- 11/11 asset berhasil.
- 0 placeholder visual.
- 6.670 mesh.
- 2.537 final mesh.
- 0 exception.

Pengujian dilakukan beberapa kali dan hasil konsisten.

---

# 54. FIX LIFECYCLE / STRICTMODE

Ditemukan masalah lifecycle pada development environment yang menggunakan React StrictMode.

Masalah terjadi karena:

- Scene dapat mengalami double mount.
- Cache GLB static dapat menyimpan promise yang terikat dengan scene lama.
- Scene lama dapat sudah disposed ketika promise digunakan kembali.

Perbaikan:

File:

`frontend/src/game/components/IndonesiaMap.ts`

Perubahan:

- GLB cache dibuat instance-level.
- Tidak lagi menggunakan static cache lintas scene.
- Dispatch mengecek `this.scene.isDisposed`.
- `placeGlbInstances()` memiliki guard terhadap disposed scene.
- Error dari scene yang sudah disposed tidak dianggap sebagai failure normal.

Hasil:

Fresh:

`11/11`

Re-entry pertama:

`11/11`

Re-entry kedua:

`11/11`

Failure:

`0`

Exception:

`0`

Tidak diperlukan perubahan pada:

- `GameCanvas.tsx`
- `main.tsx`

---

# 55. FILE YANG DIUBAH

File utama:

`frontend/src/game/components/IndonesiaMap.ts`

Perubahan mencakup:

1. GLB replacement.
2. Parallel asset loading.
3. Fix asset dengan karakter `&`.
4. Grounding model.
5. Scaling per tipe.
6. Flatten hierarchy.
7. Merge mesh.
8. Prewarm asset.
9. Watchdog.
10. Visual collision disabled.
11. Collider placeholder tetap.
12. Instance-level GLB cache.
13. Scene disposed guard.

Build:

`npm run build → PASS`

---

# 56. STATUS ASSET FINAL

Asset yang berhasil digunakan:

- rumah1.glb
- rumah2.glb
- rumah3.glb
- rumah&ruko.glb
- nasi_padang.glb
- pecel_lele.glb
- dapur&kopdes.glb
- Kopdes.glb
- bengkel.glb
- spbu.glb
- gedung1.glb

Total:

`11/11 asset berhasil dimuat dan ditempatkan.`

Asset yang belum memiliki model final:

- minimarket
- sekolah

Keduanya masih menggunakan placeholder.

---

# 57. REKOMENDASI OPTIMASI LANJUTAN

## 57.1 gedung1.glb

`gedung1.glb` masih memiliki sekitar:

`64 mesh / instance`

Setelah merge.

Jika diperlukan optimasi lanjutan, dapat dilakukan pre-merge pada asset menggunakan editor 3D.

Jangan melakukan perubahan tersebut sebelum diperlukan.

## 57.2 nasi_padang.glb

Terdapat beberapa grup kecil yang tidak berhasil di-merge.

Dapat dilakukan investigasi geometry/material jika diperlukan.

## 57.3 Kopdes dan Dapur

Beberapa asset terlihat relatif pendek:

- Kopdes sekitar 2.60 m.
- Dapur&Kopdes sekitar 2.00 m.

Jika ingin diperbaiki, dapat dipertimbangkan minimum world height sekitar 3 m.

Namun perubahan tersebut tidak wajib dan tidak boleh merusak footprint maupun layout.

---

# 58. STATUS TERBARU

## Visual

- [x] Placeholder melayang diperbaiki.
- [x] Model final grounded.
- [x] Placeholder visual = 0.
- [x] 11/11 asset final berhasil tampil.
- [x] Ukuran bangunan bervariasi.
- [x] Proporsi model dipertahankan.
- [x] Tidak ada bangunan ekstrem besar.
- [x] Tidak ada bangunan ekstrem kecil.
- [x] Anchor X/Z tidak berubah.
- [x] Tidak ada model masuk road corridor.

## Collision

- [x] Collider existing tetap digunakan.
- [x] Visual GLB tidak menambah collision.
- [x] Collider count tetap 2733.

## Loading

- [x] Parallel loading.
- [x] Asset `&` berhasil dimuat.
- [x] Prewarm asset besar.
- [x] Watchdog replacement.
- [x] Lifecycle/cache issue diperbaiki.

## Performance

- [x] Flatten.
- [x] Merge.
- [x] World matrix optimization.
- [x] `isPickable = false`.
- [x] Visual collision disabled.
- [x] Mesh berkurang sekitar 56%.
- [x] Fresh entry sekitar 60.9 FPS setelah loading.
- [x] Re-entry sekitar 60.9 FPS setelah loading.

## Compatibility

- [x] Solo City tidak berubah.
- [x] Sriwedari Park tidak berubah.
- [x] Road layout Ngawi tidak berubah.
- [x] Spawn tidak berubah.
- [x] NPC system tidak diubah.
- [x] Traffic light tidak diubah.
- [x] Gameplay existing tetap digunakan.

---

# 59. PRIORITAS PEKERJAAN BERIKUTNYA

Urutan pekerjaan berikutnya:

1. Sinkronisasi `WrongWayDetector.ts` dengan `IndonesiaMap.ts`.
2. Audit seluruh junction Ngawi.
3. Build.
4. Runtime test.
5. Test wrong-way pada ring ±245.
6. Pastikan tidak ada false violation.
7. Audit ulang road/object.
8. Tambahkan asset final sekolah jika tersedia.
9. Tambahkan asset final minimarket jika tersedia.
10. Evaluasi ukuran truck.
11. Evaluasi optimasi lanjutan `gedung1.glb`.
12. Test FPS pada laptop/mesin target.

Jangan mengerjakan semua perubahan sekaligus.

Gunakan:

`ADD, DON'T BREAK`

---

# 60. CATATAN PERFORMANCE HISTORIS

Catatan pada bagian #29 dan #42 merupakan kondisi SEBELUM optimasi.

Kondisi sebelum optimasi:

- ±19.374 mesh.
- ±15,09 juta vertex.
- `gedung1.glb` sekitar 1.443 child mesh per instance.
- `gedung1.glb` digunakan 7 instance.
- `rumah1.glb` sekitar 39 MB.
- Initial loading menyebabkan CPU spike/frame drop/stutter.

Setelah optimasi:

- 6.670 total mesh.
- 6.652 mesh aktif.
- 2.537 final mesh.
- 0 placeholder visual.
- ±56% pengurangan mesh.
- Fresh entry ±60.9 FPS setelah loading.
- Re-entry ±60.9 FPS setelah loading.

Dengan demikian, data pada #29 dan #42 dianggap sebagai:

`HISTORICAL / BEFORE OPTIMIZATION`

Sedangkan data #50–#52 merupakan:

`CURRENT / AFTER OPTIMIZATION`

---

# 61. KESIMPULAN UPDATE TERBARU

Pekerjaan visual replacement dan optimasi dasar Ngawi City telah selesai.

Hasil:

- 11/11 asset GLB berhasil digunakan.
- Placeholder visual = 0.
- Model tidak lagi melayang.
- Semua model grounded.
- Ukuran bangunan bervariasi berdasarkan tipe.
- Proporsi model tetap dipertahankan.
- Tidak ada bangunan ekstrem besar.
- Tidak ada bangunan ekstrem kecil.
- Tidak ada model masuk road corridor.
- Collider existing tetap digunakan.
- Mesh berhasil dikurangi sekitar 56%.
- Lifecycle/cache issue sudah diperbaiki.
- Fresh entry berhasil.
- Re-entry berhasil.
- 0 exception pada pengujian.
- FPS pengujian sekitar 60.9 setelah loading.
- Build berhasil.
- Solo City tidak berubah.
- Sriwedari Park tidak berubah.
- Layout Ngawi tidak berubah.
- Sistem gameplay existing tetap digunakan.

Masalah yang masih menjadi pekerjaan terpisah:

1. WrongWayDetector belum sepenuhnya sinkron dengan road network ±245.
2. Asset sekolah masih placeholder.
3. Asset minimarket masih placeholder.
4. Truck belum diubah menjadi 2× ukuran mobil.
5. Beberapa asset seperti Kopdes/Dapur relatif pendek.
6. Optimasi lanjutan `gedung1.glb` masih opsional.
7. FPS tetap perlu diverifikasi pada laptop/mesin target.

## STATUS

`VISUAL & BASIC PERFORMANCE OPTIMIZATION → SELESAI`

`WRONGWAY DETECTOR → NEXT PRIORITY`

`SCHOOL / MINIMARKET → MENUNGGU ASSET`

`TRUCK 2× → BELUM DIUBAH`

`FINAL MACHINE PERFORMANCE TEST → BELUM`

---

> **REMINDER UTAMA**
>
> **ADD, DON'T BREAK.**
>
> **HANYA NGAWI CITY.**
>
> **JANGAN MERUSAK SOLO CITY.**
>
> **JANGAN MERUSAK SRIWEDARI PARK.**
>
> **JANGAN MENGUBAH SISTEM EXISTING TANPA ALASAN KUAT.**
>
> **GUNAKAN INDONESIAMAP.TS SEBAGAI SUMBER KEBENARAN KOORDINAT.**
>
> **JANGAN MENGGUNAKAN KOORDINAT STALE DARI AUDIT LAMA.**
>
> **SETIAP PERUBAHAN HARUS DI-BUILD DAN, JIKA MEMUNGKINKAN, DI-RUNTIME TEST.**
>
> **PERUBAHAN HARUS SCOPED KE NGAWI SEBISA MUNGKIN.**