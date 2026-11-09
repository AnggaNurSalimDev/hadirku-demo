# Rancangan Web Absensi & Penggajian (MVP)

> Dokumen perencanaan pra-kode. Ditujukan untuk dibaca developer/AI yang akan menulis kode.
> Target: UMKM, belasan–puluhan pegawai, satu atau beberapa lokasi kerja.
> Ruang lingkup: **Pegawai** dan **HR** saja.

---

## 1. Ringkasan

Web untuk mencatat kehadiran pegawai secara jujur (sulit titip absen / absen dari rumah), merekap kehadiran, menghitung gaji berdasarkan aturan yang diatur HR sendiri, dan menerbitkan slip gaji.

Prinsip utama:

1. **Tidak ada data yang ditimpa.** Absen, koreksi, aturan gaji, dan slip selalu ditambah sebagai baris/versi baru.
2. **Aturan gaji adalah data, bukan kode.** Perubahan peraturan (BPJS, pajak, dll.) diatur HR tanpa mengubah sistem.
3. **Jam selalu dari server**, tidak pernah dari HP pengguna.
4. **Setiap pengecekan wewenang dilakukan di server**, tidak pernah hanya di tampilan.

---

## 2. Peran

| Peran | Cara masuk | Ringkasan wewenang |
|---|---|---|
| **Pegawai** | HP terdaftar (tanpa username/password) | Absen, ajukan koreksi, lihat riwayat, jadwal, slip miliknya |
| **Staf HR** | Username + password + 2FA | Urusan harian: akun pegawai, koreksi, absen manual, jadwal, pratinjau & ajukan gaji |
| **Kepala HR** | Username + password + 2FA | Semua wewenang staf + rumus gaji, finalisasi gaji, akun staf HR, keamanan lokasi |

### Tabel wewenang

```
WEWENANG                            KEPALA HR   STAF HR   PEGAWAI
Absen                                   ✓          ✓         ✓
Ajukan koreksi absen miliknya           ✓          ✓         ✓
Buat/nonaktifkan akun pegawai           ✓          ✓         ✗
Setujui/tolak koreksi                   ✓          ✓         ✗
Catat absen manual                      ✓          ✓         ✗
Atur jadwal shift                       ✓          ✓         ✗
Pratinjau & ajukan penggajian           ✓          ✓         ✗
Ubah jabatan & komponen gaji            ✓          ✗         ✗
FINALKAN gaji / terbitkan slip          ✓          ✗         ✗
Buat/nonaktifkan akun Staf HR           ✓          ✗         ✗
Daftarkan perangkat lokasi / ganti kunci✓          ✗         ✗
```

Catatan: Staf HR dan Kepala HR juga boleh punya jabatan (ikut digaji dan absen).

---

## 3. Akun & Login

### 3.1 Kepala HR pertama (dibuat developer)

Tidak ada halaman pendaftaran publik.

```
Developer, saat memasang sistem untuk klien:
  jalankan skrip seed
  → {nama, peran: KEPALA_HR, status: WAJIB_GANTI_PASSWORD}
  → password sementara diberikan langsung
        │
Login pertama → wajib ganti password + pasang 2FA
```

### 3.2 Akun pegawai (dibuat HR)

```
HR isi {nama, jabatan}
        │
Sistem: {status: BELUM_AKTIF} + KODE AKTIVASI
        (sekali pakai, berlaku 24 jam, disimpan sebagai hash)
        │  HR berikan kode langsung (tatap muka)
        ▼
Pegawai — WAJIB terhubung WiFi kantor:
  masukkan kode aktivasi
        │
  browser membuat pasangan kunci (WebCrypto, non-extractable)
  ├─ kunci privat → tetap di browser HP
  └─ kunci publik → dikirim ke server
        │
  {status: AKTIF, perangkat: terdaftar}
```

Kode tatap muka + WiFi kantor = bukti HR menyaksikan pendaftaran. Tidak perlu langkah persetujuan HP terpisah.

### 3.3 Masuk sehari-hari

**Pegawai** — tanpa login, selama akun AKTIF dan HP terdaftar:

