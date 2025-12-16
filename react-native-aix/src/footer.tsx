import { getHostComponent } from 'react-native-nitro-modules'
import AixComposerConfig from '../nitrogen/generated/shared/json/AixComposerConfig.json'
import type { AixComposerProps } from './views/aix.nitro'
import { StyleSheet } from 'react-native'

const AixFooterInternal = getHostComponent<AixComposerProps, {}>(
  'AixComposer',
  () => AixComposerConfig
)

export function AixFooter(
  props: React.ComponentProps<typeof AixFooterInternal>
) {
  if (__DEV__) {
    const paddingBottom = StyleSheet.flatten(props.style)?.paddingBottom
    if (paddingBottom) {
      console.error(
        '<AixFooter /> vertical padding in style is not supported. Please apply it to a child view instead'
      )
    }
  }
  return <AixFooterInternal {...props} />
}
