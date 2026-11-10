import 'react-native-url-polyfill/auto';
import { AppRegistry }  from 'react-native';
import App              from './src/App';
import { name as appName } from './app.json';
import BackgroundFetch  from 'react-native-background-fetch';
import { runSync }      from './src/services/syncService';

AppRegistry.registerComponent(appName, () => App);

// ─── Headless task for react-native-background-fetch ─────────────────────────
// Called by the BackgroundFetch library when the OS wakes the app (every 15 min).
const BackgroundFetchHeadlessTask = async (event) => {
  await runSync();
  BackgroundFetch.finish(event.taskId);
};

BackgroundFetch.registerHeadlessTask(BackgroundFetchHeadlessTask);

// ─── Headless task for the native SyncService (5-minute foreground service) ──
// SyncHeadlessTaskService.kt starts this task by name via HeadlessJsTaskService.
// The task name MUST match the string in SyncHeadlessTaskService.kt ("SyncTask").
const SyncHeadlessTask = async () => {
  await runSync();
};

AppRegistry.registerHeadlessTask('SyncTask', () => SyncHeadlessTask);