```
Buka web
   │
Server kirim nonce acak (sekali pakai, berlaku 60 detik)
   │
HP tanda tangan nonce dengan kunci privat
   │
Server verifikasi dengan pub_key + cek status AKTIF
   ├─ lolos → sesi pendek dibuat (diperbarui diam-diam)
   └─ gagal → "Akun nonaktif / perangkat tidak dikenal, hubungi HR"
```

**HR** — username + password + kode 2FA (aplikasi authenticator). Sesi 8 jam.

### 3.4 Kasus khusus

| Kasus | Penanganan |
|---|---|
| Pegawai ganti HP / hapus data browser | HR terbitkan kode aktivasi baru → HP lama otomatis dicabut |
| Pegawai resign | Status → NONAKTIF (tidak dihapus, riwayat tetap ada) |
| HR salah login 3x | Terkunci; dibuka HR lain (Staf oleh Kepala; Kepala oleh Kepala lain) |
| Kepala HR satu-satunya terkunci | Pemulihan lewat skrip developer. Sarankan klien punya ≥ 2 akun HR |

---

## 4. Alur Absen

### 4.1 Persiapan per lokasi

Setiap lokasi punya **satu perangkat lokasi** (HP/PC) yang didaftarkan Kepala HR. Perangkat ini:

- memiliki kunci sendiri (sama seperti HP pegawai),
- melapor IP publik kantor ke server setiap 5 menit (laporan **ditandatangani**),
- menampilkan kode TOTP dalam bentuk angka **dan** QR (kode yang sama).

```
[Perangkat lokasi] ──tiap 5 menit, bertanda tangan──► SERVER
   "IP kantor sekarang 36.x.x.x"
                                 simpan {ip_terakhir, ip_dilapor_pada}

[Perangkat lokasi] tampilkan (bisa offline):
   kunci_rahasia + jam → 483920  →  angka 483920 + QR berisi 483920
```

### 4.2 Tiga jalur absen

```
                 Pegawai tekan [ABSEN]
                          │
   ① PENJAGA AWAL (gagal = tolak + alasan)
     ├─ akun AKTIF?
     ├─ tanda tangan perangkat sah?
     └─ absen terakhir > 1 menit lalu? (cegah dobel)
                          │
   ┌──────────────────────┼─────────────────────────┐
   ▼                      ▼                         ▼
JALUR WIFI (utama)   JALUR TOTP (cadangan)     JALUR MANUAL
IP permintaan ==     muncul jika jalur WiFi    dicatat HR jika HP
IP kantor DAN        gagal. Pegawai pilih:     pegawai rusak/hilang/
laporan IP < 10 mnt  [Scan QR] ATAU            habis baterai.
                     [Ketik kode]              Wajib alasan.
                     Cek:
                     ├─ kode periode ini (±1)?
                     ├─ salah < 5x?
                     └─ belum dipakai akun ini?
   │                      │                         │
   └──────────────────────┴────────────┬────────────┘
                                       ▼
          ④ TENTUKAN JENIS dari status terakhir
             BELUM_MASUK → MASUK ; SEDANG_KERJA → PULANG
                                       ▼
          ⑤ INSERT absen {pengguna, jenis, waktu_server,
                          metode: WIFI|TOTP|MANUAL, ip, perangkat}
```

- Di hari normal: **satu ketukan**, tanpa kode.
- QR dan kode ketik berisi **kode yang sama**. Scan hanya agar tidak perlu mengetik. Dibedakan pun tidak menambah keamanan selama opsi ketik ada (jalur terlemah yang menentukan).
- Laporan IP yang basi (> 10 menit) dianggap tidak diketahui → pegawai diarahkan ke jalur TOTP.

### 4.3 Status pegawai dalam sehari

```
BELUM_MASUK ──absen──► SEDANG_KERJA ──absen──► SELESAI
                              │
               lewat batas shift tanpa PULANG
                              ▼
                       PERLU_KOREKSI
```

### 4.4 Koreksi

