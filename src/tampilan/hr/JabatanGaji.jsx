import { useState } from 'react'
import { useDemo } from '../../penyimpanan/toko.jsx'
import * as pilih from '../../penyimpanan/pilih.js'
import { komponenUntukJabatan } from '../../logika/gaji.js'
import { boleh, AKSI } from '../../logika/wewenang.js'
import { rentangPeriode, kunciPeriode, namaPeriode, kunciTanggal, wib } from '../../logika/waktu.js'
import { rupiah, Pesan } from '../umum.jsx'

const ringkasNilai = (k, n) => {
  if (k.jenis === 'NOMINAL') return `${rupiah(n.nilai)} ${{ SEKALI: 'tetap', PER_HADIR: '× hadir', PER_JAM: '× jam kerja' }[n.satuan]}`
  if (k.jenis === 'PERSEN') return `${n.nilai}% dari ${k.basis.toLowerCase()}${n.batasAtas ? `, maks ${rupiah(n.batasAtas)}` : ''}`
  return `tabel ${n.parameter.rentang.length} rentang, dari ${k.basis.toLowerCase()}`
}

export default function JabatanGaji() {
  const { state } = useDemo()
  const [dipilih, setDipilih] = useState(null)
  const sekarang = state.jamDemo

  return (
    <div>
      <h3>Jabatan & Gaji</h3>
      <div className="kartu-jabatan">
        {state.jabatan.map((j) => {
          const a = pilih.aturanBerlaku(state, j.id, sekarang)
          const komp = komponenUntukJabatan(state.komponen, state.komponenJabatan, j.id, sekarang)
          const jumlah = state.pengguna.filter((p) => p.jabatanId === j.id && p.status === 'AKTIF').length
          return (
            <button key={j.id} className={`kartu kartu-klik ${dipilih === j.id ? 'aktif' : ''}`} onClick={() => setDipilih(j.id)}>
              <strong>{j.nama}</strong>
              <div className="kecil">
                {a ? `${a.skema === 'HARIAN' ? 'Harian' : 'Bulanan'}, ${rupiah(a.nilaiDasar)}` : 'belum diatur'}
              </div>
              <div className="kecil redup">{jumlah} pegawai</div>
              {komp.map(({ komponen }) => (
                <div key={komponen.id} className="kecil">
                  {komponen.arah === 'TAMBAH' ? '+' : '−'} {komponen.nama}
                  {komponen.ditanggung === 'PERUSAHAAN' ? ' (info)' : ''}
                </div>
              ))}
            </button>
          )
        })}
      </div>
      {dipilih && <PanelJabatan key={dipilih} jabatanId={dipilih} />}
    </div>
  )
}

