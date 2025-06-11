import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.Fiador.com',
  appName: 'Fiador App',
  webDir: 'www',

  //Este codigo del plugin lo saco de la documentacion de capacitor splash screen 
  // el cual el enlace es el siguiente https://capacitorjs.com/docs/apis/splash-screen
  //claro, se modifica cosas como el showSpinner, splashFullScren etc
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      //launchFadeOutDuration: 3000,
      backgroundColor: "#1e7cee",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#999999",
      splashFullScreen: false,
      splashImmersive: false,
      layoutName: "launch_screen",
      useDialog: false,
    },
  },
};

export default config;
