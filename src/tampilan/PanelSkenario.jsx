import { useDemo } from '../penyimpanan/toko.jsx'
import { SKENARIO } from '../skenario/skenario.js'

export default function PanelSkenario() {
  const { state, aksi } = useDemo()
  const aktif = SKENARIO.find((s) => s.id === state.ui.skenario)

  if (aktif) {
    const l = aktif.langkah[state.ui.langkah]
    const terakhir = state.ui.langkah === aktif.langkah.length - 1
    return (
      <div className="panel-skenario aktif">
        <div className="baris-antara">
          <strong>
            Skenario {aktif.id}: {aktif.judul}
          </strong>
          <span className="kecil redup">
            langkah {state.ui.langkah + 1}/{aktif.langkah.length}
          </span>
        </div>
        <p>{l.teks}</p>
        <div className="baris">
          <button disabled={state.ui.langkah === 0} onClick={() => aksi.langkahSkenario(-1)}>
            ‹ Sebelumnya
          </button>
          {!terakhir && (
            <button className="utama" onClick={() => aksi.langkahSkenario(1)}>
              Lanjut ›
            </button>
          )}
          <button onClick={() => aksi.keluarSkenario()}>{terakhir ? 'Selesai' : 'Keluar'}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="panel-skenario">
      <div className="pembuka">
        <h1>Absen jujur, gaji rapi.</h1>
        <p>
          Pegawai absen cukup satu ketukan dari HP — tapi tidak bisa dari rumah dan tidak bisa dititipkan. Di akhir bulan, gaji dihitung otomatis dari
          kehadiran dan aturan yang Anda atur sendiri, lalu slip langsung terbit.
        </p>
      </div>
      <h4>Coba lewat cerita</h4>
      <div className="daftar-skenario">
        {SKENARIO.map((s) => (
          <button key={s.id} onClick={() => aksi.mulaiSkenario(s.id)}>
            <strong>
              {s.id}. {s.judul}
            </strong>
            <span className="kecil redup">{s.ringkas}</span>
          </button>
        ))}
      </div>
      <div className="kecil redup">Atau jelajahi bebas: ganti peran lewat “Lihat sebagai” di atas.</div>
    </div>
  )
}
