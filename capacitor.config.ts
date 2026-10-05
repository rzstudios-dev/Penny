import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'app.penny.expenses', appName: 'Penny', webDir: 'dist',
  server: { androidScheme: 'https' },
  plugins: { LocalNotifications: { smallIcon: 'ic_stat_penny', iconColor: '#B95943' }, SplashScreen: { launchAutoHide: true, backgroundColor: '#FFFAF5', showSpinner: false }, StatusBar: { style: 'LIGHT', backgroundColor: '#FFFAF5' } }
};
export default config;
