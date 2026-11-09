import { useState } from 'react'
import { useDemo } from '../../penyimpanan/toko.jsx'
import * as pilih from '../../penyimpanan/pilih.js'
import { statusSaatIni, absenUntukShift, LAPORAN_IP_BASI } from '../../logika/absen.js'
import { boleh, AKSI, namaPeran } from '../../logika/wewenang.js'
import { TIPE_SHIFT } from '../../logika/jadwal.js'
import { jamMenit, tanggalPendek, awalHari, namaHari, HARI, kunciTanggal } from '../../logika/waktu.js'
import { Lencana, Pesan } from '../umum.jsx'
import JabatanGaji from './JabatanGaji.jsx'
import Penggajian from './Penggajian.jsx'

const MENU = [
  ['dashboard', 'Dashboard'],
  ['persetujuan', 'Persetujuan'],
  ['pegawai', 'Pegawai'],
  ['jadwal', 'Jadwal shift'],
  ['jabatan', 'Jabatan & Gaji'],
  ['penggajian', 'Penggajian'],
  ['pengaturan', 'Pengaturan'],
]

export default function AplikasiHr() {
  const { state, aksi } = useDemo()
  const p = pilih.pelaku(state)
  const menu = state.ui.menuHr
  if (!boleh(p, AKSI.LIHAT_HR)) return <div className="laptop isi">Akun ini tidak punya akses HR.</div>

  return (
    <div className="laptop">
      <aside className="laptop-menu">
        <div className="kecil redup">{namaPeran(p.peran)}</div>
        <strong className="kecil">{p.nama}</strong>
        {MENU.map(([k, label]) => (
          <button key={k} className={menu === k ? 'aktif' : ''} onClick={() => aksi.aturUi({ menuHr: k })}>
            {label}
          </button>
        ))}
      </aside>
      <section className="laptop-isi">
        {menu === 'dashboard' && <Dashboard />}
        {menu === 'persetujuan' && <Persetujuan />}
        {menu === 'pegawai' && <DaftarPegawai />}
        {menu === 'jadwal' && <Jadwal />}
        {menu === 'jabatan' && <JabatanGaji />}
        {menu === 'penggajian' && <Penggajian />}
        {menu === 'pengaturan' && <Pengaturan />}
      </section>
    </div>
  )
}

