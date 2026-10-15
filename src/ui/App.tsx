import { useState } from 'react'
import Boot from './Boot'
import Shell from './Shell'

export default function App() {
  const [booted, setBooted] = useState(false)
  return booted ? <Shell /> : <Boot onDone={() => setBooted(true)} />
}
