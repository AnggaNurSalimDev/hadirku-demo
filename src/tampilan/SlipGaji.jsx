import { namaPeriode } from '../logika/waktu.js'
import { rupiah } from './umum.jsx'

/** Slip dirender dari snapshot beku — tidak pernah dihitung ulang. */
export default function SlipGaji({ slip }) {
  if (!slip) return null
  const { pegawai, periode, kehadiran, rincian } = slip.snapshot
  const Baris = ({ x, minus }) => (
    <tr>
      <td>
        {x.label}
        <div className="redup kecil">{x.keterangan}</div>
      </td>
      <td className="angka">{minus ? '−' : ''}{rupiah(x.jumlah)}</td>
    </tr>
  )
  return (
    <div className="slip" id="slip-cetak">
      <div className="slip-kepala">
        <strong>Slip gaji</strong>
        <span>{namaPeriode(periode)}{slip.versi > 1 ? `, Revisi ${slip.versi}` : ''}</span>
      </div>
      <div className="kecil">
        {pegawai.nama}, {pegawai.jabatan}
      </div>
      <table>
        <tbody>
          <tr className="judul-baris">
            <td colSpan={2}>Pendapatan</td>
          </tr>
          {rincian.pendapatan.map((x) => (
            <Baris key={x.label} x={x} />
          ))}
          <tr className="total">
            <td>Bruto</td>
            <td className="angka">{rupiah(rincian.bruto)}</td>
          </tr>
          <tr className="judul-baris">
            <td colSpan={2}>Potongan</td>
          </tr>
          {rincian.potonganPegawai.length === 0 && (
            <tr>
              <td colSpan={2} className="redup">Tidak ada</td>
            </tr>
          )}
          {rincian.potonganPegawai.map((x) => (
            <Baris key={x.label} x={x} minus />
          ))}
          <tr className="total besar">
            <td>Take-home pay</td>
            <td className="angka">{rupiah(rincian.takeHome)}</td>
          </tr>
        </tbody>
      </table>
      <div className="kecil">
        Kehadiran: hadir {kehadiran.hadir}, telat {kehadiran.telatMenit} mnt, lembur {kehadiran.lemburJam} j, bolos {kehadiran.bolos}
      </div>
      {rincian.infoPerusahaan.length > 0 && (
        <div className="info-kotak kecil">
          <strong>Ditanggung perusahaan, tidak memotong gaji</strong>
          {rincian.infoPerusahaan.map((x) => (
            <div key={x.label} className="baris-antara">
              <span>{x.label}</span>
              <span>{rupiah(x.jumlah)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="kecil redup">Dihitung berdasarkan komponen yang diatur perusahaan.</div>
    </div>
  )
}
