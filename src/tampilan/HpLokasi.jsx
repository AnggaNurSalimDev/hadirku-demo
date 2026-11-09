import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useDemo } from '../penyimpanan/toko.jsx'
import * as pilih from '../penyimpanan/pilih.js'
import { useKodeTotp } from './umum.jsx'
import { LANGKAH_DETIK } from '../logika/totp.js'

export default function HpLokasi() {
  const { state, aksi } = useDemo()
  const lokasi = pilih.lokasiUtama(state)
  const { kode, sisa } = useKodeTotp(lokasi.totpSecret)
  const [qr, setQr] = useState(null)

  useEffect(() => {
    if (!kode) return
    let batal = false
    QRCode.toDataURL(kode, { margin: 1, width: 120 })
      .then((url) => !batal && setQr(url))
      .catch(() => !batal && setQr(null))
    return () => {
      batal = true
    }
  }, [kode])

  return (
    <div className="panel hp-lokasi">
      <div className="judul-panel">HP Lokasi, {lokasi.nama}</div>
      <div className="totp">
        <div>
          <div className="kode">{kode ? `${kode.slice(0, 3)} ${kode.slice(3)}` : '—'}</div>
          <div className="bilah">
            <div style={{ width: `${(sisa / LANGKAH_DETIK) * 100}%` }} />
          </div>
          <div className="kecil redup">berganti dalam {sisa} dtk, kunci v{lokasi.versiKunci}</div>
        </div>
        {qr && <img src={qr} alt={`QR berisi kode ${kode}`} width={96} height={96} />}
      </div>
      <div className="kecil redup">Angka dan QR berisi kode yang sama. Kode dihitung sungguhan (TOTP) di browser.</div>

      <div className="judul-kecil">Simulasi jaringan HP pegawai</div>
      <div className="saklar">
        <label>
          <input type="radio" checked={state.jaringan === 'KANTOR'} onChange={() => aksi.aturJaringan('KANTOR')} /> WiFi kantor
        </label>
        <label>
          <input type="radio" checked={state.jaringan === 'LUAR'} onChange={() => aksi.aturJaringan('LUAR')} /> Di luar / data seluler
        </label>
      </div>
    </div>
  )
}
