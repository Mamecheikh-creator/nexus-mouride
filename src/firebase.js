import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBmUlOZOe0h0l4D1l14xJhy3lJQFZnTpGU",
  authDomain: "nexus-mouride.firebaseapp.com",
  projectId: "nexus-mouride",
  storageBucket: "nexus-mouride.firebasestorage.app",
  messagingSenderId: "855981831567",
  appId: "1:855981831567:web:65d0c27ab876af5e4747fa",
  measurementId: "G-T2B3HWQZ5P",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