Pegawai mengajukan (tanggal, jenis, jam usulan, alasan) → HR setujui/tolak.
Disetujui → sistem **INSERT** satu baris absen baru dengan `metode = KOREKSI`. Baris lama tidak diubah.

### 4.5 Sinyal untuk HR

Kolom `metode` memungkinkan dashboard menandai pola janggal, misalnya pegawai yang sering memakai TOTP/MANUAL saat WiFi normal.

---

## 5. Rekap Kehadiran

```
① baris absen mentah
   [{MASUK 07:58}, {PULANG 16:03}, {MASUK 08:20}, {PULANG 16:00}]
        │ pasangkan MASUK↔PULANG berdasarkan SHIFT (bukan tanggal kalender)
        ▼
② sesi kerja
   [{masuk 07:58, pulang 16:03}, {masuk 08:20, pulang 16:00}]
        │ bandingkan dengan jadwal_shift
        ▼
③ rekap harian
   [{jam 8.1, telat 0, lembur 0}, {jam 7.7, telat 20, lembur 0}]
        │ jumlahkan per periode
        ▼
④ rekap bulanan {hadir, telat_menit, lembur_jam, bolos}
```

- Sesi tanpa pasangan **tidak** diisi diam-diam (0 jam / 8 jam). Ditandai `PERLU_KOREKSI`.
- Shift lewat tengah malam aman karena jadwal memakai timestamp penuh.

---

## 6. Gaji

### 6.1 Konsep

- Aturan gaji melekat ke **jabatan** (bukan per pegawai). Pegawai beda sendiri → buat jabatan baru.
- **Katalog komponen** universal: HR bebas membuat komponen apa pun (BPJS, koperasi, kasbon, tunjangan, dll.).
- **Nilai per jabatan**: komponen yang sama boleh beda angka di tiap jabatan.
- Semua aturan **berversi** (`berlaku_mulai`). Edit = versi baru.

```
KATALOG KOMPONEN (sekali buat)        NILAI PER JABATAN (berversi)
{nama:"BPJS Kes", jenis:PERSEN,  ─┬─► {jabatan:KRU,    nilai:1%, maks:..}
 arah:KURANG, basis:POKOK}        ├─► {jabatan:SENIOR, nilai:1%, maks:..}
                                  └─► {jabatan:KEPALA, nilai:2%, maks:..}
```

### 6.2 Jenis komponen

**Level 1 (MVP):**

| Jenis | Bentuk |
|---|---|
| NOMINAL | Rp × (sekali / per hadir / per jam) |
| PERSEN | x% dari basis (POKOK / BRUTO), batas atas opsional |
| TABEL | rentang angka → tarif (mis. pajak) |

**Level 2 (disiapkan, belum dibangun):** jenis `RUMUS` — penyusun rumus dari balok (dropdown), disimpan sebagai JSON terstruktur di kolom `parameter`. **Tidak pernah memakai `eval`.**

```json
{ "jika": {"var": "hari_hadir", "op": ">=", "nilai": 22},
  "maka": {"var": "bruto", "op": "*", "nilai": 0.05},
  "lain": 0 }
```

### 6.3 Urutan hitung (contoh angka dummy)

```
REKAP {hadir:22, lembur:6j, telat:95mnt, bolos:0}
   │
① DASAR (dari aturan jabatan)
   BULANAN → gaji pokok                      3.000.000
   HARIAN  → tarif × hari hadir
   │
② TAMBAHAN
   lembur 6j × 20.000                          120.000
   uang makan 22 × 15.000                      330.000
   ▼
   BRUTO                                     3.450.000
   │
③ POTONGAN KEHADIRAN
   telat 95 mnt × 1.000                        −95.000
   │
④ POTONGAN KOMPONEN (sesuai basis masing-masing)
   "contoh potongan" 1% × pokok                −30.000
   ▼
   TAKE-HOME                                 3.325.000
```

### 6.4 Alur penggajian

