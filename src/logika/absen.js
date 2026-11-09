// Alur absen (rancangan bagian 4). Fungsi murni: semua data & waktu masuk lewat argumen.
// Setiap pengecekan dicatat di `langkah` supaya panel "Yang terjadi di server" bisa menampilkannya.

import { MENIT, JAM } from './waktu.js'
import { boleh, AKSI } from './wewenang.js'

export const JENDELA_SEBELUM_SHIFT = 2 * JAM // absen masuk boleh 2 jam sebelum shift
export const BATAS_SETELAH_SHIFT = 4 * JAM // lewat dari ini tanpa PULANG → PERLU_KOREKSI
export const JEDA_DOBEL = 1 * MENIT
export const LAPORAN_IP_BASI = 10 * MENIT
export const MAKS_SALAH_TOTP = 5

/** Shift (bukan libur) milik pengguna yang jendela waktunya memuat `waktu`. */
export function cariShift(jadwal, penggunaId, waktu) {
  return (
    jadwal.find(
      (s) =>
        s.penggunaId === penggunaId &&
        !s.libur &&
        waktu >= s.mulai - JENDELA_SEBELUM_SHIFT &&
        waktu <= s.selesai + BATAS_SETELAH_SHIFT,
    ) ?? null
  )
}

/** Baris absen pengguna yang termasuk jendela sebuah shift, urut waktu. */
export function absenUntukShift(absen, shift) {
  if (!shift) return []
  return absen
    .filter(
      (a) =>
        a.penggunaId === shift.penggunaId &&
        a.waktu >= shift.mulai - JENDELA_SEBELUM_SHIFT &&
        a.waktu <= shift.selesai + BATAS_SETELAH_SHIFT,
    )
    .sort((a, b) => a.waktu - b.waktu)
}

/** MASUK jika belum ada MASUK; PULANG jika sudah MASUK tapi belum PULANG; null jika selesai. */
export function tentukanJenis(barisShift) {
  const adaMasuk = barisShift.some((a) => a.jenis === 'MASUK')
  const adaPulang = barisShift.some((a) => a.jenis === 'PULANG')
  if (!adaMasuk && !adaPulang) return 'MASUK'
  if (adaMasuk && !adaPulang) return 'PULANG'
  if (!adaMasuk && adaPulang) return 'MASUK' // pulang sudah dikoreksi, masuk belum
  return null
}

/** Status hari ini untuk tampilan Beranda pegawai. */
export function statusSaatIni(jadwal, absen, penggunaId, waktu) {
  const shift = cariShift(jadwal, penggunaId, waktu)
  if (!shift) return { status: 'TIDAK_ADA_SHIFT', shift: null, masuk: null, pulang: null }
  const baris = absenUntukShift(absen, shift)
  const masuk = baris.find((a) => a.jenis === 'MASUK') ?? null
  const pulang = [...baris].reverse().find((a) => a.jenis === 'PULANG') ?? null
  const jenis = tentukanJenis(baris)
  const status = jenis === 'MASUK' ? 'BELUM_MASUK' : jenis === 'PULANG' ? 'SEDANG_KERJA' : 'SELESAI'
  return { status, shift, masuk, pulang }
}

function tolak(langkah, alasan, ekstra = {}) {
  return { ok: false, alasan, langkah, ...ekstra }
}

/**
 * Pemeriksaan absen oleh "server".
 * input:
 *  pengguna, perangkat (milik pengguna atau null), jadwal, absen, waktu (jam server),
 *  ipPermintaan, lokasi {id, ipTerakhir, ipDilaporPada},
 *  kode (string | null), kodeSekitar ({periode: kode} | null), gagalTotp (angka salah di periode ini)
 */
