import { describe, it, expect } from 'vitest'
import { webcrypto } from 'node:crypto'
import { wib, JAM } from './waktu.js'
import { hitungKode, base32Encode, base32Decode, kodeSekitar } from './totp.js'
import { cekAbsen, buatAbsenManual, tentukanJenis } from './absen.js'
import { sesiShift, rekapPeriode } from './rekap.js'
import { hitungGaji, validasiKomponen, validasiNilai } from './gaji.js'
import { ajukanKoreksi, putuskanKoreksi } from './koreksi.js'
import { ajukan, finalkan, kembalikan, revisiSlip } from './penggajian.js'
import { ubahStatusPengguna } from './akun.js'
import { boleh, AKSI } from './wewenang.js'

const subtle = webcrypto.subtle

const pegawai = { id: 1, nama: 'Budi', peran: 'PEGAWAI', status: 'AKTIF' }
const staf = { id: 10, nama: 'Dewi', peran: 'STAF_HR', status: 'AKTIF' }
const kepala = { id: 11, nama: 'Ani', peran: 'KEPALA_HR', status: 'AKTIF' }
const perangkat = { id: 100, penggunaId: 1, status: 'AKTIF' }
const shift = { id: 500, penggunaId: 1, mulai: wib(2026, 11, 9, 8), selesai: wib(2026, 11, 9, 16), libur: false }
const lokasi = { id: 1, ipTerakhir: '36.80.12.7', ipDilaporPada: wib(2026, 11, 9, 7, 50) }

describe('TOTP', () => {
  it('cocok dengan vektor uji RFC 6238 (T=59 → 287082)', async () => {
    const rahasia = base32Encode(new TextEncoder().encode('12345678901234567890'))
    expect(rahasia).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
    expect(await hitungKode(rahasia, 1, subtle)).toBe('287082')
  })
  it('menolak base32 tidak valid', () => {
    expect(() => base32Decode('abc!')).toThrow()
  })
})

