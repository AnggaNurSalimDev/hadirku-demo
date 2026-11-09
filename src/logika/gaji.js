// Hitung gaji (rancangan bagian 6). Aturan gaji adalah DATA; tidak ada eval.

export const JENIS = ['NOMINAL', 'PERSEN', 'TABEL'] // 'RUMUS' disiapkan untuk level 2
export const ARAH = ['TAMBAH', 'KURANG']
export const BASIS = ['POKOK', 'BRUTO']
export const DITANGGUNG = ['PEGAWAI', 'PERUSAHAAN']
export const SATUAN = ['SEKALI', 'PER_HADIR', 'PER_JAM']

const angkaValid = (n) => typeof n === 'number' && Number.isFinite(n)

/** Versi terbaru yang berlaku pada `tanggal` (berlaku_mulai ≤ tanggal). */
export function versiBerlaku(baris, cocok, tanggal) {
  return (
    baris
      .filter((b) => cocok(b) && b.berlakuMulai <= tanggal)
      .sort((a, b) => b.berlakuMulai - a.berlakuMulai)[0] ?? null
  )
}

/** Daftar {komponen, nilai} untuk satu jabatan pada tanggal tertentu. */
export function komponenUntukJabatan(komponen, komponenJabatan, jabatanId, tanggal) {
  return komponen
    .filter((k) => k.aktif)
    .map((k) => ({
      komponen: k,
      nilai: versiBerlaku(komponenJabatan, (n) => n.komponenId === k.id && n.jabatanId === jabatanId, tanggal),
    }))
    .filter((x) => x.nilai !== null)
}

export function validasiKomponen(k) {
  if (!k) return { ok: false, alasan: 'Komponen kosong.' }
  const nama = (k.nama ?? '').trim()
  if (nama.length < 2 || nama.length > 40) return { ok: false, alasan: 'Nama komponen 2–40 karakter.' }
  if (k.jenis === 'RUMUS') return { ok: false, alasan: 'Jenis RUMUS belum tersedia (level 2).' }
  if (!JENIS.includes(k.jenis)) return { ok: false, alasan: 'Jenis tidak dikenal.' }
  if (!ARAH.includes(k.arah)) return { ok: false, alasan: 'Arah harus TAMBAH atau KURANG.' }
  if (!BASIS.includes(k.basis)) return { ok: false, alasan: 'Basis harus POKOK atau BRUTO.' }
  if (!DITANGGUNG.includes(k.ditanggung)) return { ok: false, alasan: 'Penanggung tidak dikenal.' }
  if (k.arah === 'TAMBAH' && k.basis === 'BRUTO' && k.jenis !== 'NOMINAL') {
    return { ok: false, alasan: 'Tambahan tidak boleh dihitung dari bruto (bruto belum ada saat itu).' }
  }
  if (k.arah === 'TAMBAH' && k.ditanggung === 'PERUSAHAAN') {
    return { ok: false, alasan: '"Ditanggung perusahaan" hanya untuk komponen potongan.' }
  }
  return { ok: true }
}

