import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { createUsePool } from './createUsePool'
import { createUseStaggered } from './createUseStaggered'
import Animated from 'react-native-reanimated'
import { Children, memo, useState } from 'react'

const useIsAnimatedInPool = createUsePool()
const useStaggeredAnimation = createUseStaggered(32)

function FadeIn({
  children,
  onFadedIn,
  Component = Animated.Text as any,
}: {
  children: React.ReactNode
  onFadedIn: () => void
  Component?: React.ComponentType<any>
}) {
  const progress = useSharedValue(0)

  const startAnimation = () => {
    progress.set(withTiming(1, { duration: 500 }))
    setTimeout(onFadedIn, 500)
  }

  useStaggeredAnimation(startAnimation)

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
  }))

  return <Component style={animatedStyle}>{children}</Component>
}

const AnimatedFadeInText = memo(function AnimatedFadeInText(props: {
  text: string
}) {
  const chunks = props.text.split(' ')

  return chunks.map((chunk, i) => {
    if (i < chunks.length - 1) chunk += ' '

    return <TextFadeInStaggered key={i} text={chunk} />
  })
})

export const TextFadeInStaggeredIfStreaming = memo(
  function TextFadeInStaggeredIfStreaming({
    children: childrenProp,
    disabled,
  }: {
    children: React.ReactNode
    disabled: boolean
  }) {
    const [enabled] = useState(!disabled)

    let children = childrenProp
    if (enabled && children) {
      if (Array.isArray(children)) {
        children = Children.map(children, (child, i) =>
          typeof child === 'string' ? (
            <AnimatedFadeInText key={i} text={child} />
          ) : (
            child
          )
        )
      } else if (typeof children === 'string') {
        children = <AnimatedFadeInText text={children} />
      }
    }

    return children
  }
)

const TextFadeInStaggered = memo(function TextFadeInStaggered({
  text,
}: {
  text: string
}) {
  const { isActive, evict } = useIsAnimatedInPool()
  return isActive ? (
    <FadeIn
      onFadedIn={() => {
        evict()
      }}
    >
      {text}
    </FadeIn>
  ) : (
    text
  )
})
