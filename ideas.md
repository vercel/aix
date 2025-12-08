# Declarative Scroll Architecture

Claude generated this doc as I was thinking through ideas for a rewrite.

## Problem

The current `use-keyboard-aware-message-list.ts` and
`use-initial-scroll-to-end.ts` hooks are highly imperative and difficult to
reason about.

### Current Issues

1. **Multiple imperative triggers for the same action**: `scrollToEnd` is called
   from:

   - `onMoveWhileClosed()`
   - The `doScrollToEnd` reaction
   - The `isMessageSendAnimating` reaction
   - Via `runOnJS(scrollToEnd)()` in `onMove`

2. **Scattered state mutations**: `doScrollToEnd`, `isMessageSendAnimating`,
   `scrollAtStart`, `amtToOffset`, etc. are mutated in many places, making it
   hard to trace causality.

3. **Implicit dependencies**: The reactions depend on multiple shared values,
   and it's not obvious which combination of states leads to which behavior.

4. **Mixed concerns**: Keyboard handling, scroll positioning, and message-send
   animations are all intertwined.

5. **Hacky timing in initial scroll**: Multiple `requestAnimationFrame` and
   `setTimeout` calls to "hope" the layout is ready.

6. **Disconnected scroll logic**: Initial scroll lives in a separate hook,
   disconnected from the keyboard-aware hook.

---

## Proposed Solution

**Core insight**: Instead of imperatively calling `scrollToEnd` from many
places, derive a "scroll intent" and let `onContentSizeChange` be the single
executor.

### 1. Separate Intent from Environmental State

**Key insight**: Scroll intent (user-driven actions) and keyboard state
(environmental context) are orthogonal concerns. Don't conflate them.

#### Scroll Intent — "Why do we want to scroll?"

```typescript
type ScrollIntent =
  | { type: 'none' }
  | { type: 'initial-scroll-to-end' } // First load, scroll to bottom
  | { type: 'message-sent'; messageIndex: number } // User sent a message, follow it

const scrollIntent = useSharedValue<ScrollIntent>({ type: 'none' })
```

#### Keyboard State — "What is the keyboard doing?"

This is separate environmental state that affects _how_ we execute the intent:

```typescript
type KeyboardState = 'hidden' | 'opening' | 'open' | 'closing'

const keyboardState = useSharedValue<KeyboardState>('hidden')
```

You can have any intent while the keyboard is in any state. They're independent
inputs to the scroll decision.

### 2. Setters Become Declarative Intent Setters

Instead of:

```typescript
// Current: imperative, scattered
runOnJS(scrollToEnd)()
doScrollToEnd.set(true)
listRef.current?.scrollToEnd({ animated: true })
```

You do:

```typescript
// Proposed: declarative intent
scrollIntent.set({ type: 'message-sent', messageIndex: 5 })
```

### 3. Single `onContentSizeChange` Executor

The `onContentSizeChange` callback becomes the **only place** that executes
scroll actions:

```typescript
const onContentSizeChange = useCallback((width: number, height: number) => {
  const intent = scrollIntent.get()

  if (intent.type === 'none') return

  // Derive whether we should scroll based on intent + current state
  const shouldScroll = deriveScrollDecision({
    intent,
    contentHeight: height,
    scrollViewHeight: scrollViewHeight.get(),
    currentScrollY: scrollY.get(),
    keyboardHeight: keyboardHeight.get(),
    blankSize: blankSize.get(),
  })

  if (shouldScroll.action === 'scroll-to-end') {
    listRef.current?.scrollToEnd({ animated: shouldScroll.animated })
  } else if (shouldScroll.action === 'scroll-to-offset') {
    listRef.current?.scrollToOffset({
      offset: shouldScroll.offset,
      animated: true,
    })
  }

  // Clear intent after handling
  if (shouldScroll.clearIntent) {
    scrollIntent.set({ type: 'none' })
  }
}, [])
```

