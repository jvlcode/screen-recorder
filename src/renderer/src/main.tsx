import './assets/main.css'

import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import Trim from './Trim'

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/trim" element={<Trim />} />
      </Routes>
    </HashRouter>
  // </StrictMode>
)
