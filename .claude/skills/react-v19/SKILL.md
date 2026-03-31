---
name: react-v19
description: Use when working with React v19 components, hooks, forms, or React Compiler. Also use when migrating from v18 or asking about React APIs.
---

# React v19 Expert Reference

## Docs
- **Main Reference:** https://react.dev/reference/react
- **React DOM:** https://react.dev/reference/react-dom
- **React Compiler:** https://react.dev/reference/react-compiler
- **v18→v19 Migration:** https://react.dev/blog/2024/04/25/react-19-upgrade-guide

---

## Hooks

### Core Hooks

#### useState
```jsx
const [state, setState] = useState(initialValue)
```
- Lazy initialization: pass function to avoid re-running on every render
- Batch updates: all setState calls in event handlers batch automatically

#### useEffect
```jsx
useEffect(() => {
  // setup
  return () => { /* cleanup */ }
}, [dependencies])
```
- Runs after paint (async, non-blocking)
- **Cleanup function** is required for: subscriptions, timers, DOM mutations
- `useEffect(() => {}, [])` with empty deps = mount-only

#### useRef
```jsx
const ref = useRef(initialValue)
```
- `.current` mutable across renders without triggering re-render
- Common uses: DOM access, keeping values without re-renders
- Refs null on first render; DOM refs attached after paint

#### useContext
```jsx
const value = useContext(MyContext)
```
- Consumers re-render when context value changes
- `useContext` doesn't handle subscription—re-renders on ANY context change

---

### Optimization Hooks

#### useCallback / useMemo
```jsx
const memoizedFn = useCallback(fn, [deps])
const memoizedValue = useMemo(() => compute(), [deps])
```
- **useCallback(fn, deps)** = `useMemo(() => fn, deps)`
- **React Compiler** auto-memoizes; `React.memo` + `useMemo` often unnecessary with compiler
- See: https://react.dev/reference/react/useCallback

#### useMemo
```jsx
const visibleTodos = useMemo(() => filterTodos(todos, tab), [todos, tab])
```
- Memoize expensive computations
- Also memoize JSX nodes: `useMemo(() => <List items={visibleTodos} />, [visibleTodos])`

---

### Advanced Hooks

#### useReducer
```jsx
const [state, dispatch] = useReducer(reducer, initialArg, init?)
```
- Prefer over `useState` when state logic is complex (multiple sub-values, complex transitions)
- `init` function only called once on mount, not on every render
- https://react.dev/reference/react/useReducer

#### useLayoutEffect
```jsx
useLayoutEffect(() => {
  // runs synchronously before paint
  return cleanup
}, [deps])
```
- Use for: DOM measurements, preventing visual flicker
- Blocks paint—use sparingly
- Same cleanup semantics as `useEffect`
- https://react.dev/reference/react/useLayoutEffect

#### useInsertionEffect
```jsx
useInsertionEffect(() => {
  // Inject <style> tags before layout effects
  return cleanup
}, [deps])
```
- **CSS-in-JS library authors only**
- Runs before `useLayoutEffect`, after DOM mutations but before paint
- https://react.dev/reference/react/useInsertionEffect

#### useImperativeHandle
```jsx
useImperativeHandle(ref, () => ({ method() {} }), [deps])
```
- Expose custom interface to parent via `forwardRef`
- https://react.dev/reference/react/useImperativeHandle

#### useDebugValue
```jsx
useDebugValue(value)
```
- Display label for custom hooks in React DevTools
- https://react.dev/reference/react/useDebugValue

#### useId
```jsx
const id = useId()
const id = useId(prefix)  // React 19: SSR-safe with prefix
```
- Generate unique IDs stable across server/client hydration
- `prefix` parameter (React 19+) improves SSR hydration safety
- https://react.dev/reference/react/useId

#### useSyncExternalStore
```jsx
const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot?)
```
- Subscribe to external sources (Redux, window resize, navigator.onLine)
- https://react.dev/reference/react/useSyncExternalStore

#### startTransition
```jsx
startTransition(() => { /* marking code as non-urgent */ })
```
- Mark updates as non-urgent transitions (standalone API)
- Used with `useOptimistic` and `useActionState`
- Import from `'react'`
- https://react.dev/reference/react/startTransition

#### useTransition
```jsx
const [isPending, startTransition] = useTransition()
```
- Mark updates as non-urgent transitions
- Pending flag tracks in-progress transitions
- https://react.dev/reference/react/useTransition

#### useDeferredValue
```jsx
const deferredValue = useDeferredValue(value)
```
- Defer low-priority re-renders; input updates immediately, deferred content updates later
- https://react.dev/reference/react/useDeferredValue

---

### React v19 New Hooks

#### useActionState
```jsx
const [state, dispatchAction, isPending] = useActionState(action, initialState, permalink?)
```
- Manages state for async actions with built-in pending/error handling
- `action` receives `(previousState, formData)` and returns new state
- `permalink` (3rd arg) for shared element navigation URLs
- Returns `[state, dispatchAction, isPending]`
- https://react.dev/reference/react/useActionState