export function validasiNilai(komponen, n) {
  if (!n) return { ok: false, alasan: 'Nilai kosong.' }
  if (!angkaValid(n.berlakuMulai)) return { ok: false, alasan: 'Tanggal berlaku wajib.' }
  if (komponen.jenis === 'NOMINAL') {
    if (!angkaValid(n.nilai) || n.nilai < 0) return { ok: false, alasan: 'Nominal harus ≥ 0.' }
    if (!SATUAN.includes(n.satuan)) return { ok: false, alasan: 'Satuan tidak dikenal.' }
  }
  if (komponen.jenis === 'PERSEN') {
    if (!angkaValid(n.nilai) || n.nilai < 0 || n.nilai > 100) return { ok: false, alasan: 'Persen harus 0–100.' }
    if (n.batasAtas !== null && n.batasAtas !== undefined && (!angkaValid(n.batasAtas) || n.batasAtas < 0)) {
      return { ok: false, alasan: 'Batas atas harus ≥ 0 atau kosong.' }
    }
  }
  if (komponen.jenis === 'TABEL') {
    const r = n.parameter?.rentang
    if (!Array.isArray(r) || r.length === 0) return { ok: false, alasan: 'Tabel minimal 1 rentang.' }
    for (let i = 0; i < r.length; i++) {
      const { min, max, tarif } = r[i]
      if (!angkaValid(min) || min < 0) return { ok: false, alasan: `Rentang ${i + 1}: batas bawah harus ≥ 0.` }
      if (max !== null && (!angkaValid(max) || max <= min)) {
        return { ok: false, alasan: `Rentang ${i + 1}: batas atas harus > batas bawah.` }
      }
      if (!angkaValid(tarif) || tarif < 0 || tarif > 100) return { ok: false, alasan: `Rentang ${i + 1}: tarif 0–100%.` }
      if (i > 0 && min !== r[i - 1].max) return { ok: false, alasan: `Rentang ${i + 1} harus menyambung dari rentang sebelumnya.` }
      if (max === null && i !== r.length - 1) return { ok: false, alasan: 'Hanya rentang terakhir yang boleh tanpa batas atas.' }
    }
  }
  return { ok: true }
}

export function validasiAturanJabatan(a) {
  if (!a) return { ok: false, alasan: 'Aturan kosong.' }
  if (!['HARIAN', 'BULANAN'].includes(a.skema)) return { ok: false, alasan: 'Skema harus HARIAN atau BULANAN.' }
  for (const k of ['nilaiDasar', 'tarifLemburJam', 'potongTelatMenit', 'potongBolos']) {
    if (!angkaValid(a[k]) || a[k] < 0) return { ok: false, alasan: `${k} harus angka ≥ 0.` }
  }
  if (!angkaValid(a.berlakuMulai)) return { ok: false, alasan: 'Tanggal berlaku wajib.' }
  return { ok: true }
}

const rupiah = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID')

/** Hitung satu komponen. konteks: { pokok, bruto, hadir, jamKerja } */
export function hitungKomponen(komponen, nilai, konteks) {
  const basis = komponen.basis === 'BRUTO' ? konteks.bruto : konteks.pokok
  if (komponen.jenis === 'NOMINAL') {
    if (nilai.satuan === 'SEKALI') return { jumlah: nilai.nilai, keterangan: 'tetap' }
    if (nilai.satuan === 'PER_HADIR') return { jumlah: nilai.nilai * konteks.hadir, keterangan: `${konteks.hadir} hari × ${rupiah(nilai.nilai)}` }
    if (nilai.satuan === 'PER_JAM') return { jumlah: nilai.nilai * konteks.jamKerja, keterangan: `${konteks.jamKerja} jam × ${rupiah(nilai.nilai)}` }
  }
  if (!angkaValid(basis)) throw new Error(`hitungKomponen: basis ${komponen.basis} belum tersedia`)
  if (komponen.jenis === 'PERSEN') {
    let jumlah = (basis * nilai.nilai) / 100
    let ket = `${nilai.nilai}% × ${rupiah(basis)}`
    if (angkaValid(nilai.batasAtas) && jumlah > nilai.batasAtas) {
      jumlah = nilai.batasAtas
      ket += ` (maks ${rupiah(nilai.batasAtas)})`
    }
    return { jumlah, keterangan: ket }
  }
  if (komponen.jenis === 'TABEL') {
    const r = nilai.parameter.rentang.find((x) => basis >= x.min && (x.max === null || basis < x.max))
    const tarif = r ? r.tarif : 0
    return { jumlah: (basis * tarif) / 100, keterangan: `tarif ${tarif}% × ${rupiah(basis)}` }
  }
  throw new Error(`hitungKomponen: jenis ${komponen.jenis} tidak didukung`)
}

/**
 * Hitung gaji satu pegawai.
 * rekap: { hadir, bolos, telatMenit, lemburJam, jamKerja }
 * aturan: versi jabatan_aturan yang berlaku
 * komponenList: [{ komponen, nilai }]
 */