```
STAF HR                              KEPALA HR
pilih periode
CEK: ada PERLU_KOREKSI? ──ya──► wajib selesaikan dulu
pratinjau (bisa hitung ulang)
[Ajukan] ──────────────────────────► status DIAJUKAN
                                       ├─ [Kembalikan + catatan] → DRAFT
                                       └─ [Finalkan] → FINAL
                                             → snapshot slip beku
                                             → slip terbit ke pegawai
Ada salah setelah FINAL → slip versi baru (versi lama tetap tersimpan)
```

Status: `DRAFT → DIAJUKAN → FINAL`. FINAL hanya dari DIAJUKAN, hanya oleh Kepala HR.

### 6.5 Slip gaji

- Identitas & periode
- Rincian pendapatan
- Rincian potongan **bagian pegawai** (mengurangi take-home)
- Take-home pay
- Ringkasan kehadiran (hadir, telat, lembur, bolos)
- Kotak **info**: komponen yang ditanggung perusahaan (tidak mengurangi gaji)
- Catatan: "Dihitung berdasarkan komponen yang diatur perusahaan."

PDF dibuat dari `snapshot` slip, bukan dihitung ulang.

### 6.6 Batasan sengaja

Sistem **bukan** payroll penuh. Tidak menyediakan tarif pajak/BPJS bawaan, tidak melakukan transfer gaji. Kebenaran angka aturan adalah tanggung jawab HR perusahaan.

---

## 7. Halaman

### 7.1 Pegawai (HP, 4 menu bawah)

```
┌──────────────────────────────┐
│ Halo, Budi       Sen, 9 Nov  │
│ Shift: 08:00 – 16:00         │
│ Status: BELUM MASUK          │
│      ┌──────────────────┐    │
│      │   ABSEN MASUK    │    │
│      └──────────────────┘    │
│ ✓ Terhubung WiFi kantor      │
│ (jika tidak terdeteksi:)     │
│ [ Scan QR ]  [ Ketik kode ]  │
├──────────────────────────────┤
│ Beranda Riwayat  Slip Profil │
└──────────────────────────────┘
```

| Menu | Isi |
|---|---|
| **Beranda** | Status hari ini, shift, tombol absen (berubah MASUK → PULANG → selesai), opsi cadangan |
| **Riwayat** | Ringkasan bulan, daftar per hari (✓ / ⚠ telat / ❗ perlu koreksi), tombol [Koreksi], status pengajuan, jadwal minggu depan |
| **Slip** | Daftar slip per periode + unduh PDF, tanda REVISI |
| **Profil** | Nama, jabatan, perangkat terdaftar, info "ganti HP hubungi HR" |

Pegawai **tidak** bisa: melihat aturan gaji, melihat data pegawai lain, mengedit absen.

### 7.2 HR (laptop)

| Menu | Isi | Akses |
|---|---|---|
| **Dashboard** | Hadir/belum/telat/libur hari ini, status IP & jam perangkat lokasi, daftar "perlu perhatian" | Staf, Kepala |
| **Persetujuan** | Kotak masuk: koreksi absen, input absen manual (wajib alasan) | Staf, Kepala |
| **Pegawai** | Daftar & detail, jabatan, perangkat, aktif/nonaktif, terbitkan kode aktivasi | Staf, Kepala |
| **Jadwal shift** | Grid pegawai × hari | Staf, Kepala |
| **Jabatan & Gaji** | Kartu ringkasan per jabatan → klik → panel edit dasar + komponen + [Coba hitung] | Lihat: Staf; Edit: Kepala |
| **Penggajian** | Periode, pratinjau, ajukan, kembalikan, finalkan | Ajukan: Staf; Finalkan: Kepala |
| **Pengaturan** | Akun staf HR, perangkat lokasi, ganti kunci | Kepala |

Tampilan Jabatan & Gaji:

