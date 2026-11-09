import { useDemo } from '../penyimpanan/toko.jsx'
import { namaPeran } from '../logika/wewenang.js'
import { tanggalPendek, jamMenit, JAM } from '../logika/waktu.js'

export default function BarAtas() {
  const { state, aksi } = useDemo()
  const pelaku = state.pengguna.find((p) => p.id === state.pelakuId)
  const pegawai = state.pengguna.filter((p) => p.peran === 'PEGAWAI')
  const hr = state.pengguna.filter((p) => p.peran !== 'PEGAWAI')

  return (
    <header className="bar-atas">
      <div className="merek">
        <strong>Hadirku</strong> <span className="cap-demo">Demo</span>
      </div>
      <div className="kontrol">
        <label>
          Lihat sebagai
          <select value={state.pelakuId} onChange={(e) => aksi.aturPelaku(Number(e.target.value))}>
            <optgroup label="Pegawai (HP)">
              {pegawai.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama}
                </option>
              ))}
            </optgroup>
            <optgroup label="HR (laptop)">
              {hr.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama} — {namaPeran(p.peran)}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <span className="jam-demo" title="Jam server demo">
          {tanggalPendek(state.jamDemo)} {jamMenit(state.jamDemo)}
        </span>
        <button onClick={() => aksi.majuWaktu(JAM)}>+1 jam</button>
        <button onClick={() => aksi.hariBerikut()}>Besok 07:55</button>
        <button onClick={() => aksi.reset()} title="Kembalikan semua data ke awal">
          Reset
        </button>
      </div>
      {pelaku?.status !== 'AKTIF' && <div className="pesan pesan-gagal kecil">Akun {pelaku?.nama} sedang NONAKTIF.</div>}
    </header>
  )
}

