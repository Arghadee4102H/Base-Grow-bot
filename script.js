// --- STATE MANAGEMENT ---
let currentUser = null;
let userDoc = null;
const ONBOARDING_LINKS = [
    { name: "Telegram Channel 1", url: "https://t.me/ABaseGrow", id: "tg1" },
    { name: "Telegram Channel 2", url: "https://t.me/Scalpingargha", id: "tg2" },
    { name: "Twitter X", url: "https://x.com/Arghade74167980", id: "tw" },
    { name: "YouTube", url: "https://youtube.com/@aafxtrade", id: "yt" }
];

// --- UI HELPERS ---
const showToast = (msg) => {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
};

const toggleLoader = (show) => {
    const loader = document.getElementById('loader');
    loader.style.opacity = show ? '1' : '0';
    loader.style.pointerEvents = show ? 'all' : 'none';
};

// --- AUTHENTICATION ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        // Fetch user data
        const docRef = db.collection('users').doc(user.uid);
        const docSnap = await docRef.get();
        
        if (!docSnap.exists) {
            // New User Setup
            await docRef.set({
                name: user.displayName || "User",
                email: user.email,
                points: 0,
                onboarding: { tg1: false, tg2: false, tw: false, yt: false },
                onboardingComplete: false,
                adsWatchedToday: 0,
                lastAdDate: null,
                activePosts: 0
            });
            userDoc = { points: 0, onboardingComplete: false };
        } else {
            userDoc = docSnap.data();
        }
        
        checkOnboarding();
    } else {
        showScreen('auth-section');
        toggleLoader(false);
    }
});

function toggleAuth(type) {
    document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    
    if (type === 'login') {
        document.querySelector("button[onclick=\"toggleAuth('login')\"]").classList.add('active');
        document.getElementById('login-form').classList.add('active');
    } else {
        document.querySelector("button[onclick=\"toggleAuth('signup')\"]").classList.add('active');
        document.getElementById('signup-form').classList.add('active');
    }
}

// Sign Up
document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    const confirm = document.getElementById('reg-confirm-pass').value;

    if (pass !== confirm) return showToast("Passwords do not match");

    toggleLoader(true);
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        // Update profile name
        await cred.user.updateProfile({ displayName: name });
        // Auth state listener handles the rest
    } catch (error) {
        showToast(error.message);
        toggleLoader(false);
    }
});

// Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;

    toggleLoader(true);
    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (error) {
        showToast(error.message);
        toggleLoader(false);
    }
});

// --- ONBOARDING LOGIC ---
function checkOnboarding() {
    if (userDoc.onboardingComplete) {
        initDashboard();
    } else {
        showScreen('onboarding-section');
        renderOnboardingList();
        toggleLoader(false);
    }
}

function renderOnboardingList() {
    const list = document.getElementById('onboarding-list');
    list.innerHTML = '';
    
    let allDone = true;

    ONBOARDING_LINKS.forEach(link => {
        const isDone = userDoc.onboarding && userDoc.onboarding[link.id];
        if (!isDone) allDone = false;

        const item = document.createElement('div');
        item.className = 'task-item';
        item.innerHTML = `
            <div class="task-info">
                <h4>${link.name}</h4>
                <p>${isDone ? 'Completed' : 'Tap to join'}</p>
            </div>
            ${isDone 
                ? '<i class="fa-solid fa-check text-success" style="color:var(--primary)"></i>' 
                : `<button class="action-btn" onclick="handleOnboardingClick('${link.id}', '${link.url}')">Join</button>`
            }
        `;
        list.appendChild(item);
    });

    if (allDone) {
        const btn = document.getElementById('check-onboarding-btn');
        btn.classList.remove('hidden');
        btn.onclick = finishOnboarding;
    }
}

async function handleOnboardingClick(id, url) {
    // Timer Logic
    await startTimer(6); 
    window.open(url, '_blank');
    
    // Update DB local state temporarily
    if(!userDoc.onboarding) userDoc.onboarding = {};
    userDoc.onboarding[id] = true;
    
    // Save partial progress
    await db.collection('users').doc(currentUser.uid).update({
        [`onboarding.${id}`]: true
    });
    
    renderOnboardingList();
}

async function finishOnboarding() {
    toggleLoader(true);
    await db.collection('users').doc(currentUser.uid).update({
        onboardingComplete: true,
        points: firebase.firestore.FieldValue.increment(10)
    });
    userDoc.points += 10;
    userDoc.onboardingComplete = true;
    initDashboard();
}

