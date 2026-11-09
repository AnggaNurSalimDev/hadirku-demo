// TOTP (RFC 6238) — dihitung sungguhan memakai WebCrypto.
// Fungsi menerima `subtle` sebagai argumen supaya bisa diuji dan tidak bergantung pada global.

export const LANGKAH_DETIK = 30
export const DIGIT = 6

const ALFABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Decode(teks) {
  if (typeof teks !== 'string' || teks.length === 0) {
    throw new TypeError('rahasia TOTP harus string base32 tidak kosong')
  }
  const bersih = teks.toUpperCase().replace(/=+$/, '')
  let bit = 0
  let nilai = 0
  const keluar = []
  for (const huruf of bersih) {
    const idx = ALFABET.indexOf(huruf)
    if (idx === -1) throw new RangeError(`karakter base32 tidak valid: ${huruf}`)
    nilai = (nilai << 5) | idx
    bit += 5
    if (bit >= 8) {
      keluar.push((nilai >>> (bit - 8)) & 0xff)
      bit -= 8
    }
  }
  return new Uint8Array(keluar)
}

export function base32Encode(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
    throw new TypeError('bytes harus Uint8Array tidak kosong')
  }
  let bit = 0
  let nilai = 0
  let keluar = ''
  for (const b of bytes) {
    nilai = (nilai << 8) | b
    bit += 8
    while (bit >= 5) {
      keluar += ALFABET[(nilai >>> (bit - 5)) & 31]
      bit -= 5
    }
  }
  if (bit > 0) keluar += ALFABET[(nilai << (5 - bit)) & 31]
  return keluar
}

/** Nomor periode TOTP dari epoch ms. */
export function periodeTotp(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) throw new TypeError('waktu harus angka')
  return Math.floor(ms / 1000 / LANGKAH_DETIK)
}

/** Sisa detik sebelum kode berganti. */
export function sisaDetik(ms) {
  return LANGKAH_DETIK - (Math.floor(ms / 1000) % LANGKAH_DETIK)
}

/** Hitung kode 6 digit untuk satu periode. */
export async function hitungKode(rahasiaBase32, periode, subtle = globalThis.crypto?.subtle) {
  if (!subtle) throw new Error('WebCrypto tidak tersedia (butuh HTTPS atau localhost)')
  if (!Number.isInteger(periode) || periode < 0) throw new RangeError('periode harus bilangan bulat ≥ 0')

  const kunci = await subtle.importKey(
    'raw',
    base32Decode(rahasiaBase32),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const penghitung = new ArrayBuffer(8)
  const view = new DataView(penghitung)
  view.setUint32(0, Math.floor(periode / 2 ** 32))
  view.setUint32(4, periode >>> 0)

  const hmac = new Uint8Array(await subtle.sign('HMAC', kunci, penghitung))
  const geser = hmac[hmac.length - 1] & 0x0f
  const biner =
    ((hmac[geser] & 0x7f) << 24) |
    (hmac[geser + 1] << 16) |
    (hmac[geser + 2] << 8) |
    hmac[geser + 3]
  return String(biner % 10 ** DIGIT).padStart(DIGIT, '0')
}

/**
 * Kode untuk periode sekarang ±1 (toleransi jam meleset).
 * Hasil: { [periode]: kode }
 */
export async function kodeSekitar(rahasiaBase32, ms, subtle) {
  const p = periodeTotp(ms)
  const hasil = {}
  for (const periode of [p - 1, p, p + 1]) {
    hasil[periode] = await hitungKode(rahasiaBase32, periode, subtle)
  }
  return hasil
}
