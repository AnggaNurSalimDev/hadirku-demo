import { useEffect, useState } from 'react'
import { hitungKode, periodeTotp, sisaDetik } from '../logika/totp.js'

export const rupiah = (n) => 'Rp' + Math.round(n ?? 0).toLocaleString('id-ID')

export function Lencana({ jenis = 'netral', children }) {
  return <span className={`lencana lencana-${jenis}`}>{children}</span>
}

export function Pesan({ hasil }) {
  if (!hasil) return null
  return <div className={`pesan ${hasil.ok ? 'pesan-ok' : 'pesan-gagal'}`}>{hasil.ok ? '✓ ' + (hasil.teks ?? 'Berhasil') : '✗ ' + hasil.alasan}</div>
}

/** Kode TOTP yang sedang tampil di HP lokasi (jam nyata, berganti tiap 30 detik). */
export function useKodeTotp(rahasia) {
  const [kode, setKode] = useState(null)
  const [sisa, setSisa] = useState(() => sisaDetik(Date.now()))
  useEffect(() => {
    let batal = false
    let periodeTerakhir = null
    const segarkan = async () => {
      const now = Date.now()
      setSisa(sisaDetik(now))
      const p = periodeTotp(now)
      if (p === periodeTerakhir) return
      periodeTerakhir = p
      try {
        const k = await hitungKode(rahasia, p)
        if (!batal) setKode(k)
      } catch {
        if (!batal) setKode(null)
      }
    }
    segarkan()
    const t = setInterval(segarkan, 1000)
    return () => {
      batal = true
      clearInterval(t)
    }
  }, [rahasia])
  return { kode, sisa }
}

/** Ubah 'HH:MM' pada hari tertentu (awal hari ms WIB) menjadi epoch ms. */
export function gabungJam(awalHariMs, hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '')
  if (!m) return null
  const jam = Number(m[1])
  const menit = Number(m[2])
  if (jam > 23 || menit > 59) return null
  return awalHariMs + (jam * 60 + menit) * 60 * 1000
}
