// REPLACE WITH YOUR ACTUAL FIREBASE CONFIG KEYS
const firebaseConfig = {
    apiKey: "AIzaSyDGBvN2OXArmtept5_DgVXtCttvVXSOOho",
    authDomain: "basefollow-cde79.firebaseapp.com",
    projectId: "basefollow-cde79",
    storageBucket: "basefollow-cde79.firebasestorage.app",
    messagingSenderId: "104856172692",
    appId: "1:104856172692:web:802a0948acb4909cefdc81"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// console.log("Firebase Initialized");