describe('cekAbsen', () => {
  const dasar = { pengguna: pegawai, perangkat, jadwal: [shift], absen: [], lokasi }

  it('jalur WiFi: IP cocok → MASUK', () => {
    const h = cekAbsen({ ...dasar, waktu: wib(2026, 11, 9, 7, 55), ipPermintaan: '36.80.12.7' })
    expect(h.ok).toBe(true)
    expect(h.jalur).toBe('WIFI')
    expect(h.baris.jenis).toBe('MASUK')
  })

  it('IP luar tanpa kode → minta kode', () => {
    const h = cekAbsen({ ...dasar, waktu: wib(2026, 11, 9, 7, 55), ipPermintaan: '114.10.5.99' })
    expect(h.ok).toBe(false)
    expect(h.perluKode).toBe(true)
  })

  it('laporan IP basi dianggap tidak diketahui', () => {
    const h = cekAbsen({ ...dasar, waktu: wib(2026, 11, 9, 8, 5), ipPermintaan: '36.80.12.7' })
    expect(h.ok).toBe(false)
    expect(h.perluKode).toBe(true)
  })

  it('jalur TOTP: kode benar diterima, dipakai ulang ditolak', async () => {
    const rahasia = base32Encode(new Uint8Array(20).fill(7))
    const sekarangNyata = 1_800_000_000_000
    const peta = await kodeSekitar(rahasia, sekarangNyata, subtle)
    const kode = Object.values(peta)[1]
    const waktu = wib(2026, 11, 9, 7, 55)
    const h = cekAbsen({ ...dasar, waktu, ipPermintaan: '114.10.5.99', kode, kodeSekitar: peta })
    expect(h.ok).toBe(true)
    expect(h.jalur).toBe('TOTP')

    const absen = [{ ...h.baris, id: 1 }]
    const ulang = cekAbsen({ ...dasar, absen, waktu: waktu + 9 * JAM, ipPermintaan: '114.10.5.99', kode, kodeSekitar: peta })
    expect(ulang.ok).toBe(false)
  })

  it('kode salah menambah hitungan gagal; 5x salah diblokir', () => {
    const peta = { 1: '111111', 2: '222222', 3: '333333' }
    const waktu = wib(2026, 11, 9, 7, 55)
    const salah = cekAbsen({ ...dasar, waktu, ipPermintaan: 'x', kode: '999999', kodeSekitar: peta })
    expect(salah.tambahGagal).toBe(true)
    const blok = cekAbsen({ ...dasar, waktu, ipPermintaan: 'x', kode: '222222', kodeSekitar: peta, gagalTotp: 5 })
    expect(blok.ok).toBe(false)
  })

  it('menolak absen dobel < 1 menit dan akun nonaktif', () => {
    const waktu = wib(2026, 11, 9, 7, 55)
    const absen = [{ id: 1, penggunaId: 1, jenis: 'MASUK', waktu }]
    expect(cekAbsen({ ...dasar, absen, waktu: waktu + 30 * 1000, ipPermintaan: '36.80.12.7' }).ok).toBe(false)
    expect(cekAbsen({ ...dasar, pengguna: { ...pegawai, status: 'NONAKTIF' }, waktu, ipPermintaan: '36.80.12.7' }).ok).toBe(false)
  })

  it('menolak di luar shift', () => {
    const h = cekAbsen({ ...dasar, waktu: wib(2026, 11, 9, 3), ipPermintaan: '36.80.12.7', lokasi: { ...lokasi, ipDilaporPada: wib(2026, 11, 9, 3) } })
    expect(h.ok).toBe(false)
  })

  it('tentukanJenis', () => {
    expect(tentukanJenis([])).toBe('MASUK')
    expect(tentukanJenis([{ jenis: 'MASUK' }])).toBe('PULANG')
    expect(tentukanJenis([{ jenis: 'MASUK' }, { jenis: 'PULANG' }])).toBe(null)
  })

  it('absen manual wajib HR dan alasan', () => {
    const waktu = wib(2026, 11, 9, 8)
    const umum = { pegawai, jadwal: [shift], absen: [], waktu, lokasiId: 1 }
    expect(buatAbsenManual({ ...umum, pelaku: pegawai, alasan: 'HP rusak' }).ok).toBe(false)
    expect(buatAbsenManual({ ...umum, pelaku: staf, alasan: '' }).ok).toBe(false)
    const h = buatAbsenManual({ ...umum, pelaku: staf, alasan: 'HP rusak' })
    expect(h.ok).toBe(true)
    expect(h.baris.metode).toBe('MANUAL')
    expect(h.baris.dicatatOleh).toBe(10)
  })
})

describe('rekap', () => {
  it('menghitung telat & lembur', () => {
    const absen = [
      { penggunaId: 1, jenis: 'MASUK', waktu: wib(2026, 11, 9, 8, 20) },
      { penggunaId: 1, jenis: 'PULANG', waktu: wib(2026, 11, 9, 17, 10) },
    ]
    const s = sesiShift(shift, absen, wib(2026, 11, 10))
    expect(s.status).toBe('HADIR')
    expect(s.telatMenit).toBe(20)
    expect(s.lemburJam).toBe(1)
  })

  it('lupa pulang → PERLU_KOREKSI setelah batas, BERJALAN sebelum', () => {
    const absen = [{ penggunaId: 1, jenis: 'MASUK', waktu: wib(2026, 11, 9, 7, 58) }]
    expect(sesiShift(shift, absen, wib(2026, 11, 9, 17)).status).toBe('BERJALAN')
    expect(sesiShift(shift, absen, wib(2026, 11, 10, 9)).status).toBe('PERLU_KOREKSI')
  })

  it('tidak ada absen setelah batas → BOLOS', () => {
    expect(sesiShift(shift, [], wib(2026, 11, 10, 9)).status).toBe('BOLOS')
  })

  it('rekapPeriode konsisten', () => {
    const r = rekapPeriode({ jadwal: [shift], absen: [], penggunaId: 1, periode: '2026-11', sekarang: wib(2026, 12, 1) })
    expect(r.bolos).toBe(1)
  })
})

