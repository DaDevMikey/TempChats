// ==========================================================================
// Release notes shown in the in-app "What's new" dialog.
// Bump CURRENT_RELEASE whenever a new entry is added so the dialog is
// surfaced once to every user.
// ==========================================================================

export const CURRENT_RELEASE = '2.1.0';

export const RELEASE_NOTES = [
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