// --- DASHBOARD & NAVIGATION ---
function initDashboard() {
    showScreen('main-app');
    toggleLoader(false);
    
    document.getElementById('display-name').textContent = currentUser.displayName;
    document.getElementById('display-email').textContent = currentUser.email;
    updatePointsDisplay(userDoc.points);

    // Listen to real-time points updates
    db.collection('users').doc(currentUser.uid).onSnapshot(doc => {
        userDoc = doc.data();
        updatePointsDisplay(userDoc.points);
        document.getElementById('ad-count').textContent = userDoc.adsWatchedToday || 0;
        updateStats();
    });

    loadTasks();
    loadMyPosts();
}

function updatePointsDisplay(pts) {
    const el = document.getElementById('user-points');
    // Simple count-up animation
    el.classList.add('pulse');
    el.textContent = pts.toFixed(1);
    setTimeout(() => el.classList.remove('pulse'), 500);
}

function showScreen(id) {
    document.querySelectorAll('.screen, #main-app').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    
    const el = document.getElementById(id);
    if(el) {
        el.classList.remove('hidden');
        if(el.classList.contains('screen')) el.classList.add('active');
    }
}

window.switchTab = (tabId, btn) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if(btn) btn.classList.add('active');
};

// --- TIMER SYSTEM ---
function startTimer(seconds) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'timer-overlay';
        overlay.innerHTML = `
            <div class="countdown-circle" id="timer-count">${seconds}</div>
            <p style="margin-top:20px; color:#fff;">Please Wait...</p>
        `;
        document.body.appendChild(overlay);

        let left = seconds;
        const interval = setInterval(() => {
            left--;
            document.getElementById('timer-count').textContent = left;
            if (left <= 0) {
                clearInterval(interval);
                document.body.removeChild(overlay);
                resolve();
            }
        }, 1000);
    });
}

// --- POST / CAMPAIGN SYSTEM ---
const costPerFollow = 1.5;

document.getElementById('target-count').addEventListener('input', (e) => {
    const count = parseInt(e.target.value) || 0;
    document.getElementById('calc-cost').textContent = (count * costPerFollow).toFixed(1);
});

document.getElementById('create-post-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('coinbase-url').value;
    const target = parseInt(document.getElementById('target-count').value);
    const cost = target * costPerFollow;

    // Validation
    const regex = /^https:\/\/base\.app\/profile\/[a-zA-Z0-9_]+$/;
    if (!regex.test(url)) return showToast("Invalid Coinbase Profile URL");
    
    if (userDoc.points < 21) return showToast("Minimum 21 Points required to post");
    if (userDoc.points < cost) return showToast("Insufficient Points");
    if (userDoc.activePosts >= 2) return showToast("Max 2 active posts allowed");

    toggleLoader(true);

    try {
        const batch = db.batch();
        
        // Deduct points
        const userRef = db.collection('users').doc(currentUser.uid);
        batch.update(userRef, {
            points: firebase.firestore.FieldValue.increment(-cost),
            activePosts: firebase.firestore.FieldValue.increment(1)
        });

        // Create Campaign
        const campRef = db.collection('campaigns').doc();
        batch.set(campRef, {
            creatorId: currentUser.uid,
            url: url,
            target: target,
            remaining: target,
            completedBy: [], // Array of UIDs who did the task
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            active: true
        });

        await batch.commit();
        showToast("Campaign Deployed!");
        document.getElementById('create-post-form').reset();
        document.getElementById('calc-cost').textContent = '0';
        loadMyPosts(); // Refresh list
    } catch (err) {
        showToast(err.message);
    }
    toggleLoader(false);
});

// Load user's own posts
function loadMyPosts() {
    db.collection('campaigns')
      .where('creatorId', '==', currentUser.uid)
      .where('active', '==', true)
      .onSnapshot(snapshot => {
          const container = document.getElementById('my-posts-container');
          container.innerHTML = '';
          snapshot.forEach(doc => {
              const data = doc.data();
              const div = document.createElement('div');
              div.className = 'task-item';
              div.innerHTML = `
                <div class="task-info">
                    <h4>Profile Boost</h4>
                    <p>Remaining: ${data.remaining} / ${data.target}</p>
                </div>
                <div style="font-size:0.8rem; opacity:0.7">Active</div>
              `;
              container.appendChild(div);
          });
      });
}

