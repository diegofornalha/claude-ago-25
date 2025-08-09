import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

// biome-ignore lint/style/noNonNullAssertion: needed by React
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)