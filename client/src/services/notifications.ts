import type { SessionUser } from './auth';
import { listAuditRecords } from './administration';
import { listAccountRequests } from './accountRequests';
import { listChangeRequests } from './changeRequests';
import { listIngredientRequests } from './ingredientRequests';
import { listInventoryBatches, inventoryBatchSummary } from './inventoryBatches';

export type NotificationSource = 'audit' | 'account-request' | 'change-request' | 'ingredient-request' | 'inventory-batch' | 'inventory-summary';
export type NotificationReviewAction = {
  type: 'account-request' | 'change-request' | 'ingredient-request';
  requestId: string;
  expectedVersion: number;
};
export type NotificationItem = {
  id: string;
  source: NotificationSource;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  reviewAction?: NotificationReviewAction;
};
export type NotificationFeed = { items: NotificationItem[]; failedSources: NotificationSource[] };

type NotificationTask = { source: NotificationSource; load: () => Promise<NotificationItem[]> };

const humanize = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').toLowerCase();

function auditNotifications(user: SessionUser, signal: AbortSignal) {
  return listAuditRecords(1, 50, 'desc', {}, signal).then(({ items }) => items
    .filter(record => record.targetType !== 'AccountRequest' && !(user.role === 'Super Admin' && record.targetType === 'ChangeRequest'))
    .map(record => {
      const target = humanize(record.targetType);
      const title = record.targetType === 'User' || record.targetType === 'AccountRequest'
        ? 'Account activity'
        : record.action.startsWith('CHANGE_REQUEST') ? 'Change request activity' : 'System activity';
      const action = ({
        CREATE: 'created', UPDATE: 'updated', DELETE: 'deleted', DEACTIVATE: 'deactivated', REACTIVATE: 'reactivated',
        CHANGE_REQUEST_SUBMITTED: 'submitted a change request for', CHANGE_REQUEST_APPROVED: 'approved a change request for',
        CHANGE_REQUEST_REJECTED: 'rejected a change request for',
      } as Record<string, string>)[record.action] ?? humanize(record.action);
      return {
        id: `audit:${record.id}`,
        source: 'audit' as const,
        title,
        message: `${record.actor.name} ${action} ${target}.`,
        timestamp: record.timestamp,
        read: false,
      };
    }));
}

function accountRequestNotifications(user: SessionUser, signal: AbortSignal) {
  return listAccountRequests(signal).then(({ items }) => items.map(request => {
    const ownRequest = request.requestedBy.id === user.id;
    const name = `${request.firstName} ${request.lastName}`.trim();
    const status = request.status.toLowerCase();
    const pending = request.status === 'Pending';
    return {
      id: `account-request:${request.id}:${request.status}:${request.updatedAt}`,
      source: 'account-request' as const,
      title: pending ? ownRequest ? 'Account request submitted' : 'Account request awaiting review' : `Account request ${status}`,
      message: ownRequest
        ? pending ? `Your request to create a ${request.role} account for ${name} is awaiting review.` : `Your request to create a ${request.role} account for ${name} was ${status}.`
        : pending ? `${request.requestedBy.name} requested a ${request.role} account for ${name}.` : `The request for ${name} was ${status}.`,
      timestamp: pending ? request.createdAt : request.updatedAt,
      read: request.reviewedBy?.id === user.id,
      ...(pending && (
        user.role === 'Super Admin'
        || (user.role === 'Admin' && request.requestedBy.role !== 'Admin' && request.role !== 'Admin')
      ) ? { reviewAction: { type: 'account-request' as const, requestId: request.id, expectedVersion: request.version } } : {}),
    };
  }));
}

function changeRequestNotifications(user: SessionUser, signal: AbortSignal) {
  return listChangeRequests('?page=1&limit=50', signal).then(({ items }) => items.map(request => {
    const status = request.status.toUpperCase();
    const pending = status === 'PENDING';
    const target = humanize(request.targetField ?? 'ingredient');
    const requestId = request.requestID ?? request.id.slice(-8);
    const title = pending
      ? user.role === 'Inventory Manager' ? 'Change request needs review' : user.role === 'Super Admin' ? 'New change request' : 'Change request submitted'
      : `Change request ${status.toLowerCase()}`;
    return {
      id: `change-request:${request.id}:${status}:${request.updatedAt}`,
      source: 'change-request' as const,
      title,
      message: `Request ${requestId} to change ${target} ${pending ? 'is pending review' : `was ${status.toLowerCase()}`}.`,
      timestamp: pending ? request.createdAt : request.updatedAt,
      read: request.reviewedBy === user.id,
      ...(pending && user.role === 'Inventory Manager' && !request.readOnly
        ? { reviewAction: { type: 'change-request' as const, requestId: request.id, expectedVersion: request.version } }
        : {}),
    };
  }));
}