### 4. Pure Derivation Function

The `deriveScrollDecision` is a **pure function** that takes both intent AND
keyboard state as inputs, then returns an action:

```typescript
type ScrollDecision =
  | { action: 'none'; clearIntent: boolean }
  | { action: 'scroll-to-end'; animated: boolean; clearIntent: boolean }

function deriveScrollDecision(params: {
  intent: ScrollIntent
  keyboardState: KeyboardState // Environmental context
  contentHeight: number
  scrollViewHeight: number
  currentScrollY: number
  keyboardHeight: number
  blankSize: number
}): ScrollDecision {
  const {
    intent,
    keyboardState,
    contentHeight,
    scrollViewHeight,
    currentScrollY,
    blankSize,
  } = params

  switch (intent.type) {
    case 'initial-scroll-to-end':
      // Only scroll if content exceeds viewport
      if (contentHeight > scrollViewHeight) {
        return { action: 'scroll-to-end', animated: false, clearIntent: true }
      }
      return { action: 'none', clearIntent: true }

    case 'message-sent': {
      const distFromEnd =
        contentHeight - currentScrollY - scrollViewHeight + blankSize
      const isFarAway = distFromEnd > 1000 // or whatever threshold

      // Keyboard state can affect HOW we scroll, not WHETHER we scroll
      const shouldAnimate = !isFarAway && keyboardState !== 'opening'

      return {
        action: 'scroll-to-end',
        animated: shouldAnimate,
        clearIntent: true,
      }
    }

    default:
      return { action: 'none', clearIntent: false }
  }
}
```

The intent says **WHAT** we want to do. The keyboard state affects **HOW** we do
it.

### 5. Simplified Keyboard Handler

The keyboard handler only updates keyboard state and transforms—no scroll
execution, no setting scroll intents:

```typescript
useKeyboardHandler({
  onStart(e) {
    'worklet'
    if (e.progress === 1) {
      keyboardState.set('closing')
    } else {
      keyboardState.set('opening')
    }
  },
  onMove(e) {
    'worklet'
    // Only handle translateY transform, no scroll logic
    translateY.set(computeTranslateY(e, keyboardHeight.get(), bottomInset))
  },
  onEnd(e) {
    'worklet'
    keyboardState.set(e.height > 0 ? 'open' : 'hidden')
    translateY.set(0)
  },
})
```

Keyboard state changes don't trigger scrolls directly—they just update the
environmental context that the scroll decision function uses.

---

## Benefits

| Aspect              | Current                              | Proposed                                              |
| ------------------- | ------------------------------------ | ----------------------------------------------------- |
| **Scroll triggers** | 5+ places                            | 1 place (`onContentSizeChange`)                       |
| **Testability**     | Hard (side effects everywhere)       | Easy (pure `deriveScrollDecision`)                    |
| **Debuggability**   | "Why did it scroll?" → trace 5 hooks | Check `scrollIntent` value                            |
| **Race conditions** | Possible (multiple async triggers)   | Eliminated (single executor)                          |
| **Initial scroll**  | Separate hook with hacks             | Same system, just `{ type: 'initial-scroll-to-end' }` |

---

## Migration Path

1. **Add the intent system alongside existing code** — don't remove anything yet
2. **Move `use-initial-scroll-to-end` to use intent** — simplest case
3. **Move message-send scroll to use intent**
4. **Move keyboard-aware scroll to use intent**
5. **Remove old imperative calls**

---

## Open Questions

1. **Should transform/offset logic remain in the worklet?** The keyboard
   animation needs to be smooth (60fps), so some worklet logic may need to stay.

2. **Should `onContentSizeChange` run on the UI thread?** If worklet-level
   performance is needed, the executor might need to be an `AnimatedReaction`
   instead.

3. **How to handle "in-flight" intents?** E.g., user sends a message, then
   immediately opens keyboard before content size updates.

