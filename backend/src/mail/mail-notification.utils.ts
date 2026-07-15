export const MAIL_NOTIFICATION_COPY = {
  newMailReceived: {
    title: 'New Mail Received',
    body: 'You have a new mail thread.',
  },
  mailAssigned: {
    title: 'Mail Assigned to You',
    body: 'A mail thread was assigned to you.',
  },
  mailReply: {
    title: 'New Reply in Mail Thread',
    body: 'A mail thread has a new reply.',
  },
  mailStatusUpdated(status: string) {
    return {
      title: 'Mail Status Updated',
      body: `A mail thread status was updated to ${status}.`,
    };
  },
};
