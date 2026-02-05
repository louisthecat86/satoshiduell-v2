import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
// WICHTIG: Hast du diesen Import?
import { AuthProvider } from './hooks/useAuth' 
import { TranslationProvider } from './hooks/useTranslation'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* WICHTIG: Ist App hier eingewickelt? */}
    <AuthProvider>
      <TranslationProvider>
        <App />
      </TranslationProvider>
    </AuthProvider>
  </React.StrictMode>,
)