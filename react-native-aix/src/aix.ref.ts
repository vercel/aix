import type { HybridRef } from 'react-native-nitro-modules'
import type { AixProps, AixMethods } from './views/aix.nitro'
import { useRef } from 'react'

export type AixRef = HybridRef<AixProps, AixMethods>

export function useAixRef() {
  return useRef<AixRef | null>(null)
}
