import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Splash } from '../src/components/Splash';
import { StoreProvider } from '../src/store';

// Hold the native splash until the animated one is actually on screen — Splash
// hides it from its own `onShow`. Both sit on the same ground colour and put
// the same mark in the same place, so the handover is invisible.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [introDone, setIntroDone] = useState(false);

  // Belt and braces: if the intro finished without the modal ever showing, the
  // native splash must not be left covering the app.
  useEffect(() => {
    if (introDone) SplashScreen.hideAsync();
  }, [introDone]);

  return (
    <StoreProvider>
      <View style={styles.root}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
        <Splash visible={!introDone} onDone={() => setIntroDone(true)} />
      </View>
    </StoreProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
