import { Fragment, useState } from 'react'
import { useDemo } from '../../penyimpanan/toko.jsx'
import * as pilih from '../../penyimpanan/pilih.js'
import { boleh, AKSI } from '../../logika/wewenang.js'
import { slipTerbaru } from '../../logika/penggajian.js'
import { namaPeriode, kunciPeriode, periodeSebelum } from '../../logika/waktu.js'
import { rupiah, Lencana, Pesan } from '../umum.jsx'
import SlipGaji from '../SlipGaji.jsx'

function daftarPeriodeSelesai(state) {
  const pertama = kunciPeriode(Math.min(...state.jadwal.map((s) => s.mulai)))
  const hasil = []
  let p = pilih.periodeTerakhirSelesai(state)
  while (p >= pertama && hasil.length < 12) {
    hasil.push(p)
    p = periodeSebelum(p)
  }
  return hasil
}

const WARNA_STATUS = { DRAFT: 'netral', DIAJUKAN: 'peringatan', FINAL: 'ok' }

export default function Penggajian() {
  const { state, aksi } = useDemo()
  const p = pilih.pelaku(state)
  const daftar = daftarPeriodeSelesai(state)
  const [periode, setPeriode] = useState(daftar[0] ?? null)
  const [buka, setBuka] = useState(null)
  const [catatan, setCatatan] = useState('')
  const [hasil, setHasil] = useState(null)

  if (!periode) return <p>Belum ada periode yang selesai.</p>

  const pg = pilih.penggajianPeriode(state, periode)
  const status = pg?.status ?? 'DRAFT'
  const final = status === 'FINAL'
  const data = pilih.pegawaiDigaji(state).map((x) => pilih.dataGaji(state, x, periode))
  const slip = final ? slipTerbaru(state.slip.filter((s) => s.penggajianId === pg.id)) : []
  const masalah = data.filter((d) => d.rekap.perluKoreksi > 0 || d.rekap.berjalan > 0 || !d.hasil.valid)
  const total = data.reduce((t, d) => t + (d.hasil.valid ? d.hasil.rincian.takeHome : 0), 0)

  const jalankan = (h, teks) => setHasil(h.ok ? { ok: true, teks } : h)

  return (
    <div>
      <div className="baris-antara">
        <h3>Penggajian</h3>
        <select value={periode} onChange={(e) => setPeriode(e.target.value)}>
          {daftar.map((x) => (
            <option key={x} value={x}>
              {namaPeriode(x)}
            </option>
          ))}
        </select>
      </div>

      <div className="alur-status kecil">
        {['DRAFT', 'DIAJUKAN', 'FINAL'].map((st, i) => (
          <span key={st} className={status === st ? 'aktif' : ''}>
            {i > 0 && ' → '}
            {st}
          </span>
        ))}
      </div>
      {pg?.catatanKembali && status === 'DRAFT' && <div className="pesan pesan-gagal">Dikembalikan Kepala HR: “{pg.catatanKembali}”</div>}

      {masalah.length > 0 && !final && (
        <div className="pesan pesan-gagal">
          Selesaikan dulu sebelum diajukan:
          <ul>
            {masalah.map((d) => (
              <li key={d.pengguna.id}>
                {d.pengguna.nama}: {d.rekap.perluKoreksi ? `${d.rekap.perluKoreksi} absen perlu koreksi` : ''}
                {!d.hasil.valid ? d.hasil.alasan : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Pesan hasil={hasil} />

      {!final && (
        <>
          <p className="kecil redup">Pratinjau — dihitung langsung dari absen & aturan yang berlaku. Belum mengikat sampai FINAL.</p>
          <table className="tabel">
            <thead>
              <tr>
                <th>Pegawai</th>
                <th>Hadir</th>
                <th>Telat</th>
                <th>Lembur</th>
                <th className="angka">Bruto</th>
                <th className="angka">Potongan</th>
                <th className="angka">Take-home</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <Fragment key={d.pengguna.id}>
                  <tr className="klik" onClick={() => setBuka(buka === d.pengguna.id ? null : d.pengguna.id)}>
                    <td>
                      {d.pengguna.nama}
                      <div className="kecil redup">{d.jabatan?.nama}</div>
                    </td>
                    <td>{d.rekap.hadir}</td>
                    <td>{d.rekap.telatMenit}m</td>
                    <td>{d.rekap.lemburJam}j</td>
                    <td className="angka">{d.hasil.rincian ? rupiah(d.hasil.rincian.bruto) : '—'}</td>
                    <td className="angka">{d.hasil.rincian ? rupiah(d.hasil.rincian.totalPotongan) : '—'}</td>
                    <td className="angka">{d.hasil.valid ? <strong>{rupiah(d.hasil.rincian.takeHome)}</strong> : <Lencana jenis="gagal">✗</Lencana>}</td>
                  </tr>
                  {buka === d.pengguna.id && d.hasil.rincian && (
                    <tr>
                      <td colSpan={7}>
                        <SlipGaji
                          slip={{
                            versi: 1,
                            snapshot: { pegawai: { nama: d.pengguna.nama, jabatan: d.jabatan?.nama }, periode, kehadiran: d.rekap, rincian: d.hasil.rincian },
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6}>Total take-home</td>
                <td className="angka">
                  <strong>{rupiah(total)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>

          <div className="baris">
            {status === 'DRAFT' && (
              <button className="utama" disabled={!boleh(p, AKSI.AJUKAN_GAJI)} onClick={() => jalankan(aksi.ajukanGaji(periode), 'Diajukan ke Kepala HR')}>
                Ajukan ke Kepala HR
              </button>
            )}
            {status === 'DIAJUKAN' && (
              <>
                <input placeholder="Catatan jika dikembalikan" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
                <button disabled={!boleh(p, AKSI.KEMBALIKAN_GAJI)} onClick={() => jalankan(aksi.kembalikanGaji(periode, catatan), 'Dikembalikan ke DRAFT')}>
                  Kembalikan
                </button>
                <button className="utama" disabled={!boleh(p, AKSI.FINALKAN_GAJI)} onClick={() => jalankan(aksi.finalkanGaji(periode), 'FINAL — slip terbit ke pegawai')}>
                  Finalkan
                </button>
              </>
            )}
          </div>
          {status === 'DIAJUKAN' && !boleh(p, AKSI.FINALKAN_GAJI) && <p className="kecil redup">Menunggu Kepala HR memfinalkan.</p>}
        </>
      )}

      {final && (
        <>
          <p className="kecil">
            <Lencana jenis={WARNA_STATUS.FINAL}>FINAL</Lencana> Slip sudah terbit dan beku. Koreksi setelah ini → revisi (versi baru), slip lama tetap tersimpan.
          </p>
          <table className="tabel">
            <thead>
              <tr>
                <th>Pegawai</th>
                <th>Versi</th>
                <th className="angka">Take-home (slip)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {slip.map((s) => (
                <tr key={s.id}>
                  <td>{s.snapshot.pegawai.nama}</td>
                  <td>{s.versi > 1 ? <Lencana jenis="peringatan">Revisi {s.versi}</Lencana> : 1}</td>
                  <td className="angka">{rupiah(s.takeHome)}</td>
                  <td>
                    <button
                      className="kecil"
                      disabled={!boleh(p, AKSI.REVISI_SLIP)}
                      onClick={() => jalankan(aksi.revisiSlip(periode, s.penggunaId), 'Revisi slip terbit')}
                      title="Hitung ulang dari data terkini; hanya terbit jika ada perubahan"
                    >
                      Buat revisi
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