---

## Current Architecture Flow Diagram

This diagram shows every path through the current system. The complexity is
intentional—it illustrates why a refactor is needed.

```mermaid
flowchart TB
    subgraph UserActions["👤 User Actions"]
        UA_Send["Press Send Button"]
        UA_Tap["Tap Input Field"]
        UA_Swipe["Swipe Down on Keyboard"]
        UA_Load["App Loads with Messages"]
        UA_Type["Type in Composer"]
    end

    subgraph Composer["📝 Composer (App.tsx)"]
        C_SetAnim["setIsMessageSendAnimating(true)"]
        C_SetKbState["setKeyboardState('didHide')"]
        C_SetOffset["shouldOffsetCloseKeyboard.set(false)"]
        C_Dismiss["Keyboard.dismiss()"]
        C_AddMsg["setMessages([...m, newMsg])"]
        C_Height["composerHeight.set(height)"]
    end

    subgraph KeyboardProvider["⌨️ KeyboardStateProvider"]
        KP_WillShow["keyboardWillShow"]
        KP_DidShow["keyboardDidShow"]
        KP_WillHide["keyboardWillHide"]
        KP_DidHide["keyboardDidHide"]
        KP_State["keyboardState SharedValue"]
        KP_StateActual["keyboardStateActual SharedValue"]
        KP_Height["keyboardHeight SharedValue"]
    end

    subgraph ChatAnimationCtx["🎬 ChatAnimationProvider"]
        CA_Animating["isMessageSendAnimating SharedValue"]
        CA_Debounce["resetAnimation (500ms debounce)"]
    end

    subgraph MessageListCtx["📋 MessageListContextProvider"]
        ML_BlankSize["blankSize SharedValue"]
        ML_BlankFull["blankSizeFull SharedValue"]
        ML_ContentH["contentHeight SharedValue"]
        ML_ScrollY["scrollY SharedValue"]
        ML_OffsetY["offsetY SharedValue"]
        ML_TranslateY["translateY SharedValue"]
        ML_LastMsg["lastUserMessage SharedValue"]
        ML_BottomInset["bottomInset (derived)"]
        ML_ScrollToEnd["scrollToEnd()"]
        ML_OnContentSize["onContentSizeChange"]
    end

    subgraph InitialScroll["🚀 useInitialScrollToEnd"]
        IS_Started["hasStartedScrolledToEnd"]
        IS_Done["hasScrolledToEnd"]
        IS_Reaction["AnimatedReaction: blankSize >= 0"]
        IS_RAFs["scrollToEnd × 4 (rAF + setTimeout)"]
    end

    subgraph BlankSize["📐 useMessageBlankSize"]
        BS_Reaction["AnimatedReaction"]
        BS_CalcMin["Calculate minHeight from scrollViewHeight"]
        BS_CalcFull["Calculate minHeightFull"]
        BS_SetBlank["blankSize.set()"]
        BS_SetFull["blankSizeFull.set()"]
        BS_OnLayout["onLayout (debounced if growing)"]
    end

    subgraph SetLastMsg["📍 useSetLastAnimatableMessage"]
        SL_Layout["useLayoutEffect"]
        SL_GetPos["getPositionByIndex()"]
        SL_SetLast["lastUserMessage.set({index, position})"]
    end

    subgraph KeyboardAware["🎹 useKeyboardAwareMessageList"]
        subgraph LocalState["Local Shared Values"]
            KA_DidInteractive["didInteractive"]
            KA_ScrollAtStart["scrollAtStart"]
            KA_AmtOffset["amtToOffset"]
            KA_AmtTransform["amtToTransform"]
            KA_DoScrollEnd["doScrollToEnd"]
            KA_IsOpening["isOpening"]
            KA_IsEnabled["isEnabled"]
        end

        subgraph KeyboardHandler["useKeyboardHandler"]
            KH_OnStart["onStart(e)"]
            KH_OnMove["onMove(e)"]
            KH_OnEnd["onEnd(e)"]
            KH_OnInteractive["onInteractive(e)"]
        end

        subgraph Reactions["AnimatedReactions"]
            R1["Reaction 1: doScrollToEnd + lastUserMessage"]
            R2["Reaction 2: numMessages + blankSizeFull (kb open)"]
            R3["Reaction 3: isMessageSendAnimating + lastUserMessage (kb closed)"]
        end

        subgraph Helpers["Helper Functions"]
            H_GetOffset["getOffsetWhenOpening()"]
            H_GetOffsetClose["getOffsetWhenNotOpening()"]
            H_GetValues["getValuesOnMove()"]
            H_IsFarAway["isScrollFarAway()"]
            H_MoveWhileClosed["onMoveWhileClosed()"]
        end

        KA_ScrollToEnd["scrollToEnd() - sets doScrollToEnd + calls listRef"]
    end

    subgraph AutoscrollComposer["📏 useAutoscrollFromComposerHeight"]
        AC_Reaction["AnimatedReaction: composerHeight"]
        AC_CheckDist["Check distanceFromEnd < 0"]
        AC_Scroll["scrollToEnd × 2"]
    end

    subgraph FirstMsgEntrance["✨ useFirstMessageEntrance"]
        FM_Reaction["AnimatedReaction: itemHeight"]
        FM_Check["Check: isMessageSendAnimating && startedWithOneMessage"]
        FM_Animate["Animate translateY + opacity"]
    end

    subgraph ScrollExecution["🎯 Scroll Execution Points"]
        SE1["listRef.scrollToEnd()"]
        SE2["offsetY.set(withTiming)"]
        SE3["translateY.set()"]
    end

    %% User Action Flows
    UA_Send --> C_SetKbState
    UA_Send --> C_SetOffset
    UA_Send --> C_SetAnim
    UA_Send --> C_Dismiss
    UA_Send --> C_AddMsg

    UA_Tap --> KP_WillShow
    UA_Swipe --> KH_OnInteractive
    UA_Load --> IS_Reaction
    UA_Type --> C_Height

    %% Keyboard Events
    KP_WillShow --> KP_State
    KP_WillShow --> KP_StateActual
    KP_WillShow --> KP_Height
    KP_DidShow --> KP_State
    KP_DidShow --> KP_StateActual
    KP_WillHide --> KP_State
    KP_WillHide --> KP_StateActual
    KP_DidHide --> KP_State
    KP_DidHide --> KP_StateActual

    %% Composer flows
    C_SetAnim --> CA_Animating
    CA_Animating --> CA_Debounce
    C_Height --> AC_Reaction
    C_AddMsg --> BS_OnLayout
    C_AddMsg --> SL_Layout

    %% BlankSize calculation
    BS_OnLayout --> BS_Reaction
    BS_Reaction --> BS_CalcMin
    BS_CalcMin --> BS_CalcFull
    BS_CalcFull --> BS_SetBlank
    BS_CalcFull --> BS_SetFull
    BS_SetBlank --> ML_BlankSize
    BS_SetFull --> ML_BlankFull

    %% Initial scroll flow
    ML_BlankSize --> IS_Reaction
    IS_Reaction -->|"blankSize >= 0"| IS_Started
    IS_Started --> IS_RAFs
    IS_RAFs --> SE1

    %% Set last message flow
    SL_Layout --> SL_GetPos
    SL_GetPos --> SL_SetLast
    SL_SetLast --> ML_LastMsg

    %% Keyboard handler flows
    KP_WillShow --> KH_OnStart
    KP_WillHide --> KH_OnStart
    KH_OnStart --> KA_IsEnabled
    KH_OnStart --> KA_IsOpening
    KH_OnStart --> H_GetOffset
    KH_OnStart --> H_GetOffsetClose
    H_GetOffset --> KA_AmtOffset
    H_GetOffsetClose --> KA_AmtOffset

    KH_OnMove --> H_GetValues
    H_GetValues -->|"scrollToEnd: true"| KA_ScrollToEnd
    H_GetValues -->|"offsetY"| SE2
    H_GetValues -->|"translateY"| SE3

    KH_OnEnd --> KH_OnMove
    KH_OnEnd --> CA_Animating

    KH_OnInteractive --> KA_DidInteractive
    KH_OnInteractive --> KH_OnStart
    KH_OnInteractive --> KH_OnMove

    %% Reaction 1: doScrollToEnd + lastUserMessage
    KA_DoScrollEnd --> R1
    ML_LastMsg --> R1
    R1 -->|"position >= 0"| H_MoveWhileClosed
    H_MoveWhileClosed --> SE2

    %% Reaction 2: content changes while keyboard open
    ML_BlankFull --> R2
    R2 -->|"keyboardState === didShow"| KH_OnStart
    R2 --> KH_OnMove
    R2 --> KH_OnEnd

    %% Reaction 3: message sent while keyboard closed
    CA_Animating --> R3
    ML_LastMsg --> R3
    KP_StateActual -->|"didHide"| R3
    R3 --> H_IsFarAway
    H_IsFarAway -->|"far"| KA_ScrollToEnd
    H_IsFarAway -->|"near"| H_MoveWhileClosed

    %% Autoscroll from composer
    AC_Reaction --> AC_CheckDist
    AC_CheckDist -->|"< 0"| AC_Scroll
    AC_Scroll --> SE1

    %% First message entrance
    CA_Animating --> FM_Reaction
    FM_Reaction --> FM_Check
    FM_Check -->|"eligible"| FM_Animate

    %% Final scroll execution
    KA_ScrollToEnd --> KA_DoScrollEnd
    KA_ScrollToEnd --> SE1

    %% Styling
    classDef userAction fill:#e1f5fe,stroke:#01579b
    classDef context fill:#fff3e0,stroke:#e65100
    classDef hook fill:#f3e5f5,stroke:#7b1fa2
    classDef reaction fill:#e8f5e9,stroke:#2e7d32
    classDef execution fill:#ffebee,stroke:#c62828
    classDef helper fill:#fafafa,stroke:#616161

    class UA_Send,UA_Tap,UA_Swipe,UA_Load,UA_Type userAction
    class KP_State,KP_StateActual,KP_Height,CA_Animating,ML_BlankSize,ML_BlankFull,ML_ContentH,ML_ScrollY,ML_OffsetY,ML_TranslateY,ML_LastMsg context
    class IS_Reaction,BS_Reaction,R1,R2,R3,AC_Reaction,FM_Reaction reaction
    class SE1,SE2,SE3 execution
    class H_GetOffset,H_GetOffsetClose,H_GetValues,H_IsFarAway,H_MoveWhileClosed helper
```

