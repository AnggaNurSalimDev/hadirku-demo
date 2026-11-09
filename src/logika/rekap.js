// Rekap kehadiran (rancangan bagian 5).
// absen mentah → sesi per shift → rekap harian → rekap periode

import { MENIT, JAM, rentangPeriode, kunciTanggal } from './waktu.js'
import { absenUntukShift, BATAS_SETELAH_SHIFT } from './absen.js'

const SETENGAH_JAM = 30 * MENIT

/**
 * Satu shift → satu sesi.
 * status: LIBUR | BERJALAN | HADIR | BOLOS | PERLU_KOREKSI
 */
export function sesiShift(shift, absen, sekarang) {
  if (!shift) throw new TypeError('sesiShift: shift wajib')
  if (shift.selesai <= shift.mulai) throw new RangeError('sesiShift: selesai harus setelah mulai')

  const dasar = {
    shiftId: shift.id,
    tanggal: kunciTanggal(shift.mulai),
    mulai: shift.mulai,
    selesai: shift.selesai,
    masuk: null,
    pulang: null,
    telatMenit: 0,
    lemburJam: 0,
    jamKerja: 0,
  }
  if (shift.libur) return { ...dasar, status: 'LIBUR' }

  const baris = absenUntukShift(absen, shift)
  const masuk = baris.filter((a) => a.jenis === 'MASUK').map((a) => a.waktu)
  const pulang = baris.filter((a) => a.jenis === 'PULANG').map((a) => a.waktu)
  const tMasuk = masuk.length ? Math.min(...masuk) : null
  const tPulang = pulang.length ? Math.max(...pulang) : null
  const lewatBatas = sekarang > shift.selesai + BATAS_SETELAH_SHIFT
  const hasil = { ...dasar, masuk: tMasuk, pulang: tPulang }

  if (tMasuk === null && tPulang === null) {
    return { ...hasil, status: lewatBatas ? 'BOLOS' : 'BERJALAN' }
  }
  if (tMasuk === null || tPulang === null) {
    return { ...hasil, status: lewatBatas ? 'PERLU_KOREKSI' : 'BERJALAN' }
  }
  if (tPulang <= tMasuk) {
    // invariant: pulang harus setelah masuk
    return { ...hasil, status: 'PERLU_KOREKSI' }
  }

  const telatMenit = Math.max(0, Math.floor((tMasuk - shift.mulai) / MENIT))
  const lebih = Math.max(0, tPulang - shift.selesai)
  const lemburJam = Math.floor(lebih / SETENGAH_JAM) * 0.5
  const jamKerja = Math.round(((tPulang - tMasuk) / JAM) * 10) / 10

  return { ...hasil, status: 'HADIR', telatMenit, lemburJam, jamKerja }
}

/** Rekap satu pengguna dalam satu periode bulanan. */
export function rekapPeriode({ jadwal, absen, penggunaId, periode, sekarang }) {
  if (!Array.isArray(jadwal) || !Array.isArray(absen)) throw new TypeError('rekapPeriode: data wajib array')
  const { mulai, selesai } = rentangPeriode(periode)

  const sesi = jadwal
    .filter((s) => s.penggunaId === penggunaId && s.mulai >= mulai && s.mulai < selesai)
    .sort((a, b) => a.mulai - b.mulai)
    .map((s) => sesiShift(s, absen, sekarang))

  const hitung = (st) => sesi.filter((s) => s.status === st).length
  const jumlah = (k) => sesi.reduce((t, s) => t + s[k], 0)

  const rekap = {
    periode,
    sesi,
    hadir: hitung('HADIR'),
    bolos: hitung('BOLOS'),
    libur: hitung('LIBUR'),
    perluKoreksi: hitung('PERLU_KOREKSI'),
    berjalan: hitung('BERJALAN'),
    telatMenit: jumlah('telatMenit'),
    lemburJam: jumlah('lemburJam'),
    jamKerja: Math.round(jumlah('jamKerja') * 10) / 10,
  }

  // invariant: setiap sesi terhitung tepat sekali
  const total = rekap.hadir + rekap.bolos + rekap.libur + rekap.perluKoreksi + rekap.berjalan
  if (total !== sesi.length) throw new Error('rekapPeriode: jumlah sesi tidak konsisten')

  return rekap
}
