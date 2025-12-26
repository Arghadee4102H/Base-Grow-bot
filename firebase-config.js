import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDGBvN2OXArmtept5_DgVXtCttvVXSOOho",
    authDomain: "basefollow-cde79.firebaseapp.com",
    projectId: "basefollow-cde79",
    storageBucket: "basefollow-cde79.firebasestorage.app",
    messagingSenderId: "104856172692",
    appId: "1:104856172692:web:802a0948acb4909cefdc81"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
