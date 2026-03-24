// Re-export from the context for backward compatibility
// The context-based implementation ensures all components share the same
// notification state, fixing the issue where notifications triggered from
// nested hooks wouldn't appear.
export {
	useNotification,
	type Notification,
	type NotifyFn,
} from '../context/NotificationContext';