describe('hitungGaji', () => {
  const aturan = { skema: 'BULANAN', nilaiDasar: 3_000_000, tarifLemburJam: 20_000, potongTelatMenit: 1_000, potongBolos: 0 }
  const uangMakan = { komponen: { nama: 'Uang makan', arah: 'TAMBAH', jenis: 'NOMINAL', basis: 'POKOK', ditanggung: 'PEGAWAI' }, nilai: { nilai: 15_000, satuan: 'PER_HADIR' } }
  const potongan = { komponen: { nama: 'Contoh potongan', arah: 'KURANG', jenis: 'PERSEN', basis: 'POKOK', ditanggung: 'PEGAWAI' }, nilai: { nilai: 1, batasAtas: null } }
  const rekap = { hadir: 22, bolos: 0, telatMenit: 95, lemburJam: 6, jamKerja: 176 }

  it('contoh rancangan 6.3 → take-home 3.325.000', () => {
    const h = hitungGaji({ rekap, aturan, komponenList: [uangMakan, potongan] })
    expect(h.valid).toBe(true)
    expect(h.rincian.bruto).toBe(3_450_000)
    expect(h.rincian.takeHome).toBe(3_325_000)
  })

  it('bagian perusahaan tidak mengurangi take-home', () => {
    const perusahaan = { ...potongan, komponen: { ...potongan.komponen, ditanggung: 'PERUSAHAAN' } }
    const h = hitungGaji({ rekap, aturan, komponenList: [uangMakan, perusahaan] })
    expect(h.rincian.takeHome).toBe(3_355_000)
    expect(h.rincian.infoPerusahaan[0].jumlah).toBe(30_000)
  })

  it('batas atas persen dihormati', () => {
    const p = { ...potongan, nilai: { nilai: 10, batasAtas: 100_000 } }
    const h = hitungGaji({ rekap, aturan, komponenList: [p] })
    expect(h.rincian.potonganPegawai.find((x) => x.label === 'Contoh potongan').jumlah).toBe(100_000)
  })

  it('take-home negatif → tidak valid', () => {
    const p = { ...potongan, nilai: { nilai: 100, batasAtas: null }, komponen: { ...potongan.komponen, basis: 'BRUTO' } }
    const h = hitungGaji({ rekap, aturan, komponenList: [p] })
    expect(h.valid).toBe(false)
  })

  it('validasi komponen menolak RUMUS dan tambahan berbasis bruto', () => {
    expect(validasiKomponen({ nama: 'X', jenis: 'RUMUS', arah: 'TAMBAH', basis: 'POKOK', ditanggung: 'PEGAWAI' }).ok).toBe(false)
    expect(validasiKomponen({ nama: 'Bonus', jenis: 'PERSEN', arah: 'TAMBAH', basis: 'BRUTO', ditanggung: 'PEGAWAI' }).ok).toBe(false)
    expect(validasiNilai({ jenis: 'PERSEN' }, { nilai: 120, berlakuMulai: 1 }).ok).toBe(false)
  })
})

describe('koreksi', () => {
  it('ajukan → setujui menghasilkan absen KOREKSI baru', () => {
    const waktu = wib(2026, 11, 10, 9)
    const a = ajukanKoreksi({ pelaku: pegawai, shift, jenis: 'PULANG', waktuUsulan: wib(2026, 11, 9, 16), alasan: 'lupa absen', koreksi: [], waktu })
    expect(a.ok).toBe(true)
    const k = { ...a.baris, id: 7 }
    expect(putuskanKoreksi({ pelaku: pegawai, koreksi: k, setuju: true, waktu }).ok).toBe(false)
    const p = putuskanKoreksi({ pelaku: staf, koreksi: k, setuju: true, waktu, lokasiId: 1 })
    expect(p.ok).toBe(true)
    expect(p.barisAbsen.metode).toBe('KOREKSI')
    expect(p.barisAbsen.koreksiId).toBe(7)
  })

  it('jam usulan di masa depan ditolak', () => {
    const a = ajukanKoreksi({ pelaku: pegawai, shift, jenis: 'PULANG', waktuUsulan: wib(2026, 11, 9, 16), alasan: 'lupa absen', koreksi: [], waktu: wib(2026, 11, 9, 12) })
    expect(a.ok).toBe(false)
  })
})

