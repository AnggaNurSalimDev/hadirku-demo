// Koreksi absen (rancangan 4.4). Disetujui → INSERT absen baru (metode KOREKSI). Baris lama tidak diubah.

import { boleh, AKSI } from './wewenang.js'
import { JENDELA_SEBELUM_SHIFT, BATAS_SETELAH_SHIFT } from './absen.js'

export function ajukanKoreksi({ pelaku, shift, jenis, waktuUsulan, alasan, koreksi, waktu }) {
  if (!boleh(pelaku, AKSI.AJUKAN_KOREKSI)) return { ok: false, alasan: 'Akun tidak aktif.' }
  if (!shift || shift.penggunaId !== pelaku.id) return { ok: false, alasan: 'Shift tidak ditemukan untuk akun ini.' }
  if (shift.libur) return { ok: false, alasan: 'Hari libur tidak bisa dikoreksi.' }
  if (!['MASUK', 'PULANG'].includes(jenis)) return { ok: false, alasan: 'Jenis harus MASUK atau PULANG.' }
  if (typeof waktuUsulan !== 'number' || !Number.isFinite(waktuUsulan)) return { ok: false, alasan: 'Jam usulan wajib.' }
  if (waktuUsulan < shift.mulai - JENDELA_SEBELUM_SHIFT || waktuUsulan > shift.selesai + BATAS_SETELAH_SHIFT) {
    return { ok: false, alasan: 'Jam usulan di luar jendela shift.' }
  }
  if (waktuUsulan > waktu) return { ok: false, alasan: 'Jam usulan tidak boleh di masa depan.' }
  const alasanBersih = (alasan ?? '').trim()
  if (alasanBersih.length < 5) return { ok: false, alasan: 'Alasan minimal 5 karakter.' }
  const dobel = koreksi.some(
    (k) => k.penggunaId === pelaku.id && k.shiftId === shift.id && k.jenis === jenis && k.status === 'MENUNGGU',
  )
  if (dobel) return { ok: false, alasan: 'Sudah ada pengajuan yang menunggu untuk shift dan jenis ini.' }

  return {
    ok: true,
    baris: {
      penggunaId: pelaku.id,
      shiftId: shift.id,
      jenis,
      waktuUsulan,
      alasan: alasanBersih,
      status: 'MENUNGGU',
      diajukanPada: waktu,
      diputusOleh: null,
      diputusPada: null,
      catatan: null,
    },
  }
}

export function putuskanKoreksi({ pelaku, koreksi, setuju, catatan, waktu, lokasiId }) {
  const langkah = []
  const catat = (teks, ok) => langkah.push({ teks, ok })

  if (!boleh(pelaku, AKSI.PUTUS_KOREKSI)) {
    catat('Pelaku adalah HR aktif?', false)
    return { ok: false, alasan: 'Hanya HR yang boleh memutus koreksi.', langkah }
  }
  catat('Pelaku adalah HR aktif', true)
  if (!koreksi || koreksi.status !== 'MENUNGGU') {
    catat('Pengajuan masih MENUNGGU?', false)
    return { ok: false, alasan: 'Pengajuan sudah diputus.', langkah }
  }
  if (koreksi.penggunaId === pelaku.id) {
    catat('Bukan pengajuan milik sendiri?', false)
    return { ok: false, alasan: 'Tidak boleh memutus pengajuan milik sendiri.', langkah }
  }
  catat('Bukan pengajuan milik sendiri', true)
  const catatanBersih = (catatan ?? '').trim()
  if (!setuju && catatanBersih.length < 3) {
    catat('Alasan penolakan diisi?', false)
    return { ok: false, alasan: 'Penolakan wajib disertai alasan.', langkah }
  }

  const koreksiBaru = {
    ...koreksi,
    status: setuju ? 'DISETUJUI' : 'DITOLAK',
    diputusOleh: pelaku.id,
    diputusPada: waktu,
    catatan: catatanBersih || null,
  }
  if (!setuju) {
    catat('Pengajuan ditolak', true)
    return { ok: true, koreksiBaru, barisAbsen: null, langkah }
  }

  catat('INSERT absen baru (metode KOREKSI) — baris lama tidak diubah', true)
  return {
    ok: true,
    koreksiBaru,
    langkah,
    barisAbsen: {
      penggunaId: koreksi.penggunaId,
      jenis: koreksi.jenis,
      waktu: koreksi.waktuUsulan,
      metode: 'KOREKSI',
      lokasiId,
      ip: null,
      perangkatId: null,
      totpPeriode: null,
      koreksiId: koreksi.id,
      dicatatOleh: pelaku.id,
      alasan: koreksi.alasan,
    },
  }
}
