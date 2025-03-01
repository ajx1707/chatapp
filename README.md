# Modern Chat Application

A real-time chat application built with HTML, CSS, JavaScript, and Firebase. Features include user authentication, real-time messaging, and a modern UI.

## Features

- User authentication (login/register)
- Real-time messaging
- Add new contacts by email
- Modern and responsive UI
- Multiple chat conversations

## Setup

1. Create a Firebase project:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Authentication (Email/Password)
   - Enable Cloud Firestore

2. Get your Firebase configuration:
   - In Firebase Console, go to Project Settings
   - Under "Your apps", click the web icon (</>)
   - Register your app and copy the Firebase configuration object

3. Update the Firebase configuration:
   - Open `firebase-config.js`
   - Replace the placeholder config object with your Firebase configuration

4. Deploy to GitHub Pages:
   - Create a new GitHub repository
   - Push your code to the repository
   - Go to repository Settings > Pages
   - Enable GitHub Pages and select your main branch
   - Your site will be published at `https://<username>.github.io/<repository-name>`

## Security Rules

Add these security rules to your Firebase Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    match /chats/{chatId} {
      allow read, write: if request.auth != null && 
        resource.data.users[request.auth.uid] != null;
      match /messages/{messageId} {
        allow read, write: if request.auth != null && 
          get(/databases/$(database)/documents/chats/$(chatId)).data.users[request.auth.uid] != null;
      }
    }
  }
}
```

## Usage

1. Register with your email and name
2. Login with your credentials
3. Add new contacts using their email address
4. Start chatting!
