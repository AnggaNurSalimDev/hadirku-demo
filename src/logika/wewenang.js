// Tabel wewenang (rancangan bagian 2). Dicek di setiap aksi, bukan hanya di tampilan.

export const PERAN = Object.freeze({
  PEGAWAI: 'PEGAWAI',
  STAF_HR: 'STAF_HR',
  KEPALA_HR: 'KEPALA_HR',
})

const SEMUA = [PERAN.PEGAWAI, PERAN.STAF_HR, PERAN.KEPALA_HR]
const HR = [PERAN.STAF_HR, PERAN.KEPALA_HR]
const KEPALA = [PERAN.KEPALA_HR]

const IZIN = Object.freeze({
  ABSEN: SEMUA,
  AJUKAN_KOREKSI: SEMUA,
  LIHAT_HR: HR,
  UBAH_STATUS_PEGAWAI: HR,
  PUTUS_KOREKSI: HR,
  ABSEN_MANUAL: HR,
  ATUR_JADWAL: HR,
  AJUKAN_GAJI: HR,
  UBAH_ATURAN_GAJI: KEPALA,
  KEMBALIKAN_GAJI: KEPALA,
  FINALKAN_GAJI: KEPALA,
  REVISI_SLIP: KEPALA,
  KELOLA_STAF_HR: KEPALA,
  GANTI_KUNCI_LOKASI: KEPALA,
})

export const AKSI = Object.freeze(Object.fromEntries(Object.keys(IZIN).map((k) => [k, k])))

/** true jika pengguna AKTIF dan perannya diizinkan untuk aksi tersebut. */
export function boleh(pengguna, aksi) {
  if (!(aksi in IZIN)) throw new Error(`aksi tidak dikenal: ${aksi}`)
  if (!pengguna) return false
  if (pengguna.status !== 'AKTIF') return false
  return IZIN[aksi].includes(pengguna.peran)
}

export function namaPeran(peran) {
  return { PEGAWAI: 'Pegawai', STAF_HR: 'Staf HR', KEPALA_HR: 'Kepala HR' }[peran] ?? peran
}
