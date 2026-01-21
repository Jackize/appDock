import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Containers } from './pages/Containers'
import { Images } from './pages/Images'
import { Networks } from './pages/Networks'
import { Volumes } from './pages/Volumes'
import { Toaster } from './components/ui/Toaster'

function App() {
  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/containers" element={<Containers />} />
          <Route path="/images" element={<Images />} />
          <Route path="/networks" element={<Networks />} />
          <Route path="/volumes" element={<Volumes />} />
        </Routes>
      </Layout>
      <Toaster />
    </>
  )
}

export default App


