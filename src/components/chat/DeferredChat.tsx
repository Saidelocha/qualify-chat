'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import type { ChatProps } from './Chat'

// The chat pulls in some weight — load it off the critical path.
const Chat = dynamic(() => import('./Chat'), { ssr: false })

const FALLBACK_DELAY_MS = 3500

export default function DeferredChat(props: ChatProps) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const load = () => setReady(true)
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(load, { timeout: FALLBACK_DELAY_MS })
      return () => window.cancelIdleCallback(id)
    }
    const id = setTimeout(load, FALLBACK_DELAY_MS)
    return () => clearTimeout(id)
  }, [])

  return ready ? <Chat {...props} /> : null
}
