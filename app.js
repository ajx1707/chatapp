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
const profileButton = document.getElementById('profileButton');
const profileModal = document.getElementById('profileModal');
const closeModal = document.querySelector('.close-modal');
const profilePicInput = document.getElementById('profilePicInput');
const profilePreview = document.getElementById('profilePreview');
const saveProfilePic = document.getElementById('saveProfilePic');
const userProfilePic = document.getElementById('userProfilePic');

// Firebase references
const auth = firebase.auth();
const db = firebase.firestore();

// Global variables
let currentUser = null;
let currentChat = null;
let unsubscribeMessages = null;

// Context Menu Elements
let activeContextMenu = null;

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
    autoHide: true,  // Changed to true to properly hide/show
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

picker.on('emoji', emoji => {
    const cursorPos = messageInput.selectionStart;
    const start = messageInput.value.substring(0, cursorPos);
    const end = messageInput.value.substring(cursorPos);
    messageInput.value = start + emoji + end;
    messageInput.focus();
});

emojiButton.addEventListener('click', (e) => {
    e.stopPropagation();  // Prevent event bubbling
    picker.pickerVisible ? picker.hidePicker() : picker.showPicker(emojiButton);
});

// Close emoji picker when clicking outside
document.addEventListener('click', (e) => {
    if (picker.pickerVisible && !emojiButton.contains(e.target) && !picker.pickerEl?.contains(e.target)) {
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
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (error) {
        alert(error.message);
    }
}

// Create context menu function
function createContextMenu(items, x, y) {
    // Remove any existing context menu
    if (activeContextMenu) {
        activeContextMenu.remove();
    }

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    
    items.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.className = `context-menu-item ${item.class || ''}`;
        menuItem.innerHTML = `<i class="${item.icon}"></i>${item.text}`;
        menuItem.addEventListener('click', (e) => {
            e.stopPropagation();
            item.onClick();
            menu.remove();
            activeContextMenu = null;
        });
        menu.appendChild(menuItem);
    });

    document.body.appendChild(menu);
    
    // Position the menu after it's added to get proper dimensions
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Check if menu would go off the right side
    if (x + menuRect.width > viewportWidth) {
        x = viewportWidth - menuRect.width - 10;
    }

    // Check if menu would go off the bottom
    if (y + menuRect.height > viewportHeight) {
        y = viewportHeight - menuRect.height - 10;
    }

    // Ensure menu doesn't go off the left or top
    x = Math.max(10, x);
    y = Math.max(10, y);

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    activeContextMenu = menu;

    // Add click outside listener
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                activeContextMenu = null;
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 0);
}

// Function to add message to container with context menu
function addMessageToContainer(message, senderId) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', senderId === currentUser.uid ? 'sent' : 'received');
    messageElement.textContent = message.text;
    messageElement.dataset.messageId = message.id;

    // Add context menu for messages
    messageElement.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        // Only allow deletion of own messages
        if (senderId === currentUser.uid) {
            const rect = messageElement.getBoundingClientRect();
            let x = e.clientX;
            let y = e.clientY;

            // If on mobile, center the menu
            if (window.innerWidth <= 768) {
                x = window.innerWidth / 2;
                y = window.innerHeight / 2;
            }

            createContextMenu([
                {
                    text: 'Delete Message',
                    icon: 'fas fa-trash',
                    class: 'delete',
                    onClick: async () => {
                        try {
                            await db.collection('chats').doc(currentChat)
                                .collection('messages').doc(message.id).delete();
                            messageElement.remove();
                        } catch (error) {
                            alert('Error deleting message: ' + error.message);
                        }
                    }
                }
            ], x, y);
        }
    });

    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Add context menu for chat list items
