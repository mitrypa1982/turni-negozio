import { useState } from 'react'
import { supabase } from './supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [messaggio, setMessaggio] = useState('')
  const [caricamento, setCaricamento] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setCaricamento(true)
    setMessaggio('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setMessaggio('❌ ' + error.message)
      setCaricamento(false)
    } else {
      window.location.reload()
    }
  }

  const handleRegistrazione = async () => {
    setCaricamento(true)
    setMessaggio('')
    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setMessaggio('❌ ' + error.message)
    } else {
      setMessaggio('✅ Registrazione avvenuta! Ora puoi accedere.')
    }
    setCaricamento(false)
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-800 mb-2">Turni Negozio</h1>
          <p className="text-gray-500">Accedi per gestire i tuoi turni</p>
        </div>
        
        <div className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              placeholder="mario@negozio.it"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-800 bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-800 bg-gray-50"
            />
          </div>
          
          <button 
            onClick={handleLogin}
            disabled={caricamento}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors cursor-pointer mt-2 disabled:opacity-50"
          >
            {caricamento ? 'Attendi...' : 'Accedi'}
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">oppure</span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>

          <button 
            onClick={handleRegistrazione}
            disabled={caricamento}
            className="w-full bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50 font-bold py-3 px-4 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            Crea un nuovo account
          </button>

          {messaggio && (
            <div className={`p-3 rounded-lg text-center text-sm font-medium ${messaggio.includes('❌') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {messaggio}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}