# Hadirku — Demo Absensi & Gaji

**Demo:** _(tautan Vercel menyusul)_

**Untuk pemilik usaha:** Pegawai absen cukup satu ketukan dari HP — tapi tidak bisa dari rumah dan tidak bisa dititipkan. Di akhir bulan gaji dihitung otomatis dari kehadiran dan aturan yang Anda atur sendiri, lalu slip langsung terbit.

**Untuk pembaca teknis:** rancangan lengkap (alur, tabel data PostgreSQL, keamanan) ada di [`docs/rancangan-web-absensi.md`](docs/rancangan-web-absensi.md). Di demo, buka **"Lihat cara kerja"** untuk melihat setiap pemeriksaan server secara langsung.

## Menjalankan

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # tes logika (vitest)
npm run build
```

WebCrypto (TOTP) hanya berjalan di HTTPS atau `localhost`.

## Struktur

```
src/
├─ logika/       fungsi murni: absen, rekap, gaji, koreksi, penggajian, totp, wewenang
├─ penyimpanan/  "server" demo + adapter localStorage (nanti diganti adapter API)
├─ data-dummy/   1 lokasi, 3 jabatan, 8 pegawai, absen Okt–Nov 2026
├─ skenario/     6 skenario terpandu
└─ tampilan/     React: HP pegawai, laptop HR, HP lokasi, panel server
```

Semua data fiktif. Angka BPJS/pajak hanya contoh, bukan tarif resmi.
