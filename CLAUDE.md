# Hadirku — Web Absensi & Penggajian (Demo)

Sumber kebenaran proyek ini: **`docs/rancangan-web-absensi.md`**. Baca seluruhnya sebelum menulis kode.

- Yang dibangun sekarang: **web demo** (bagian 12) — React + Vite, frontend saja, data di localStorage, deploy Vercel.
- Bagian 1–11 adalah rancangan sistem asli; perilaku, aturan bisnis, dan penjaganya tetap harus ditiru di demo.

## Aturan kerja

- Ikuti rancangan. Jika ada yang ambigu atau bertentangan, **tanyakan dulu**, jangan menebak diam-diam.
- Jangan menambah fitur di luar rancangan (lihat bagian 10 "Di luar ruang lingkup").
- Logika bisnis di `src/logika/` sebagai fungsi murni: tanpa localStorage, DOM, atau `Date.now()` langsung.
- Selalu sertakan guard clause & invariant check.
- Data append-only: tidak ada fungsi ubah/hapus absen, koreksi, atau slip.
- Tidak ada `eval` untuk rumus.
- Bahasa antarmuka: Indonesia.

## Saat menjelaskan perubahan ke pemilik proyek

- Bagian sensitif (hak akses, data absen/koreksi, hitung gaji, tanda tangan/TOTP): beri konteks singkat — aturan yang disentuh, lokasi file, titik rawan — lalu tanyakan apakah perlu penelusuran detail.
- Bagian lain: jelaskan hanya jika diminta.
- Sertakan diagram sederhana (kotak/garis) yang menunjukkan alur data atau perubahan bentuk data.
