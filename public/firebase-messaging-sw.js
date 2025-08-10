importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

self.__FIREBASE_CONFIG = self.__FIREBASE_CONFIG || {
  apiKey: self.VITE_FIREBASE_API_KEY,
  authDomain: self.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: self.VITE_FIREBASE_PROJECT_ID,
  storageBucket: self.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: self.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: self.VITE_FIREBASE_APP_ID,
  measurementId: self.VITE_FIREBASE_MEASUREMENT_ID,
};

firebase.initializeApp(self.__FIREBASE_CONFIG);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  const title = payload.notification?.title || "SoulSeer";
  const options = {
    body: payload.notification?.body,
    icon: '/logo192.png',
    data: payload.data,
  };
  self.registration.showNotification(title, options);
});