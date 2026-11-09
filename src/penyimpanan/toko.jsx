// "Server" demo: menjalankan logika murni lalu menambahkan hasilnya ke state (append-only untuk absen/slip).
// Semua pemeriksaan wewenang terjadi di sini lewat logika, bukan di tampilan.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { buatDataAwal, VERSI_DATA, IP_KANTOR, IP_LUAR } from '../data-dummy/seed.js'
import { muat, simpan, hapus } from './adapterLokal.js'
import { cekAbsen, buatAbsenManual } from '../logika/absen.js'
import { kodeSekitar, periodeTotp, base32Encode } from '../logika/totp.js'
import { ajukanKoreksi, putuskanKoreksi } from '../logika/koreksi.js'
import { ajukan, kembalikan, finalkan, revisiSlip } from '../logika/penggajian.js'
import { ubahStatusPengguna, gantiKunciLokasi } from '../logika/akun.js'
import { ubahShift } from '../logika/jadwal.js'
import { validasiKomponen, validasiNilai, validasiAturanJabatan } from '../logika/gaji.js'
import { boleh, AKSI } from '../logika/wewenang.js'
import { awalHari, JAM, MENIT, HARI } from '../logika/waktu.js'
import * as pilih from './pilih.js'
import { SKENARIO } from '../skenario/skenario.js'

const Konteks = createContext(null)

/** Jam demo hanya boleh maju. Perangkat lokasi melapor IP tiap 5 menit → di demo dianggap selalu segar. */
export function keJam(s, jam) {
  if (!(jam > s.jamDemo)) return s
  return { ...s, jamDemo: jam, lokasi: s.lokasi.map((l) => ({ ...l, ipDilaporPada: jam })) }
}
const MAKS_LOG = 30

function dataAwal() {
  return muat(VERSI_DATA) ?? buatDataAwal()
}

