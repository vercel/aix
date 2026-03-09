'use client'
import { useEffect, useReducer, useState } from 'react'
import styles from './page.module.css'
import { Aix, AixCell } from 'aix'

const heights = Array.from({ length: 200 }, () => Math.max(30, Math.random() * 100))

export default function Home() {
  const [mounted, onMount] = useReducer(() => true, false)
  const [length, setLength] = useState(10)
  const [scrollToIndex, setScrollToIndex] = useState<number | undefined>()
  function sendMessage() {
    setLength((length) => length + 2)
    setScrollToIndex(length + 1)
  }
  useEffect(onMount, [])
  if (!mounted) return null
  return (
    <div className={styles.page}>
      <Aix
        debug='all'
        mainScrollViewID='scroll-container'
        shouldStartAtEnd={true}
        style={{ flex: 1 }}
        scrollToIndex={scrollToIndex}
        onDidScrollToIndex={() => setScrollToIndex(undefined)}
      >
        <div id='scroll-container' style={{ height: '100%', overflowY: 'auto' }}>
          {Array.from({ length }, (_, index) => index).map((item) => (
            <AixCell
              style={{
                height: heights[item] ?? 30,
                backgroundColor: item % 2 === 0 ? 'blue' : 'green',
              }}
              key={item}
              index={item}
              isLast={item === length - 1}
            >
              <div>{item}</div>
            </AixCell>
          ))}
        </div>
      </Aix>
      <button
        onClick={sendMessage}
        style={{ position: 'absolute', bottom: 0, left: 0, margin: 16, right: 0, height: 48 }}
      >
        Send Message
      </button>
    </div>
  )
}

const items = Array.from({ length: 4 }, (_, index) => index)