```
┌─ KRU ───────────┐ ┌─ SENIOR ────────┐ ┌─ KEPALA ────────┐
│ Harian · 120rb  │ │ Bulanan · 3jt   │ │ Bulanan · 4,5jt │
│ 8 pegawai       │ │ 2 pegawai       │ │ 1 pegawai       │
│ + Uang makan    │ │ + Uang makan    │ │ + Tunj. jabatan │
│ + Lembur        │ │ + Lembur        │ │ − BPJS Kes      │
│ − BPJS Kes      │ │ − BPJS Kes      │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
          klik kartu ▼
┌─ SENIOR ──────────────────────────────┐
│ Skema: Bulanan   Dasar: 3.000.000 [✎] │
│ Lembur/jam · Telat/menit · Bolos  [✎] │
│ + Uang makan  15.000 × hadir     [✎]  │
│ − BPJS Kes    1% dari pokok      [✎]  │
│ [ + Tambah komponen ]                 │
│ [ Coba hitung untuk: Rina ▾ ]         │
└───────────────────────────────────────┘
```

---

## 8. Tabel Data (PostgreSQL)

### 8.1 Peta hubungan

```
IDENTITAS               ABSENSI                  GAJI
jabatan ◄─┐             lokasi                   komponen
jabatan_aturan          jadwal_shift                 │
          │                                    komponen_jabatan
pengguna ─┴─┬──► absen ◄── koreksi                   │
  ├─► kode_aktivasi                            penggajian ──► slip
  ├─► perangkat
  └─► tantangan
```

### 8.2 Definisi

```
jabatan
  id, nama, aktif

jabatan_aturan                       -- berversi
  id, jabatan_id, skema (HARIAN|BULANAN), nilai_dasar,
  tarif_lembur_jam, potong_telat_menit, potong_bolos,
  berlaku_mulai

pengguna
  id, nama, peran (PEGAWAI|STAF_HR|KEPALA_HR), jabatan_id (nullable),
  status (BELUM_AKTIF|AKTIF|NONAKTIF|WAJIB_GANTI_PASSWORD),
  username, password_hash, totp_2fa_secret_enc,   -- khusus HR
  gagal_login, terkunci_sampai, dibuat_oleh, dibuat_pada

kode_aktivasi
  id, pengguna_id, kode_hash, kedaluwarsa, dipakai_pada

perangkat                            -- HP pegawai
  id, pengguna_id, pub_key, status (AKTIF|DICABUT),
  didaftarkan_pada, dicabut_pada

tantangan                            -- nonce untuk tanda tangan
  id, subjek_tipe (PENGGUNA|LOKASI), subjek_id, nonce,
  kedaluwarsa, dipakai_pada

lokasi
  id, nama, pub_key_perangkat, totp_secret_enc, versi_kunci,
  ip_terakhir, ip_dilapor_pada

jadwal_shift
  id, pengguna_id, mulai (timestamptz), selesai (timestamptz), libur

absen                                -- HANYA INSERT
  id, pengguna_id, jenis (MASUK|PULANG), waktu (default now()),
  metode (WIFI|TOTP|MANUAL|KOREKSI), lokasi_id, ip, perangkat_id,
  totp_periode, koreksi_id, dicatat_oleh, alasan

koreksi
  id, pengguna_id, jenis, waktu_usulan, alasan,
  status (MENUNGGU|DISETUJUI|DITOLAK),
  diajukan_pada, diputus_oleh, diputus_pada, catatan

komponen                             -- katalog universal
  id, nama, arah (TAMBAH|KURANG),
  jenis (NOMINAL|PERSEN|TABEL),       -- nanti + RUMUS
  basis (POKOK|BRUTO), ditanggung (PEGAWAI|PERUSAHAAN), aktif

komponen_jabatan                     -- nilai per jabatan, berversi
  id, komponen_id, jabatan_id, nilai, satuan (SEKALI|PER_HADIR|PER_JAM),
  batas_atas, parameter (jsonb),      -- TABEL sekarang, RUMUS nanti
  berlaku_mulai

penggajian
  id, periode, status (DRAFT|DIAJUKAN|FINAL),
  diajukan_oleh, diajukan_pada, difinalkan_oleh, difinalkan_pada,
  catatan_kembali

slip                                 -- beku
  id, penggajian_id, pengguna_id, versi, snapshot (jsonb),
  take_home, dibuat_pada
```

### 8.3 Penjaga di level database

