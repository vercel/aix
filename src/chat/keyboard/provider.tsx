import { Keyboard } from 'react-native'
import { createContext, useContext, useEffect, useMemo } from 'react'
import { useSharedValue, type SharedValue } from 'react-native-reanimated'

// This is a custom keyboard state context where we can only update the state from the "didShow" events
// And we can manually set the state to false when we want consumers to know that the keyboard is hidden
interface KeyboardStateContextType {
  keyboardState: SharedValue<'didHide' | 'didShow' | 'willHide' | 'willShow'>
  keyboardStateActual: SharedValue<
    'didHide' | 'didShow' | 'willHide' | 'willShow'
  >
  keyboardHeight: SharedValue<number>
  shouldOffsetCloseKeyboard: SharedValue<boolean>
  setKeyboardState: (
    state: 'didHide' | 'didShow' | 'willHide' | 'willShow'
  ) => void
}

const KeyboardStateContext = createContext<KeyboardStateContextType>({} as any)

export function KeyboardStateProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const keyboardHeight = useSharedValue(0)
  const keyboardState = useSharedValue<
    'didHide' | 'didShow' | 'willHide' | 'willShow'
  >('didHide')
  const keyboardStateActual = useSharedValue<
    'didHide' | 'didShow' | 'willHide' | 'willShow'
  >('didHide')
  const shouldOffsetCloseKeyboard = useSharedValue(true)
  const value = useMemo<KeyboardStateContextType>(
    () => ({
      keyboardState,
      keyboardStateActual,
      keyboardHeight,
      shouldOffsetCloseKeyboard,
      setKeyboardState: (state) => {
        keyboardState.set(state)
      },
    }),
    [
      keyboardState,
      keyboardStateActual,
      shouldOffsetCloseKeyboard,
      keyboardHeight,
    ]
  )

  useEffect(() => {
    const willShowListener = Keyboard.addListener('keyboardWillShow', (e) => {
      keyboardHeight.set(e.endCoordinates.height)
      keyboardState.set('willShow')
      keyboardStateActual.set('willShow')
    })
    const didShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      keyboardHeight.set(e.endCoordinates.height)
      keyboardState.set('didShow')
      keyboardStateActual.set('didShow')
    })
    const willHideListener = Keyboard.addListener('keyboardWillHide', (e) => {
      const height = e.startCoordinates?.height
      if (height) {
        keyboardHeight.set(height)
      }
      keyboardState.set('willHide')
      keyboardStateActual.set('willHide')
    })
    const didHideListener = Keyboard.addListener('keyboardDidHide', (e) => {
      keyboardState.set('didHide')
      keyboardStateActual.set('didHide')
    })

    return () => {
      willShowListener.remove()
      didShowListener.remove()
      willHideListener.remove()
      didHideListener.remove()
    }
  }, [keyboardHeight, keyboardState, keyboardStateActual])

  return (
    <KeyboardStateContext.Provider value={value}>
      {children}
    </KeyboardStateContext.Provider>
  )
}

export function useKeyboardContextState() {
  return useContext(KeyboardStateContext)
}
