import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

if (import.meta.env.DEV) import('./dev/testHooks')

// No StrictMode: its double-mount would create and tear down the physics world twice per run.
createRoot(document.getElementById('root')!).render(<App />)
