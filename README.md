# TempChats

Secure, temporary chat rooms that auto-destruct. Built with React 18, Vite, and Material 3 Expressive design.

**Live Demo:** [https://tempchats.web.app/](https://tempchats.web.app/)

## Features

- **Instant Rooms** — Create a chat room in seconds with a unique share code
- **No Registration** — Just pick a username and start chatting anonymously
- **Message Actions Everywhere** — Hover or right-click on desktop, long-press on mobile, to react, reply, copy, edit, or delete
- **Direct Messages (Beta)** — Every account gets a random handle for one-to-one, end-to-end encrypted chats that clear after 24 hours. Rolling out gradually: every app load gives a non-beta account a small chance of being enrolled (enrolment never reverts on its own), and anyone can opt in or out at will from Settings. Backed by the `tags.beta` / `tags.betaOptOut` flags on the Firestore user document
- **Release Notes** — In-app "What's new" dialog, shown once per version and reopenable from Settings
- **Mobile First** — Responsive Material 3 Expressive layouts with One UI ergonomics, safe-area and on-screen keyboard handling
- **Prominent Room Cards** — Modern M3 cards with expiration badges and direct Join buttons
- **Read Receipts** — Optional room feature displaying who has read the latest messages
- **Auto-Destruct** — Rooms and all messages are permanently deleted when they expire
- **Private Rooms** — Lock rooms with a 6-character code so only invited people can join
- **Real-Time** — Messages, typing indicators, and room updates stream live via Firestore
- **Content Moderation** — Built-in word filtering with minimal and advanced levels
- **Privacy & Trust** — Dedicated Privacy Terms modal, zero tracking cookies, user data control
- **Account Hand-over** — Logging out transfers room ownership to active chatters or wipes abandoned rooms
- **Secure** — Firebase Anonymous Auth, strict Firestore security rules, input sanitization

## Tech Stack

- **Frontend:** React 18, Vite (Fast HMR & build optimization)
- **Design System:** Material 3 Expressive with One UI inspired ergonomics (custom CSS implementation)
- **Database:** Firebase Firestore (real-time listeners)
- **Auth:** Firebase Anonymous Authentication
- **Icons:** Material Symbols Rounded
- **Font:** Inter (Google Fonts)

## Getting Started

### Prerequisites

- Node.js (v16+)
- A Firebase project ([create one here](https://console.firebase.google.com))

### Installation & Local Dev

1. **Clone repository**:
   ```bash
   git clone https://github.com/DaDevMikey/TempChats.git
   cd TempChats
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Copy your config**:
   Paste your Firebase credentials into `config/firebase.js`.
4. **Deploy Firestore security rules**:
   ```bash
   firebase deploy --only firestore:rules
   ```
5. **Run dev server**:
   ```bash
   npm run dev
   ```

### Deploying to Vercel

1. In your Vercel project settings, add the following Environment Variables:
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`
2. Set the **Build Command** to: `npm run build`
3. Set the **Output Directory** to: `dist`
4. Deploy!

## License

CC0-1.0 — Public Domain

## Author

[@DaDevMikey](https://github.com/DaDevMikey) · [Nexas Development](https://nexas-development.vercel.app/)