function ingredientRequestNotifications(user: SessionUser, signal: AbortSignal) {
  return listIngredientRequests(signal).then(({ items }) => items.map(request => {
    const ownRequest = request.createdBy.id === user.id;
    const reviewedByMe = request.reviewedBy?.id === user.id;
    const status = request.status.toLowerCase();
    const pending = request.status === 'Pending';
    return {
      id: `ingredient-request:${request.id}:${request.status}:${request.updatedAt}`,
      source: 'ingredient-request' as const,
      title: pending ? ownRequest ? 'Ingredient request submitted' : 'Ingredient request needs review'
        : reviewedByMe ? 'Ingredient request reviewed' : `Ingredient request ${status}`,
      message: pending
        ? ownRequest ? `Your request to add ${request.name} is awaiting review.` : `${request.createdBy.name} requested to add ${request.name}.`
        : ownRequest ? `Your request to add ${request.name} was ${status}.`
          : reviewedByMe ? `You ${status} the request to add ${request.name}.` : `The request to add ${request.name} was ${status}.`,
      timestamp: pending ? request.createdAt : request.updatedAt,
      read: request.reviewedBy?.id === user.id,
      ...(pending && ['Inventory Manager', 'Admin', 'Super Admin'].includes(user.role)
        ? { reviewAction: { type: 'ingredient-request' as const, requestId: request.id, expectedVersion: request.version } }
        : {}),
    };
  }));
}

function inventoryNotifications(signal: AbortSignal) {
  return listInventoryBatches(1, 100, signal).then(({ items }) => items
    .filter(batch => batch.isActive && Number(batch.quantity) > 0 && batch.status !== 'Normal')
    .map(batch => {
      const expired = batch.status === 'Expired';
      const status = batch.status === 'Approaching Expiry' ? 'approaching expiration' : batch.status.toLowerCase();
      const expiration = new Date(`${batch.expirationDate}T00:00:00`).toLocaleDateString();
      return {
        id: `inventory-batch:${batch.id}:${batch.status}`,
        source: 'inventory-batch' as const,
        title: expired ? 'Expired inventory' : batch.status === 'Critical' ? 'Inventory expiring soon' : 'Approaching expiration',
        message: `Batch ${batch.batchCode} is ${status} (expiration date: ${expiration}).`,
        timestamp: batch.updatedAt,
        read: false,
      };
    }));
}

export async function fetchNotifications(user: SessionUser, signal: AbortSignal): Promise<NotificationFeed> {
  const tasks: NotificationTask[] = [
    { source: 'account-request', load: () => accountRequestNotifications(user, signal) },
    { source: 'ingredient-request', load: () => ingredientRequestNotifications(user, signal) },
    { source: 'inventory-batch', load: () => inventoryNotifications(signal) },
  ];
  if (user.role === 'Admin' || user.role === 'Super Admin') tasks.push({ source: 'audit', load: () => auditNotifications(user, signal) });
  if (user.role === 'Inventory Staff' || user.role === 'Inventory Manager' || user.role === 'Super Admin') {
    tasks.push({ source: 'change-request', load: () => changeRequestNotifications(user, signal) });
  }
  if (user.role === 'Inventory Manager') {
    tasks.push({
      source: 'inventory-summary',
      load: () => inventoryBatchSummary(signal).then(summary => summary.lowStockItems > 0 ? [{
        id: `inventory-low-stock:${summary.lowStockItems}`,
        source: 'inventory-summary' as const,
        title: 'Low stock alert',
        message: `${summary.lowStockItems} ${summary.lowStockItems === 1 ? 'ingredient is' : 'ingredients are'} at or below the configured stock threshold.`,
        timestamp: new Date().toISOString(),
        read: false,
      }] : []),
    });
  }

  const results = await Promise.allSettled(tasks.map(task => task.load()));
  const items: NotificationItem[] = [];
  const failedSources: NotificationSource[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      items.push(...result.value);
    } else failedSources.push(tasks[index].source);
  });
  items.sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
  return { items: items.slice(0, 50), failedSources };
}
