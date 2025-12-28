import { auth, db } from './firebaseConfig.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    doc, getDoc, setDoc, updateDoc, collection, 
    addDoc, query, onSnapshot, where, orderBy, limit 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentUser = null;
const timerOverlay = document.getElementById('timer-overlay');
const timerProgress = document.getElementById('timer-progress');
const timerNumber = document.getElementById('timer-number');

// --- AUTH LOGIC ---
document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('user-name').value;
    const email = document.getElementById('user-email').value;
    const pass = document.getElementById('user-pass').value;
    const isLogin = document.getElementById('show-login').classList.contains('active');

    try {
        if (isLogin) {
            await signInWithEmailAndPassword(auth, email, pass);
        } else {
            const res = await createUserWithEmailAndPassword(auth, email, pass);
            await setDoc(doc(db, "users", res.user.uid), {
                name, email, points: 0, onboardingDone: false, adsToday: 0, lastAdDate: new Date().toDateString()
            });
        }
    } catch (err) { alert(err.message); }
});

// --- APP STATE CONTROLLER ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        currentUser = { uid: user.uid, ...userDoc.data() };
        
        if (!currentUser.onboardingDone) {
            showScreen('onboarding-screen');
        } else {
            showScreen('main-screen');
            loadDashboard();
        }
    } else {
        showScreen('auth-screen');
    }
});

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// --- TIMER LOGIC ---
async function startActionTimer(url, callback) {
    window.open(url, '_blank');
    timerOverlay.classList.remove('hidden');
    let timeLeft = 6;
    const fullDash = 283;
    
    const interval = setInterval(() => {
        timeLeft--;
        timerNumber.innerText = timeLeft;
        timerProgress.style.strokeDashoffset = fullDash - (fullDash * (6 - timeLeft) / 6);
        
        if (timeLeft <= 0) {
            clearInterval(interval);
            timerOverlay.classList.add('hidden');
            callback();
        }
    }, 1000);
}

// --- ONBOARDING ---
document.querySelectorAll('.task-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const url = this.parentElement.dataset.url;
        startActionTimer(url, () => {
            this.innerText = "✔️ Done";
            this.disabled = true;
            checkOnboardingComplete();
        });
    });
});

async function checkOnboardingComplete() {
    const allDone = Array.from(document.querySelectorAll('.task-btn')).every(b => b.disabled);
    if (allDone) {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { 
            onboardingDone: true, 
            points: 10 
        });
        window.location.reload();
    }
}

// --- ADS LOGIC (Monetag/Adsgram) ---
document.getElementById('watch-ad-btn').addEventListener('click', async () => {
    const today = new Date().toDateString();
    if (currentUser.lastAdDate !== today) {
        currentUser.adsToday = 0;
    }

    if (currentUser.adsToday >= 70) {
        alert("Daily limit of 70 ads reached!");
        return;
    }

    // Trigger Monetag
    if (typeof show_10376570 === 'function') {
        show_10376570().then(async () => {
            const newPoints = currentUser.points + 0.5;
            await updateDoc(doc(db, "users", currentUser.uid), {
                points: newPoints,
                adsToday: currentUser.adsToday + 1,
                lastAdDate: today
            });
            updateLocalPoints(newPoints);
        });
    } else {
        // Fallback or Simulated Ad for testing
        alert("Ad playing...");
        setTimeout(async () => {
            const newPoints = currentUser.points + 0.5;
            await updateDoc(doc(db, "users", currentUser.uid), {
                points: newPoints,
                adsToday: (currentUser.adsToday || 0) + 1,
                lastAdDate: today
            });
            updateLocalPoints(newPoints);
        }, 2000);
    }
});

// --- POST CAMPAIGN LOGIC ---
document.getElementById('submit-post').addEventListener('click', async () => {
    const link = document.getElementById('coinbase-link').value;
    const count = parseInt(document.getElementById('follow-budget').value);
    const cost = count * 1.5;

    if (!link.startsWith('https://base.app/profile/')) {
        alert("Invalid Coinbase Link!");
        return;
    }
    if (currentUser.points < 21 || currentUser.points < cost) {
        alert("Not enough points! (Min 21 needed)");
        return;
    }

    await addDoc(collection(db, "tasks"), {
        ownerId: currentUser.uid,
        link: link,
        target: count,
        current: 0,
        createdAt: Date.now()
    });

    const newPoints = currentUser.points - cost;
    await updateDoc(doc(db, "users", currentUser.uid), { points: newPoints });
    updateLocalPoints(newPoints);
    alert("Post Launched!");
});

// --- TASK LIST (GLOBAL) ---
function loadDashboard() {
    const q = query(collection(db, "tasks"), where("current", "<", "target"), limit(20));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('global-tasks-list');
        container.innerHTML = "";
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.ownerId === currentUser.uid) return;

            const div = document.createElement('div');
            div.className = "task-item glass-card";
            div.innerHTML = `
                <span>Follow Profile</span>
                <button onclick="performTask('${doc.id}', '${data.link}')" class="btn-primary">Earn 1 PT</button>
            `;
            container.appendChild(div);
        });
    });
}

window.performTask = (taskId, link) => {
    startActionTimer(link, async () => {
        // Increase user points
        const newPoints = currentUser.points + 1;
        await updateDoc(doc(db, "users", currentUser.uid), { points: newPoints });
        
        // Update task progress in Firestore (Simplified logic)
        // In a production app, you'd track which user did which task to prevent repeats.
        updateLocalPoints(newPoints);
    });
};

function updateLocalPoints(p) {
    currentUser.points = p;
    document.getElementById('user-points').innerText = p.toFixed(1);
    document.getElementById('stat-points').innerText = p.toFixed(1);
}

// UI Tabs
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`${btn.dataset.tab}-section`).classList.add('active');
    });
});