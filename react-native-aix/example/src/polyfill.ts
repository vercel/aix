import { Platform } from 'react-native';
import structuredClone from '@ungap/structured-clone';
import {
  TransformStream,
  ReadableStream,
  WritableStream,
} from 'web-streams-polyfill';

if (Platform.OS !== 'web') {
  const setupPolyfills = async () => {
    const { polyfillGlobal } = await import(
      'react-native/Libraries/Utilities/PolyfillFunctions'
    );

    const { TextEncoderStream, TextDecoderStream } = await import(
      '@stardazed/streams-text-encoding'
    );

    if (!('structuredClone' in global)) {
      polyfillGlobal('structuredClone', () => structuredClone);
    }

    if (!('TransformStream' in global)) {
      polyfillGlobal('TransformStream', () => TransformStream);
    }

    if (!('ReadableStream' in global)) {
      polyfillGlobal('ReadableStream', () => ReadableStream);
    }

    if (!('WritableStream' in global)) {
      polyfillGlobal('WritableStream', () => WritableStream);
    }

    polyfillGlobal('TextEncoderStream', () => TextEncoderStream);
    polyfillGlobal('TextDecoderStream', () => TextDecoderStream);
  };

  setupPolyfills();
}

export {};
