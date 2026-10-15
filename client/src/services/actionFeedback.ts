export type ActionFeedback = { kind: 'success' | 'error'; message: string };
const eventName = 'shelflife:action-feedback';

export function publishActionFeedback(detail: ActionFeedback) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<ActionFeedback>(eventName, { detail }));
}

export function actionFeedbackEventName() {
  return eventName;
}
