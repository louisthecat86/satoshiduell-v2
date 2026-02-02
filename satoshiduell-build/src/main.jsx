import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
// WICHTIG: Hast du diesen Import?
import { AuthProvider } from './hooks/useAuth' 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* WICHTIG: Ist App hier eingewickelt? */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)