function Dashboard() {
  const { state, aksi } = useDemo()
  const lokasi = pilih.lokasiUtama(state)
  const hariIni = kunciTanggal(state.jamDemo)
  const pegawai = state.pengguna.filter((p) => p.jabatanId && p.status === 'AKTIF')

  let hadir = 0, belum = 0, telat = 0, libur = 0
  for (const p of pegawai) {
    const shiftHariIni = state.jadwal.find((s) => s.penggunaId === p.id && kunciTanggal(s.mulai) === hariIni)
    if (!shiftHariIni || shiftHariIni.libur) {
      libur++
      continue
    }
    const masuk = absenUntukShift(state.absen, shiftHariIni).find((a) => a.jenis === 'MASUK')
    if (masuk) {
      hadir++
      if (masuk.waktu > shiftHariIni.mulai) telat++
    } else belum++
  }

  const perhatian = []
  const menunggu = state.koreksi.filter((k) => k.status === 'MENUNGGU').length
  if (menunggu) perhatian.push({ teks: `${menunggu} koreksi menunggu persetujuan`, menu: 'persetujuan' })
  const seminggu = state.jamDemo - 7 * HARI
  for (const p of pegawai) {
    const totp = state.absen.filter((a) => a.penggunaId === p.id && a.metode === 'TOTP' && a.waktu >= seminggu).length
    if (totp >= 3) perhatian.push({ teks: `${p.nama.split(' ')[0]}: ${totp}x pakai kode TOTP minggu ini (WiFi normal?)`, menu: 'pegawai' })
    const r = pilih.rekapPengguna(state, p.id, pilih.periodeBerjalan(state))
    if (r.perluKoreksi) perhatian.push({ teks: `${p.nama.split(' ')[0]}: ${r.perluKoreksi} absen perlu koreksi`, menu: 'persetujuan' })
  }
  const diajukan = state.penggajian.filter((g) => g.status === 'DIAJUKAN')
  for (const g of diajukan) perhatian.push({ teks: `Penggajian ${g.periode} menunggu finalisasi Kepala HR`, menu: 'penggajian' })

  const ipSegar = state.jamDemo - lokasi.ipDilaporPada <= LAPORAN_IP_BASI

  return (
    <div>
      <h3>Hari ini, {tanggalPendek(state.jamDemo)}</h3>
      <div className="kecil">
        Lokasi {lokasi.nama}: <Lencana jenis={ipSegar ? 'ok' : 'gagal'}>IP {ipSegar ? 'OK' : 'basi'}</Lencana>{' '}
        <Lencana jenis="ok">kunci v{lokasi.versiKunci}</Lencana>
      </div>
      <div className="angka-kotak">
        <div><b>{hadir}</b>Hadir</div>
        <div><b>{belum}</b>Belum</div>
        <div><b>{telat}</b>Telat</div>
        <div><b>{libur}</b>Libur</div>
      </div>
      <h4>⚠ Perlu perhatian</h4>
      {perhatian.length === 0 && <p className="redup kecil">Tidak ada.</p>}
      <ul className="daftar">
        {perhatian.map((x, i) => (
          <li key={i} className="klik" onClick={() => aksi.aturUi({ menuHr: x.menu })}>
            {x.teks}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Persetujuan() {
  const { state, aksi } = useDemo()
  const [tab, setTab] = useState('koreksi')
  const [catatan, setCatatan] = useState({})
  const [hasil, setHasil] = useState(null)
  const [manual, setManual] = useState({ pegawaiId: '', alasan: '' })

  const menunggu = state.koreksi.filter((k) => k.status === 'MENUNGGU')
  const selesai = state.koreksi.filter((k) => k.status !== 'MENUNGGU').slice(-5).reverse()
  const nama = (id) => pilih.cariPengguna(state, id)?.nama ?? '?'

  const putus = (k, setuju) => {
    const h = aksi.putuskanKoreksi({ koreksiId: k.id, setuju, catatan: catatan[k.id] })
    setHasil(h.ok ? { ok: true, teks: setuju ? 'Disetujui — baris absen KOREKSI ditambahkan' : 'Ditolak' } : h)
  }

  const pegawaiAktif = state.pengguna.filter((p) => p.jabatanId && p.status === 'AKTIF')

  return (
    <div>
      <div className="tab">
        <button className={tab === 'koreksi' ? 'aktif' : ''} onClick={() => setTab('koreksi')}>
          Koreksi absen {menunggu.length > 0 && <Lencana jenis="peringatan">{menunggu.length}</Lencana>}
        </button>
        <button className={tab === 'manual' ? 'aktif' : ''} onClick={() => setTab('manual')}>
          Absen manual
        </button>
      </div>
      <Pesan hasil={hasil} />

      {tab === 'koreksi' && (
        <>
          {menunggu.length === 0 && <p className="redup kecil">Tidak ada pengajuan.</p>}
          {menunggu.map((k) => {
            const shift = state.jadwal.find((s) => s.id === k.shiftId)
            const bukti = absenUntukShift(state.absen, shift)
            return (
              <div key={k.id} className="kartu">
                <strong>{nama(k.penggunaId)}</strong>, {tanggalPendek(shift.mulai)}, {k.jenis.toLowerCase()} {jamMenit(k.waktuUsulan)}
                <div className="kecil">“{k.alasan}”</div>
                <div className="kecil redup">
                  Bukti: {bukti.length ? bukti.map((a) => `${a.jenis.toLowerCase()} ${jamMenit(a.waktu)} via ${a.metode}`).join(', ') : 'tidak ada absen'}
                  {', '}shift {jamMenit(shift.mulai)}–{jamMenit(shift.selesai)}
                </div>
                <div className="baris">
                  <input placeholder="Catatan (wajib jika tolak)" value={catatan[k.id] ?? ''} onChange={(e) => setCatatan({ ...catatan, [k.id]: e.target.value })} />
                  <button onClick={() => putus(k, false)}>Tolak</button>
                  <button className="utama" onClick={() => putus(k, true)}>
                    Setujui
                  </button>
                </div>
              </div>
            )
          })}
          {selesai.length > 0 && (
            <>
              <h4>Riwayat keputusan</h4>
              <ul className="daftar kecil">
                {selesai.map((k) => (
                  <li key={k.id}>
                    {nama(k.penggunaId)}, {k.jenis.toLowerCase()} {jamMenit(k.waktuUsulan)} → <strong>{k.status}</strong> oleh {nama(k.diputusOleh)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {tab === 'manual' && (
        <form
          className="kartu form"
          onSubmit={(e) => {
            e.preventDefault()
            const h = aksi.absenManual({ pegawaiId: Number(manual.pegawaiId), alasan: manual.alasan })
            setHasil(h.ok ? { ok: true, teks: `Absen ${h.baris.jenis.toLowerCase()} ${jamMenit(h.baris.waktu)} dicatat (MANUAL)` } : h)
          }}
        >
          <p className="kecil redup">Untuk pegawai yang HP-nya rusak, hilang, atau habis baterai. Jam diambil dari server: {jamMenit(state.jamDemo)}.</p>
          <label>
            Pegawai
            <select value={manual.pegawaiId} onChange={(e) => setManual({ ...manual, pegawaiId: e.target.value })}>
              <option value="">— pilih —</option>
              {pegawaiAktif.map((p) => {
                const st = statusSaatIni(state.jadwal, state.absen, p.id, state.jamDemo)
                return (
                  <option key={p.id} value={p.id}>
                    {p.nama} ({st.status.replace('_', ' ').toLowerCase()})
                  </option>
                )
              })}
            </select>
          </label>
          <label>
            Alasan (wajib)
            <input value={manual.alasan} onChange={(e) => setManual({ ...manual, alasan: e.target.value })} placeholder="mis. HP rusak" />
          </label>
          <button type="submit" className="utama">
            Catat absen sekarang
          </button>
        </form>
      )}
    </div>
  )
}

function DaftarPegawai() {
  const { state, aksi } = useDemo()
  const [hasil, setHasil] = useState(null)
  const pegawai = state.pengguna.filter((p) => p.peran === 'PEGAWAI')
  const seminggu = state.jamDemo - 7 * HARI

  return (
    <div>
      <h3>Pegawai</h3>
      <Pesan hasil={hasil} />
      <table className="tabel">
        <thead>
          <tr>
            <th>Nama</th>
            <th>Jabatan</th>
            <th>HP</th>
            <th>TOTP 7 hari</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {pegawai.map((p) => {
            const totp = state.absen.filter((a) => a.penggunaId === p.id && a.metode === 'TOTP' && a.waktu >= seminggu).length
            return (
              <tr key={p.id}>
                <td>{p.nama}</td>
                <td>{pilih.cariJabatan(state, p.jabatanId)?.nama}</td>
                <td>{state.perangkat.some((d) => d.penggunaId === p.id && d.status === 'AKTIF') ? '✓' : '—'}</td>
                <td>{totp >= 3 ? <Lencana jenis="peringatan">{totp}x</Lencana> : totp}</td>
                <td>
                  <Lencana jenis={p.status === 'AKTIF' ? 'ok' : 'gagal'}>{p.status}</Lencana>
                </td>
                <td>
                  <button
                    className="kecil"
                    onClick={() => {
                      const h = aksi.ubahStatus({ penggunaId: p.id, statusBaru: p.status === 'AKTIF' ? 'NONAKTIF' : 'AKTIF' })
                      setHasil(h.ok ? { ok: true, teks: `${p.nama} → ${h.penggunaBaru.status}` } : h)
                    }}
                  >
                    {p.status === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="kecil redup">
        Di versi asli: tombol “Tambah pegawai” menerbitkan kode aktivasi sekali pakai (24 jam) yang diberikan HR secara tatap muka. Pegawai yang dinonaktifkan tidak dihapus — riwayatnya tetap ada.
      </p>
    </div>
  )
}

const URUTAN_TIPE = ['P', 'S', 'L']

function Jadwal() {
  const { state, aksi } = useDemo()
  const [geser, setGeser] = useState(0)
  const [hasil, setHasil] = useState(null)
  const awal = awalHari(state.jamDemo)
  const senin = awal - ((new Date(awal + 7 * 3600 * 1000).getUTCDay() + 6) % 7) * HARI + geser * 7 * HARI
  const hari = Array.from({ length: 7 }, (_, i) => senin + i * HARI)
  const pegawai = state.pengguna.filter((p) => p.jabatanId && p.status === 'AKTIF')

  const klik = (shift) => {
    const tipeBaru = URUTAN_TIPE[(URUTAN_TIPE.indexOf(shift.tipe) + 1) % URUTAN_TIPE.length]
    const h = aksi.ubahShift({ shiftId: shift.id, tipeBaru })
    setHasil(h.ok ? null : h)
  }

  return (
    <div>
      <div className="baris-antara">
        <h3>Jadwal shift</h3>
        <div className="baris">
          <button onClick={() => setGeser(geser - 1)}>‹</button>
          <button onClick={() => setGeser(0)}>Minggu ini</button>
          <button onClick={() => setGeser(geser + 1)}>›</button>
        </div>
      </div>
      <Pesan hasil={hasil} />
      <div className="gulir">
        <table className="tabel jadwal">
          <thead>
            <tr>
              <th />
              {hari.map((h) => (
                <th key={h} className={kunciTanggal(h) === kunciTanggal(state.jamDemo) ? 'hari-ini' : ''}>
                  {namaHari(h)} {new Date(h + 7 * 3600 * 1000).getUTCDate()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pegawai.map((p) => (
              <tr key={p.id}>
                <td>{p.nama.split(' ')[0]}</td>
                {hari.map((h) => {
                  const s = state.jadwal.find((x) => x.penggunaId === p.id && kunciTanggal(x.mulai) === kunciTanggal(h))
                  return (
                    <td key={h}>
                      {s ? (
                        <button className={`sel sel-${s.tipe}`} onClick={() => klik(s)} title="Klik untuk ganti P → S → L">
                          {s.tipe}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="kecil redup">
        {Object.entries(TIPE_SHIFT)
          .map(([k, t]) => (k === 'L' ? `${k} = ${t.label}` : `${k} = ${t.label} ${String(t.mulaiJam).padStart(2, '0')}:00–${String(t.mulaiJam + t.durasiJam).padStart(2, '0')}:00`))
          .join(', ')}
        . Hanya jadwal mulai besok yang bisa diubah.
      </p>
    </div>
  )
}

function Pengaturan() {
  const { state, aksi } = useDemo()
  const p = pilih.pelaku(state)
  const lokasi = pilih.lokasiUtama(state)
  const [hasil, setHasil] = useState(null)
  const kepala = boleh(p, AKSI.GANTI_KUNCI_LOKASI)
  const hr = state.pengguna.filter((x) => x.peran !== 'PEGAWAI')

  return (
    <div>
      <h3>Pengaturan</h3>
      {!kepala && <p className="kecil redup">Hanya Kepala HR yang bisa mengubah pengaturan.</p>}
      <Pesan hasil={hasil} />
      <div className="kartu">
        <strong>Perangkat lokasi, {lokasi.nama}</strong>
        <div className="kecil">IP kantor terakhir: {lokasi.ipTerakhir} (dilapor {jamMenit(lokasi.ipDilaporPada)})</div>
        <div className="kecil">Versi kunci TOTP: {lokasi.versiKunci}</div>
        <button
          disabled={!kepala}
          onClick={() => {
            const h = aksi.gantiKunciLokasi()
            setHasil(h.ok ? { ok: true, teks: 'Kunci diganti. Kode lama langsung tidak berlaku.' } : h)
          }}
        >
          Ganti kunci (HP lokasi hilang?)
        </button>
      </div>
      <div className="kartu">
        <strong>Akun HR</strong>
        {hr.map((x) => (
          <div key={x.id} className="baris-antara kecil">
            <span>
              {x.nama}, {namaPeran(x.peran)} <Lencana jenis={x.status === 'AKTIF' ? 'ok' : 'gagal'}>{x.status}</Lencana>
            </span>
            <button
              className="kecil"
              disabled={!kepala}
              onClick={() => {
                const h = aksi.ubahStatus({ penggunaId: x.id, statusBaru: x.status === 'AKTIF' ? 'NONAKTIF' : 'AKTIF' })
                setHasil(h.ok ? { ok: true, teks: `${x.nama} → ${h.penggunaBaru.status}` } : h)
              }}
            >
              {x.status === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
          </div>
        ))}
        <p className="kecil redup">Di versi asli HR login dengan password + 2FA. Minimal satu Kepala HR harus tetap aktif.</p>
      </div>
    </div>
  )
}