function createChatListItem(chatId, otherUserName) {
    const chatItem = document.createElement('div');
    chatItem.className = 'chat-list-item';
    chatItem.innerHTML = `
        <i class="fas fa-user-circle"></i>
        <span>${otherUserName}</span>
    `;
    
    chatItem.addEventListener('click', () => selectChat(chatId, otherUserName));
    
    // Add context menu
    chatItem.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        createContextMenu([
            {
                text: 'Delete Conversation',
                icon: 'fas fa-trash',
                class: 'delete',
                onClick: async () => {
                    if (confirm('Are you sure you want to delete this conversation?')) {
                        try {
                            // Delete all messages
                            const messagesRef = db.collection('chats').doc(chatId).collection('messages');
                            const messages = await messagesRef.get();
                            const batch = db.batch();
                            messages.docs.forEach((doc) => {
                                batch.delete(doc.ref);
                            });
                            await batch.commit();
                            
                            // Delete chat document
                            await db.collection('chats').doc(chatId).delete();
                            
                            // Remove from UI
                            chatItem.remove();
                            if (currentChat === chatId) {
                                currentChat = null;
                                noChatSelected.classList.remove('hidden');
                                activeChatArea.classList.add('hidden');
                            }
                        } catch (error) {
                            alert('Error deleting conversation: ' + error.message);
                        }
                    }
                }
            }
        ], e.pageX, e.pageY);
    });
    
    return chatItem;
}

// Update the loadUserChats function to use the new createChatListItem
async function loadUserChats() {
    chatList.innerHTML = '';
    const chatsQuery = await db.collection('chats')
        .where('users', 'array-contains', currentUser.uid)
        .get();

    for (const chatDoc of chatsQuery.docs) {
        const chatData = chatDoc.data();
        const otherUserId = chatData.users.find(id => id !== currentUser.uid);
        const otherUserDoc = await db.collection('users').doc(otherUserId).get();
        const otherUserName = otherUserDoc.data().name;
        
        const chatItem = createChatListItem(chatDoc.id, otherUserName);
        chatList.appendChild(chatItem);
    }
}

// Update the selectChat function to include message IDs
async function selectChat(chatId, otherUserName) {
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }

    currentChat = chatId;
    currentChatUser.textContent = otherUserName;
    messagesContainer.innerHTML = '';
    noChatSelected.classList.add('hidden');
    activeChatArea.classList.remove('hidden');

    // Load and listen to messages
    unsubscribeMessages = db.collection('chats').doc(chatId)
        .collection('messages')
        .orderBy('timestamp')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const message = {
                        ...change.doc.data(),
                        id: change.doc.id  // Include the message ID
                    };
                    addMessageToContainer(message, message.senderId);
                }
            });
        });
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
    
    // Set profile picture if exists
    if (userData.profilePicture) {
        userProfilePic.src = userData.profilePicture;
        profilePreview.src = userData.profilePicture;
    } else {
        // Set default avatar with user's initials
        const initials = userData.name.split(' ').map(n => n[0]).join('').toUpperCase();
        const defaultAvatar = `https://ui-avatars.com/api/?name=${initials}&background=7c3aed&color=fff`;
        userProfilePic.src = defaultAvatar;
        profilePreview.src = defaultAvatar;
    }
}

function getChatId(uid1, uid2) {
    return [uid1, uid2].sort().join('_');
}

// Profile Picture Handlers
profileButton.addEventListener('click', () => {
    profileModal.classList.remove('hidden');
});

closeModal.addEventListener('click', () => {
    profileModal.classList.add('hidden');
    // Reset preview
    const currentPic = userProfilePic.src;
    profilePreview.src = currentPic;
    profilePicInput.value = '';
    saveProfilePic.disabled = true;
});

profilePicInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert('Image size should be less than 5MB');
            profilePicInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            profilePreview.src = e.target.result;
            saveProfilePic.disabled = false;
        };
        reader.readAsDataURL(file);
    }
});

saveProfilePic.addEventListener('click', async () => {
    try {
        const imageData = profilePreview.src;
        
        // Update user profile in Firestore
        await db.collection('users').doc(currentUser.uid).update({
            profilePicture: imageData
        });

        // Update UI
        userProfilePic.src = imageData;
        profileModal.classList.add('hidden');
        saveProfilePic.disabled = true;
        profilePicInput.value = '';
    } catch (error) {
        alert('Error updating profile picture: ' + error.message);
    }
});

// Close modal when clicking outside
profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) {
        profileModal.classList.add('hidden');
        // Reset preview
        const currentPic = userProfilePic.src;
        profilePreview.src = currentPic;
        profilePicInput.value = '';
        saveProfilePic.disabled = true;
    }
});