### Flow Summary by Use Case

#### 1. Initial Load (App opens with existing messages)

```mermaid
sequenceDiagram
    participant App
    participant BlankSize as useMessageBlankSize
    participant InitScroll as useInitialScrollToEnd
    participant List as LegendList

    App->>BlankSize: Messages render
    BlankSize->>BlankSize: Calculate minHeight
    BlankSize->>BlankSize: blankSize.set(calculated)
    BlankSize-->>InitScroll: blankSize >= 0
    InitScroll->>InitScroll: hasStartedScrolledToEnd = true
    InitScroll->>List: scrollToEnd({animated: false})
    InitScroll->>InitScroll: requestAnimationFrame
    InitScroll->>List: scrollToEnd({animated: false})
    InitScroll->>InitScroll: setTimeout(16ms)
    InitScroll->>List: scrollToEnd({animated: false})
    InitScroll->>InitScroll: requestAnimationFrame
    InitScroll->>InitScroll: hasScrolledToEnd = true
```

#### 2. Send Message (Keyboard Open → Closes)

```mermaid
sequenceDiagram
    participant User
    participant Composer
    participant KbProvider as KeyboardStateProvider
    participant ChatAnim as ChatAnimationProvider
    participant KbAware as useKeyboardAwareMessageList
    participant List as LegendList

    User->>Composer: Press Send
    Composer->>KbProvider: setKeyboardState('didHide')
    Composer->>KbProvider: shouldOffsetCloseKeyboard.set(false)
    Composer->>ChatAnim: setIsMessageSendAnimating(true)
    Composer->>Composer: Keyboard.dismiss()
    Composer->>Composer: Add messages to state

    Note over KbProvider: Native keyboard events fire
    KbProvider->>KbAware: onStart(e) [progress=1, closing]
    KbAware->>KbAware: isOpening = false
    KbAware->>KbAware: Calculate amtToOffset

    KbProvider->>KbAware: onMove(e)
    KbAware->>KbAware: getValuesOnMove()
    alt Far from bottom
        KbAware->>KbAware: doScrollToEnd = true
        KbAware->>List: scrollToEnd({animated: true})
    else Near bottom
        KbAware->>KbAware: offsetY.set(calculated)
        KbAware->>KbAware: translateY.set(calculated)
    end

    KbProvider->>KbAware: onEnd(e)
    KbAware->>ChatAnim: isMessageSendAnimating.set(false)
```

