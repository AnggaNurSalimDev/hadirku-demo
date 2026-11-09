// Status akun & keamanan lokasi.

import { boleh, AKSI, PERAN } from './wewenang.js'

export function ubahStatusPengguna({ pelaku, target, statusBaru, semuaPengguna }) {
  if (!['AKTIF', 'NONAKTIF'].includes(statusBaru)) return { ok: false, alasan: 'Status tidak dikenal.' }
  if (!target) return { ok: false, alasan: 'Pengguna tidak ditemukan.' }
  if (target.status === statusBaru) return { ok: false, alasan: `Akun sudah ${statusBaru}.` }

  const targetHR = target.peran !== PERAN.PEGAWAI
  const aksi = targetHR ? AKSI.KELOLA_STAF_HR : AKSI.UBAH_STATUS_PEGAWAI
  if (!boleh(pelaku, aksi)) {
    return { ok: false, alasan: targetHR ? 'Hanya Kepala HR yang boleh mengelola akun HR.' : 'Hanya HR yang boleh mengubah status pegawai.' }
  }

  // invariant: minimal 1 Kepala HR aktif
  if (target.peran === PERAN.KEPALA_HR && statusBaru === 'NONAKTIF') {
    const kepalaAktifLain = semuaPengguna.filter(
      (p) => p.peran === PERAN.KEPALA_HR && p.status === 'AKTIF' && p.id !== target.id,
    )
    if (kepalaAktifLain.length === 0) return { ok: false, alasan: 'Tidak bisa menonaktifkan Kepala HR terakhir.' }
  }
  return { ok: true, penggunaBaru: { ...target, status: statusBaru } }
}

export function gantiKunciLokasi({ pelaku, lokasi, rahasiaBaru }) {
  if (!boleh(pelaku, AKSI.GANTI_KUNCI_LOKASI)) return { ok: false, alasan: 'Hanya Kepala HR yang boleh mengganti kunci lokasi.' }
  if (!lokasi) return { ok: false, alasan: 'Lokasi tidak ditemukan.' }
  if (typeof rahasiaBaru !== 'string' || rahasiaBaru.length < 16) return { ok: false, alasan: 'Rahasia baru tidak valid.' }
  if (rahasiaBaru === lokasi.totpSecret) return { ok: false, alasan: 'Rahasia baru sama dengan yang lama.' }
  return { ok: true, lokasiBaru: { ...lokasi, totpSecret: rahasiaBaru, versiKunci: lokasi.versiKunci + 1 } }
}
