// Alur penggajian (rancangan 6.4): DRAFT → DIAJUKAN → FINAL. Slip beku setelah terbit.

import { boleh, AKSI } from './wewenang.js'
import { rentangPeriode } from './waktu.js'

export function periodeSudahSelesai(periode, sekarang) {
  return sekarang >= rentangPeriode(periode).selesai
}

/**
 * hasilSemua: [{ pengguna, rekap, hasil }]  (hasil = keluaran hitungGaji)
 */
function masalahPeriode(hasilSemua) {
  const masalah = []
  for (const { pengguna, rekap, hasil } of hasilSemua) {
    if (rekap.perluKoreksi > 0) masalah.push(`${pengguna.nama}: ${rekap.perluKoreksi} absen perlu koreksi`)
    if (rekap.berjalan > 0) masalah.push(`${pengguna.nama}: ${rekap.berjalan} shift belum selesai`)
    if (!hasil.valid) masalah.push(`${pengguna.nama}: ${hasil.alasan}`)
  }
  return masalah
}

export function ajukan({ pelaku, penggajian, periode, sekarang, hasilSemua }) {
  if (!boleh(pelaku, AKSI.AJUKAN_GAJI)) return { ok: false, alasan: 'Hanya HR yang boleh mengajukan penggajian.' }
  if (!periodeSudahSelesai(periode, sekarang)) return { ok: false, alasan: 'Periode belum selesai.' }
  if (penggajian && penggajian.status !== 'DRAFT') return { ok: false, alasan: `Status sekarang ${penggajian.status}, tidak bisa diajukan.` }
  if (!hasilSemua.length) return { ok: false, alasan: 'Tidak ada pegawai untuk digaji.' }
  const masalah = masalahPeriode(hasilSemua)
  if (masalah.length) return { ok: false, alasan: 'Selesaikan dulu: ' + masalah.join('; ') }

  return {
    ok: true,
    penggajianBaru: {
      ...(penggajian ?? { periode, difinalkanOleh: null, difinalkanPada: null }),
      status: 'DIAJUKAN',
      diajukanOleh: pelaku.id,
      diajukanPada: sekarang,
      catatanKembali: null,
    },
  }
}

export function kembalikan({ pelaku, penggajian, catatan }) {
  if (!boleh(pelaku, AKSI.KEMBALIKAN_GAJI)) return { ok: false, alasan: 'Hanya Kepala HR yang boleh mengembalikan.' }
  if (!penggajian || penggajian.status !== 'DIAJUKAN') return { ok: false, alasan: 'Hanya pengajuan berstatus DIAJUKAN yang bisa dikembalikan.' }
  const c = (catatan ?? '').trim()
  if (c.length < 3) return { ok: false, alasan: 'Catatan pengembalian wajib diisi.' }
  return { ok: true, penggajianBaru: { ...penggajian, status: 'DRAFT', catatanKembali: c } }
}

function buatSnapshot({ pengguna, jabatan, rekap, hasil, periode }) {
  // JSON beku: slip tidak pernah dihitung ulang dari aturan terbaru.
  return JSON.parse(
    JSON.stringify({
      pegawai: { id: pengguna.id, nama: pengguna.nama, jabatan: jabatan?.nama ?? '-' },
      periode,
      kehadiran: {
        hadir: rekap.hadir,
        telatMenit: rekap.telatMenit,
        lemburJam: rekap.lemburJam,
        bolos: rekap.bolos,
      },
      rincian: hasil.rincian,
    }),
  )
}

export function finalkan({ pelaku, penggajian, hasilSemua, sekarang }) {
  if (!boleh(pelaku, AKSI.FINALKAN_GAJI)) return { ok: false, alasan: 'Hanya Kepala HR yang boleh memfinalkan.' }
  if (!penggajian || penggajian.status !== 'DIAJUKAN') return { ok: false, alasan: 'FINAL hanya bisa dari status DIAJUKAN.' }
  const masalah = masalahPeriode(hasilSemua)
  if (masalah.length) return { ok: false, alasan: 'Tidak bisa difinalkan: ' + masalah.join('; ') }

  const slipBaru = hasilSemua.map((x) => {
    if (x.hasil.rincian.takeHome < 0) throw new Error('invariant: take-home negatif lolos pemeriksaan')
    return {
      penggajianId: penggajian.id,
      penggunaId: x.pengguna.id,
      versi: 1,
      snapshot: buatSnapshot({ ...x, periode: penggajian.periode }),
      takeHome: x.hasil.rincian.takeHome,
      dibuatPada: sekarang,
    }
  })

  return {
    ok: true,
    penggajianBaru: { ...penggajian, status: 'FINAL', difinalkanOleh: pelaku.id, difinalkanPada: sekarang },
    slipBaru,
  }
}

export function revisiSlip({ pelaku, penggajian, data, slip, sekarang }) {
  if (!boleh(pelaku, AKSI.REVISI_SLIP)) return { ok: false, alasan: 'Hanya Kepala HR yang boleh membuat revisi.' }
  if (!penggajian || penggajian.status !== 'FINAL') return { ok: false, alasan: 'Revisi hanya untuk penggajian FINAL.' }
  if (data.rekap.perluKoreksi > 0 || data.rekap.berjalan > 0) return { ok: false, alasan: 'Masih ada absen yang perlu koreksi.' }
  if (!data.hasil.valid) return { ok: false, alasan: data.hasil.alasan }

  const milikPegawai = slip.filter((s) => s.penggajianId === penggajian.id && s.penggunaId === data.pengguna.id)
  const terakhir = milikPegawai.sort((a, b) => b.versi - a.versi)[0]
  if (!terakhir) return { ok: false, alasan: 'Slip awal tidak ditemukan.' }

  const snapshot = buatSnapshot({ ...data, periode: penggajian.periode })
  if (JSON.stringify(snapshot) === JSON.stringify(terakhir.snapshot)) {
    return { ok: false, alasan: 'Tidak ada perubahan dibanding slip terakhir.' }
  }
  return {
    ok: true,
    slipBaru: {
      penggajianId: penggajian.id,
      penggunaId: data.pengguna.id,
      versi: terakhir.versi + 1,
      snapshot,
      takeHome: data.hasil.rincian.takeHome,
      dibuatPada: sekarang,
    },
  }
}

/** Slip versi terbaru per (penggajian, pegawai). */
export function slipTerbaru(slip) {
  const peta = new Map()
  for (const s of slip) {
    const k = `${s.penggajianId}:${s.penggunaId}`
    if (!peta.has(k) || peta.get(k).versi < s.versi) peta.set(k, s)
  }
  return [...peta.values()]
}
