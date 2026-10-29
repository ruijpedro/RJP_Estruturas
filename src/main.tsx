import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)


if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`, { updateViaCache: 'none' })
      await registration.update()
    } catch (error) {
      console.warn('Não foi possível ativar/atualizar o modo offline da WebApp.', error)
    }
  })
}
