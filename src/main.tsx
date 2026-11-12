import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './components/elevator/elevator.css'
import App from './App.tsx'
import { loadAnalytics } from './analytics'
import { watchVisibleHeight } from './viewport'

loadAnalytics()
watchVisibleHeight()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