export function hitungGaji({ rekap, aturan, komponenList }) {
  if (!rekap) throw new TypeError('hitungGaji: rekap wajib')
  if (!aturan) return { valid: false, alasan: 'Jabatan belum punya aturan gaji yang berlaku.' }
  for (const k of ['hadir', 'bolos', 'telatMenit', 'lemburJam', 'jamKerja']) {
    if (!angkaValid(rekap[k]) || rekap[k] < 0) throw new RangeError(`hitungGaji: rekap.${k} tidak valid`)
  }

  const pendapatan = []
  const potonganPegawai = []
  const infoPerusahaan = []

  // ① Dasar
  const pokok = aturan.skema === 'BULANAN' ? aturan.nilaiDasar : aturan.nilaiDasar * rekap.hadir
  pendapatan.push({
    label: aturan.skema === 'BULANAN' ? 'Gaji pokok' : 'Upah harian',
    keterangan: aturan.skema === 'BULANAN' ? 'bulanan' : `${rekap.hadir} hari × ${rupiah(aturan.nilaiDasar)}`,
    jumlah: pokok,
  })

  // ② Tambahan
  if (aturan.tarifLemburJam > 0 && rekap.lemburJam > 0) {
    pendapatan.push({
      label: 'Lembur',
      keterangan: `${rekap.lemburJam} jam × ${rupiah(aturan.tarifLemburJam)}`,
      jumlah: rekap.lemburJam * aturan.tarifLemburJam,
    })
  }
  const konteks = { pokok, bruto: null, hadir: rekap.hadir, jamKerja: rekap.jamKerja }
  for (const { komponen, nilai } of komponenList.filter((x) => x.komponen.arah === 'TAMBAH')) {
    const h = hitungKomponen(komponen, nilai, konteks)
    pendapatan.push({ label: komponen.nama, keterangan: h.keterangan, jumlah: h.jumlah })
  }
  const bruto = pendapatan.reduce((t, p) => t + Math.round(p.jumlah), 0)
  konteks.bruto = bruto

  // ③ Potongan kehadiran
  if (aturan.potongTelatMenit > 0 && rekap.telatMenit > 0) {
    potonganPegawai.push({
      label: 'Potongan telat',
      keterangan: `${rekap.telatMenit} menit × ${rupiah(aturan.potongTelatMenit)}`,
      jumlah: rekap.telatMenit * aturan.potongTelatMenit,
    })
  }
  if (aturan.potongBolos > 0 && rekap.bolos > 0) {
    potonganPegawai.push({
      label: 'Potongan bolos',
      keterangan: `${rekap.bolos} hari × ${rupiah(aturan.potongBolos)}`,
      jumlah: rekap.bolos * aturan.potongBolos,
    })
  }

  // ④ Potongan komponen
  for (const { komponen, nilai } of komponenList.filter((x) => x.komponen.arah === 'KURANG')) {
    const h = hitungKomponen(komponen, nilai, konteks)
    const item = { label: komponen.nama, keterangan: h.keterangan, jumlah: h.jumlah }
    if (komponen.ditanggung === 'PERUSAHAAN') infoPerusahaan.push(item)
    else potonganPegawai.push(item)
  }

  const bulatkan = (xs) => xs.map((x) => ({ ...x, jumlah: Math.round(x.jumlah) }))
  const rincian = {
    pokok: Math.round(pokok),
    pendapatan: bulatkan(pendapatan),
    potonganPegawai: bulatkan(potonganPegawai),
    infoPerusahaan: bulatkan(infoPerusahaan),
    bruto,
  }
  const totalPotongan = rincian.potonganPegawai.reduce((t, p) => t + p.jumlah, 0)
  rincian.totalPotongan = totalPotongan
  rincian.takeHome = bruto - totalPotongan

  if (rincian.takeHome < 0) {
    return { valid: false, alasan: 'Take-home negatif. Periksa aturan gaji (kemungkinan salah isi).', rincian }
  }
  return { valid: true, rincian }
}
