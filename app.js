// DOM Elements
const authForms = document.getElementById('authForms');
const chatInterface = document.getElementById('chatInterface');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginToggle = document.getElementById('loginToggle');
const registerToggle = document.getElementById('registerToggle');
const userNameElement = document.getElementById('userName');
const logoutBtn = document.getElementById('logoutBtn');
const newChatEmail = document.getElementById('newChatEmail');
const addChatBtn = document.getElementById('addChatBtn');
const chatList = document.getElementById('chatList');
const noChatSelected = document.getElementById('noChatSelected');
const activeChatArea = document.getElementById('activeChatArea');
const currentChatUser = document.getElementById('currentChatUser');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendMessage = document.getElementById('sendMessage');
const emojiButton = document.getElementById('emojiButton');

// Firebase references
const auth = firebase.auth();
const db = firebase.firestore();

// Global variables
let currentUser = null;
let currentChat = null;
let unsubscribeMessages = null;

// Auth state observer
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        showChatInterface();
        loadUserChats();
    } else {
        currentUser = null;
        showAuthForms();
    }
});

// Toggle between login and register forms
loginToggle.addEventListener('click', () => {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    loginToggle.classList.add('active');
    registerToggle.classList.remove('active');
});

registerToggle.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    loginToggle.classList.remove('active');
    registerToggle.classList.add('active');
});

// Login form handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        await auth.signInWithEmailAndPassword(email, password);
        loginForm.reset();
    } catch (error) {
        alert(error.message);
    }
});

// Register form handler
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('users').doc(userCredential.user.uid).set({
            name,
            email
        });
        registerForm.reset();
    } catch (error) {
        alert(error.message);
    }
});

// Logout handler
logoutBtn.addEventListener('click', () => {
    auth.signOut();
});

// Add new chat handler
addChatBtn.addEventListener('click', async () => {
    const email = newChatEmail.value.trim();
    if (!email) return;

    try {
        const userQuery = await db.collection('users').where('email', '==', email).get();
        if (userQuery.empty) {
            alert('User not found');
            return;
        }

        const otherUser = userQuery.docs[0];
        if (otherUser.id === currentUser.uid) {
            alert('You cannot chat with yourself');
            return;
        }

        const chatId = getChatId(currentUser.uid, otherUser.id);
        await db.collection('chats').doc(chatId).set({
            users: [currentUser.uid, otherUser.id],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        newChatEmail.value = '';
    } catch (error) {
        alert(error.message);
    }
});

// Initialize emoji picker
const picker = new EmojiButton({
    position: 'top-start',
    theme: 'light',
    autoHide: false,
    emojisPerRow: 8,
    rows: 4,
    showPreview: false,
    showSearch: true,
    showRecents: true,
    rootElement: document.getElementById('chatInterface'),
    styleProperties: {
        '--emoji-size': '1.5rem',
        '--emoji-padding': '0.5rem',
        '--background-color': '#ffffff',
        '--hover-color': '#f1f5f9'
    }
});

picker.on('emoji', selection => {
    const cursorPos = messageInput.selectionStart;
    const textBeforeCursor = messageInput.value.substring(0, cursorPos);
    const textAfterCursor = messageInput.value.substring(cursorPos);
    messageInput.value = textBeforeCursor + selection.emoji + textAfterCursor;
    messageInput.selectionStart = cursorPos + selection.emoji.length;
    messageInput.selectionEnd = cursorPos + selection.emoji.length;
    messageInput.focus();
});

emojiButton.addEventListener('click', () => {
    picker.togglePicker(emojiButton);
});

// Close emoji picker when clicking outside
document.addEventListener('click', (e) => {
    if (!emojiButton.contains(e.target) && !picker.pickerEl?.contains(e.target)) {
        picker.hidePicker();
    }
});

// Handle message input with emoji support
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendNewMessage();
    }
});

// Send message handler
sendMessage.addEventListener('click', sendNewMessage);

async function sendNewMessage() {
    if (!currentChat || !messageInput.value.trim()) return;

    try {
        await db.collection('chats').doc(currentChat).collection('messages').add({
            text: messageInput.value,
            senderId: currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        messageInput.value = '';
    } catch (error) {
        alert(error.message);
    }
}

// Helper functions
function showAuthForms() {
    authForms.classList.remove('hidden');
    chatInterface.classList.add('hidden');
}

function showChatInterface() {
    authForms.classList.add('hidden');
    chatInterface.classList.remove('hidden');
    loadUserInfo();
}

async function loadUserInfo() {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const userData = userDoc.data();
    userNameElement.textContent = userData.name;
}

function getChatId(uid1, uid2) {
    return [uid1, uid2].sort().join('_');
}

async function loadUserChats() {
    const unsubscribe = db.collection('chats')
        .where('users', 'array-contains', currentUser.uid)
        .onSnapshot(async (snapshot) => {
            chatList.innerHTML = '';
            
            for (const change of snapshot.docChanges()) {
                if (change.type === 'added' || change.type === 'modified') {
                    const chat = change.doc;
                    const otherUserId = chat.data().users.find(id => id !== currentUser.uid);
                    const otherUserDoc = await db.collection('users').doc(otherUserId).get();
                    const otherUserData = otherUserDoc.data();

                    const chatElement = document.createElement('div');
                    chatElement.className = 'chat-item';
                    chatElement.innerHTML = `
                        <i class="fas fa-user-circle"></i>
                        <span>${otherUserData.name}</span>
                    `;
                    chatElement.addEventListener('click', () => {
                        document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
                        chatElement.classList.add('active');
                        selectChat(chat.id, otherUserData.name);
                    });
                    chatList.appendChild(chatElement);
                }
            }
        });
}

function selectChat(chatId, otherUserName) {
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }

    currentChat = chatId;
    currentChatUser.textContent = otherUserName;
    noChatSelected.classList.add('hidden');
    activeChatArea.classList.remove('hidden');
    messagesContainer.innerHTML = '';

    // Load and listen to messages
    unsubscribeMessages = db.collection('chats').doc(chatId)
        .collection('messages')
        .orderBy('timestamp')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const message = change.doc.data();
                    const messageElement = document.createElement('div');
                    messageElement.className = `message ${message.senderId === currentUser.uid ? 'sent' : 'received'}`;
                    messageElement.textContent = message.text;
                    messagesContainer.appendChild(messageElement);
                    
                    // Scroll to the latest message with smooth animation
                    messageElement.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
}
