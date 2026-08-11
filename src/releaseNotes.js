// ==========================================================================
// Release notes shown in the in-app "What's new" dialog.
// Bump CURRENT_RELEASE whenever a new entry is added so the dialog is
// surfaced once to every user.
// ==========================================================================

export const CURRENT_RELEASE = '2.2.0';

export const RELEASE_NOTES = [
  {
    version: '2.2.0',
    date: 'August 2026',
    highlights: [
      {
        icon: 'science',
        title: 'Turn on direct messages yourself',
        description:
          'Direct messages now have a switch in Settings, so you no longer have to wait to be picked. Accounts that are not in the beta also get a small chance of being added every time the app loads, and once you are in you stay in unless you switch it off yourself.',
        badge: 'Beta — gradual rollout'
      },
      {
        icon: 'shield_lock',
        title: 'Hardened security rules',
        description:
          'Direct threads and their encryption keys are readable only by the two people in them, usernames and handles can no longer be changed or impersonated, and messages and rooms can only be edited or deleted by the people they belong to.'
      },
      {
        icon: 'delete_sweep',
        title: 'Delete a direct chat early',
        description: 'Remove a direct thread and everything in it straight from the direct messages list instead of waiting 24 hours.'
      }
    ]
  },
  {
    version: '2.1.0',
    date: 'August 2026',
    highlights: [
      {
        icon: 'forum',
        title: 'Direct messages',
        description:
          'Every account now gets a random handle you can share so people can message you one to one. Direct chats are end-to-end encrypted and clear themselves after 24 hours.',
        badge: 'Beta — gradual rollout'
      },
      {
        icon: 'right_click',
        title: 'Right-click message actions',
        description:
          'Right-clicking a message on desktop opens the same action sheet as long-pressing on mobile, including copy, reply, edit and delete.'
      },
      {
        icon: 'news',
        title: 'Release notes',
        description: 'This dialog. Reopen it any time from Settings → What\u2019s new.'
      }
    ]
  },
  {
    version: '2.0.0',
    date: 'July 2026',
    highlights: [
      {
        icon: 'phone_android',
        title: 'Mobile-first redesign',
        description:
          'Material 3 Expressive layouts with One UI ergonomics, safe-area handling and on-screen keyboard awareness.'
      },
      {
        icon: 'touch_app',
        title: 'Touch message actions',
        description: 'Long-press any message to react, reply, copy, edit or delete it.'
      },
      {
        icon: 'bolt',
        title: 'Faster rooms',
        description: 'Windowed message listeners and cached decryption keep long rooms smooth on low-end phones.'
      }
    ]
  }
];
