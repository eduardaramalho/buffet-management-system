import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { AppRoutes } from './routes/AppRoutes'
import './App.css'

function App() { return <BrowserRouter><AuthProvider><ToastProvider><AppRoutes /></ToastProvider></AuthProvider></BrowserRouter> }

export default App