#### useOptimistic
```jsx
const [optimisticValue, setOptimistic] = useOptimistic(value, updateFn?)
```
- Immediately update UI while async action processes
- `updateFn(prev, optimisticValue) => result` (optional reducer-style updater)
- `setOptimistic(newValue)` applies optimistically, reverts on error
- https://react.dev/reference/react/useOptimistic

#### useFormStatus
```jsx
const { pending, data, method, action } = useFormStatus()
```
- Access parent `<form>` submission status from a child component
- `pending` = true while form is submitting
- `data` = FormData of the submission
- `method` = HTTP method string
- `action` = the action function that was invoked
- Must be used inside a `<form>` subtree
- https://react.dev/reference/react-dom/hooks#useformstatus

#### use
```jsx
const value = use(promise)   // await a promise in render
const value = use(context)   // like useContext but accepts thenables
```
- React 19 stable (not experimental)
- Suspends while promise resolves (like `await` but in render)
- Accepts thenables (promise-like objects)
- https://react.dev/reference/react/use

---

## Components

#### React.memo
```jsx
const MemoizedComponent = React.memo(function MyComponent(props) {
  // ...
})
```
- Memoize component to prevent unnecessary re-renders
- Often unnecessary with React Compiler
- https://react.dev/reference/react/memo

#### forwardRef
```jsx
const FancyInput = forwardRef(function FancyInput(props, ref) {
  return <input ref={ref} className={props.className} />
})
```
- Forward ref to underlying DOM element
- https://react.dev/reference/react/forwardRef

#### StrictMode
```jsx
<StrictMode>
  <App />
</StrictMode>
```
- In React 19 dev: double-invokes ref callbacks on mount to test cleanup
- Extra render cycles to surface side effects
- https://react.dev/reference/react/StrictMode

#### Fragment
```jsx
<>
  <ChildA />
  <ChildB />
</Fragment>
```
- Group children without adding DOM nodes
- Shorthand: `<>...</>`
- https://react.dev/reference/react/Fragment

#### Suspense
```jsx
<Suspense fallback={<Spinner />}>
  <AsyncComponent />
</Suspense>
```
- Show fallback while child component loads
- Works with `use()` for promise consumption
- https://react.dev/reference/react/Suspense

#### Context as Provider (React 19)
```jsx
<MyContext value={data}>
  {children}
</MyContext>
```
- React 19: Context accepts `value` prop directly (replaces `<MyContext.Provider>`)
- https://react.dev/reference/react/components

---

## APIs

### Ref Callback Cleanup
```jsx
<div ref={(node) => {
  // node = DOM element
  return () => { /* cleanup when ref detaches */ }
}} />
```
- Ref callbacks can return cleanup function (React 19+)
- React calls cleanup before assigning new ref or unmounting
- **Strict Mode**: extra setup/cleanup cycle in dev to test cleanup logic
- **React 19 StrictMode double-invoke**: ref callbacks are now double-invoked on initial mount (dev only) to verify cleanup
- https://react.dev/reference/react-dom/components/common#ref-callback-cleanup

### createRoot Options
```jsx
createRoot(container, {
  onUncaughtError: (error, info) => { /* log error */ },
  onCaughtError: (error, info) => { /* log error */ }
})
```
- `onUncaughtError`: called when error thrown and not caught by Error Boundary
- `onCaughtError`: called when error is caught by Error Boundary
- https://react.dev/reference/react-dom/client/createRoot

### Form Actions (React 19)
```jsx
<form action={async function submitForm(formData) {
  await saveToServer(formData);
}}>
  <button type="submit">Save</button>
</form>
```
- Native HTML form Actions work with `useActionState`, `useFormStatus`, `useOptimistic`
- Server Actions: functions passed to `action` can be async
- Works without JavaScript (progressive enhancement)

### act()
```jsx
import { act } from 'react'
act(() => { /* flush updates */ })
```
- Flush pending updates in tests
- Import from `'react'` (not `'react-dom/test-utils'`)
- https://react.dev/reference/react/act

---

## Removed in React 19

| Removed | Replacement |
|---------|-------------|
| `findDOMNode` | Use `ref` |
| `hydrate` | `hydrateRoot` from `react-dom/client` |
| `render` | `createRoot` from `react-dom/client` |
| `unmountComponentAtNode` | `root.unmount()` |
| `renderToNodeStream` | `renderToReadableStream` |
| `renderToStaticNodeStream` | `renderToStaticReadableStream` |

### Removed in Earlier Versions (still noted in migration)
- String refs (removed in v16)
- `propTypes` (removed in v17)
- `defaultProps` (removed in v17)
- `contextTypes` (removed in v17)
- `createFactory` (removed in v17)

---

## React Compiler

### Setup (Babel)
```js
// babel.config.js
module.exports = {
  plugins: ['babel-plugin-react-compiler']
}
```

### Configuration
```js
{
  target: '19' // or '18', '17'
}
```

### What it does
- **Automatically memoizes** components/hooks: equivalent to `React.memo` + `useMemo` + `useCallback`
- **Rules**: Components/hooks must be pure; compiler enforces this
- With compiler enabled: `React.memo` often unnecessary
- https://react.dev/reference/react-compiler

---

## TypeScript Changes

