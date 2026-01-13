/**
 * Modal Tools Module
 * Handles modal state management
 */

export const modalModule = {
  name: 'modal',
  version: '1.0.0',
  
  tools: {
    '@core/openModal': {
      metadata: {
        id: '@core/openModal',
        name: 'Open Modal',
        description: 'Open modal with random content',
      },
      execute: (actor, payload) => {
        const randomTitles = [
          '🎉 Random Modal!',
          '✨ Surprise!',
          '🚀 Hello There!',
          '💫 Magic Moment',
          '🌟 Special Message',
          '🎊 Celebration!',
          '⚡ Quick Info',
          '🎈 Fun Fact'
        ];

        const randomContents = [
          'This is a randomly generated modal! The content changes every time you open it.',
          'Did you know that modals are great for displaying important information without navigating away?',
          'Shadow DOM isolation means this modal is completely contained within the todo actor!',
          'You can click outside the modal or the X button to close it.',
          'The modal uses backdrop blur for a modern glassmorphism effect.',
          'This modal is styled with the light theme.',
          'Try opening it multiple times to see different random content!',
          'The modal button is fixed at the bottom center of the todo app.'
        ];

        const randomTitle = randomTitles[Math.floor(Math.random() * randomTitles.length)];
        const randomContent = randomContents[Math.floor(Math.random() * randomContents.length)];

        actor.context.modalOpen = true;
        actor.context.modalTitle = randomTitle;
        actor.context.modalContent = randomContent;
      }
    },

    '@core/closeModal': {
      metadata: {
        id: '@core/closeModal',
        name: 'Close Modal',
        description: 'Close the modal',
      },
      execute: (actor, payload) => {
        actor.context.modalOpen = false;
      }
    },
  }
};
