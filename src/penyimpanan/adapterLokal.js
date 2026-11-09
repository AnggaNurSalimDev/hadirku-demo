// Adapter penyimpanan demo: localStorage.
// Di sistem asli, adapter ini diganti adapter API ke server — logika & tampilan tidak berubah.

const KUNCI = 'hadirku-demo'

export function muat(versi) {
  try {
    const teks = globalThis.localStorage?.getItem(KUNCI)
    if (!teks) return null
    const data = JSON.parse(teks)
    if (!data || data.versi !== versi) return null // struktur lama → mulai ulang
    return data
  } catch {
    return null
  }
}

export function simpan(state) {
  try {
    globalThis.localStorage?.setItem(KUNCI, JSON.stringify(state))
  } catch {
    // penyimpanan penuh / diblokir: demo tetap jalan di memori
  }
}

export function hapus() {
  try {
    globalThis.localStorage?.removeItem(KUNCI)
  } catch {
    // abaikan
  }
}
