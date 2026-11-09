import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PenyediaDemo } from './penyimpanan/toko.jsx'
import App from './App.jsx'
import './gaya.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PenyediaDemo>
      <App />
    </PenyediaDemo>
  </StrictMode>,
)
