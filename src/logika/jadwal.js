// Jadwal shift. Shift yang sudah lewat atau sudah punya absen tidak bisa diubah.

import { boleh, AKSI } from './wewenang.js'
import { awalHari, JAM } from './waktu.js'
import { absenUntukShift } from './absen.js'

export const TIPE_SHIFT = Object.freeze({
  P: { label: 'Pagi', mulaiJam: 8, durasiJam: 8 },
  S: { label: 'Siang', mulaiJam: 14, durasiJam: 8 },
  L: { label: 'Libur', mulaiJam: 8, durasiJam: 8 },
})

/** Bangun data shift dari tanggal (ms di hari itu) dan tipe. */
export function bentukShift(penggunaId, hari, tipe) {
  const t = TIPE_SHIFT[tipe]
  if (!t) throw new RangeError(`tipe shift tidak dikenal: ${tipe}`)
  const mulai = awalHari(hari) + t.mulaiJam * JAM
  return { penggunaId, tipe, mulai, selesai: mulai + t.durasiJam * JAM, libur: tipe === 'L' }
}

export function ubahShift({ pelaku, shift, tipeBaru, absen, sekarang }) {
  if (!boleh(pelaku, AKSI.ATUR_JADWAL)) return { ok: false, alasan: 'Hanya HR yang boleh mengatur jadwal.' }
  if (!shift) return { ok: false, alasan: 'Shift tidak ditemukan.' }
  if (!TIPE_SHIFT[tipeBaru]) return { ok: false, alasan: 'Tipe shift tidak dikenal.' }
  if (shift.tipe === tipeBaru) return { ok: false, alasan: 'Tidak ada perubahan.' }
  if (awalHari(shift.mulai) <= awalHari(sekarang)) return { ok: false, alasan: 'Hanya jadwal mulai besok yang bisa diubah.' }
  if (absenUntukShift(absen, shift).length > 0) return { ok: false, alasan: 'Shift ini sudah punya data absen.' }
  return { ok: true, shiftBaru: { ...shift, ...bentukShift(shift.penggunaId, shift.mulai, tipeBaru) } }
}
