import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PenyediaDemo } from './penyimpanan/toko.jsx'
import App from './App.jsx'
import '@fontsource/atkinson-hyperlegible-next/400.css'
import '@fontsource/atkinson-hyperlegible-next/600.css'
import '@fontsource/atkinson-hyperlegible-next/700.css'
import '@fontsource/atkinson-hyperlegible-next/800.css'
import '@fontsource/doto/800.css'
import './gaya.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PenyediaDemo>
      <App />
    </PenyediaDemo>
  </StrictMode>,
)
