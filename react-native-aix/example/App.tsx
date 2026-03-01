import './src/polyfill';

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Text,
  Keyboard,
  Pressable,
  Platform,
  PlatformColor,
  useColorScheme,
  type ColorValue,
  type ColorSchemeName,
} from 'react-native';
import {
  Aix,
  AixCell,
  AixFooter,
  AixInputWrapper,
  AixDropzone,
  useAixRef,
  TextFadeInStaggeredIfStreaming,
  useContentInsetHandler,
  type AixInputWrapperOnPasteEvent,
} from 'aix';
import { useAppleChat, useMessages } from './src/apple';
import {
  KeyboardProvider,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  useAnimatedProps,
  Keyframe,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { AnimatedLegendList as LegendList } from '@legendapp/list/reanimated';
import { useIsLastItem } from '@legendapp/list';
import { FlashList } from '@shopify/flash-list';

type AttachmentsContextType = {
  attachments: AixInputWrapperOnPasteEvent[];
  addAttachments: (newAttachments: AixInputWrapperOnPasteEvent[]) => void;
  clearAttachments: () => void;
};

type ThemeColors = {
  textPrimary: ColorValue;
  textSecondary: ColorValue;
  placeholder: ColorValue;
  surface: ColorValue;
  surfaceSecondary: ColorValue;
  surfaceTertiary: ColorValue;
  border: ColorValue;
  borderSubtle: ColorValue;
  buttonEnabled: ColorValue;
  buttonEnabledBorder: ColorValue;
  buttonDisabled: ColorValue;
  buttonDisabledBorder: ColorValue;
  userMessageBackground: ColorValue;
  attachmentBackground: ColorValue;
};

const lightThemeColors: ThemeColors = {
  textPrimary: '#000000',
  textSecondary: '#6E6E73',
  placeholder: '#8E8E93',
  surface: '#FFFFFF',
  surfaceSecondary: '#F2F2F7',
  surfaceTertiary: '#E5E5EA',
  border: '#D1D1D6',
  borderSubtle: '#E5E5EA',
  buttonEnabled: '#D1D1D6',
  buttonEnabledBorder: '#C7C7CC',
  buttonDisabled: '#F2F2F7',
  buttonDisabledBorder: '#E5E5EA',
  userMessageBackground: '#F2F2F7',
  attachmentBackground: '#D1D1D6',
};

const darkThemeColors: ThemeColors = {
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  placeholder: '#8E8E93',
  surface: '#000000',
  surfaceSecondary: '#1C1C1E',
  surfaceTertiary: '#2C2C2E',
  border: '#3A3A3C',
  borderSubtle: '#48484A',
  buttonEnabled: '#48484A',
  buttonEnabledBorder: '#636366',
  buttonDisabled: '#2C2C2E',
  buttonDisabledBorder: '#3A3A3C',
  userMessageBackground: '#1C1C1E',
  attachmentBackground: '#48484A',
};

const iosThemeColors: ThemeColors = {
  textPrimary: PlatformColor('label'),
  textSecondary: PlatformColor('secondaryLabel'),
  placeholder: PlatformColor('placeholderText'),
  surface: PlatformColor('systemBackground'),
  surfaceSecondary: PlatformColor('secondarySystemBackground'),
  surfaceTertiary: PlatformColor('systemGray3'),
  border: PlatformColor('separator'),
  borderSubtle: PlatformColor('systemGray5'),
  buttonEnabled: PlatformColor('systemGray3'),
  buttonEnabledBorder: PlatformColor('separator'),
  buttonDisabled: PlatformColor('systemGray6'),
  buttonDisabledBorder: PlatformColor('systemGray5'),
  userMessageBackground: PlatformColor('secondarySystemBackground'),
  attachmentBackground: PlatformColor('systemGray3'),
};

function getThemeColors(colorScheme: ColorSchemeName): ThemeColors {
  if (Platform.OS === 'ios') {
    return iosThemeColors;
  }

  return colorScheme === 'dark' ? darkThemeColors : lightThemeColors;
}

function useThemeColors(): ThemeColors {
  const colorScheme = useColorScheme();
  return getThemeColors(colorScheme);
}

const AttachmentsContext = createContext<AttachmentsContextType>({
  attachments: [],
  addAttachments: () => {},
  clearAttachments: () => {},
});

function useAttachments() {
  return useContext(AttachmentsContext);
}

function AttachmentsProvider({ children }: { children: React.ReactNode }) {
  const [attachments, setAttachments] = useState<AixInputWrapperOnPasteEvent[]>(
    [],
  );

  const addAttachments = useCallback(
    (newAttachments: AixInputWrapperOnPasteEvent[]) => {
      setAttachments(prev => [...prev, ...newAttachments]);
    },
    [],
  );

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  return (
    <AttachmentsContext.Provider
      value={{ attachments, addAttachments, clearAttachments }}
    >
      {children}
    </AttachmentsContext.Provider>
  );
}

function CellRenderer({
  children,
  index,
  isLast,
  ...props
}: {
  children: React.ReactNode;
  index: number;
  isLast: boolean;
}) {
  return (
    <AixCell key={index} index={index} isLast={isLast} {...props}>
      {children}
    </AixCell>
  );
}
let isUsingExperimentalLegendList: boolean = false;

function LegendListCellRenderer({
  index,
  ...props
}: {
  index: number;
  children: React.ReactNode;
}) {
  const isLast = useIsLastItem();
  return <CellRenderer index={index} isLast={isLast} {...props} />;
}

function Chat({ children }: { children: React.ReactNode }) {
  const aix = useAixRef();
  const colorScheme = useColorScheme();
  const isAndroidDarkMode = Platform.OS === 'android' && colorScheme === 'dark';

  const { messages, setMessages } = useMessages();
  const [isNearEnd, setIsNearEnd] = useState(false);
  const { send } = useAppleChat({ setMessages, messages });
  const [animateMessageIndex, setAnimateMessageIndex] = useState<number | null>(
    null,
  );

  // JS-controlled content insets via Reanimated
  const bottomInset = useSharedValue<number | null>(null);

  const contentInsetHandler = useContentInsetHandler(insets => {
    'worklet';
    console.log('[useContentInsetHandler]', insets);
    bottomInset.set(insets.bottom ?? null);
  });

  const contentInset = useDerivedValue(() => ({
    top: 0,
    bottom: bottomInset.get() ?? 0,
    left: 0,
    right: 0,
  }));

  // Apply content insets via animated` props on the ScrollView
  const animatedScrollViewProps = useAnimatedProps(() => ({
    contentInset: contentInset.get(),
  }));

  const renderItem = (message: (typeof messages)[number], index: number) =>
    message.role === 'user' ? (
      <UserMessage content={message.content} />
    ) : (
      <AssistantMessage
        content={message.content}
        shouldAnimate={animateMessageIndex === index}
      />
    );

  const examples = {
    scrollProps: {
      keyboardDismissMode: 'interactive',
      nativeID: mainScrollViewID,
    } satisfies Partial<React.ComponentProps<typeof ScrollView>>,

    legendList: () => (
      <LegendList
        {...examples.scrollProps}
        estimatedItemSize={100}
        data={messages}
        getItemType={item => item.role}
        keyExtractor={(_, index) => index.toString()}
        maintainVisibleContentPosition
        alwaysRender={{
          bottom: 2,
        }}
        // @ts-ignore
        contentInset={isUsingExperimentalLegendList ? contentInset : undefined}
        renderItem={({ item, index }) => (
          <LegendListCellRenderer index={index}>
            {renderItem(item, index)}
          </LegendListCellRenderer>
        )}
      />
    ),
    scrollview: () => (
      <Animated.ScrollView
        {...examples.scrollProps}
        animatedProps={animatedScrollViewProps}
        contentInset={
          isUsingExperimentalLegendList ? contentInset.get() : undefined
        }
      >
        {messages.map((message, index) => (
          <CellRenderer
            index={messages.indexOf(message)}
            isLast={messages.indexOf(message) === messages.length - 1}
            key={index}
          >
            {renderItem(message, messages.indexOf(message))}
          </CellRenderer>
        ))}
      </Animated.ScrollView>
    ),
    flashList: () => (
      <FlashList
        {...examples.scrollProps}
        data={messages}
        getItemType={item => item.role}
        keyExtractor={(_, index) => index.toString()}
        CellRendererComponent={props => (
          <CellRenderer
            isLast={props.index === messages.length - 1}
            {...props}
          />
        )}
        renderItem={({ item, index }) => renderItem(item, index)}
      />
    ),
  };

  return (
    <AttachmentsProvider>
      <DropzoneWithAttachments>
        <Aix
          shouldStartAtEnd={true}
          scrollOnFooterSizeUpdate={{
            enabled: true,
            scrolledToEndThreshold: 200,
            animated: false,
          }}
          onScrolledNearEndChange={isNearEnd => {
            console.log('onScrolledNearEndChange', isNearEnd);
            setIsNearEnd(isNearEnd);
          }}
          style={[
            styles.container,
            isAndroidDarkMode && styles.androidDarkBackground,
          ]}
          ref={aix}
          additionalContentInsets={{
            bottom: {
              whenKeyboardClosed: safeAreaInsetsBottom,
              whenKeyboardOpen: 0,
            },
          }}
          additionalScrollIndicatorInsets={{
            bottom: {
              whenKeyboardClosed: safeAreaInsetsBottom,
              whenKeyboardOpen: 0,
            },
          }}
          mainScrollViewID={mainScrollViewID}
          // JS-controlled content insets
          {...(isUsingExperimentalLegendList && {
            shouldApplyContentInsets: false,
            onWillApplyContentInsets: contentInsetHandler,
          })}
        >
          {children}
          {examples.scrollview()}
          <AixFooter
            style={styles.footer}
            fixInput
            stickToKeyboard={{
              enabled: true,
              offset: {
                whenKeyboardClosed: safeAreaInsetsBottom,
                whenKeyboardOpen: 0,
              },
            }}
          >
            <Composer
              onScrollToEnd={() => aix.current?.scrollToEnd(true)}
              isNearEnd={isNearEnd}
              onSubmit={message => {
                const nextAssistantMessageIndex = messages.length + 1;
                aix.current?.scrollToIndexWhenBlankSizeReady(
                  nextAssistantMessageIndex,
                  true,
                  false,
                );
                setAnimateMessageIndex(nextAssistantMessageIndex);
                send(message);
              }}
            />
          </AixFooter>
        </Aix>
      </DropzoneWithAttachments>
    </AttachmentsProvider>
  );
}

function DropzoneWithAttachments({ children }: { children: React.ReactNode }) {
  const { addAttachments } = useAttachments();
  return (
    <AixDropzone
      onDrop={events => {
        console.log('onDrop', events);
        addAttachments(events);
      }}
    >
      {children}
    </AixDropzone>
  );
}

function FloatingFooter({ children }: { children: React.ReactNode }) {
  return (
    <StickyView
      offset={{
        opened: -paddingVertical / 2,
        closed: -safeAreaInsetsBottom - paddingVertical / 2,
      }}
    >
      {children}
    </StickyView>
  );
}

function App() {
  const colors = useThemeColors();

  return (
    <KeyboardProvider>
      <Chat>
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.headerText, { color: colors.textPrimary }]}>Chat</Text>
        </View>
      </Chat>
    </KeyboardProvider>
  );
}