#### 3. Send Message (Keyboard Already Closed)

```mermaid
sequenceDiagram
    participant User
    participant Composer
    participant ChatAnim as ChatAnimationProvider
    participant SetLastMsg as useSetLastAnimatableMessage
    participant KbAware as useKeyboardAwareMessageList
    participant List as LegendList

    User->>Composer: Press Send (keyboard closed)
    Composer->>ChatAnim: setIsMessageSendAnimating(true)
    Composer->>Composer: Add messages to state

    Note over SetLastMsg: New message renders
    SetLastMsg->>SetLastMsg: useLayoutEffect
    SetLastMsg->>SetLastMsg: lastUserMessage.set({index, position})

    Note over KbAware: Reaction 3 fires
    KbAware->>KbAware: Check: keyboardStateActual === 'didHide'
    KbAware->>KbAware: Check: isMessageSendAnimating === true
    KbAware->>KbAware: Check: lastUserMessageIndex increased

    alt Far from bottom (>1000px)
        KbAware->>List: scrollToEnd({animated: true})
    else Near bottom
        KbAware->>KbAware: onMoveWhileClosed()
        KbAware->>KbAware: offsetY.set(withTiming(target))
    end
```

#### 4. Keyboard Opens (Tap input)

```mermaid
sequenceDiagram
    participant User
    participant Native as Native Keyboard
    participant KbProvider as KeyboardStateProvider
    participant KbAware as useKeyboardAwareMessageList
    participant List as LegendList

    User->>Native: Tap input field
    Native->>KbProvider: keyboardWillShow
    KbProvider->>KbProvider: keyboardState = 'willShow'
    KbProvider->>KbProvider: keyboardHeight.set(height)

    KbProvider->>KbAware: onStart(e) [progress=0, opening]
    KbAware->>KbAware: isOpening = true
    KbAware->>KbAware: shouldOffsetCloseKeyboard = true
    KbAware->>KbAware: Calculate distFromEnd
    KbAware->>KbAware: getOffsetWhenOpening()
    KbAware->>KbAware: amtToOffset.set(calculated)
    KbAware->>KbAware: amtToTransform.set(kbHeight - bottomInset)

    loop Every frame
        KbProvider->>KbAware: onMove(e) [progress 0→1]
        KbAware->>KbAware: getValuesOnMove()
        KbAware->>KbAware: offsetY.set(interpolated)
        KbAware->>KbAware: translateY.set(progress * transform)
    end

    Native->>KbProvider: keyboardDidShow
    KbProvider->>KbAware: onEnd(e)
    KbAware->>KbAware: Re-enable scroll processing
```

