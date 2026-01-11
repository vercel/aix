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
    const flat = StyleSheet.flatten(props.style)
    const broken = Object.keys({
      paddingBottom: flat.paddingBottom,
      padding: flat.padding,
    }).filter((key) => flat[key as keyof typeof flat] !== undefined)

    if (broken.length) {
      console.error(
        `<AixFooter /> You used ${broken.join(
          ', '
        )} in the style prop. Vertical padding is not supported on AixFooter directly. Please apply it to a child view instead.`
      )
    }
  }
  return <AixFooterInternal {...props} />
}
