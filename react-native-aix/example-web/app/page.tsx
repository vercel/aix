'use client'
import { useEffect, useReducer } from 'react'
import styles from './page.module.css'
import { Aix, AixCell } from 'aix'

export default function Home() {
  const [mounted, onMount] = useReducer(() => true, false)
  useEffect(onMount, [])
  if (!mounted) return null
  return (
    <div className={styles.page}>
      <Aix mainScrollViewID='scroll-container' shouldStartAtEnd={true} style={{ flex: 1 }}>
        <div id='scroll-container' style={{ height: '100%', overflowY: 'auto' }}>
          {items.map((item) => (
            <AixCell
              style={{ height: 30, backgroundColor: item % 2 === 0 ? 'blue' : 'green' }}
              key={item}
              index={item}
              isLast={item === items.length - 1}
            >
              <div>{item}</div>
            </AixCell>
          ))}
        </div>
      </Aix>
    </div>
  )
}

const items = Array.from({ length: 4 }, (_, index) => index)
