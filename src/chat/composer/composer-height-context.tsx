import { useSharedValue, type SharedValue } from 'react-native-reanimated'
import { createContext, useContext } from 'react'

type ComposerHeightContextType = {
  composerHeight: SharedValue<number>
}

const ComposerHeightContext = createContext<ComposerHeightContextType>(
  undefined as any
)

export const ComposerHeightContextProvider = ({
  children,
  initialHeight,
}: {
  children: React.ReactNode
  initialHeight: number
}) => {
  const composerHeight = useSharedValue(initialHeight)

  const ctxValue: ComposerHeightContextType = {
    composerHeight,
  }

  return (
    <ComposerHeightContext.Provider value={ctxValue}>
      {children}
    </ComposerHeightContext.Provider>
  )
}

export function useComposerHeightContext() {
  return useContext(ComposerHeightContext)
}