### useRef requires initial value
```tsx
// Before (v18)
const ref = useRef<HTMLElement>()  // Error in v19

// After (v19)
const ref = useRef<HTMLElement>(null)
```

### Ref callbacks must use block body
```tsx
// Error in v19
<div ref={r => instance = r} />

// Correct in v19
<div ref={r => { instance = r }} />
```

### ReactElement.props is now unknown
```tsx
// Generic code accessing props may need type assertion
const { children, ...props } = element.props as { children: ReactNode, [key: string]: unknown }
```

### JSX namespace scoped to react
```tsx
// Before (global)
declare module '_MYMODULE_' {
  namespace JSX {}
}

// After (React 19)
declare module "react" {
  namespace JSX {}
}
```

### useReducer typing simplified
```tsx
// No longer generic in the same way as v18
const [state, dispatch] = useReducer<State, Action>(reducer, initialArg)
```

---

## Codemods

### React v19 Migration
```bash
# Run all v19 migration codemods at once
npx codemod@latest react/19/migration-recipe ./path
```

### TypeScript Codemods
```bash
# TypeScript-specific v19 codemods
npx types-react-codemod@latest preset-19 ./path
```

### useFormState to useActionState
```bash
# Migrates useFormState (react-dom) to useActionState
npx codemod@latest replace-use-form-state ./path
```

---

## v18 → v19 Key Differences

| Feature | v18 | v19 |
|---------|-----|-----|
| Form state | Manual | `useActionState` |
| Optimistic UI | Manual | `useOptimistic` |
| Ref cleanup | `useEffect` cleanup | Ref callback cleanup |
| `useCallback` | Manual memoization | Auto with compiler |
| `useMemo` | Manual memoization | Auto with compiler |
| `React.memo` | Manual memoization | Often unnecessary with compiler |
| `useRef` | Optional initial value | Required initial value |
| Context | `<Context.Provider>` | `<Context value>` (also valid) |
| Removed APIs | N/A | `findDOMNode`, `hydrate`, `render`, etc. |

### Other v19 Changes
- **Better strict mode**: extra render cycles to surface side effects
- **StrictMode ref double-invoke**: ref callbacks double-invoke on mount in dev
- **Improved hydration**: better error messages
- **Context as provider**: `<Context value={...}>` instead of `<Context.Provider>`
- **`useId` prefix**: `useId(prefix)` for SSR hydration safety
- **`use` hook**: stable in React 19 (not experimental)

---

## Common Patterns

### Form with useActionState + useOptimistic
```jsx
function Checkout() {
  const [count, dispatchAction, isPending] = useActionState(updateCartAction, 0);
  const [optimisticCount, setOptimisticCount] = useOptimistic(count);

  async function formAction(formData) {
    const type = formData.get('type');
    if (type === 'ADD') setOptimisticCount(c => c + 1);
    return dispatchAction(formData);
  }

  return (
    <form action={formAction}>
      <span>{optimisticCount}</span>
      <button type="submit" name="type" value="ADD">+</button>
    </form>
  );
}
```

### Deferred List Rendering
```jsx
function App() {
  const [text, setText] = useState('');
  const deferredText = useDeferredValue(text);
  return (
    <>
      <input value={text} onChange={e => setText(e.target.value)} />
      <SlowList text={deferredText} /> {/* deferred */}
    </>
  );
}
```

### Subscribing to Browser API
```jsx
const isOnline = useSyncExternalStore(
  (callback) => {
    window.addEventListener('online', callback);
    window.addEventListener('offline', callback);
    return () => {
      window.removeEventListener('online', callback);
      window.removeEventListener('offline', callback);
    };
  },
  () => navigator.onLine
);
```

---

## Links Summary

| Topic | URL |
|-------|-----|
| All React APIs | https://react.dev/reference/react |
| Hooks | https://react.dev/reference/react/hooks |
| React DOM | https://react.dev/reference/react-dom |
| Components | https://react.dev/reference/react/components |
| useActionState | https://react.dev/reference/react/useActionState |
| useOptimistic | https://react.dev/reference/react/useOptimistic |
| useFormStatus | https://react.dev/reference/react-dom/hooks#useformstatus |
| useTransition | https://react.dev/reference/react/useTransition |
| useDeferredValue | https://react.dev/reference/react/useDeferredValue |
| useId | https://react.dev/reference/react/useId |
| useReducer | https://react.dev/reference/react/useReducer |
| useSyncExternalStore | https://react.dev/reference/react/useSyncExternalStore |
| useImperativeHandle | https://react.dev/reference/react/useImperativeHandle |
| useInsertionEffect | https://react.dev/reference/react/useInsertionEffect |
| useLayoutEffect | https://react.dev/reference/react/useLayoutEffect |
| useDebugValue | https://react.dev/reference/react/useDebugValue |
| use | https://react.dev/reference/react/use |
| forwardRef | https://react.dev/reference/react/forwardRef |
| React.memo | https://react.dev/reference/react/memo |
| React Compiler | https://react.dev/reference/react-compiler |
| Upgrade Guide | https://react.dev/blog/2024/04/25/react-19-upgrade-guide |
