// Selector: merangkai data state untuk tampilan. Tidak mengubah state.

import { rekapPeriode } from '../logika/rekap.js'
import { hitungGaji, versiBerlaku, komponenUntukJabatan } from '../logika/gaji.js'
import { rentangPeriode, kunciPeriode, periodeSebelum } from '../logika/waktu.js'

export const cariPengguna = (s, id) => s.pengguna.find((p) => p.id === id) ?? null
export const cariJabatan = (s, id) => s.jabatan.find((j) => j.id === id) ?? null
export const pelaku = (s) => cariPengguna(s, s.pelakuId)
export const lokasiUtama = (s) => s.lokasi[0]

export const pegawaiDigaji = (s) => s.pengguna.filter((p) => p.jabatanId !== null && p.status === 'AKTIF')

export const periodeBerjalan = (s) => kunciPeriode(s.jamDemo)
export const periodeTerakhirSelesai = (s) => periodeSebelum(periodeBerjalan(s))

/** Tanggal acuan aturan untuk sebuah periode: akhir periode. */
export const acuanPeriode = (periode) => rentangPeriode(periode).selesai - 1

export function aturanBerlaku(s, jabatanId, tanggal) {
  return versiBerlaku(s.jabatanAturan, (a) => a.jabatanId === jabatanId, tanggal)
}

export function rekapPengguna(s, penggunaId, periode) {
  return rekapPeriode({ jadwal: s.jadwal, absen: s.absen, penggunaId, periode, sekarang: s.jamDemo })
}

/**
 * Data gaji satu pegawai untuk satu periode.
 * override (opsional): { aturan, komponenList } untuk fitur "Coba hitung".
 */
export function dataGaji(s, pengguna, periode, override = {}) {
  const tanggal = acuanPeriode(periode)
  const rekap = rekapPengguna(s, pengguna.id, periode)
  const aturan = override.aturan ?? aturanBerlaku(s, pengguna.jabatanId, tanggal)
  const komponenList = override.komponenList ?? komponenUntukJabatan(s.komponen, s.komponenJabatan, pengguna.jabatanId, tanggal)
  const hasil = hitungGaji({ rekap, aturan, komponenList })
  return { pengguna, jabatan: cariJabatan(s, pengguna.jabatanId), rekap, hasil }
}

export const penggajianPeriode = (s, periode) => s.penggajian.find((p) => p.periode === periode) ?? null
