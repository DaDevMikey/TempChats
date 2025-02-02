# TempChats

Create temporary chatrooms for you and your friends!

This repository contains the source code for TempChats, a web application that allows users to quickly and easily create temporary chatrooms for private conversations.  No accounts are required, making it perfect for quick chats, sharing links, or collaborating on the fly.

**Live Demo:** [https://tempchats.web.app/](https://tempchats.web.app/)

## Features

* **Instant Chatrooms:** Create a new chatroom with a single click.  A unique Code is generated that you can share with others.
* **No Registration:**  No accounts or sign-ups are needed. Start chatting immediately.
* **Temporary:** Chatrooms are ephemeral.  They disappear after a period of inactivity (currently approximately 24 hours).
* **Simple Interface:** Clean and intuitive design for a seamless user experience.
* **Secure:**  While messages are not end-to-end encrypted, the temporary nature of the chatrooms provides a degree of privacy.  (See Security Considerations below for more details).

## Technologies Used

* **Frontend:**
    * HTML
    * CSS
    * JavaScript
* **Backend:** Client-side only
* **Database:** Firebase Firestore
* **Hosting:** Firebase Hosting

## Development

### Prerequisites

* Node.js and npm (or yarn)
* Firebase CLI: `npm install -g firebase-tools`

### Installation

1. Clone the repository: `git clone https://github.com/DaDevMikey/TempChats.git`
2. Navigate to the project directory: `cd TempChats`
3. Install dependencies: `npm install` (or `yarn install`)

### Firebase Setup

1. **Firebase Login:** `firebase login` (You'll need to authenticate with your Google account)
2. **Firebase Project Initialization:**  `firebase init`
    * Choose "Hosting" and "Firestore" when prompted.
    * Select "Use an existing project" and choose your Firebase project (or create a new one in the Firebase console).
    * Configure the public directory (usually "public").
    * Choose whether or not to configure as a single-page app (usually "yes" for modern web apps).
3. **Firebase Configuration:** You'll need to configure your Firebase project settings.  This usually involves setting up your web configuration in the Firebase console and adding the configuration details to your project (often in a `firebase.js` or similar file).  The exact steps will vary depending on your project setup, but you'll need to include API keys, project ID, etc.  *Do not commit these sensitive keys to your repository.*  A common approach is to use environment variables.

### Running the application

1. **Serve Locally:** `firebase emulators:start` (This will start both the hosting emulator and the Firestore emulator. It's highly recommended to use emulators during development) or `firebase serve` (for just hosting).
2. **Deploy:** `firebase deploy` (This will deploy your application to Firebase Hosting.)

## Security Considerations

* **Ephemeral Nature:**  The temporary nature of the chatrooms helps to protect privacy, as conversations are not permanently stored.
* **No End-to-End Encryption:**  Currently, messages are not end-to-end encrypted.  Avoid sharing highly sensitive information.
* **Security Best Practices:** Using Firebase's built-in security rules for Firestore is highly recommended.  These rules allow you to control who can read and write data to your database.

## Contributing

Contributions are welcome!  Please open an issue or submit a pull request.

## License

CC0-1.0 license

## Contact

@DaDevMikey - DaManMikey On Discord