export function cekAbsen(input) {
  const { pengguna, perangkat, jadwal, absen, waktu, ipPermintaan, lokasi, kode = null, kodeSekitar = null, gagalTotp = 0 } =
    input ?? {}
  const langkah = []
  const catat = (teks, ok) => langkah.push({ teks, ok })

  if (!pengguna || !Array.isArray(jadwal) || !Array.isArray(absen) || !lokasi) {
    throw new TypeError('cekAbsen: data masukan tidak lengkap')
  }
  if (typeof waktu !== 'number') throw new TypeError('cekAbsen: waktu server wajib')

  // ① Penjaga awal
  if (!boleh(pengguna, AKSI.ABSEN)) {
    catat('Akun aktif?', false)
    return tolak(langkah, 'Akun tidak aktif. Hubungi HR.')
  }
  catat('Akun aktif', true)

  if (!perangkat || perangkat.status !== 'AKTIF' || perangkat.penggunaId !== pengguna.id) {
    catat('Tanda tangan perangkat sah?', false)
    return tolak(langkah, 'Perangkat tidak dikenal. Hubungi HR untuk mendaftarkan HP.')
  }
  catat('Tanda tangan perangkat sah', true)

  const terakhir = absen
    .filter((a) => a.penggunaId === pengguna.id)
    .reduce((m, a) => (m === null || a.waktu > m.waktu ? a : m), null)
  if (terakhir && waktu < terakhir.waktu) {
    catat('Jam server maju dari absen terakhir?', false)
    return tolak(langkah, 'Jam server lebih awal dari absen terakhir. Data ditolak demi konsistensi.')
  }
  if (terakhir && waktu - terakhir.waktu < JEDA_DOBEL) {
    catat('Bukan absen dobel (> 1 menit dari terakhir)?', false)
    return tolak(langkah, 'Kamu baru saja absen. Tunggu sebentar.')
  }
  catat('Bukan absen dobel', true)

  const shift = cariShift(jadwal, pengguna.id, waktu)
  if (!shift) {
    catat('Ada shift aktif saat ini?', false)
    return tolak(langkah, 'Tidak ada shift aktif saat ini (libur atau di luar jam shift).')
  }
  catat('Shift aktif ditemukan', true)

  const jenis = tentukanJenis(absenUntukShift(absen, shift))
  if (!jenis) {
    catat('Masih ada absen yang perlu dilakukan?', false)
    return tolak(langkah, 'Kamu sudah absen masuk dan pulang untuk shift ini.')
  }
  catat(`Jenis absen: ${jenis}`, true)

  const dasar = {
    penggunaId: pengguna.id,
    jenis,
    waktu,
    lokasiId: lokasi.id,
    ip: ipPermintaan,
    perangkatId: perangkat.id,
    koreksiId: null,
    dicatatOleh: null,
    alasan: null,
  }

  // ② Jalur WiFi
  const laporanSegar = typeof lokasi.ipDilaporPada === 'number' && waktu - lokasi.ipDilaporPada <= LAPORAN_IP_BASI
  const ipCocok = !!ipPermintaan && ipPermintaan === lokasi.ipTerakhir
  if (laporanSegar && ipCocok) {
    catat(`IP ${ipPermintaan} cocok dengan IP kantor`, true)
    return { ok: true, langkah, jalur: 'WIFI', baris: { ...dasar, metode: 'WIFI', totpPeriode: null } }
  }
  catat(
    !laporanSegar ? 'Laporan IP kantor basi (> 10 menit)' : `IP ${ipPermintaan} bukan IP kantor`,
    false,
  )

  // ③ Jalur TOTP
  if (kode === null || kode === undefined || kode === '') {
    return tolak(langkah, 'WiFi kantor tidak terdeteksi. Scan QR atau ketik kode dari HP lokasi.', { perluKode: true })
  }
  if (gagalTotp >= MAKS_SALAH_TOTP) {
    catat(`Salah kode < ${MAKS_SALAH_TOTP}x?`, false)
    return tolak(langkah, 'Terlalu banyak kode salah. Tunggu kode berikutnya.', { perluKode: true })
  }
  if (!/^\d{6}$/.test(String(kode))) {
    catat('Format kode 6 digit?', false)
    return tolak(langkah, 'Kode harus 6 digit angka.', { perluKode: true, tambahGagal: true })
  }
  if (!kodeSekitar) throw new TypeError('cekAbsen: kodeSekitar wajib saat kode dikirim')

  const periodeCocok = Object.entries(kodeSekitar).find(([, k]) => k === String(kode))?.[0]
  if (periodeCocok === undefined) {
    catat('Kode cocok dengan periode sekarang (±1)?', false)
    return tolak(langkah, 'Kode salah atau sudah kedaluwarsa.', { perluKode: true, tambahGagal: true })
  }
  const periode = Number(periodeCocok)
  catat('Kode TOTP valid', true)

  const sudahDipakai = absen.some((a) => a.penggunaId === pengguna.id && a.totpPeriode === periode)
  if (sudahDipakai) {
    catat('Kode belum pernah dipakai akun ini?', false)
    return tolak(langkah, 'Kode ini sudah kamu pakai. Tunggu kode berikutnya.', { perluKode: true })
  }
  catat('Kode belum pernah dipakai akun ini', true)

  return { ok: true, langkah, jalur: 'TOTP', baris: { ...dasar, metode: 'TOTP', totpPeriode: periode } }
}

/** Absen manual oleh HR (jalur ③): untuk pegawai yang HP-nya bermasalah. */
export function buatAbsenManual({ pelaku, pegawai, jadwal, absen, waktu, alasan, lokasiId }) {
  const langkah = []
  const catat = (teks, ok) => langkah.push({ teks, ok })

  if (!boleh(pelaku, AKSI.ABSEN_MANUAL)) {
    catat('Pelaku berwenang mencatat absen manual?', false)
    return tolak(langkah, 'Hanya HR yang boleh mencatat absen manual.')
  }
  catat('Pelaku adalah HR aktif', true)

  if (!pegawai || pegawai.status !== 'AKTIF') {
    catat('Pegawai aktif?', false)
    return tolak(langkah, 'Pegawai tidak aktif.')
  }
  const alasanBersih = (alasan ?? '').trim()
  if (alasanBersih.length < 5) {
    catat('Alasan diisi (min. 5 karakter)?', false)
    return tolak(langkah, 'Alasan wajib diisi (minimal 5 karakter).')
  }
  catat('Alasan diisi', true)

  const terakhir = absen.filter((a) => a.penggunaId === pegawai.id).sort((a, b) => b.waktu - a.waktu)[0]
  if (terakhir && waktu - terakhir.waktu < JEDA_DOBEL) {
    catat('Bukan absen dobel?', false)
    return tolak(langkah, 'Pegawai ini baru saja absen.')
  }

  const shift = cariShift(jadwal, pegawai.id, waktu)
  if (!shift) {
    catat('Pegawai punya shift aktif?', false)
    return tolak(langkah, 'Pegawai tidak punya shift aktif saat ini.')
  }
  const jenis = tentukanJenis(absenUntukShift(absen, shift))
  if (!jenis) {
    catat('Masih ada absen yang perlu dilakukan?', false)
    return tolak(langkah, 'Pegawai sudah absen masuk dan pulang untuk shift ini.')
  }
  catat(`Jenis absen: ${jenis}`, true)

  return {
    ok: true,
    langkah,
    jalur: 'MANUAL',
    baris: {
      penggunaId: pegawai.id,
      jenis,
      waktu,
      metode: 'MANUAL',
      lokasiId,
      ip: null,
      perangkatId: null,
      totpPeriode: null,
      koreksiId: null,
      dicatatOleh: pelaku.id,
      alasan: alasanBersih,
    },
  }
}
