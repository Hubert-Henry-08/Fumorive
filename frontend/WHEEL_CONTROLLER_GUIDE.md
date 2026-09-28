# Controller/Wheel Fumorive

1. Sambungkan setir USB dan pedal sebelum membuka game.
2. Di Windows, tekan `Win + R`, jalankan `joy.cpl`, lalu pastikan setir, pedal, dan tombol terdeteksi.
3. Buka sebuah map kendaraan. Pada HUD, pilih **WHEEL** di bagian **INPUT MODE**.
4. Bila status menyatakan controller belum terhubung, Fumorive tetap menerima keyboard sebagai fallback.
5. Buka **Kalibrasi / Mapping**. Untuk tiap pedal, lepaskan pedal lalu klik **Simpan posisi diam**; setelah itu tahan penuh dan klik **Deteksi Gas/Rem**. Kedua posisi ini membuat pedal generic bekerja benar walau arah axis-nya terbalik. Nomor axis dan dead zone tetap dapat diubah manual. Pengaturan disimpan per perangkat di browser (`localStorage`) dan digunakan pada semua map kendaraan.

## Mapping tombol default

Untuk controller dengan susunan tombol PlayStation yang mengikuti Standard Gamepad API: **△** menaikkan fork, **□** menurunkan fork, **○** memiringkan fork ke atas, dan **×** memiringkannya ke bawah. Tombol **R2** menjatuhkan box yang sedang dibawa. Aksi-aksi ini hanya berlaku pada map forklift. Tombol bahu lain digunakan pada seluruh kendaraan: L1 mesin, R1 kamera, dan L2 klakson. Tidak ada input gigi atau shifter pada controller di map mana pun: pedal rem menghentikan kendaraan saat melaju lalu menjalankannya mundur setelah hampir berhenti. Karena controller generic dapat memiliki urutan tombol lain, nomor mapping dapat disesuaikan melalui panel pengaturan dan tersimpan per perangkat.

Web Gamepad API tidak menjamin force feedback/vibrasi. Kontrol setir, gas, rem, dan tombol tetap didukung selama Windows/browser mengenali perangkatnya.
