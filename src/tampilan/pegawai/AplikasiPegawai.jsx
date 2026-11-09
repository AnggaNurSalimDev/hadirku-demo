import { useState } from 'react'
import { useDemo } from '../../penyimpanan/toko.jsx'
import * as pilih from '../../penyimpanan/pilih.js'
import { statusSaatIni } from '../../logika/absen.js'
import { slipTerbaru } from '../../logika/penggajian.js'
import { jamMenit, tanggalPendek, awalHari, namaPeriode, kunciPeriode, periodeSebelum, MENIT, HARI } from '../../logika/waktu.js'
import { rupiah, Lencana, Pesan, useKodeTotp, gabungJam } from '../umum.jsx'
import SlipGaji from '../SlipGaji.jsx'

const TAB = [
  ['beranda', 'Beranda'],
  ['riwayat', 'Riwayat'],
  ['slip', 'Slip'],
  ['profil', 'Profil'],
]

export default function AplikasiPegawai() {
  const { state, aksi } = useDemo()
  const p = pilih.pelaku(state)
  const tab = state.ui.tabPegawai

  return (
    <div className="hp">
      <div className="hp-layar">
        {tab === 'beranda' && <Beranda key={p.id} />}
        {tab === 'riwayat' && <Riwayat key={p.id} />}
        {tab === 'slip' && <DaftarSlip key={p.id} />}
        {tab === 'profil' && <Profil />}
      </div>
      <nav className="hp-nav">
        {TAB.map(([k, label]) => (
          <button key={k} className={tab === k ? 'aktif' : ''} onClick={() => aksi.aturUi({ tabPegawai: k })}>
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}

const LABEL_STATUS = {
  BELUM_MASUK: 'Belum masuk',
  SEDANG_KERJA: 'Sedang bekerja',
  SELESAI: 'Selesai hari ini',
  TIDAK_ADA_SHIFT: 'Tidak ada shift aktif',
}

function Beranda() {
  const { state, aksi } = useDemo()
  const p = pilih.pelaku(state)
  const lokasi = pilih.lokasiUtama(state)
  const st = statusSaatIni(state.jadwal, state.absen, p.id, state.jamDemo)
  const [mode, setMode] = useState(null) // null | 'pilih' | 'ketik'
  const [kode, setKode] = useState('')
  const [hasil, setHasil] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  const { kode: kodeLokasi } = useKodeTotp(lokasi.totpSecret)

  const kirim = async (k = null) => {
    setSibuk(true)
    const h = await aksi.absen({ kode: k })
    setSibuk(false)
    if (h.ok) {
      setHasil({ ok: true, cap: h.baris, teks: `Absen ${h.baris.jenis === 'MASUK' ? 'masuk' : 'pulang'} tercatat ${jamMenit(h.baris.waktu)}` })
      setMode(null)
      setKode('')
    } else {
      setHasil({ ok: false, alasan: h.alasan })
      if (h.perluKode) setMode((m) => m ?? 'pilih')
    }
  }

  const bisaAbsen = st.status === 'BELUM_MASUK' || st.status === 'SEDANG_KERJA'
  const labelTombol = st.status === 'SEDANG_KERJA' ? 'ABSEN PULANG' : st.status === 'BELUM_MASUK' ? 'ABSEN MASUK' : LABEL_STATUS[st.status]

  return (
    <div className="isi">
      <div className="baris-antara">
        <strong>Halo, {p.nama.split(' ')[0]}</strong>
        <span className="redup">{tanggalPendek(state.jamDemo)}</span>
      </div>
      <div className="kartu">
        <div>Shift: {st.shift ? `${jamMenit(st.shift.mulai)} – ${jamMenit(st.shift.selesai)}` : '—'}</div>
        <div>
          Status: <strong>{LABEL_STATUS[st.status]}</strong>
        </div>
        {st.masuk && <div>Masuk <span className="jam-cetak">{jamMenit(st.masuk.waktu)}</span> <span className="redup kecil">{NAMA_METODE[st.masuk.metode]}</span></div>}
        {st.pulang && <div>Pulang <span className="jam-cetak">{jamMenit(st.pulang.waktu)}</span> <span className="redup kecil">{NAMA_METODE[st.pulang.metode]}</span></div>}
      </div>

      <button className="tombol-absen" disabled={!bisaAbsen || sibuk} onClick={() => kirim()}>
        {sibuk ? 'Memeriksa…' : labelTombol}
      </button>

      <div className={state.jaringan === 'KANTOR' ? 'jaringan ok' : 'jaringan gagal'}>
        {state.jaringan === 'KANTOR' ? '✓ Terhubung WiFi kantor' : '✗ WiFi kantor tidak terdeteksi'}
      </div>

      {mode && bisaAbsen && (
        <div className="kartu cadangan">
          <div className="kecil">Masukkan kode dari HP lokasi:</div>
          <div className="baris">
            <button disabled={sibuk || !kodeLokasi} onClick={() => kirim(kodeLokasi)} title="Simulasi: kamera membaca QR di panel HP Lokasi">
              📷 Scan QR
            </button>
            <button disabled={sibuk} onClick={() => setMode('ketik')}>
              ⌨ Ketik kode
            </button>
          </div>
          {mode === 'ketik' && (
            <form
              className="baris"
              onSubmit={(e) => {
                e.preventDefault()
                kirim(kode.trim())
              }}
            >
              <input inputMode="numeric" maxLength={6} placeholder="6 digit" value={kode} onChange={(e) => setKode(e.target.value.replace(/\D/g, ''))} />
              <button type="submit" disabled={sibuk || kode.length !== 6}>
                Kirim
              </button>
            </form>
          )}
          <div className="kecil redup">Scan QR di demo disimulasikan: membaca QR dari panel HP Lokasi.</div>
        </div>
      )}

      {hasil?.cap ? <CapWaktu baris={hasil.cap} teks={hasil.teks} /> : <Pesan hasil={hasil} />}

      {st.status === 'SEDANG_KERJA' && state.jamDemo < st.shift.selesai && (
        <button className="tombol-demo" onClick={() => aksi.majuWaktu(st.shift.selesai + 5 * MENIT - state.jamDemo)}>
          ⏩ Lompat ke jam pulang (demo)
        </button>
      )}
    </div>
  )
}

const NAMA_METODE = { WIFI: 'lewat WiFi kantor', TOTP: 'lewat kode HP lokasi', MANUAL: 'dicatat HR', KOREKSI: 'hasil koreksi' }

function CapWaktu({ baris, teks }) {
  return (
    <div className="cap-waktu" role="status" aria-label={teks}>
      <span className="tinta" key={baris.waktu}>
        <span className="jenis">{baris.jenis === 'MASUK' ? 'Masuk' : 'Pulang'}</span>
        <span className="jam">{jamMenit(baris.waktu)}</span>
      </span>
      <span className="metode">{NAMA_METODE[baris.metode]}</span>
    </div>
  )
}

const IKON = { HADIR: '✓', LIBUR: '–', BOLOS: '✗', PERLU_KOREKSI: '❗', BERJALAN: '…' }

function Riwayat() {
  const { state, aksi } = useDemo()
  const p = pilih.pelaku(state)
  const sekarangPeriode = kunciPeriode(state.jamDemo)
  const [periode, setPeriode] = useState(sekarangPeriode)
  const [buka, setBuka] = useState(null)

  if (!p.jabatanId) return <div className="isi redup">Akun ini tidak memiliki jadwal kerja.</div>

  const rekap = pilih.rekapPengguna(state, p.id, periode)
  const sesi = rekap.sesi.filter((s) => s.mulai <= state.jamDemo).reverse()
  const pengajuan = state.koreksi.filter((k) => k.penggunaId === p.id)
  const mendatang = state.jadwal
    .filter((s) => s.penggunaId === p.id && s.mulai > awalHari(state.jamDemo) + HARI && s.mulai < awalHari(state.jamDemo) + 8 * HARI)
    .sort((a, b) => a.mulai - b.mulai)

  return (
    <div className="isi">
      <div className="baris-antara">
        <select value={periode} onChange={(e) => setPeriode(e.target.value)}>
          <option value={sekarangPeriode}>{namaPeriode(sekarangPeriode)}</option>
          <option value={periodeSebelum(sekarangPeriode)}>{namaPeriode(periodeSebelum(sekarangPeriode))}</option>
        </select>
      </div>
      <div className="kartu kecil">
        Hadir {rekap.hadir}, Telat {rekap.telatMenit} mnt, Lembur {rekap.lemburJam} j, Bolos {rekap.bolos}
        {rekap.perluKoreksi > 0 && <div className="teks-gagal">❗ {rekap.perluKoreksi} perlu koreksi</div>}
      </div>
      <ul className="daftar">
        {sesi.map((s) => {
          const kor = pengajuan.filter((k) => k.shiftId === s.shiftId)
          return (
            <li key={s.shiftId}>
              <div className="baris-antara">
                <span>
                  {tanggalPendek(s.mulai)} {s.status !== 'LIBUR' && <span className="jam-cetak">{s.masuk ? jamMenit(s.masuk) : '--:--'} {s.pulang ? jamMenit(s.pulang) : '--:--'}</span>}
                </span>
                <span>
                  {IKON[s.status]} {s.status === 'LIBUR' ? 'libur' : ''}
                  {s.telatMenit > 0 && <Lencana jenis="peringatan">telat {s.telatMenit}</Lencana>}
                </span>
              </div>
              {kor.map((k) => (
                <div key={k.id} className="kecil redup">
                  Koreksi {k.jenis.toLowerCase()} {jamMenit(k.waktuUsulan)}: <strong>{k.status}</strong>
                  {k.catatan ? ` — ${k.catatan}` : ''}
                </div>
              ))}
              {s.status === 'PERLU_KOREKSI' && !kor.some((k) => k.status === 'MENUNGGU') && (
                <button className="kecil" onClick={() => setBuka(buka === s.shiftId ? null : s.shiftId)}>
                  Koreksi
                </button>
              )}
              {buka === s.shiftId && <FormKoreksi sesi={s} selesai={() => setBuka(null)} aksi={aksi} />}
            </li>
          )
        })}
      </ul>
      <h4>Jadwal 7 hari ke depan</h4>
      <ul className="daftar kecil">
        {mendatang.map((s) => (
          <li key={s.id}>
            {tanggalPendek(s.mulai)} — {s.libur ? 'Libur' : `${jamMenit(s.mulai)}–${jamMenit(s.selesai)}`}
          </li>
        ))}
      </ul>
    </div>
  )
}

function FormKoreksi({ sesi, selesai, aksi }) {
  const jenisAwal = sesi.masuk ? 'PULANG' : 'MASUK'
  const [jenis, setJenis] = useState(jenisAwal)
  const [jam, setJam] = useState(jamMenit(jenisAwal === 'PULANG' ? sesi.selesai : sesi.mulai))
  const [alasan, setAlasan] = useState('')
  const [hasil, setHasil] = useState(null)

  const kirim = (e) => {
    e.preventDefault()
    const waktuUsulan = gabungJam(awalHari(sesi.mulai), jam)
    if (waktuUsulan === null) return setHasil({ ok: false, alasan: 'Format jam HH:MM.' })
    const h = aksi.ajukanKoreksi({ shiftId: sesi.shiftId, jenis, waktuUsulan, alasan })
    setHasil(h.ok ? { ok: true, teks: 'Pengajuan terkirim ke HR' } : h)
    if (h.ok) setTimeout(selesai, 900)
  }

  return (
    <form className="kartu form" onSubmit={kirim}>
      <label>
        Jenis
        <select value={jenis} onChange={(e) => setJenis(e.target.value)}>
          <option value="MASUK">Masuk</option>
          <option value="PULANG">Pulang</option>
        </select>
      </label>
      <label>
        Jam
        <input type="time" value={jam} onChange={(e) => setJam(e.target.value)} />
      </label>
      <label>
        Alasan
        <input value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="mis. lupa absen, HP lowbat" />
      </label>
      <button type="submit">Kirim pengajuan</button>
      <Pesan hasil={hasil} />
    </form>
  )
}

function DaftarSlip() {
  const { state } = useDemo()
  const p = pilih.pelaku(state)
  const [dipilih, setDipilih] = useState(null)
  const final = new Set(state.penggajian.filter((g) => g.status === 'FINAL').map((g) => g.id))
  const milik = slipTerbaru(state.slip.filter((s) => s.penggunaId === p.id && final.has(s.penggajianId))).sort((a, b) =>
    b.snapshot.periode.localeCompare(a.snapshot.periode),
  )

  if (dipilih) {
    const s = state.slip.find((x) => x.id === dipilih)
    return (
      <div className="isi">
        <button className="kecil" onClick={() => setDipilih(null)}>
          ← Kembali
        </button>
        <SlipGaji slip={s} />
        <button onClick={() => window.print()}>Cetak / Simpan PDF</button>
      </div>
    )
  }

  return (
    <div className="isi">
      <h4>Slip gaji</h4>
      {milik.length === 0 && <p className="redup kecil">Belum ada slip. Slip muncul setelah Kepala HR memfinalkan penggajian.</p>}
      <ul className="daftar">
        {milik.map((s) => (
          <li key={s.id} className="baris-antara klik" onClick={() => setDipilih(s.id)}>
            <span>
              {namaPeriode(s.snapshot.periode)} {s.versi > 1 && <Lencana jenis="peringatan">REVISI {s.versi}</Lencana>}
            </span>
            <strong>{rupiah(s.takeHome)}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Profil() {
  const { state } = useDemo()
  const p = pilih.pelaku(state)
  const j = pilih.cariJabatan(state, p.jabatanId)
  const d = state.perangkat.find((x) => x.penggunaId === p.id && x.status === 'AKTIF')
  return (
    <div className="isi">
      <div className="kartu">
        <strong>{p.nama}</strong>
        <div className="redup">{j?.nama ?? 'HR'}</div>
      </div>
      <div className="kartu kecil">
        HP terdaftar: {d ? `${d.label}, aktif` : 'tidak ada'}
        <div className="redup">Ganti HP? Hubungi HR untuk kode aktivasi baru.</div>
      </div>
      <p className="kecil redup">Tidak ada password: HP ini sendiri adalah kuncinya (tanda tangan perangkat).</p>
    </div>
  )
}
