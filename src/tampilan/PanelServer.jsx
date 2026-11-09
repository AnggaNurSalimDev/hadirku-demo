import { useDemo } from '../penyimpanan/toko.jsx'
import { jamMenit } from '../logika/waktu.js'

export default function PanelServer() {
  const { state, aksi } = useDemo()
  const terakhir = state.log[0]

  if (!state.ui.lapis2) {
    return (
      <div className="panel">
        {terakhir ? (
          <div className={terakhir.ok ? 'teks-ok' : 'teks-gagal'}>
            {terakhir.ok ? '✓' : '✗'} {terakhir.judul}: {terakhir.pesan}
          </div>
        ) : (
          <div className="redup kecil">Hasil setiap tindakan akan muncul di sini.</div>
        )}
        <button className="tautan" onClick={() => aksi.aturUi({ lapis2: true })}>
          🔍 Lihat cara kerja
        </button>
      </div>
    )
  }

  return (
    <div className="panel panel-server">
      <div className="baris-antara">
        <div className="judul-panel">📋 Yang terjadi di server</div>
        <button className="tautan" onClick={() => aksi.aturUi({ lapis2: false })}>
          Sembunyikan
        </button>
      </div>
      {state.log.length === 0 && <div className="redup kecil">Belum ada tindakan.</div>}
      {state.log.slice(0, 6).map((l, i) => (
        <div key={l.id} className={`log ${i === 0 ? 'log-baru' : ''}`}>
          <div className="baris-antara kecil">
            <strong>{l.judul}</strong>
            <span className="redup">{jamMenit(l.waktu)}</span>
          </div>
          {l.langkah?.map((x, j) => (
            <div key={j} className={`kecil ${x.ok ? 'teks-ok' : 'teks-gagal'}`}>
              {x.ok ? '✓' : '✗'} {x.teks}
            </div>
          ))}
          <div className={`kecil ${l.ok ? 'teks-ok' : 'teks-gagal'}`}>→ {l.pesan}</div>
        </div>
      ))}
      <div className="kecil redup">
        Rancangan lengkap (tabel data, keamanan):{' '}
        <a href="https://github.com/AnggaNurSalimDev/hadirku-demo/blob/main/docs/rancangan-web-absensi.md" target="_blank" rel="noreferrer">
          docs/rancangan-web-absensi.md
        </a>
      </div>
    </div>
  )
}