function Composer({
  onSubmit,
  onScrollToEnd,
  isNearEnd,
}: {
  onSubmit: (message: string) => void;
  onScrollToEnd: () => void;
  isNearEnd: boolean;
}) {
  const colorScheme = useColorScheme();
  const colors = getThemeColors(colorScheme);
  const [inputValue, setInputValue] = useState('');
  const { attachments, addAttachments } = useAttachments();
  const inputRef = useRef<TextInput>(null);
  return (
    <>
      {!isNearEnd && (
        <Animated.View
          style={{
            position: 'absolute',
            top: -48,
            paddingLeft: 16,
            transformOrigin: 'bottom center',
          }}
          entering={buttonAnimation.entering}
          exiting={buttonAnimation.exiting}
        >
          <Button onPress={onScrollToEnd} disabled={isNearEnd}>
            <Text style={[styles.buttonText, { color: colors.textPrimary }]}>↓</Text>
          </Button>
        </Animated.View>
      )}
      <View
        style={[
          styles.footerBackground,
          {
            experimental_backgroundImage:
              colorScheme === 'dark'
                ? `linear-gradient(to bottom, #00000000, #000000)`
                : `linear-gradient(to bottom, #ffffff00, #ffffff)`,
          },
        ]}
      />
      <View style={styles.footerRow}>
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {attachments.length > 0 ? (
            <ScrollView
              horizontal
              style={styles.attachmentsContainer}
              contentContainerStyle={styles.attachmentsContentContainer}
            >
              {attachments.map((attachment, index) =>
                attachment.type === 'image' ? (
                  <Animated.Image
                    entering={FadeIn}
                    exiting={FadeOut}
                    source={{ uri: attachment.filePath }}
                    style={[
                      styles.attachment,
                      {
                        backgroundColor: colors.attachmentBackground,
                        borderColor: colors.border,
                      },
                    ]}
                    key={index}
                  />
                ) : (
                  <Animated.View
                    entering={FadeIn}
                    exiting={FadeOut}
                    key={index}
                    style={[
                      styles.attachment,
                      {
                        backgroundColor: colors.attachmentBackground,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.attachmentText, { color: colors.textSecondary }]}>
                      {attachment.fileExtension?.toUpperCase() ?? 'FILE'}
                    </Text>
                  </Animated.View>
                ),
              )}
            </ScrollView>
          ) : null}
          <AixInputWrapper
            editMenuDefaultActions={['paste']}
            onPaste={(events: AixInputWrapperOnPasteEvent[]) => {
              addAttachments(events);
            }}
            style={{ flex: 1 }}
          >
            <TextInput
              placeholderTextColor={colors.placeholder}
              placeholder="Type something..."
              onChangeText={setInputValue}
              style={[styles.input, { color: colors.textPrimary }]}
              value={inputValue}
              ref={inputRef}
              multiline
              autoFocus
            />
          </AixInputWrapper>
        </View>

        <Pressable
          style={[
            styles.button,
            inputValue.length === 0
              ? {
                  backgroundColor: colors.buttonDisabled,
                  borderColor: colors.buttonDisabledBorder,
                }
              : {
                  backgroundColor: colors.buttonEnabled,
                  borderColor: colors.buttonEnabledBorder,
                },
          ]}
          onPress={async () => {
            setInputValue('');
            onSubmit(inputValue);
            requestAnimationFrame(() => {
              Keyboard.dismiss();
            });
          }}
        >
          <Text style={[styles.buttonText, { color: colors.textPrimary }]}>↑</Text>
        </Pressable>
      </View>
    </>
  );
}

const buttonAnimation = {
  entering: new Keyframe({
    from: {
      transform: [{ scale: 0.9 }],
      opacity: 0,
    },
    to: {
      transform: [{ scale: 1 }],
      opacity: 1,
    },
  }).duration(150),
  exiting: new Keyframe({
    from: {
      transform: [{ scale: 1 }],
      opacity: 1,
    },
    to: {
      transform: [{ scale: 0.8 }],
      opacity: 0,
    },
  }).duration(150),
};

function Button({
  children,
  onPress,
  disabled = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        disabled
          ? {
              backgroundColor: colors.buttonDisabled,
              borderColor: colors.buttonDisabledBorder,
            }
          : {
              backgroundColor: colors.buttonEnabled,
              borderColor: colors.buttonEnabledBorder,
            },
      ]}
    >
      {children}
    </Pressable>
  );
}