#### 5. Interactive Keyboard Dismissal (Swipe down)

```mermaid
sequenceDiagram
    participant User
    participant KbAware as useKeyboardAwareMessageList
    participant List as LegendList

    User->>KbAware: Start swipe down
    KbAware->>KbAware: onInteractive(e) [first frame]
    KbAware->>KbAware: didInteractive = true
    KbAware->>KbAware: onStart(e)
    KbAware->>KbAware: onMove(e, interactive=true, skipOffset=true)

    loop Each frame of swipe
        User->>KbAware: Continue swipe
        KbAware->>KbAware: onInteractive(e)
        KbAware->>KbAware: onMove(e, interactive=true, skipOffset=true)
        KbAware->>KbAware: translateY follows finger
    end

    User->>KbAware: Release
    KbAware->>KbAware: onEnd(e)
    Note over KbAware: May fire twice for interactive
    KbAware->>KbAware: didInteractive = false
```

#### 6. Content Changes While Keyboard Open

```mermaid
sequenceDiagram
    participant Stream as AI Response Stream
    participant BlankSize as useMessageBlankSize
    participant KbAware as useKeyboardAwareMessageList

    Note over KbAware: Keyboard is open (didShow)

    Stream->>BlankSize: Content grows
    BlankSize->>BlankSize: renderedSize increases
    BlankSize->>BlankSize: blankSizeFull shrinks

    Note over KbAware: Reaction 2 fires
    KbAware->>KbAware: Check: keyboardState === 'didShow'
    KbAware->>KbAware: Check: blankSizeFull changed > 0.5

    KbAware->>KbAware: Replay keyboard sequence
    KbAware->>KbAware: onStart(synthetic event)
    KbAware->>KbAware: onMove(synthetic event)
    KbAware->>KbAware: onEnd(synthetic event)
    KbAware->>KbAware: translateY/offsetY recalculated
```

