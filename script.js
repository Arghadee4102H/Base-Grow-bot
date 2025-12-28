import { auth, db } from './firebaseConfig.js';
import { 
    onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    doc, getDoc, setDoc, updateDoc, collection, addDoc, onSnapshot, query, where, limit 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let userLocal = null;
const MY_PROFILE = "https://base.app/profile/arghade4102";

// --- AUTH LOGIC ---
onAuthStateChanged(auth, async (user) => {
    const loader = document.getElementById('loader-screen');
    const app = document.getElementById('app');
    
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        userLocal = { uid: user.uid, ...snap.data() };

        // Daily Reset Logic
        const today = new Date().toDateString();
        if (userLocal.lastDate !== today) {
            await updateDoc(userRef, { adsToday: 0, dailyBonusDone: false, lastDate: today });
            userLocal.adsToday = 0;
            userLocal.dailyBonusDone = false;
        }

        if (!userLocal.onboardingDone) {
            showScreen('onboarding-screen');
        } else {
            showScreen('main-screen');
            initApp();
        }
    } else {
        showScreen('auth-screen');
    }
    loader.style.display = 'none';
    app.classList.remove('hidden');
});

// Toggle Login/Signup
document.getElementById('show-signup').onclick = () => {
    document.getElementById('signup-fields').classList.remove('hidden');
    document.getElementById('show-login').classList.remove('active');
    document.getElementById('show-signup').classList.add('active');
};
document.getElementById('show-login').onclick = () => {
    document.getElementById('signup-fields').classList.add('hidden');
    document.getElementById('show-signup').classList.remove('active');
    document.getElementById('show-login').classList.add('active');
};

document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    const isSignup = !document.getElementById('signup-fields').classList.contains('hidden');

    try {
        if (isSignup) {
            const name = document.getElementById('reg-name').value;
            const res = await createUserWithEmailAndPassword(auth, email, pass);
            await setDoc(doc(db, "users", res.user.uid), {
                name, email, points: 0, onboardingDone: false, adsToday: 0, dailyBonusDone: false, lastDate: new Date().toDateString()
            });
        } else {
            await signInWithEmailAndPassword(auth, email, pass);
        }
    } catch (err) { alert(err.message); }
};

// --- TIMER SYSTEM ---
function runTimer(url, callback) {
    window.open(url, '_blank');
    const modal = document.getElementById('timer-modal');
    const bar = document.getElementById('timer-bar');
    const num = document.getElementById('timer-num');
    modal.classList.remove('hidden');
    
    let time = 6;
    const interval = setInterval(() => {
        time--;
        num.innerText = time;
        bar.style.strokeDashoffset = 283 - ((6-time)/6 * 283);
        if(time <= 0) {
            clearInterval(interval);
            modal.classList.add('hidden');
            callback();
        }
    }, 1000);
}

// --- ONBOARDING ---
document.querySelectorAll('.ob-btn').forEach(btn => {
    btn.onclick = function() {
        const url = this.closest('.task-row').dataset.url;
        runTimer(url, () => {
            this.innerText = "✔️";
            this.disabled = true;
            if(Array.from(document.querySelectorAll('.ob-btn')).every(b => b.disabled)) {
                updateDoc(doc(db, "users", auth.currentUser.uid), { onboardingDone: true, points: 10 }).then(() => window.location.reload());
            }
        });
    };
});

// --- DASHBOARD & SPECIAL TASK ---
function initApp() {
    document.getElementById('user-display-name').innerText = userLocal.name;
    document.getElementById('user-display-email').innerText = userLocal.email;
    updateUI(userLocal.points, userLocal.adsToday);

    // Featured Task Button State
    const bonusBtn = document.getElementById('daily-bonus-btn');
    if(userLocal.dailyBonusDone) {
        bonusBtn.innerText = "DONE FOR TODAY";
        bonusBtn.disabled = true;
    }

    bonusBtn.onclick = () => {
        runTimer(MY_PROFILE, async () => {
            const newPts = userLocal.points + 1;
            await updateDoc(doc(db, "users", auth.currentUser.uid), { points: newPts, dailyBonusDone: true });
            updateUI(newPts, userLocal.adsToday);
            bonusBtn.innerText = "DONE FOR TODAY";
            bonusBtn.disabled = true;
        });
    };

    // Feed logic
    const q = query(collection(db, "tasks"), where("budget", ">", 0), limit(30));
    onSnapshot(q, (snap) => {
        const list = document.getElementById('global-task-list');
        list.innerHTML = "";
        snap.forEach(tDoc => {
            const t = tDoc.data();
            if(t.owner === auth.currentUser.uid) return;
            const div = document.createElement('div');
            div.className = "glass-card";
            div.style.display = "flex"; div.style.justifyContent = "space-between"; div.style.alignItems = "center";
            div.innerHTML = `<span>Follow Coinbase</span><button class="btn-neon" style="width:80px" onclick="doTask('${tDoc.id}','${t.link}')">1 PT</button>`;
            list.appendChild(div);
        });
    });
}

// --- ADS LOGIC ---
document.getElementById('watch-ad-btn').onclick = () => {
    if(userLocal.adsToday >= 70) return alert("Limit 70 reached!");
    if(typeof show_10376570 === 'function') {
        show_10376570().then(rewardAd);
    } else {
        alert("Ad simulation..."); setTimeout(rewardAd, 2000);
    }
};

async function rewardAd() {
    const newPts = userLocal.points + 0.5;
    const newAds = userLocal.adsToday + 1;
    await updateDoc(doc(db, "users", auth.currentUser.uid), { points: newPts, adsToday: newAds });
    updateUI(newPts, newAds);
}

// --- POSTING CAMPAIGN ---
document.getElementById('submit-campaign').onclick = async () => {
    const url = document.getElementById('coinbase-url').value;
    const qty = parseInt(document.getElementById('follow-budget').value);
    const cost = qty * 1.5;

    if(!url.startsWith("https://base.app/profile/")) return alert("Invalid Link");
    if(userLocal.points < 21 || userLocal.points < cost) return alert("Insufficient points (Min 21)");

    await addDoc(collection(db, "tasks"), { owner: auth.currentUser.uid, link: url, budget: qty, timestamp: Date.now() });
    const newPts = userLocal.points - cost;
    await updateDoc(doc(db, "users", auth.currentUser.uid), { points: newPts });
    updateUI(newPts, userLocal.adsToday);
    alert("Campaign Started!");
};

// Global Task Action
window.doTask = (id, link) => {
    runTimer(link, async () => {
        const tRef = doc(db, "tasks", id);
        const tSnap = await getDoc(tRef);
        if(tSnap.exists() && tSnap.data().budget > 0) {
            await updateDoc(tRef, { budget: tSnap.data().budget - 1 });
            const newPts = userLocal.points + 1;
            await updateDoc(doc(db, "users", auth.currentUser.uid), { points: newPts });
            updateUI(newPts, userLocal.adsToday);
        }
    });
};

function updateUI(p, a) {
    userLocal.points = p;
    userLocal.adsToday = a;
    document.getElementById('user-points').innerText = p.toFixed(1);
    document.getElementById('stat-pts').innerText = p.toFixed(1);
    document.getElementById('stat-ads').innerText = `${a}/70`;
}

// TAB NAVIGATION
document.querySelectorAll('.nav-item').forEach(nav => {
    nav.onclick = () => {
        document.querySelectorAll('.nav-item, .tab-pane').forEach(el => el.classList.remove('active'));
        nav.classList.add('active');
        document.getElementById(nav.dataset.target).classList.add('active');
    };
});