function UserMessage({ content }: { content: string }) {
  const colors = useThemeColors();

  return (
    <View
      style={[
        styles.userMessage,
        {
          backgroundColor: colors.userMessageBackground,
        },
      ]}
    >
      <Text style={[styles.text, { color: colors.textPrimary }]}>{content}</Text>
    </View>
  );
}

function AssistantMessage({
  content,
  shouldAnimate,
}: {
  content: string;
  shouldAnimate: boolean;
}) {
  const colors = useThemeColors();

  return (
    <View>
      <Text
        style={[
          styles.text,
          { color: colors.textPrimary },
          { paddingHorizontal: gap(4), paddingVertical: gap(2) },
        ]}
      >
        <TextFadeInStaggeredIfStreaming disabled={!shouldAnimate}>
          {content}
        </TextFadeInStaggeredIfStreaming>
      </Text>
    </View>
  );
}

function gap(size: number) {
  return size * 4;
}

const fontSize = 17;
const lineHeight = (fontSize: number) => fontSize * 1.4;
const paddingVertical = 8;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 0,
  },
  androidDarkBackground: {
    backgroundColor: '#000000',
  },
  view: {
    width: 200,
    justifyContent: 'center',
    alignItems: 'center',
    height: 200,
  },
  text: {
    fontSize,
    lineHeight: lineHeight(fontSize),
  },
  footerRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    paddingVertical,
    gap: gap(3),
  },
  inputContainer: {
    borderWidth: 1,
    borderRadius: 24,
    borderCurve: 'continuous',
    minHeight: 44,
    flex: 1,
    overflow: 'hidden',
  },
  input: {
    fontSize,
    paddingVertical: (44 - lineHeight(fontSize)) / 2,
    paddingHorizontal: gap(4),
    minHeight: 44,
  },
  userMessage: {
    paddingHorizontal: gap(4),
    paddingVertical: gap(2),
    borderRadius: 20,
    marginHorizontal: gap(4),
    alignSelf: 'flex-end',
    maxWidth: '70%',
    borderCurve: 'continuous',
    marginVertical: gap(3),
  },
  footer: {
    paddingHorizontal: gap(4),
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  button: {
    height: 44,
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: '500',
  },
  footerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: -18 - 6,
  },
  header: {
    paddingHorizontal: gap(4),
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
  },
  attachment: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    height: 80,
    width: 80,
    borderWidth: 1,
    borderCurve: 'continuous',
  },
  attachmentsContainer: {
    paddingHorizontal: gap(2),
    paddingVertical: gap(2),
  },
  attachmentsContentContainer: {
    gap: gap(2),
  },
  attachmentText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default App;

const mainScrollViewID = 'chat-list-scroll-view';

const safeAreaInsetsBottom = 18;

function StickyView(
  props: React.ComponentProps<typeof Animated.View> & {
    offset?: { opened?: number; closed?: number };
  },
) {
  const { height, progress } = useReanimatedKeyboardAnimation();

  const style = useAnimatedStyle(() => {
    const y =
      height.get() +
      interpolate(
        progress.get(),
        [0, 1],
        [props.offset?.closed ?? 0, props.offset?.opened ?? 0],
      );
    return {
      transform: [
        {
          translateY: y,
        },
      ],
    };
  });

  return <Animated.View {...props} style={[style, props.style]} />;
}