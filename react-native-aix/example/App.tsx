import './src/polyfill';

import React, {
  useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Text,
  Keyboard,
  Pressable,
  PlatformColor,
  useColorScheme,
} from 'react-native';
import {
  Aix,
  AixCell,
  AixFooter,
  useAixRef,
  TextFadeInStaggeredIfStreaming,
  useContentInsetHandler,
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
} from 'react-native-reanimated';
import { AnimatedLegendList as LegendList } from '@legendapp/list/reanimated';
import { useIsLastItem } from '@legendapp/list';
import { FlashList } from '@shopify/flash-list';

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
let isUsingExperimentalLegendList: boolean = true;

function LegendListCellRenderer({ index, ...props }: { index: number, children: React.ReactNode }) {
  const isLast = useIsLastItem();
  return (
    <CellRenderer index={index} isLast={isLast} {...props} />
  );
}

function Chat({ children }: { children: React.ReactNode }) {
  const aix = useAixRef();

  const { messages, setMessages } = useMessages();
  const { send } = useAppleChat({ setMessages, messages });
  const [animateMessageIndex, setAnimateMessageIndex] = useState<number | null>(
    null,
  );

  // JS-controlled content insets via Reanimated
  const bottomInset = useSharedValue<number | null>(null);

  const contentInsetHandler = useContentInsetHandler((insets) => {
    'worklet'
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
          bottom: 2
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
        CellRendererComponent={(props) => <CellRenderer isLast={props.index === messages.length - 1} {...props} />}
        renderItem={({ item, index }) => renderItem(item, index)}
      />
    ),
  }; 

  return (
    <Aix
      shouldStartAtEnd={true}
      scrollOnFooterSizeUpdate={{
        enabled: true,
        scrolledToEndThreshold: 200,
        animated: false,
      }}
      style={styles.container}
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
      {...isUsingExperimentalLegendList && {
        shouldApplyContentInsets: false,
        onWillApplyContentInsets: contentInsetHandler,
      }} 
    >
      {children}
      {examples.legendList()}
      <FloatingFooter>
        <AixFooter style={styles.footer}>
          <Composer
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
      </FloatingFooter>
    </Aix>
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
  return (
    <KeyboardProvider>
      <Chat>
        <View style={styles.header}>
          <Text style={styles.headerText}>Chat</Text>
        </View>
      </Chat>
    </KeyboardProvider>
  );
}

function Composer({ onSubmit }: { onSubmit: (message: string) => void }) {
  const colorScheme = useColorScheme();
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<TextInput>(null);
  return (
    <>
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
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <TextInput
            onChangeText={setInputValue}
            style={[styles.input]}
            placeholderTextColor={PlatformColor('placeholderText')}
            placeholder="Type something..."
            ref={inputRef}
            multiline
            value={inputValue}
            autoFocus
          />
        </View>

        <Pressable
          style={[
            styles.button,
            inputValue.length === 0
              ? {
                backgroundColor: PlatformColor('systemGray6'),
                borderColor: PlatformColor('systemGray5'),
              }
              : {
                backgroundColor: PlatformColor('systemGray3'),
                borderColor: PlatformColor('separator'),
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
          <Text style={styles.buttonText}>↑</Text>
        </Pressable>
      </View>
    </>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <View style={styles.userMessage}>
      <Text style={[styles.text]}>{content}</Text>
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
  return (
    <View>
      <Text
        style={[
          styles.text,
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
    paddingTop: 60,
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
    color: PlatformColor('label'),
  },
  footerRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    paddingVertical,
    gap: gap(3),
  },
  input: {
    fontSize,
    color: PlatformColor('label'),
    backgroundColor: PlatformColor('systemBackground'),
    borderWidth: 1,
    borderColor: PlatformColor('separator'),
    paddingVertical: (44 - lineHeight(fontSize)) / 2,
    borderRadius: 24,
    borderCurve: 'continuous',
    paddingHorizontal: gap(4),
  },
  userMessage: {
    backgroundColor: PlatformColor('secondarySystemBackground'),
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
    backgroundColor: PlatformColor('systemGray8'),
    borderWidth: 1,
    borderColor: PlatformColor('separator'),
  },
  buttonText: {
    color: PlatformColor('label'),
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
    backgroundColor: PlatformColor('systemBackground'),
    borderBottomWidth: 1,
    borderBottomColor: PlatformColor('separator'),
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: PlatformColor('label'),
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