export function PenyediaDemo({ children }) {
  const [state, setState] = useState(dataAwal)
  const ref = useRef(state)
  ref.current = state

  useEffect(() => simpan(state), [state])

  /** Perbarui state secara sinkron dengan fungsi murni (s → s baru). */
  const ubah = useCallback((f) => {
    const baru = f(ref.current)
    ref.current = baru
    setState(baru)
    return baru
  }, [])

  const tambahLog = (s, entri) => ({
    ...s,
    log: [{ id: s.idBerikut, waktu: s.jamDemo, ...entri }, ...s.log].slice(0, MAKS_LOG),
    idBerikut: s.idBerikut + 1,
  })

  const sisip = (s, koleksi, baris) => {
    const id = s.idBerikut
    return { s: { ...s, [koleksi]: [...s[koleksi], { ...baris, id }], idBerikut: id + 1 }, id }
  }

  const ganti = (s, koleksi, baris) => ({ ...s, [koleksi]: s[koleksi].map((x) => (x.id === baris.id ? baris : x)) })

  const tolakLog = (judul, alasan, langkah = []) => {
    ubah((s) => tambahLog(s, { judul, ok: false, pesan: alasan, langkah }))
    return { ok: false, alasan }
  }

  const aksi = useMemo(
    () => ({
      // ---------- kontrol demo ----------
      reset() {
        hapus()
        ubah(() => buatDataAwal())
      },
      aturJaringan(jaringan) {
        ubah((s) => ({ ...s, jaringan }))
      },
      aturPelaku(pelakuId) {
        ubah((s) => ({ ...s, pelakuId }))
      },
      aturUi(sebagian) {
        ubah((s) => ({ ...s, ui: { ...s.ui, ...sebagian } }))
      },
      majuWaktu(ms) {
        if (!(ms > 0)) return
        ubah((s) => keJam(s, s.jamDemo + ms))
      },
      hariBerikut() {
        ubah((s) => keJam(s, awalHari(s.jamDemo) + HARI + 7 * JAM + 55 * MENIT))
      },
      mulaiSkenario(id) {
        const sk = SKENARIO.find((x) => x.id === id)
        if (!sk) return
        hapus()
        ubah(() => {
          const awal = buatDataAwal()
          const atur = sk.siapkan(awal)
          return { ...awal, ...atur, ui: { ...awal.ui, ...(atur.ui ?? {}), skenario: id, langkah: 0 } }
        })
      },
      langkahSkenario(arah) {
        ubah((s) => {
          const sk = SKENARIO.find((x) => x.id === s.ui.skenario)
          if (!sk) return s
          const langkah = Math.min(Math.max(0, s.ui.langkah + arah), sk.langkah.length - 1)
          const l = sk.langkah[langkah]
          const tambahan = arah > 0 && l.terapkan ? l.terapkan(s) : {}
          return { ...s, ...tambahan, ui: { ...s.ui, ...(tambahan.ui ?? {}), langkah } }
        })
      },
      keluarSkenario() {
        ubah((s) => ({ ...s, ui: { ...s.ui, skenario: null, langkah: 0 } }))
      },

      // ---------- absen ----------
      async absen({ kode = null } = {}) {
        const s = ref.current
        const p = pilih.pelaku(s)
        const sekarangNyata = Date.now() // TOTP memakai jam nyata supaya kode berganti tiap 30 detik
        const lok = pilih.lokasiUtama(s)
        let peta = null
        if (kode) {
          try {
            peta = await kodeSekitar(lok.totpSecret, sekarangNyata)
          } catch (e) {
            return tolakLog('Absen', e.message)
          }
        }
        const periode = periodeTotp(sekarangNyata)
        const catatanGagal = s.gagalTotp[p.id]
        const gagal = catatanGagal && catatanGagal.periode === periode ? catatanGagal.jumlah : 0

        const hasil = cekAbsen({
          pengguna: p,
          perangkat: s.perangkat.find((d) => d.penggunaId === p.id && d.status === 'AKTIF') ?? null,
          jadwal: s.jadwal,
          absen: s.absen,
          waktu: s.jamDemo,
          ipPermintaan: s.jaringan === 'KANTOR' ? IP_KANTOR : IP_LUAR,
          lokasi: lok,
          kode,
          kodeSekitar: peta,
          gagalTotp: gagal,
        })

        ubah((s2) => {
          let n = s2
          if (hasil.ok) n = sisip(n, 'absen', hasil.baris).s
          if (hasil.tambahGagal) {
            n = { ...n, gagalTotp: { ...n.gagalTotp, [p.id]: { periode, jumlah: gagal + 1 } } }
          }
          return tambahLog(n, {
            judul: `Absen ${p.nama.split(' ')[0]}`,
            ok: hasil.ok,
            pesan: hasil.ok ? `INSERT absen ${hasil.baris.jenis} (metode ${hasil.baris.metode})` : hasil.alasan,
            langkah: hasil.langkah,
          })
        })
        return hasil
      },

      absenManual({ pegawaiId, alasan }) {
        const s = ref.current
        const hasil = buatAbsenManual({
          pelaku: pilih.pelaku(s),
          pegawai: pilih.cariPengguna(s, pegawaiId),
          jadwal: s.jadwal,
          absen: s.absen,
          waktu: s.jamDemo,
          alasan,
          lokasiId: pilih.lokasiUtama(s).id,
        })
        ubah((s2) =>
          tambahLog(hasil.ok ? sisip(s2, 'absen', hasil.baris).s : s2, {
            judul: 'Absen manual',
            ok: hasil.ok,
            pesan: hasil.ok ? `INSERT absen ${hasil.baris.jenis} (metode MANUAL)` : hasil.alasan,
            langkah: hasil.langkah,
          }),
        )
        return hasil
      },

      // ---------- koreksi ----------
      ajukanKoreksi({ shiftId, jenis, waktuUsulan, alasan }) {
        const s = ref.current
        const hasil = ajukanKoreksi({
          pelaku: pilih.pelaku(s),
          shift: s.jadwal.find((x) => x.id === shiftId),
          jenis,
          waktuUsulan,
          alasan,
          koreksi: s.koreksi,
          waktu: s.jamDemo,
        })
        ubah((s2) =>
          tambahLog(hasil.ok ? sisip(s2, 'koreksi', hasil.baris).s : s2, {
            judul: 'Ajukan koreksi',
            ok: hasil.ok,
            pesan: hasil.ok ? 'INSERT koreksi (status MENUNGGU)' : hasil.alasan,
          }),
        )
        return hasil
      },

      putuskanKoreksi({ koreksiId, setuju, catatan }) {
        const s = ref.current
        const hasil = putuskanKoreksi({
          pelaku: pilih.pelaku(s),
          koreksi: s.koreksi.find((k) => k.id === koreksiId),
          setuju,
          catatan,
          waktu: s.jamDemo,
          lokasiId: pilih.lokasiUtama(s).id,
        })
        ubah((s2) => {
          let n = s2
          if (hasil.ok) {
            n = ganti(n, 'koreksi', hasil.koreksiBaru)
            if (hasil.barisAbsen) n = sisip(n, 'absen', hasil.barisAbsen).s
          }
          return tambahLog(n, {
            judul: setuju ? 'Setujui koreksi' : 'Tolak koreksi',
            ok: hasil.ok,
            pesan: hasil.ok ? (setuju ? 'Koreksi disetujui' : 'Koreksi ditolak') : hasil.alasan,
            langkah: hasil.langkah,
          })
        })
        return hasil
      },

      // ---------- akun, jadwal, lokasi ----------
      ubahStatus({ penggunaId, statusBaru }) {
        const s = ref.current
        const hasil = ubahStatusPengguna({
          pelaku: pilih.pelaku(s),
          target: pilih.cariPengguna(s, penggunaId),
          statusBaru,
          semuaPengguna: s.pengguna,
        })
        ubah((s2) =>
          tambahLog(hasil.ok ? ganti(s2, 'pengguna', hasil.penggunaBaru) : s2, {
            judul: 'Ubah status akun',
            ok: hasil.ok,
            pesan: hasil.ok ? `${hasil.penggunaBaru.nama} → ${statusBaru}` : hasil.alasan,
          }),
        )
        return hasil
      },

      ubahShift({ shiftId, tipeBaru }) {
        const s = ref.current
        const hasil = ubahShift({
          pelaku: pilih.pelaku(s),
          shift: s.jadwal.find((x) => x.id === shiftId),
          tipeBaru,
          absen: s.absen,
          sekarang: s.jamDemo,
        })
        if (hasil.ok) ubah((s2) => ganti(s2, 'jadwal', hasil.shiftBaru))
        else ubah((s2) => tambahLog(s2, { judul: 'Ubah jadwal', ok: false, pesan: hasil.alasan }))
        return hasil
      },

      gantiKunciLokasi() {
        const s = ref.current
        const bytes = new Uint8Array(20)
        globalThis.crypto.getRandomValues(bytes)
        const hasil = gantiKunciLokasi({ pelaku: pilih.pelaku(s), lokasi: pilih.lokasiUtama(s), rahasiaBaru: base32Encode(bytes) })
        ubah((s2) =>
          tambahLog(hasil.ok ? ganti(s2, 'lokasi', hasil.lokasiBaru) : s2, {
            judul: 'Ganti kunci lokasi',
            ok: hasil.ok,
            pesan: hasil.ok ? `Kunci versi ${hasil.lokasiBaru.versiKunci}. Kode lama langsung tidak berlaku.` : hasil.alasan,
          }),
        )
        return hasil
      },

      // ---------- aturan gaji (selalu versi baru) ----------
      simpanAturanJabatan(aturanBaru) {
        const s = ref.current
        const p = pilih.pelaku(s)
        if (!boleh(p, AKSI.UBAH_ATURAN_GAJI)) return tolakLog('Ubah aturan', 'Hanya Kepala HR yang boleh mengubah aturan gaji.')
        const v = validasiAturanJabatan(aturanBaru)
        if (!v.ok) return tolakLog('Ubah aturan', v.alasan)
        const bentrok = s.jabatanAturan.some((a) => a.jabatanId === aturanBaru.jabatanId && a.berlakuMulai === aturanBaru.berlakuMulai)
        if (bentrok) return tolakLog('Ubah aturan', 'Sudah ada versi pada tanggal berlaku itu. Pilih tanggal lain.')
        const { id: _abaikan, ...isi } = aturanBaru
        ubah((s2) => tambahLog(sisip(s2, 'jabatanAturan', isi).s, { judul: 'Ubah aturan', ok: true, pesan: 'INSERT versi aturan baru' }))
        return { ok: true }
      },

      simpanNilaiKomponen({ komponenBaru = null, komponenId = null, nilai }) {
        const s = ref.current
        const p = pilih.pelaku(s)
        if (!boleh(p, AKSI.UBAH_ATURAN_GAJI)) return tolakLog('Ubah komponen', 'Hanya Kepala HR yang boleh mengubah komponen.')
        let komponen = komponenId ? s.komponen.find((k) => k.id === komponenId) : komponenBaru
        if (!komponen) return tolakLog('Ubah komponen', 'Komponen tidak ditemukan.')
        if (komponenBaru) {
          const vk = validasiKomponen(komponenBaru)
          if (!vk.ok) return tolakLog('Tambah komponen', vk.alasan)
          if (s.komponen.some((k) => k.nama.trim().toLowerCase() === komponenBaru.nama.trim().toLowerCase())) {
            return tolakLog('Tambah komponen', 'Nama komponen sudah ada di katalog.')
          }
        }
        const vn = validasiNilai(komponen, nilai)
        if (!vn.ok) return tolakLog('Ubah komponen', vn.alasan)
        if (komponenId) {
          const bentrok = s.komponenJabatan.some(
            (n) => n.komponenId === komponenId && n.jabatanId === nilai.jabatanId && n.berlakuMulai === nilai.berlakuMulai,
          )
          if (bentrok) return tolakLog('Ubah komponen', 'Sudah ada versi pada tanggal berlaku itu. Pilih tanggal lain.')
        }
        ubah((s2) => {
          let n = s2
          let kid = komponenId
          if (komponenBaru) {
            const r = sisip(n, 'komponen', { ...komponenBaru, nama: komponenBaru.nama.trim(), aktif: true })
            n = r.s
            kid = r.id
          }
          n = sisip(n, 'komponenJabatan', { ...nilai, komponenId: kid }).s
          return tambahLog(n, { judul: 'Simpan komponen', ok: true, pesan: 'INSERT versi nilai komponen baru' })
        })
        return { ok: true }
      },

      // ---------- penggajian ----------
      ajukanGaji(periode) {
        const s = ref.current
        const pg = pilih.penggajianPeriode(s, periode)
        const hasilSemua = pilih.pegawaiDigaji(s).map((x) => pilih.dataGaji(s, x, periode))
        const hasil = ajukan({ pelaku: pilih.pelaku(s), penggajian: pg, periode, sekarang: s.jamDemo, hasilSemua })
        ubah((s2) => {
          let n = s2
          if (hasil.ok) n = pg ? ganti(n, 'penggajian', hasil.penggajianBaru) : sisip(n, 'penggajian', hasil.penggajianBaru).s
          return tambahLog(n, { judul: 'Ajukan gaji', ok: hasil.ok, pesan: hasil.ok ? 'Status → DIAJUKAN' : hasil.alasan })
        })
        return hasil
      },

      kembalikanGaji(periode, catatan) {
        const s = ref.current
        const hasil = kembalikan({ pelaku: pilih.pelaku(s), penggajian: pilih.penggajianPeriode(s, periode), catatan })
        ubah((s2) =>
          tambahLog(hasil.ok ? ganti(s2, 'penggajian', hasil.penggajianBaru) : s2, {
            judul: 'Kembalikan gaji',
            ok: hasil.ok,
            pesan: hasil.ok ? 'Status → DRAFT' : hasil.alasan,
          }),
        )
        return hasil
      },

      finalkanGaji(periode) {
        const s = ref.current
        const pg = pilih.penggajianPeriode(s, periode)
        const hasilSemua = pilih.pegawaiDigaji(s).map((x) => pilih.dataGaji(s, x, periode))
        const hasil = finalkan({ pelaku: pilih.pelaku(s), penggajian: pg, hasilSemua, sekarang: s.jamDemo })
        ubah((s2) => {
          let n = s2
          if (hasil.ok) {
            n = ganti(n, 'penggajian', hasil.penggajianBaru)
            for (const sl of hasil.slipBaru) n = sisip(n, 'slip', sl).s
          }
          return tambahLog(n, {
            judul: 'Finalkan gaji',
            ok: hasil.ok,
            pesan: hasil.ok ? `Status → FINAL. ${hasil.slipBaru.length} slip terbit (beku).` : hasil.alasan,
          })
        })
        return hasil
      },

      revisiSlip(periode, penggunaId) {
        const s = ref.current
        const pg = pilih.penggajianPeriode(s, periode)
        const data = pilih.dataGaji(s, pilih.cariPengguna(s, penggunaId), periode)
        const hasil = revisiSlip({ pelaku: pilih.pelaku(s), penggajian: pg, data, slip: s.slip, sekarang: s.jamDemo })
        ubah((s2) =>
          tambahLog(hasil.ok ? sisip(s2, 'slip', hasil.slipBaru).s : s2, {
            judul: 'Revisi slip',
            ok: hasil.ok,
            pesan: hasil.ok ? `Slip versi ${hasil.slipBaru.versi} terbit; versi lama tetap tersimpan.` : hasil.alasan,
          }),
        )
        return hasil
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const nilai = useMemo(() => ({ state, aksi }), [state, aksi])
  return <Konteks.Provider value={nilai}>{children}</Konteks.Provider>
}

export function useDemo() {
  const k = useContext(Konteks)
  if (!k) throw new Error('useDemo harus dipakai di dalam PenyediaDemo')
  return k
}