```
absen            : role aplikasi tanpa izin UPDATE/DELETE (append-only)
koreksi, slip    : tanpa DELETE; slip tanpa UPDATE
perangkat        : UNIQUE (pengguna_id) WHERE status = 'AKTIF'
absen            : UNIQUE (pengguna_id, totp_periode) WHERE totp_periode IS NOT NULL
jadwal_shift     : CHECK (selesai > mulai)
jabatan_aturan   : UNIQUE (jabatan_id, berlaku_mulai); CHECK nilai >= 0
komponen_jabatan : UNIQUE (komponen_id, jabatan_id, berlaku_mulai)
                   CHECK (nilai >= 0); PERSEN: CHECK (nilai <= 100)
slip             : UNIQUE (penggajian_id, pengguna_id, versi)
                   CHECK (take_home >= 0)
penggajian       : UNIQUE (periode)
kode_aktivasi    : CHECK (kedaluwarsa > dibuat_pada)
```

### 8.4 Penjaga di aplikasi (dalam satu transaksi)

- Minimal **1 KEPALA_HR AKTIF** — tolak penonaktifan/penurunan kepala terakhir.
- `FINAL` hanya dari `DIAJUKAN`, hanya oleh KEPALA_HR.
- Penggajian tidak bisa diajukan selama ada absen `PERLU_KOREKSI` di periode itu.
- Staf HR tidak bisa membuat/mengubah peran HR.
- `parameter` jsonb divalidasi sesuai `jenis` sebelum disimpan.
- Take-home negatif → tolak finalisasi, tandai pegawai.

---

## 9. Keamanan

### 9.1 Ancaman & penanganan

```
ANCAMAN                              PENANGANAN
Absen dari rumah                  →  IP kantor / TOTP dinamis
Titip absen (pakai akun teman)    →  kunci perangkat tak bisa disalin
Kode TOTP dikirim via WA          →  masa berlaku pendek + kolom metode
                                      dipantau HR (risiko sisa, diterima)
Tebak kode 6 digit                →  maks 5 salah per periode per akun
Pemalsuan IP lewat header         →  hanya percaya X-Forwarded-For dari
                                      proxy yang dikenal
Laporan IP palsu ke server        →  laporan wajib ditandatangani
                                      kunci perangkat lokasi
Replay tanda tangan lama          →  nonce acak, sekali pakai, 60 detik
Ubah jam HP                       →  waktu selalu dari server
Akun HR dibobol                   →  password kuat + 2FA + kunci 3x salah
Staf HR curang lewat gaji         →  finalisasi wajib Kepala HR
Mengintip data orang lain         →  setiap query dibatasi pengguna_id sesi
Database bocor                    →  hash untuk password & kode aktivasi;
                                      rahasia TOTP terenkripsi
```

### 9.2 Daftar aturan teknis

**Transport & sesi**
- HTTPS wajib + header HSTS.
- Cookie sesi: `HttpOnly`, `Secure`, `SameSite=Strict`.
- Sesi pegawai pendek (mis. 12 jam), diperbarui diam-diam lewat tanda tangan perangkat. Status akun dicek **di setiap permintaan** → nonaktif berlaku seketika.
- Sesi HR 8 jam, logout otomatis.
- Token CSRF untuk semua aksi yang mengubah data di sisi HR.

**Kata sandi & rahasia**
- Password HR di-hash dengan **argon2id** (atau bcrypt). Tidak pernah disimpan/dicatat dalam bentuk asli.
- Kode aktivasi disimpan sebagai hash, sekali pakai, 24 jam.
- `totp_secret` lokasi dan `totp_2fa_secret` HR dienkripsi; kunci enkripsi disimpan di environment variable, **bukan** di database.
- Kunci privat perangkat dibuat `extractable: false` di WebCrypto.

**Pembatasan laju (rate limit)**
- Endpoint absen: maks beberapa permintaan per menit per akun.
- Kode TOTP: maks 5 salah per periode per akun.
- Kode aktivasi: maks 5 salah per akun, lalu kode hangus.
- Login HR: 3 salah → terkunci.

