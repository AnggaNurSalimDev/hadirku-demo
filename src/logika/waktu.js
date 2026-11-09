// Utilitas waktu murni. Semua waktu disimpan sebagai epoch milidetik (number).
// Zona waktu tetap WIB (UTC+7) supaya demo konsisten di browser mana pun.

export const MENIT = 60 * 1000
export const JAM = 60 * MENIT
export const HARI = 24 * JAM
const OFFSET_WIB = 7 * JAM

function pastikanAngka(ms, nama = 'waktu') {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) {
    throw new TypeError(`${nama} harus berupa angka epoch milidetik`)
  }
}

/** Buat epoch ms dari komponen tanggal WIB. Bulan 1–12. */
export function wib(tahun, bulan, tanggal, jam = 0, menit = 0) {
  if (bulan < 1 || bulan > 12) throw new RangeError('bulan harus 1–12')
  return Date.UTC(tahun, bulan - 1, tanggal, jam, menit) - OFFSET_WIB
}

/** Pecah epoch ms menjadi komponen tanggal WIB. */
export function bagian(ms) {
  pastikanAngka(ms)
  const d = new Date(ms + OFFSET_WIB)
  return {
    tahun: d.getUTCFullYear(),
    bulan: d.getUTCMonth() + 1,
    tanggal: d.getUTCDate(),
    jam: d.getUTCHours(),
    menit: d.getUTCMinutes(),
    hari: d.getUTCDay(), // 0 = Minggu
  }
}

const dua = (n) => String(n).padStart(2, '0')

/** 'YYYY-MM-DD' (WIB) */
export function kunciTanggal(ms) {
  const b = bagian(ms)
  return `${b.tahun}-${dua(b.bulan)}-${dua(b.tanggal)}`
}

/** 'YYYY-MM' (WIB) */
export function kunciPeriode(ms) {
  const b = bagian(ms)
  return `${b.tahun}-${dua(b.bulan)}`
}

/** Rentang satu periode bulanan: [mulai, selesai) */
export function rentangPeriode(periode) {
  const cocok = /^(\d{4})-(\d{2})$/.exec(periode ?? '')
  if (!cocok) throw new RangeError(`periode tidak valid: ${periode}`)
  const tahun = Number(cocok[1])
  const bulan = Number(cocok[2])
  if (bulan < 1 || bulan > 12) throw new RangeError(`periode tidak valid: ${periode}`)
  const mulai = wib(tahun, bulan, 1)
  const selesai = bulan === 12 ? wib(tahun + 1, 1, 1) : wib(tahun, bulan + 1, 1)
  return { mulai, selesai }
}

/** Periode bulan sebelumnya dari sebuah periode. */
export function periodeSebelum(periode) {
  const { mulai } = rentangPeriode(periode)
  return kunciPeriode(mulai - 1)
}

export function jamMenit(ms) {
  const b = bagian(ms)
  return `${dua(b.jam)}:${dua(b.menit)}`
}

const NAMA_HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const NAMA_BULAN_PANJANG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export function tanggalPendek(ms) {
  const b = bagian(ms)
  return `${NAMA_HARI[b.hari]}, ${b.tanggal} ${NAMA_BULAN[b.bulan - 1]}`
}

export function namaPeriode(periode) {
  const { mulai } = rentangPeriode(periode)
  const b = bagian(mulai)
  return `${NAMA_BULAN_PANJANG[b.bulan - 1]} ${b.tahun}`
}

export function namaHari(ms) {
  return NAMA_HARI[bagian(ms).hari]
}

/** Awal hari (00:00 WIB) dari sebuah waktu. */
export function awalHari(ms) {
  const b = bagian(ms)
  return wib(b.tahun, b.bulan, b.tanggal)
}
