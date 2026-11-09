// Data dummy demo: 1 lokasi, 3 jabatan, 8 pegawai, 2 akun HR, absen Oktober – 8 November 2026.
// Dibangkitkan deterministik (seed tetap) supaya setiap reset menghasilkan data yang sama.

import { wib, HARI, MENIT, JAM } from '../logika/waktu.js'
import { bentukShift } from '../logika/jadwal.js'

export const VERSI_DATA = 3
export const JAM_AWAL_DEMO = wib(2026, 11, 9, 7, 55) // Senin, 9 Nov 2026
export const IP_KANTOR = '36.80.12.7'
export const IP_LUAR = '114.10.5.99'

// CATATAN: di sistem asli, rahasia TOTP disimpan TERENKRIPSI di server dan
// hanya ada di perangkat lokasi. Di demo ditulis di kode supaya bisa diperagakan.
export const RAHASIA_TOTP_DEMO = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'

function acak(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const AWAL_TAHUN = wib(2026, 1, 1)

export function buatDataAwal() {
  let id = 1
  const baru = () => id++

  const lokasi = [
    {
      id: baru(),
      nama: 'Toko Utama',
      ipTerakhir: IP_KANTOR,
      ipDilaporPada: JAM_AWAL_DEMO,
      totpSecret: RAHASIA_TOTP_DEMO,
      versiKunci: 1,
    },
  ]
  const lokasiId = lokasi[0].id

  const jabatan = [
    { id: baru(), nama: 'Kru', aktif: true },
    { id: baru(), nama: 'Senior', aktif: true },
    { id: baru(), nama: 'Kepala Toko', aktif: true },
  ]
  const [KRU, SENIOR, KEPALA] = jabatan.map((j) => j.id)

  const jabatanAturan = [
    { id: baru(), jabatanId: KRU, skema: 'HARIAN', nilaiDasar: 120_000, tarifLemburJam: 15_000, potongTelatMenit: 500, potongBolos: 0, berlakuMulai: AWAL_TAHUN },
    { id: baru(), jabatanId: SENIOR, skema: 'BULANAN', nilaiDasar: 3_000_000, tarifLemburJam: 20_000, potongTelatMenit: 1_000, potongBolos: 100_000, berlakuMulai: AWAL_TAHUN },
    { id: baru(), jabatanId: KEPALA, skema: 'BULANAN', nilaiDasar: 4_500_000, tarifLemburJam: 0, potongTelatMenit: 1_000, potongBolos: 150_000, berlakuMulai: AWAL_TAHUN },
  ]

  const pegawaiAwal = [
    ['Budi Santoso', KRU, 'P'],
    ['Sari Lestari', KRU, 'P'],
    ['Dodi Pratama', KRU, 'S'],
    ['Eka Putri', KRU, 'S'],
    ['Fajar Nugroho', KRU, 'P'],
    ['Rina Wulandari', SENIOR, 'P'],
    ['Joko Susilo', SENIOR, 'S'],
    ['Wawan Hidayat', KEPALA, 'P'],
  ]
  const pengguna = pegawaiAwal.map(([nama, jabatanId]) => ({
    id: baru(),
    nama,
    peran: 'PEGAWAI',
    jabatanId,
    status: 'AKTIF',
  }))
  const ani = { id: baru(), nama: 'Ani Rahmawati', peran: 'KEPALA_HR', jabatanId: null, status: 'AKTIF' }
  const dewi = { id: baru(), nama: 'Dewi Anggraini', peran: 'STAF_HR', jabatanId: null, status: 'AKTIF' }
  pengguna.push(ani, dewi)

  const perangkat = pengguna.map((p) => ({ id: baru(), penggunaId: p.id, status: 'AKTIF', label: 'Android · Chrome' }))

  // Komponen (angka contoh, BUKAN tarif resmi)
  const komponen = [
    { id: baru(), nama: 'Uang makan', arah: 'TAMBAH', jenis: 'NOMINAL', basis: 'POKOK', ditanggung: 'PEGAWAI', aktif: true },
    { id: baru(), nama: 'Tunjangan jabatan', arah: 'TAMBAH', jenis: 'NOMINAL', basis: 'POKOK', ditanggung: 'PEGAWAI', aktif: true },
    { id: baru(), nama: 'BPJS Kes (contoh)', arah: 'KURANG', jenis: 'PERSEN', basis: 'POKOK', ditanggung: 'PEGAWAI', aktif: true },
    { id: baru(), nama: 'BPJS Kes perusahaan (contoh)', arah: 'KURANG', jenis: 'PERSEN', basis: 'POKOK', ditanggung: 'PERUSAHAAN', aktif: true },
    { id: baru(), nama: 'Pajak (contoh tabel)', arah: 'KURANG', jenis: 'TABEL', basis: 'BRUTO', ditanggung: 'PEGAWAI', aktif: true },
  ]
  const [MAKAN, TUNJ, BPJS, BPJS_P, PAJAK] = komponen.map((k) => k.id)
  const nilai = (komponenId, jabatanId, isi) => ({
    id: baru(),
    komponenId,
    jabatanId,
    nilai: null,
    satuan: null,
    batasAtas: null,
    parameter: null,
    berlakuMulai: AWAL_TAHUN,
    ...isi,
  })
  const komponenJabatan = [
    nilai(MAKAN, KRU, { nilai: 15_000, satuan: 'PER_HADIR' }),
    nilai(MAKAN, SENIOR, { nilai: 15_000, satuan: 'PER_HADIR' }),
    nilai(TUNJ, KEPALA, { nilai: 500_000, satuan: 'SEKALI' }),
    nilai(BPJS, KRU, { nilai: 1, batasAtas: 120_000 }),
    nilai(BPJS, SENIOR, { nilai: 1, batasAtas: 120_000 }),
    nilai(BPJS, KEPALA, { nilai: 1, batasAtas: 120_000 }),
    nilai(BPJS_P, KRU, { nilai: 4, batasAtas: 480_000 }),
    nilai(BPJS_P, SENIOR, { nilai: 4, batasAtas: 480_000 }),
    nilai(BPJS_P, KEPALA, { nilai: 4, batasAtas: 480_000 }),
    nilai(PAJAK, KEPALA, {
      parameter: {
        rentang: [
          { min: 0, max: 4_500_000, tarif: 0 },
          { min: 4_500_000, max: null, tarif: 2 },
        ],
      },
    }),
  ]

  // Jadwal 1 Okt – 30 Nov. Tiap pegawai libur satu hari per minggu (berbeda-beda).
  const jadwal = []
  const mulaiJadwal = wib(2026, 10, 1)
  const akhirJadwal = wib(2026, 12, 1)
  pengguna
    .filter((p) => p.peran === 'PEGAWAI')
    .forEach((p, i) => {
      const tipeKerja = pegawaiAwal[i][2]
      const hariLibur = i % 7
      for (let t = mulaiJadwal; t < akhirJadwal; t += HARI) {
        const hari = new Date(t + 7 * JAM).getUTCDay()
        const tipe = hari === hariLibur ? 'L' : tipeKerja
        jadwal.push({ id: baru(), ...bentukShift(p.id, t, tipe) })
      }
    })

  // Absen untuk shift yang sudah lewat
  const rng = acak(20261109)
  const absen = []
  const dodi = pengguna.find((p) => p.nama.startsWith('Dodi'))
  const sari = pengguna.find((p) => p.nama.startsWith('Sari'))
  let periodeTotpPalsu = 100
  for (const s of jadwal) {
    if (s.libur || s.mulai >= wib(2026, 11, 9)) continue
    const p = pengguna.find((x) => x.id === s.penggunaId)
    const telat = rng() < 0.12
    const masuk = s.mulai + (telat ? 10 + Math.floor(rng() * 25) : -Math.floor(rng() * 12)) * MENIT
    const lembur = rng() < 0.15
    const pulang = s.selesai + (lembur ? 30 + Math.floor(rng() * 90) : Math.floor(rng() * 8)) * MENIT
    const pakaiTotp = p.id === dodi.id && s.mulai >= wib(2026, 11, 2)
    const baris = (jenis, waktu) => ({
      id: baru(),
      penggunaId: p.id,
      jenis,
      waktu,
      metode: pakaiTotp ? 'TOTP' : 'WIFI',
      lokasiId,
      ip: pakaiTotp ? IP_LUAR : IP_KANTOR,
      perangkatId: perangkat.find((d) => d.penggunaId === p.id).id,
      totpPeriode: pakaiTotp ? periodeTotpPalsu++ : null,
      koreksiId: null,
      dicatatOleh: null,
      alasan: null,
    })
    absen.push(baris('MASUK', masuk))
    // Skenario ④: Sari lupa absen pulang tanggal 6 Nov
    const lupaPulang = p.id === sari.id && s.mulai >= wib(2026, 11, 6) && s.mulai < wib(2026, 11, 7)
    if (!lupaPulang) absen.push(baris('PULANG', pulang))
  }

  return {
    versi: VERSI_DATA,
    jamDemo: JAM_AWAL_DEMO,
    jaringan: 'KANTOR',
    pelakuId: pengguna[0].id,
    ui: { tabPegawai: 'beranda', menuHr: 'dashboard', lapis2: false, skenario: null, langkah: 0 },
    lokasi,
    jabatan,
    jabatanAturan,
    pengguna,
    perangkat,
    jadwal,
    absen,
    koreksi: [],
    komponen,
    komponenJabatan,
    penggajian: [],
    slip: [],
    gagalTotp: {},
    log: [],
    idBerikut: id,
  }
}