**Otorisasi**
- Middleware cek peran di **setiap endpoint**. Tampilan yang menyembunyikan tombol bukan pengaman.
- Data pegawai selalu difilter `WHERE pengguna_id = <id dari sesi>`, bukan dari parameter URL.

**IP & lokasi**
- Ambil IP klien hanya dari sumber terpercaya (konfigurasi `trust proxy` sesuai hosting). Jangan membaca header `X-Forwarded-For` mentah.
- Laporan IP dari perangkat lokasi wajib bertanda tangan + nonce.
- Laporan IP > 10 menit dianggap basi.
- Kepala HR dapat **ganti kunci** lokasi: TOTP lama & kunci perangkat lokasi lama langsung tidak berlaku.

**Database**
- Role database aplikasi dengan hak minimum (tanpa UPDATE/DELETE pada tabel append-only).
- Query selalu berparameter (tidak menyambung string SQL).
- Backup terjadwal.

**Masukan & tampilan**
- Validasi semua masukan di server (angka ≥ 0, persen ≤ 100, tanggal valid, struktur jsonb sesuai jenis).
- Tidak ada `eval` / eksekusi rumus dalam bentuk teks.
- Header Content-Security-Policy; React sudah meng-escape teks secara bawaan.

**Log**
- Jangan mencatat password, kode aktivasi, kode TOTP, atau rahasia ke log.

### 9.3 Risiko sisa (disadari & diterima)

- Kode TOTP masih bisa dibagikan dalam ~60–90 detik. Ditekan dengan pemantauan kolom `metode`, tidak dihilangkan.
- Sinyal WiFi bisa sedikit bocor ke luar gedung.
- ISP dengan IP bersama (CGNAT) bisa melemahkan jalur WiFi — **harus dicek di lokasi nyata**.
- Siapa pun yang memegang HP pegawai yang tidak terkunci bisa melihat slip gaji pemiliknya (PIN slip ditunda).

---

## 10. Di luar ruang lingkup MVP

- Peran Owner / pengawas HR
- PIN khusus untuk membuka slip gaji
- Jenis komponen `RUMUS` (level 2) — struktur data sudah disiapkan
- Log audit tindakan HR terpisah
- Fitur pengajuan umum dari Staf ke Kepala HR
- Payroll penuh (tarif pajak/BPJS bawaan, transfer gaji)
- NFC tag, tablet kiosk, mesin sidik jari
- Tombol "terapkan komponen ke jabatan lain"

---

## 11. Langkah berikutnya (sistem asli)

1. Buat prototipe **jalur absen WiFi** (pendaftaran perangkat + tanda tangan + cek IP).
2. Uji di lokasi nyata: apakah IP kantor stabil? apakah ISP memakai IP bersama?
3. Baru lanjut ke jalur TOTP, rekap, lalu gaji.

---

## 12. Web Demo (yang dibangun PERTAMA)

> Repo ini membangun **web demo** dulu. Bagian 1–11 adalah rancangan sistem asli yang menjadi acuan perilaku. Demo mensimulasikan sistem itu sepenuhnya di browser.

### 12.1 Tujuan & sasaran

- Pengunjung paham alur sistem dalam ±5 menit tanpa dijelaskan.
- Sasaran **berlapis**:
  - **Lapis 1 (default)** — pemilik usaha/HR: bahasa sederhana, fokus manfaat.
  - **Lapis 2 (tombol "Lihat cara kerja")** — recruiter/klien teknis: panel server, alasan teknis, tautan ke `docs/`.
- Target pasar: usaha kecil–menengah.

### 12.2 Teknologi

- React + Vite, **frontend saja**, tanpa backend.
- Data disimpan di `localStorage` lewat adapter (lihat 12.6).
- Deploy di Vercel (HTTPS otomatis — dibutuhkan WebCrypto & kamera).
- Bila memakai React Router: `vercel.json` rewrite semua path ke `index.html`.

### 12.3 Apa yang disimulasikan

