import { auth, db } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp, limit, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentUser = null;
let userData = null;

// Screen Management
window.showScreen = (id) => {
    document.querySelectorAll('.screen, #main-content').forEach(s => s.classList.add('hidden'));
    if(id === 'home-screen' || id === 'post-screen' || id === 'ads-screen' || id === 'task-screen') {
        document.getElementById('main-content').classList.remove('hidden');
        switchTab(id);
    } else {
        document.getElementById(id).classList.remove('hidden');
        document.getElementById(id).classList.add('active');
    }
};

window.switchTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    // Update nav icons logic...
    if(id === 'task-screen') loadTasks();
};

// Auth Logic
window.toggleAuth = (isLogin) => {
    document.getElementById('login-form').classList.toggle('hidden', !isLogin);
    document.getElementById('signup-form').classList.toggle('hidden', isLogin);
};

window.handleSignup = async () => {
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const pass = document.getElementById('signup-pass').value;
    const conf = document.getElementById('signup-confirm').value;

    if(pass !== conf) return alert("Passwords mismatch");

    try {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, "users", res.user.uid), {
            name, email, points: 0, completedSocials: [], adCount: 0, lastAdDate: new Date().toDateString()
        });
        showScreen('onboarding-screen');
    } catch (e) { alert(e.message); }
};

window.handleLogin = async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) { alert(e.message); }
};

// State Observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const snap = await getDoc(doc(db, "users", user.uid));
        userData = snap.data();
        document.getElementById('user-display-name').innerText = userData.name;
        updateUI();
        showScreen('home-screen');
    } else {
        showScreen('auth-screen');
    }
});

function updateUI() {
    if(!userData) return;
    document.getElementById('h-name').innerText = userData.name;
    document.getElementById('h-email').innerText = userData.email;
    document.getElementById('h-points').innerText = userData.points.toFixed(1);
    document.getElementById('ad-count').innerText = userData.adCount;
}

// Timer Logic
async function runVerification(action) {
    const overlay = document.getElementById('timer-overlay');
    const prog = document.getElementById('timer-progress');
    const txt = document.getElementById('timer-text');
    overlay.classList.remove('hidden');
    
    let seconds = 6;
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            seconds--;
            txt.innerText = seconds;
            let offset = (seconds / 6) * 100;
            prog.style.strokeDasharray = `${offset}, 100`;
            
            if(seconds <= 0) {
                clearInterval(interval);
                overlay.classList.add('hidden');
                resolve(true);
            }
        }, 1000);
    });
}

// Social Tasks (Onboarding)
window.verifySocial = async (id, link) => {
    window.open(link, '_blank');
    const success = await runVerification();
    if(success && !userData.completedSocials.includes(id)) {
        userData.points += 2.5;
        userData.completedSocials.push(id);
        await updateDoc(doc(db, "users", currentUser.uid), {
            points: userData.points,
            completedSocials: userData.completedSocials
        });
        updateUI();
        alert("Earned 2.5 points!");
    }
};

// Create Post Logic
window.createPost = async () => {
    const link = document.getElementById('base-link').value;
    const budget = parseFloat(document.getElementById('post-budget').value);

    if(!link.startsWith("https://base.app/profile/")) return alert("Invalid Link");
    if(budget < 21) return alert("Minimum budget 21 points");
    if(userData.points < budget) return alert("Insufficient points");

    // Check active post limit
    const q = query(collection(db, "posts"), where("userId", "==", currentUser.uid), where("status", "==", "active"));
    const activeSnap = await getDocs(q);
    if(activeSnap.size >= 2) return alert("Max 2 active posts allowed");

    await addDoc(collection(db, "posts"), {
        userId: currentUser.uid,
        link,
        budget,
        spent: 0,
        status: "active",
        createdAt: serverTimestamp()
    });

    await updateDoc(doc(db, "users", currentUser.uid), {
        points: userData.points - budget
    });
    
    userData.points -= budget;
    updateUI();
    alert("Post Live!");
};

// Task Logic (Following others)
async function loadTasks() {
    const container = document.getElementById('available-tasks');
    container.innerHTML = "Loading...";
    
    const q = query(collection(db, "posts"), where("status", "==", "active"), limit(20));
    const snap = await getDocs(q);
    
    container.innerHTML = "";
    snap.forEach(postDoc => {
        const post = postDoc.data();
        if(post.userId === currentUser.uid) return;

        const el = document.createElement('div');
        el.className = 'glass-card task-card';
        el.innerHTML = `
            <p>Follow on Base</p>
            <button class="btn-primary" onclick="completeFollowTask('${postDoc.id}', '${post.link}')">Follow (1 pt)</button>
        `;
        container.appendChild(el);
    });
}

window.completeFollowTask = async (postId, link) => {
    window.open(link, '_blank');
    const success = await runVerification();
    if(success) {
        const postRef = doc(db, "posts", postId);
        const postSnap = await getDoc(postRef);
        const postData = postSnap.data();

        if(postData.budget - postData.spent >= 1.5) {
            await updateDoc(postRef, {
                spent: postData.spent + 1.5,
                status: (postData.spent + 1.5 >= postData.budget) ? "completed" : "active"
            });
            
            userData.points += 1;
            await updateDoc(doc(db, "users", currentUser.uid), { points: userData.points });
            updateUI();
            alert("Reward claimed!");
            loadTasks();
        }
    }
};

// Monetag Ads logic
window.showMonetagAd = () => {
    const today = new Date().toDateString();
    if(userData.lastAdDate !== today) {
        userData.adCount = 0;
        userData.lastAdDate = today;
    }

    if(userData.adCount >= 70) return alert("Daily limit reached");

    // Check if Monetag SDK is loaded
    if (typeof show_10376570 === 'function') {
        show_10376570().then(async () => {
            userData.points += 0.5;
            userData.adCount += 1;
            await updateDoc(doc(db, "users", currentUser.uid), {
                points: userData.points,
                adCount: userData.adCount,
                lastAdDate: userData.lastAdDate
            });
            updateUI();
        });
    } else {
        alert("Ad provider loading... try again in a moment.");
    }
};
