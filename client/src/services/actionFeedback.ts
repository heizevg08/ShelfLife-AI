export type ActionFeedback = { kind: 'success' | 'error'; message: string };
const eventName = 'shelflife:action-feedback';

/**
 * Broadcast a one-off action result so the app shell can show it as a toast.
 *
 * @param detail - the message to show and whether it reports success or failure.
 */
export function publishActionFeedback(detail: ActionFeedback) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<ActionFeedback>(eventName, { detail }));
}

/**
 * The window event that carries action feedback to the app shell.
 *
 * @returns the event name to subscribe to.
 */
export function actionFeedbackEventName() {
  return eventName;
}