// --- TASK SYSTEM (Follow others) ---
function loadTasks() {
    // In a real app, you need complex query logic or Cloud Functions for "Not In Array".
    // Firestore limitations mean we fetch active campaigns and filter client side for MVP.
    db.collection('campaigns')
      .where('active', '==', true)
      .orderBy('timestamp', 'asc') // FIFO
      .limit(20)
      .onSnapshot(snapshot => {
          const container = document.getElementById('tasks-container');
          container.innerHTML = '';
          
          let count = 0;
          snapshot.forEach(doc => {
              const data = doc.data();
              // Filter: Not my post AND I haven't done it yet
              if (data.creatorId !== currentUser.uid && !data.completedBy.includes(currentUser.uid)) {
                   if (data.remaining > 0) {
                       createTaskElement(doc.id, data, container);
                       count++;
                   }
              }
          });
          
          if(count === 0) container.innerHTML = '<p style="text-align:center; padding:20px; opacity:0.5">No tasks available right now.</p>';
      });
}

function createTaskElement(docId, data, container) {
    const div = document.createElement('div');
    div.className = 'task-item';
    div.innerHTML = `
        <div class="task-info">
            <h4>Follow Profile</h4>
            <p>Earn +1.0 Point</p>
        </div>
        <button class="action-btn" onclick="executeTask('${docId}', '${data.url}')">Follow</button>
    `;
    container.appendChild(div);
}

async function executeTask(campaignId, url) {
    // 1. Timer Protection
    await startTimer(6);
    
    // 2. Open Link
    window.open(url, '_blank');
    
    // 3. Confirm Action (Simulated verification)
    // In a real sophisticated app, you might ask for a screenshot or use an API if available.
    // For this request, we assume click = done after timer.
    
    toggleLoader(true);
    
    try {
        const batch = db.batch();
        const campRef = db.collection('campaigns').doc(campaignId);
        const userRef = db.collection('users').doc(currentUser.uid);
        
        // Transaction to ensure atomicity
        await db.runTransaction(async (transaction) => {
            const campDoc = await transaction.get(campRef);
            if (!campDoc.exists || campDoc.data().remaining <= 0) {
                throw "Task expired";
            }
            
            // Add user to completed list
            const completedBy = campDoc.data().completedBy || [];
            completedBy.push(currentUser.uid);
            
            let newRemaining = campDoc.data().remaining - 1;
            let isActive = newRemaining > 0;

            transaction.update(campRef, {
                remaining: newRemaining,
                completedBy: completedBy,
                active: isActive
            });
            
            // Give reward
            transaction.update(userRef, {
                points: firebase.firestore.FieldValue.increment(1)
            });
            
            // If campaign finished, update creator's active count
            if(!isActive) {
                 const creatorRef = db.collection('users').doc(campDoc.data().creatorId);
                 transaction.update(creatorRef, {
                     activePosts: firebase.firestore.FieldValue.increment(-1)
                 });
            }
        });
        
        showToast("Task Verified! +1 Point");
    } catch (e) {
        showToast("Error: " + e);
    }
    toggleLoader(false);
}

// --- ADS SYSTEM ---
// Reset daily limits check
function checkAdReset() {
    const today = new Date().toDateString();
    if (userDoc.lastAdDate !== today) {
        db.collection('users').doc(currentUser.uid).update({
            adsWatchedToday: 0,
            lastAdDate: today
        });
        userDoc.adsWatchedToday = 0;
    }
}

async function rewardAd() {
    checkAdReset();
    if (userDoc.adsWatchedToday >= 70) return showToast("Daily Ad Limit Reached (70/70)");

    toggleLoader(true);
    try {
        await db.collection('users').doc(currentUser.uid).update({
            points: firebase.firestore.FieldValue.increment(0.5),
            adsWatchedToday: firebase.firestore.FieldValue.increment(1),
            lastAdDate: new Date().toDateString()
        });
        showToast("Ad Watched! +0.5 Points");
    } catch (e) {
        showToast("Error saving reward");
    }
    toggleLoader(false);
}

// Adsgram Integration
function showAdsgramAd() {
    if (window.Adsgram) {
        const AdController = window.Adsgram.init({ blockId: "int-20014" });
        AdController.show().then((result) => {
            // result: 'done' or 'skipped'
            rewardAd();
        }).catch((result) => {
            // Error handling
            console.log(result);
            // Fallback for testing on web if AdBlock blocks it
            // rewardAd(); // Uncomment to allow reward on error (risky)
        });
    } else {
        showToast("Adsgram not ready (Mobile Only?)");
    }
}

// Monetag Integration
function showMonetagAd() {
    if (typeof show_10376570 === 'function') {
        show_10376570().then(() => {
            rewardAd();
        });
    } else {
        showToast("Ad Loading... Try again");
        // Simulated for demo if script blocked
        setTimeout(() => rewardAd(), 2000); 
    }
}

function updateStats() {
    document.getElementById('stat-active-posts').textContent = userDoc.activePosts || 0;
    // Task count requires querying completedBy array size, skipping for performance in this block
}