function PanelJabatan({ jabatanId }) {
  const { state, aksi } = useDemo()
  const p = pilih.pelaku(state)
  const bisaUbah = boleh(p, AKSI.UBAH_ATURAN_GAJI)
  const jabatan = pilih.cariJabatan(state, jabatanId)
  const aturanAsli = pilih.aturanBerlaku(state, jabatanId, state.jamDemo)
  const kompAsli = komponenUntukJabatan(state.komponen, state.komponenJabatan, jabatanId, state.jamDemo)

  // Draft: diedit bebas, belum tersimpan sampai "Simpan"
  const [aturan, setAturan] = useState(aturanAsli)
  const [nilai, setNilai] = useState(() => Object.fromEntries(kompAsli.map((x) => [x.komponen.id, x.nilai])))
  const [baru, setBaru] = useState(null)
  const awalBulan = rentangPeriode(kunciPeriode(state.jamDemo)).mulai
  const [berlaku, setBerlaku] = useState(kunciTanggal(awalBulan))
  const [hasil, setHasil] = useState(null)
  const pegawai = state.pengguna.filter((x) => x.jabatanId === jabatanId && x.status === 'AKTIF')
  const [pegawaiUji, setPegawaiUji] = useState(pegawai[0]?.id ?? null)
  const [uji, setUji] = useState(null)

  const tanggalBerlaku = () => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(berlaku)
    return m ? wib(+m[1], +m[2], +m[3]) : null
  }

  const daftarDraft = () => {
    const list = kompAsli.map((x) => ({ komponen: x.komponen, nilai: nilai[x.komponen.id] }))
    if (baru) list.push({ komponen: baru.komponen, nilai: baru.nilai })
    return list
  }

  const cobaHitung = () => {
    const peg = pilih.cariPengguna(state, Number(pegawaiUji))
    if (!peg) return
    const periode = pilih.periodeTerakhirSelesai(state)
    try {
      const sebelum = pilih.dataGaji(state, peg, periode)
      const sesudah = pilih.dataGaji(state, peg, periode, { aturan, komponenList: daftarDraft() })
      setUji({ periode, peg, sebelum: sebelum.hasil, sesudah: sesudah.hasil })
    } catch (e) {
      setUji({ galat: e.message })
    }
  }

  const simpan = () => {
    const t = tanggalBerlaku()
    if (t === null) return setHasil({ ok: false, alasan: 'Tanggal berlaku tidak valid.' })
    const ubahAturan = JSON.stringify({ ...aturan, berlakuMulai: 0, id: 0 }) !== JSON.stringify({ ...aturanAsli, berlakuMulai: 0, id: 0 })
    let jumlah = 0
    if (ubahAturan) {
      const h = aksi.simpanAturanJabatan({ ...aturan, jabatanId, berlakuMulai: t })
      if (!h.ok) return setHasil(h)
      jumlah++
    }
    for (const x of kompAsli) {
      const n = nilai[x.komponen.id]
      if (JSON.stringify(n) === JSON.stringify(x.nilai)) continue
      const { id: _id, ...isi } = n
      const h = aksi.simpanNilaiKomponen({ komponenId: x.komponen.id, nilai: { ...isi, jabatanId, berlakuMulai: t } })
      if (!h.ok) return setHasil(h)
      jumlah++
    }
    if (baru) {
      const h = aksi.simpanNilaiKomponen({ komponenBaru: baru.komponen, nilai: { ...baru.nilai, jabatanId, berlakuMulai: t } })
      if (!h.ok) return setHasil(h)
      setBaru(null)
      jumlah++
    }
    setHasil(jumlah ? { ok: true, teks: `${jumlah} perubahan disimpan sebagai versi baru (berlaku ${berlaku}).` } : { ok: false, alasan: 'Tidak ada perubahan.' })
  }

  if (!aturan) return <p>Jabatan belum punya aturan.</p>
  const angka = (k) => (e) => setAturan({ ...aturan, [k]: Number(e.target.value) })

  return (
    <div className="kartu panel-jabatan">
      <h4>{jabatan.nama}</h4>
      {!bisaUbah && <p className="kecil redup">Mode lihat. Hanya Kepala HR yang bisa mengubah aturan gaji.</p>}
      <fieldset disabled={!bisaUbah}>
        <div className="grid-form">
          <label>
            Skema
            <select value={aturan.skema} onChange={(e) => setAturan({ ...aturan, skema: e.target.value })}>
              <option value="HARIAN">Harian</option>
              <option value="BULANAN">Bulanan</option>
            </select>
          </label>
          <label>
            {aturan.skema === 'HARIAN' ? 'Upah per hari' : 'Gaji pokok'}
            <input type="number" min="0" value={aturan.nilaiDasar} onChange={angka('nilaiDasar')} />
          </label>
          <label>
            Lembur / jam
            <input type="number" min="0" value={aturan.tarifLemburJam} onChange={angka('tarifLemburJam')} />
          </label>
          <label>
            Potong telat / menit
            <input type="number" min="0" value={aturan.potongTelatMenit} onChange={angka('potongTelatMenit')} />
          </label>
          <label>
            Potong bolos / hari
            <input type="number" min="0" value={aturan.potongBolos} onChange={angka('potongBolos')} />
          </label>
        </div>

        <h5>Komponen</h5>
        {kompAsli.map(({ komponen }) => (
          <EditorNilai
            key={komponen.id}
            komponen={komponen}
            nilai={nilai[komponen.id]}
            ubah={(n) => setNilai({ ...nilai, [komponen.id]: n })}
          />
        ))}
        {baru ? (
          <KomponenBaru baru={baru} setBaru={setBaru} />
        ) : (
          <button
            className="kecil"
            onClick={() =>
              setBaru({
                komponen: { nama: '', arah: 'TAMBAH', jenis: 'NOMINAL', basis: 'POKOK', ditanggung: 'PEGAWAI' },
                nilai: { nilai: 0, satuan: 'SEKALI', batasAtas: null, parameter: null },
              })
            }
          >
            + Tambah komponen
          </button>
        )}

        <div className="baris">
          <label>
            Berlaku mulai
            <input type="date" value={berlaku} onChange={(e) => setBerlaku(e.target.value)} />
          </label>
          <button className="utama" onClick={simpan}>
            Simpan sebagai versi baru
          </button>
        </div>
      </fieldset>
      <Pesan hasil={hasil} />

      <div className="coba-hitung">
        <div className="baris">
          <span className="kecil">Coba hitung untuk</span>
          <select value={pegawaiUji ?? ''} onChange={(e) => setPegawaiUji(e.target.value)}>
            {pegawai.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nama}
              </option>
            ))}
          </select>
          <button onClick={cobaHitung} disabled={!pegawaiUji}>
            Coba hitung
          </button>
        </div>
        {uji?.galat && <div className="pesan pesan-gagal">✗ {uji.galat}</div>}
        {uji && !uji.galat && (
          <div className="kecil">
            {uji.peg.nama}, {namaPeriode(uji.periode)} (data kehadiran nyata)
            <div className="baris-antara">
              <span>Sekarang</span>
              <strong>{uji.sebelum.valid ? rupiah(uji.sebelum.rincian.takeHome) : uji.sebelum.alasan}</strong>
            </div>
            <div className="baris-antara">
              <span>Dengan draft ini</span>
              <strong>{uji.sesudah.valid ? rupiah(uji.sesudah.rincian.takeHome) : '✗ ' + uji.sesudah.alasan}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function EditorNilai({ komponen, nilai, ubah }) {
  const n = nilai
  return (
    <div className="editor-nilai">
      <span>
        {komponen.arah === 'TAMBAH' ? '+' : '−'} {komponen.nama}
        {komponen.ditanggung === 'PERUSAHAAN' && <span className="redup kecil"> (ditanggung perusahaan)</span>}
      </span>
      {komponen.jenis === 'NOMINAL' && (
        <span className="baris">
          <input type="number" min="0" value={n.nilai} onChange={(e) => ubah({ ...n, nilai: Number(e.target.value) })} />
          <select value={n.satuan} onChange={(e) => ubah({ ...n, satuan: e.target.value })}>
            <option value="SEKALI">tetap</option>
            <option value="PER_HADIR">× hari hadir</option>
            <option value="PER_JAM">× jam kerja</option>
          </select>
        </span>
      )}
      {komponen.jenis === 'PERSEN' && (
        <span className="baris">
          <input type="number" min="0" max="100" step="0.1" value={n.nilai} onChange={(e) => ubah({ ...n, nilai: Number(e.target.value) })} />
          <span className="kecil">% dari {komponen.basis.toLowerCase()}, maks</span>
          <input
            type="number"
            min="0"
            placeholder="tanpa batas"
            value={n.batasAtas ?? ''}
            onChange={(e) => ubah({ ...n, batasAtas: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </span>
      )}
      {komponen.jenis === 'TABEL' && <EditorTabel nilai={n} ubah={ubah} basis={komponen.basis} />}
      <span className="kecil redup">{ringkasNilai(komponen, n)}</span>
    </div>
  )
}

function EditorTabel({ nilai, ubah, basis }) {
  const r = nilai.parameter?.rentang ?? []
  const set = (i, k, v) => {
    const salin = r.map((x) => ({ ...x }))
    salin[i][k] = v
    if (k === 'max' && salin[i + 1]) salin[i + 1].min = v // jaga rentang tetap menyambung
    ubah({ ...nilai, parameter: { rentang: salin } })
  }
  return (
    <div className="kecil">
      <div className="redup">Rentang {basis.toLowerCase()} → tarif %</div>
      {r.map((x, i) => (
        <div key={i} className="baris">
          <span>{rupiah(x.min)} –</span>
          <input
            type="number"
            placeholder="tanpa batas"
            value={x.max ?? ''}
            onChange={(e) => set(i, 'max', e.target.value === '' ? null : Number(e.target.value))}
          />
          <input type="number" min="0" max="100" step="0.1" value={x.tarif} onChange={(e) => set(i, 'tarif', Number(e.target.value))} />%
        </div>
      ))}
      <button
        className="kecil"
        onClick={() => {
          const akhir = r[r.length - 1]
          if (akhir?.max === null) return
          ubah({ ...nilai, parameter: { rentang: [...r, { min: akhir ? akhir.max : 0, max: null, tarif: 0 }] } })
        }}
      >
        + rentang
      </button>
    </div>
  )
}

function KomponenBaru({ baru, setBaru }) {
  const k = baru.komponen
  const setK = (isi) => {
    const komponen = { ...k, ...isi }
    let nilai = baru.nilai
    if (isi.jenis === 'TABEL') nilai = { ...nilai, parameter: { rentang: [{ min: 0, max: null, tarif: 0 }] } }
    if (isi.jenis && isi.jenis !== 'TABEL') nilai = { ...nilai, parameter: null }
    if (isi.arah === 'TAMBAH') komponen.ditanggung = 'PEGAWAI'
    setBaru({ komponen, nilai })
  }
  return (
    <div className="kartu komponen-baru">
      <div className="grid-form">
        <label>
          Nama
          <input value={k.nama} onChange={(e) => setK({ nama: e.target.value })} placeholder="mis. Iuran koperasi" />
        </label>
        <label>
          Arah
          <select value={k.arah} onChange={(e) => setK({ arah: e.target.value })}>
            <option value="TAMBAH">Tambah</option>
            <option value="KURANG">Kurang</option>
          </select>
        </label>
        <label>
          Jenis
          <select value={k.jenis} onChange={(e) => setK({ jenis: e.target.value })}>
            <option value="NOMINAL">Nominal</option>
            <option value="PERSEN">Persen</option>
            <option value="TABEL">Tabel</option>
            <option value="RUMUS" disabled>
              Rumus (segera)
            </option>
          </select>
        </label>
        <label>
          Basis
          <select value={k.basis} onChange={(e) => setK({ basis: e.target.value })}>
            <option value="POKOK">Gaji pokok</option>
            <option value="BRUTO">Bruto</option>
          </select>
        </label>
        {k.arah === 'KURANG' && (
          <label>
            Ditanggung
            <select value={k.ditanggung} onChange={(e) => setK({ ditanggung: e.target.value })}>
              <option value="PEGAWAI">Pegawai (memotong gaji)</option>
              <option value="PERUSAHAAN">Perusahaan (info di slip)</option>
            </select>
          </label>
        )}
      </div>
      <EditorNilai komponen={{ ...k, nama: k.nama || '(komponen baru)' }} nilai={baru.nilai} ubah={(n) => setBaru({ ...baru, nilai: n })} />
      <button className="kecil" onClick={() => setBaru(null)}>
        Batal
      </button>
    </div>
  )
}
