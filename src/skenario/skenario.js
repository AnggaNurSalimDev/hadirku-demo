// Skenario terpandu (rancangan 12.5). Setiap skenario dimulai dari data awal.
// siapkan(state awal) → bagian state yang diubah. terapkan(state) di langkah → bantuan pindah peran/jam.

import { wib } from '../logika/waktu.js'

const cari = (s, awalan) => s.pengguna.find((p) => p.nama.startsWith(awalan)).id

/** Majukan jam demo (tidak boleh mundur) + perbarui laporan IP. */
const keJam = (s, jam) =>
  jam > s.jamDemo ? { jamDemo: jam, lokasi: s.lokasi.map((l) => ({ ...l, ipDilaporPada: jam })) } : {}

export const SKENARIO = [
  {
    id: 1,
    judul: 'Hari normal',
    ringkas: 'Absen 1 ketukan lewat WiFi kantor',
    siapkan: (s) => ({ pelakuId: cari(s, 'Budi'), jaringan: 'KANTOR', ui: { tabPegawai: 'beranda' } }),
    langkah: [
      { teks: 'Budi tiba di toko pukul 07:55 dan HP-nya tersambung WiFi kantor. Tekan tombol ABSEN MASUK.' },
      {
        teks: 'Tercatat! Panel "Lihat cara kerja" sekarang terbuka: inilah pemeriksaan yang dilakukan server dalam sekejap.',
        terapkan: () => ({ ui: { lapis2: true } }),
      },
      {
        teks: 'Jam dimajukan ke 16:05. Tekan ABSEN PULANG.',
        terapkan: (s) => keJam(s, wib(2026, 11, 9, 16, 5)),
      },
      { teks: 'Selesai. Di hari normal pegawai cukup 2 ketukan sehari — tanpa kode, tanpa antre.' },
    ],
  },
  {
    id: 2,
    judul: 'WiFi kantor mati',
    ringkas: 'Jalur cadangan: scan QR atau ketik kode',
    siapkan: (s) => ({ pelakuId: cari(s, 'Budi'), jaringan: 'LUAR', ui: { tabPegawai: 'beranda' } }),
    langkah: [
      { teks: 'WiFi toko sedang mati, HP Budi memakai data seluler. Tekan ABSEN MASUK.' },
      { teks: 'Sistem tidak mengenali IP kantor, jadi meminta kode. Pilih "Scan QR" atau ketik kode yang tampil di panel HP Lokasi.' },
      { teks: 'Tercatat dengan metode TOTP. HR bisa melihat siapa saja yang sering memakai jalur ini.' },
    ],
  },
  {
    id: 3,
    judul: 'Coba curang',
    ringkas: 'Absen dari rumah ditolak',
    siapkan: (s) => ({ pelakuId: cari(s, 'Budi'), jaringan: 'LUAR', ui: { tabPegawai: 'beranda', lapis2: true } }),
    langkah: [
      { teks: 'Budi masih di rumah dan mencoba absen. Tekan ABSEN MASUK.' },
      { teks: 'Ia tidak bisa melihat HP Lokasi di toko. Ketik kode tebakan, misalnya 123456.' },
      { teks: 'Ditolak. Setelah 5 kali salah, percobaan diblokir sampai kode berganti — menebak 1 dari sejuta kemungkinan jadi sia-sia.' },
    ],
  },
  {
    id: 4,
    judul: 'Lupa absen pulang',
    ringkas: 'Pegawai ajukan koreksi, HR setujui',
    siapkan: (s) => ({ pelakuId: cari(s, 'Sari'), jaringan: 'KANTOR', ui: { tabPegawai: 'riwayat' } }),
    langkah: [
      { teks: 'Sari lupa absen pulang tanggal 6 November. Di Riwayat ada tanda ❗. Tekan tombol Koreksi pada baris itu.' },
      { teks: 'Isi jam pulang 16:00 dan alasannya, lalu kirim.' },
      {
        teks: 'Pindah ke Staf HR (Dewi). Buka Persetujuan lalu setujui pengajuan Sari.',
        terapkan: (s) => ({ pelakuId: cari(s, 'Dewi'), ui: { menuHr: 'persetujuan' } }),
      },
      {
        teks: 'Kembali ke Sari. Riwayatnya sekarang ✓ — baris lama tidak diubah, sistem menambahkan baris baru bermetode KOREKSI.',
        terapkan: (s) => ({ pelakuId: cari(s, 'Sari'), ui: { tabPegawai: 'riwayat' } }),
      },
    ],
  },
  {
    id: 5,
    judul: 'Akhir bulan',
    ringkas: 'Staf ajukan gaji → Kepala finalkan → slip',
    siapkan: (s) => ({ pelakuId: cari(s, 'Dewi'), ui: { menuHr: 'penggajian' } }),
    langkah: [
      { teks: 'Dewi (Staf HR) membuka Penggajian Oktober 2026. Periksa pratinjau, lalu tekan Ajukan ke Kepala HR.' },
      {
        teks: 'Pindah ke Ani (Kepala HR). Periksa, lalu tekan Finalkan.',
        terapkan: (s) => ({ pelakuId: cari(s, 'Ani'), ui: { menuHr: 'penggajian' } }),
      },
      {
        teks: 'Slip langsung terbit. Ini tampilan di HP Budi — buka slip Oktober, lalu coba Cetak / Simpan PDF.',
        terapkan: (s) => ({ pelakuId: cari(s, 'Budi'), ui: { tabPegawai: 'slip' } }),
      },
    ],
  },
  {
    id: 6,
    judul: 'Ubah aturan gaji',
    ringkas: 'Kepala HR mengatur komponen sendiri',
    siapkan: (s) => ({ pelakuId: cari(s, 'Ani'), ui: { menuHr: 'jabatan' } }),
    langkah: [
      { teks: 'Ani (Kepala HR) membuka Jabatan & Gaji. Klik kartu Senior.' },
      { teks: 'Ubah nilai uang makan, lalu tekan "Coba hitung" untuk melihat dampaknya pada gaji Rina sebelum menyimpan.' },
      { teks: 'Simpan = versi baru dengan tanggal berlaku. Slip yang sudah final tidak ikut berubah.' },
    ],
  },
]