#### 7. Composer Height Changes

```mermaid
sequenceDiagram
    participant User
    participant Composer
    participant AutoScroll as useAutoscrollFromComposerHeight
    participant List as LegendList

    User->>Composer: Type multiline text
    Composer->>Composer: composerHeight.set(newHeight)

    Note over AutoScroll: AnimatedReaction fires
    AutoScroll->>AutoScroll: Check distanceFromEnd
    alt distanceFromEnd < 0
        AutoScroll->>List: scrollToEnd({animated: false})
        AutoScroll->>AutoScroll: setTimeout(16ms)
        AutoScroll->>List: scrollToEnd({animated: false})
    end
```

### All `scrollToEnd` Call Sites

| Location                          | Trigger                             | Animated |
| --------------------------------- | ----------------------------------- | -------- |
| `useInitialScrollToEnd`           | blankSize >= 0 (first time)         | false    |
| `useKeyboardAwareMessageList`     | `scrollToEnd()` helper              | true     |
| `useKeyboardAwareMessageList`     | Reaction 3 (far away, kb closed)    | true     |
| `useAutoscrollFromComposerHeight` | composerHeight changes, near bottom | false    |

### All `offsetY.set()` Call Sites

| Location                      | Trigger                              | Animation  |
| ----------------------------- | ------------------------------------ | ---------- |
| `useKeyboardAwareMessageList` | `onMove()` during keyboard animation | immediate  |
| `useKeyboardAwareMessageList` | `onMoveWhileClosed()`                | withTiming |

### All `translateY.set()` Call Sites

| Location                      | Trigger                              |
| ----------------------------- | ------------------------------------ |
| `useKeyboardAwareMessageList` | `onMove()` during keyboard animation |
| `useKeyboardAwareMessageList` | `onStart()` reset after interactive  |
