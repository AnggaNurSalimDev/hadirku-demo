import { useDemo } from './penyimpanan/toko.jsx'
import * as pilih from './penyimpanan/pilih.js'
import BarAtas from './tampilan/BarAtas.jsx'
import PanelSkenario from './tampilan/PanelSkenario.jsx'
import AplikasiPegawai from './tampilan/pegawai/AplikasiPegawai.jsx'
import AplikasiHr from './tampilan/hr/AplikasiHr.jsx'
import HpLokasi from './tampilan/HpLokasi.jsx'
import PanelServer from './tampilan/PanelServer.jsx'

export default function App() {
  const { state } = useDemo()
  const pelaku = pilih.pelaku(state)
  const modeHr = pelaku?.peran !== 'PEGAWAI'

  return (
    <div className="aplikasi">
      <BarAtas />
      <PanelSkenario />
      <main className={`panggung ${modeHr ? 'mode-hr' : 'mode-pegawai'}`}>
        <div className="kolom-perangkat">
          <div className="label-perangkat">{modeHr ? '💻 Laptop HR' : '📱 HP Pegawai'}</div>
          {modeHr ? <AplikasiHr /> : <AplikasiPegawai />}
        </div>
        <div className="kolom-samping">
          <HpLokasi />
          <PanelServer />
        </div>
      </main>
      <footer className="kaki kecil redup">
        Demo Hadirku · semua data fiktif dan hanya tersimpan di browser ini · angka BPJS/pajak hanya contoh, bukan tarif resmi
      </footer>
    </div>
  )
}