```
SISTEM ASLI                       DEMO
Cek IP kantor (WiFi)          →   saklar: (●) WiFi kantor ( ) Di luar
Perangkat lokasi fisik        →   panel "HP Lokasi" di layar yang sama
Pendaftaran perangkat + ttd   →   dianggap sudah terdaftar (boleh pakai
                                  WebCrypto sungguhan di browser)
Login HR + 2FA                →   pengalih peran, tanpa login
Jam server                    →   "jam demo" + tombol [+1 hari]
Database                      →   localStorage + tombol [Reset]
TOTP                          →   SUNGGUHAN (dihitung di browser,
                                  berganti tiap 30 detik)
```

Rahasia TOTP demo ditulis di kode — beri komentar bahwa di sistem asli rahasia ini terenkripsi di server.

### 12.4 Tata letak

```
┌───────────────────────────────────────────────────────┐
│ MODE DEMO · data tidak permanen               [Reset] │
│ Peran: [Pegawai ▾]   Jam demo: Sen 9 Nov 07:55 [+1h]  │
├──────────────────────┬────────────────────────────────┤
│ 📱 HP PEGAWAI         │ 📱 HP LOKASI                   │
│ (tampilan asli)      │ kode 483920  [QR]              │
│                      │ Simulasi jaringan:             │
│ [ ABSEN MASUK ]      │ (●) WiFi kantor ( ) Di luar    │
│                      │ ─────────────────────────────  │
│                      │ 📋 Yang terjadi di server      │
│                      │ (Lapis 2 — tampil jika dibuka) │
│                      │ ✓ ttd perangkat sah            │
│                      │ ✓ IP cocok kantor              │
│                      │ → INSERT absen (WIFI)          │
└──────────────────────┴────────────────────────────────┘
```

- Peran HR (Staf/Kepala) → panel kiri berganti tampilan laptop HR.
- Di layar sempit (HP), panel ditumpuk vertikal.

### 12.5 Skenario terpandu

```
① Hari normal        : absen 1 ketukan via WiFi
② WiFi mati          : jalur cadangan scan QR / ketik kode
③ Coba curang        : absen dari "luar" + kode basi → ditolak
④ Lupa absen pulang  : pegawai ajukan koreksi → HR setujui
⑤ Akhir bulan        : Staf ajukan gaji → Kepala finalkan → slip PDF
⑥ Ubah aturan gaji   : Kepala ubah komponen → [Coba hitung]
```

Setiap skenario punya petunjuk langkah ("Sekarang tekan ABSEN"); pengunjung bebas keluar dari skenario kapan saja.

### 12.6 Struktur kode

```
src/
├─ logika/       FUNGSI MURNI (tanpa efek samping, bisa dipindah ke backend)
│                rekap(), hitungGaji(), tentukanJenis(), cekAbsen(),
│                validasiKomponen(), totp()
├─ penyimpanan/  adapter: demo → localStorage ; asli (nanti) → API
├─ data-dummy/   1 lokasi, 3 jabatan, ±8 pegawai, absen ±1 bulan
├─ skenario/     6 skenario terpandu
└─ tampilan/     komponen React: pegawai, HR, HP lokasi, panel server
docs/
└─ rancangan-web-absensi.md   (dokumen ini)
```

Aturan:
- Logika di `logika/` **tidak boleh** mengakses `localStorage`, DOM, atau `Date.now()` langsung — waktu dan data selalu dikirim sebagai argumen (jam demo bisa diatur).
- Semua aturan bisnis & penjaga (bagian 4–6, 8.3–8.4) tetap berlaku di demo, ditegakkan di `logika/`.
- Data tetap append-only di demo: tidak ada fungsi ubah/hapus absen.
- Guard clause & invariant check wajib di setiap fungsi logika.

### 12.7 Batas demo

- 1 lokasi, 3 jabatan, ±8 pegawai dummy, 1 periode gaji.
- Tanpa pendaftaran akun & kode aktivasi (cukup disebut di teks "tersedia di versi asli").
- Tanpa level 2 (RUMUS).

### 12.8 README

1. Tautan demo.
2. Dua kalimat untuk pemilik usaha (manfaat).
3. Tautan ke `docs/` untuk pembaca teknis.