describe('penggajian', () => {
  const rekapOk = { hadir: 20, bolos: 0, telatMenit: 0, lemburJam: 0, jamKerja: 160, perluKoreksi: 0, berjalan: 0 }
  const hasil = hitungGaji({ rekap: rekapOk, aturan: { skema: 'BULANAN', nilaiDasar: 3_000_000, tarifLemburJam: 0, potongTelatMenit: 0, potongBolos: 0 }, komponenList: [] })
  const hasilSemua = [{ pengguna: pegawai, jabatan: { nama: 'Senior' }, rekap: rekapOk, hasil }]
  const sekarang = wib(2026, 11, 9)

  it('DRAFT → DIAJUKAN (staf) → FINAL (kepala)', () => {
    const a = ajukan({ pelaku: staf, penggajian: null, periode: '2026-10', sekarang, hasilSemua })
    expect(a.ok).toBe(true)
    const pg = { ...a.penggajianBaru, id: 1 }
    expect(finalkan({ pelaku: staf, penggajian: pg, hasilSemua, sekarang }).ok).toBe(false)
    const f = finalkan({ pelaku: kepala, penggajian: pg, hasilSemua, sekarang })
    expect(f.ok).toBe(true)
    expect(f.penggajianBaru.status).toBe('FINAL')
    expect(f.slipBaru[0].takeHome).toBe(3_000_000)
  })

  it('periode belum selesai atau ada perlu koreksi → tolak', () => {
    expect(ajukan({ pelaku: staf, penggajian: null, periode: '2026-11', sekarang, hasilSemua }).ok).toBe(false)
    const masalah = [{ ...hasilSemua[0], rekap: { ...rekapOk, perluKoreksi: 1 } }]
    expect(ajukan({ pelaku: staf, penggajian: null, periode: '2026-10', sekarang, hasilSemua: masalah }).ok).toBe(false)
  })

  it('kembalikan wajib catatan; revisi tanpa perubahan ditolak', () => {
    const pg = { id: 1, periode: '2026-10', status: 'DIAJUKAN' }
    expect(kembalikan({ pelaku: kepala, penggajian: pg, catatan: '' }).ok).toBe(false)
    const f = finalkan({ pelaku: kepala, penggajian: pg, hasilSemua, sekarang })
    const r = revisiSlip({ pelaku: kepala, penggajian: f.penggajianBaru, data: hasilSemua[0], slip: f.slipBaru, sekarang })
    expect(r.ok).toBe(false)
  })
})

describe('akun & wewenang', () => {
  it('Kepala HR terakhir tidak bisa dinonaktifkan', () => {
    const h = ubahStatusPengguna({ pelaku: kepala, target: kepala, statusBaru: 'NONAKTIF', semuaPengguna: [kepala, staf] })
    expect(h.ok).toBe(false)
  })
  it('staf tidak bisa mengelola akun HR', () => {
    const h = ubahStatusPengguna({ pelaku: staf, target: kepala, statusBaru: 'NONAKTIF', semuaPengguna: [kepala, staf] })
    expect(h.ok).toBe(false)
  })
  it('aksi tak dikenal melempar error', () => {
    expect(() => boleh(staf, 'TERBANG')).toThrow()
    expect(boleh(staf, AKSI.FINALKAN_GAJI)).toBe(false)
  })
})

