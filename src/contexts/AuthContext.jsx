import { createContext, useContext, useEffect, useState } from "react"
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth"
import { doc, onSnapshot } from "firebase/firestore"
import { auth, db } from "../firebase/config"

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userDoc, setUserDoc] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubDoc = null

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const tokenResult = await firebaseUser.getIdTokenResult(true)
        const claimRole = tokenResult.claims.role || null
        setUser(firebaseUser)
        setRole(claimRole)

        unsubDoc = onSnapshot(doc(db, "users", firebaseUser.uid), (snap) => {
          if (snap.exists()) {
            const docData = { id: snap.id, ...snap.data() }
            setUserDoc(docData)
            if (!claimRole && docData.role) setRole(docData.role)
          }
        })
      } else {
        setUser(null)
        setRole(null)
        setUserDoc(null)
        if (unsubDoc) unsubDoc()
      }
      setLoading(false)
    })

    return () => {
      unsubAuth()
      if (unsubDoc) unsubDoc()
    }
  }, [])

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password)
  const logout = () => signOut(auth)

  return (
    <AuthContext.Provider value={{ user, userDoc, role, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
