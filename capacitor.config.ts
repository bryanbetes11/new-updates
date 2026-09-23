import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Development identity. Confirm before the first signed store upload.
  appId: 'com.babcreations.servesync',
  appName: 'ServeSync',
  webDir: 'dist',
  backgroundColor: '#050505',
  // Ship bundled assets; never point a release at a development server.
  server: { androidScheme: 'https' },
  android: { allowMixedContent: false },
  plugins: { PushNotifications: { presentationOptions: ['alert', 'sound'] } },
};

export default config;
