# react-use-localstate

A lightweight, type-safe custom React hook that seamlessly synchronizes React state with `localStorage`. It behaves exactly like React's native `useState`, but persists data across page refreshes.

## Features

* ⚡ **Zero Dependencies:** Ultra-lightweight and fast.
* 🔄 **Native-Like API:** Drop-in replacement for `useState`.
* 🔒 **Type Safe:** Written in TypeScript with full generics support.
* 🧼 **SSR Friendly:** Safe for use in Next.js or Remix environments (won't crash on server-side rendering).
* 🗃️ **Functional Updates:** Supports functional state updates like `setValue(prev => !prev)`.

## 📦 Installation

```bash
npm install react-use-localstate
```

## 🚀 Quick Start

```jsx
import { useLocalState } from 'react-use-localstate';

export default function App() {
  const [count, setCount] = useLocalState('count', 0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  );
}
```

The `count` state will persist across page refreshes!

## 📖 Usage

### Basic String State

```jsx
const [name, setName] = useLocalState('userName', 'Guest');

return (
  <input
    value={name}
    onChange={(e) => setName(e.target.value)}
    placeholder="Enter your name"
  />
);
```

### Complex Objects

```jsx
const [user, setUser] = useLocalState('user', {
  id: 1,
  name: 'John',
  preferences: { theme: 'dark' }
});

// Update entire object
setUser({ ...user, name: 'Jane' });

// Or use functional updates
setUser(prev => ({ ...prev, name: 'Jane' }));
```

### Arrays

```jsx
const [todos, setTodos] = useLocalState('todos', []);

const addTodo = (text) => {
  setTodos([...todos, { id: Date.now(), text }]);
};

const removeTodo = (id) => {
  setTodos(todos.filter(todo => todo.id !== id));
};
```

### Lazy Initialization

```jsx
// Use a function for expensive initial computations
const [data, setData] = useLocalState('data', () => {
  return fetchExpensiveData(); // Only called on first mount
});
```

### Form State Management

```jsx
const [formData, setFormData] = useLocalState('form', {
  email: '',
  password: '',
  rememberMe: false
});

const handleChange = (e) => {
  const { name, value, type, checked } = e.target;
  setFormData(prev => ({
    ...prev,
    [name]: type === 'checkbox' ? checked : value
  }));
};
```

## 📚 API Documentation

### useLocalState

A custom React hook that synchronizes state with `localStorage`.

**Signature:**

```typescript
function useLocalState<T>(
  key: string,
  initialValue: T | (() => T)
): [T, Dispatch<SetStateAction<T>>]
```

**Parameters:**

- `key` (string, required): The localStorage key to persist the value under.
- `initialValue` (T | function, required): The initial state value. Can be a direct value or a function that returns the initial value (lazy initialization).

**Returns:**

A tuple containing:
- `value` (T): The current state value from localStorage (or initialValue if not found).
- `setValue` (function): A function to update the state, exactly like `useState`.

**Type Safety:**

The hook is fully generic and TypeScript will infer the type based on the initial value:

```typescript
const [count, setCount] = useLocalState('count', 0); // T is number
const [name, setName] = useLocalState('name', 'John'); // T is string
const [items, setItems] = useLocalState('items', [] as Item[]); // T is Item[]
```

**Error Handling:**

The hook gracefully handles localStorage errors:
- If localStorage is not available, it silently falls back to the initial value.
- Parse errors are logged to console but won't crash your app.
- SSR-safe: Returns the initial value during server-side rendering.

## 🌐 Browser Support

Works in all modern browsers that support:
- `localStorage` API
- ES6+ JavaScript
- React 18+

Gracefully degrades in environments without `localStorage` (SSR, older browsers).

<!-- ## 🎯 Use Cases

- **Form State:** Persist form data to prevent data loss on refresh
- **User Preferences:** Remember theme, language, or layout settings
- **Shopping Cart:** Persist cart items across sessions
- **Authentication Tokens:** Store user session data (use secure storage for sensitive data)
- **UI State:** Remember scroll position, expanded panels, filters, etc. -->

## ⚠️ Important Notes

- **Storage Limit:** localStorage has a ~5-10MB limit per domain
- **Sensitive Data:** Don't store passwords or tokens in localStorage. Use `httpOnly` cookies for authentication.
- **Performance:** Avoid storing very large objects as it will impact localStorage performance
- **Synchronization:** Changes from other tabs/windows won't automatically sync (consider using storage events for that)

## 🤝 Contributing

We welcome contributions! If you'd like to contribute to react-use-localstate, please follow our [Contribution Guidelines](https://github.com/SubramanyaKS/react-use-localstate/blob/main/CONTRIBUTING.md).

### Development Setup

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build the library
npm run build
```

## Author
[Subramanya KS](https://github.com/SubramanyaKS)

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

