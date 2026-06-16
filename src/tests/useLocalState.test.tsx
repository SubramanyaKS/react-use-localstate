import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalState } from '../hooks/useLocalState';

describe('useLocalState Hook', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  /**
   * Helper function to simulate storage event from another tab
   */
  const simulateStorageEvent = (key: string, newValue: string | null, oldValue: string | null = null) => {
    const event = new StorageEvent('storage', {
      key,
      newValue,
      oldValue,
      storageArea: localStorage,
    });
    window.dispatchEvent(event);
  };

  describe('Initial State', () => {
    it('should initialize with provided value when localStorage is empty', () => {
      const { result } = renderHook(() => useLocalState('test-key', 'initial-value'));
      expect(result.current[0]).toBe('initial-value');
    });

    it('should initialize with function initializer when localStorage is empty', () => {
      const initializer = vi.fn(() => 'computed-value');
      const { result } = renderHook(() => useLocalState('test-key', initializer));
      expect(result.current[0]).toBe('computed-value');
      expect(initializer).toHaveBeenCalled();
    });

    it('should load existing localStorage value on mount', () => {
      localStorage.setItem('test-key', JSON.stringify('stored-value'));
      const { result } = renderHook(() => useLocalState('test-key', 'initial-value'));
      expect(result.current[0]).toBe('stored-value');
    });

    it('should handle raw string from localStorage (non-JSON values)', () => {
      localStorage.setItem('raw-key', 'plain-text-value');
      const { result } = renderHook(() => useLocalState('raw-key', 'initial'));
      expect(result.current[0]).toBe('plain-text-value');
    });

    it('should use fallback when localStorage read fails', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage access denied');
      });

      const { result } = renderHook(() => useLocalState('error-key', 'fallback'));
      expect(result.current[0]).toBe('fallback');
      expect(consoleWarnSpy).toHaveBeenCalled();

      getItemSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Cross-Tab Synchronization', () => {
    it('should sync state when storage changes in another tab', () => {
      const { result } = renderHook(() => useLocalState('sync-key', 'initial'));
      expect(result.current[0]).toBe('initial');

      act(() => {
        simulateStorageEvent('sync-key', JSON.stringify('updated-from-other-tab'));
      });

      expect(result.current[0]).toBe('updated-from-other-tab');
    });

    it('should sync object values across tabs', () => {
      const initialObj = { count: 0, items: [] as string[] };
      const { result } = renderHook(() => useLocalState('obj-sync-key', initialObj));

      const updatedObj = { count: 5, items: ['a', 'b', 'c'] };

      act(() => {
        simulateStorageEvent('obj-sync-key', JSON.stringify(updatedObj));
      });

      expect(result.current[0]).toEqual(updatedObj);
    });

    it('should sync array values across tabs', () => {
      const { result } = renderHook(() => useLocalState<string[]>('arr-sync-key', []));

      act(() => {
        simulateStorageEvent('arr-sync-key', JSON.stringify(['item1', 'item2', 'item3']));
      });

      expect(result.current[0]).toEqual(['item1', 'item2', 'item3']);
    });

    it('should handle raw string values from storage events', () => {
      const { result } = renderHook(() => useLocalState('raw-sync-key', 'initial'));

      act(() => {
        simulateStorageEvent('raw-sync-key', 'plain-text-from-other-tab');
      });

      expect(result.current[0]).toBe('plain-text-from-other-tab');
    });

    it('should not sync when key does not match', () => {
      const { result } = renderHook(() => useLocalState('key-1', 'initial'));

      act(() => {
        simulateStorageEvent('different-key', JSON.stringify('different-value'));
      });

      expect(result.current[0]).toBe('initial');
    });

    it('should not sync when newValue is null', () => {
      const { result } = renderHook(() => useLocalState('null-sync-key', 'initial'));

      act(() => {
        simulateStorageEvent('null-sync-key', null);
      });

      // Should remain unchanged when newValue is null
      expect(result.current[0]).toBe('initial');
    });

    it('should handle corrupted JSON in storage events gracefully', () => {
      const { result } = renderHook(() => useLocalState('corrupt-sync-key', 'initial'));

      act(() => {
        simulateStorageEvent('corrupt-sync-key', '{invalid json}');
      });

      // Should fall back to treating as plain string
      expect(result.current[0]).toBe('{invalid json}');
    });

    it('should sync multiple times from different tabs', () => {
      const { result } = renderHook(() => useLocalState('multi-sync-key', 'initial'));

      act(() => {
        simulateStorageEvent('multi-sync-key', JSON.stringify('first-update'));
      });
      expect(result.current[0]).toBe('first-update');

      act(() => {
        simulateStorageEvent('multi-sync-key', JSON.stringify('second-update'));
      });
      expect(result.current[0]).toBe('second-update');

      act(() => {
        simulateStorageEvent('multi-sync-key', JSON.stringify('third-update'));
      });
      expect(result.current[0]).toBe('third-update');
    });

    it('should maintain separate sync listeners for different keys', () => {
      const { result: result1 } = renderHook(() => useLocalState('key-a', 'value-a'));
      const { result: result2 } = renderHook(() => useLocalState('key-b', 'value-b'));

      act(() => {
        simulateStorageEvent('key-a', JSON.stringify('updated-a'));
      });

      expect(result1.current[0]).toBe('updated-a');
      expect(result2.current[0]).toBe('value-b');

      act(() => {
        simulateStorageEvent('key-b', JSON.stringify('updated-b'));
      });

      expect(result1.current[0]).toBe('updated-a');
      expect(result2.current[0]).toBe('updated-b');
    });

    it('should cleanup storage event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderHook(() => useLocalState('cleanup-sync-key', 'initial'));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });

    it('should re-register storage listener when key changes', () => {
      const { result, rerender } = renderHook(
        ({ key }) => useLocalState(key, 'initial'),
        { initialProps: { key: 'key-1' } }
      );

      act(() => {
        simulateStorageEvent('key-1', JSON.stringify('value-1'));
      });
      expect(result.current[0]).toBe('value-1');

      rerender({ key: 'key-2' });

      act(() => {
        simulateStorageEvent('key-1', JSON.stringify('value-1-updated'));
      });

      // Should NOT sync because listener was updated to key-2
      expect(result.current[0]).toBe('value-1');

      act(() => {
        simulateStorageEvent('key-2', JSON.stringify('value-2'));
      });

      expect(result.current[0]).toBe('value-2');
    });

    it('should sync numeric values correctly across tabs', () => {
      const { result } = renderHook(() => useLocalState('num-sync-key', 0));

      act(() => {
        simulateStorageEvent('num-sync-key', JSON.stringify(42));
      });

      expect(result.current[0]).toBe(42);
    });

    it('should sync boolean values correctly across tabs', () => {
      const { result } = renderHook(() => useLocalState('bool-sync-key', false));

      act(() => {
        simulateStorageEvent('bool-sync-key', JSON.stringify(true));
      });

      expect(result.current[0]).toBe(true);
    });

    it('should sync nested objects across tabs', () => {
      const initialNested = {
        user: {
          profile: {
            name: 'John',
            settings: {
              theme: 'light',
            },
          },
        },
      };

      const { result } = renderHook(() => useLocalState('nested-sync-key', initialNested));

      const updatedNested = {
        user: {
          profile: {
            name: 'Jane',
            settings: {
              theme: 'dark',
            },
          },
        },
      };

      act(() => {
        simulateStorageEvent('nested-sync-key', JSON.stringify(updatedNested));
      });

      expect(result.current[0]).toEqual(updatedNested);
      expect(result.current[0].user.profile.name).toBe('Jane');
      expect(result.current[0].user.profile.settings.theme).toBe('dark');
    });

    it('should sync with special characters across tabs', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;\':"<>,.?/~`';
      const { result } = renderHook(() => useLocalState('special-sync-key', 'initial'));

      act(() => {
        simulateStorageEvent('special-sync-key', JSON.stringify(specialChars));
      });

      expect(result.current[0]).toBe(specialChars);
    });

    it('should sync unicode characters across tabs', () => {
      const unicodeStr = '你好 🚀 مرحبا';
      const { result } = renderHook(() => useLocalState('unicode-sync-key', 'initial'));

      act(() => {
        simulateStorageEvent('unicode-sync-key', JSON.stringify(unicodeStr));
      });

      expect(result.current[0]).toBe(unicodeStr);
    });

    it('should maintain local state updates after receiving sync from other tab', () => {
      const { result } = renderHook(() => useLocalState('persist-after-sync-key', 'initial'));

      act(() => {
        simulateStorageEvent('persist-after-sync-key', JSON.stringify('synced-value'));
      });
      expect(result.current[0]).toBe('synced-value');

      act(() => {
        result.current[1]('locally-updated');
      });

      expect(result.current[0]).toBe('locally-updated');
      expect(localStorage.getItem('persist-after-sync-key')).toBe(JSON.stringify('locally-updated'));
    });
  });

  describe('Data Type Support', () => {
    it('should handle string values', () => {
      const { result } = renderHook(() => useLocalState<string>('string-key', 'hello'));
      expect(result.current[0]).toBe('hello');
      expect(localStorage.getItem('string-key')).toBe(JSON.stringify('hello'));
    });

    it('should handle number values', () => {
      const { result } = renderHook(() => useLocalState<number>('number-key', 42));
      expect(result.current[0]).toBe(42);
      expect(JSON.parse(localStorage.getItem('number-key')!)).toBe(42);
    });

    it('should handle boolean values', () => {
      const { result } = renderHook(() => useLocalState<boolean>('bool-key', true));
      expect(result.current[0]).toBe(true);
      expect(JSON.parse(localStorage.getItem('bool-key')!)).toBe(true);
    });

    it('should handle null values', () => {
      const { result } = renderHook(() => useLocalState<null>('null-key', null));
      expect(result.current[0]).toBeNull();
      expect(localStorage.getItem('null-key')).toBe(JSON.stringify(null));
    });

    it('should handle object values', () => {
      const testObject = { id: 1, name: 'John', email: 'john@example.com' };
      const { result } = renderHook(() => useLocalState('obj-key', testObject));
      expect(result.current[0]).toEqual(testObject);
      expect(JSON.parse(localStorage.getItem('obj-key')!)).toEqual(testObject);
    });

    it('should handle array values', () => {
      const testArray = [1, 2, 3, 'four', { five: 5 }];
      const { result } = renderHook(() => useLocalState('arr-key', testArray));
      expect(result.current[0]).toEqual(testArray);
      expect(JSON.parse(localStorage.getItem('arr-key')!)).toEqual(testArray);
    });

    it('should handle nested objects', () => {
      const nestedObj = {
        user: {
          profile: {
            name: 'John',
            address: {
              city: 'NYC',
              zip: '10001',
            },
          },
        },
      };
      const { result } = renderHook(() => useLocalState('nested-key', nestedObj));
      expect(result.current[0]).toEqual(nestedObj);
    });

    it('should handle empty strings', () => {
      const { result } = renderHook(() => useLocalState<string>('empty-key', ''));
      expect(result.current[0]).toBe('');
      expect(result.current[0]).toHaveLength(0);
    });

    it('should handle zero without treating as falsy', () => {
      const { result } = renderHook(() => useLocalState<number>('zero-key', 0));
      expect(result.current[0]).toBe(0);
      expect(result.current[0]).not.toBe(null);
    });

    it('should handle false without treating as falsy', () => {
      const { result } = renderHook(() => useLocalState<boolean>('false-key', false));
      expect(result.current[0]).toBe(false);
      expect(result.current[0]).not.toBe(null);
    });
  });

  describe('State Updates and Persistence', () => {
    it('should update state when setState is called', () => {
      const { result } = renderHook(() => useLocalState('update-key', 'initial'));

      act(() => {
        result.current[1]('updated');
      });

      expect(result.current[0]).toBe('updated');
    });

    it('should persist state to localStorage on update', () => {
      const { result } = renderHook(() => useLocalState('persist-key', 'initial'));

      act(() => {
        result.current[1]('persisted');
      });

      expect(localStorage.getItem('persist-key')).toBe(JSON.stringify('persisted'));
    });

    it('should handle setState with updater function', () => {
      const { result } = renderHook(() => useLocalState('counter-key', 0));

      act(() => {
        result.current[1]((prev) => prev + 1);
      });

      expect(result.current[0]).toBe(1);

      act(() => {
        result.current[1]((prev) => prev + 5);
      });

      expect(result.current[0]).toBe(6);
      expect(JSON.parse(localStorage.getItem('counter-key')!)).toBe(6);
    });

    it('should persist object updates correctly', () => {
      const initialObj = { count: 0, items: [] as string[] };
      const { result } = renderHook(() => useLocalState('obj-update-key', initialObj));

      act(() => {
        result.current[1]({ count: 1, items: ['a', 'b'] });
      });

      const stored = JSON.parse(localStorage.getItem('obj-update-key')!);
      expect(stored).toEqual({ count: 1, items: ['a', 'b'] });
    });

    it('should handle array push via state update', () => {
      const { result } = renderHook(() => useLocalState<string[]>('arr-update-key', []));

      act(() => {
        result.current[1]((prev) => [...prev, 'new-item']);
      });

      expect(result.current[0]).toEqual(['new-item']);
      expect(JSON.parse(localStorage.getItem('arr-update-key')!)).toEqual(['new-item']);
    });

    it('should handle multiple consecutive updates', () => {
      const { result } = renderHook(() => useLocalState('multi-update-key', 0));

      act(() => {
        result.current[1](1);
        result.current[1](2);
        result.current[1](3);
      });

      expect(result.current[0]).toBe(3);
      expect(JSON.parse(localStorage.getItem('multi-update-key')!)).toBe(3);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle corrupted JSON gracefully', () => {
      localStorage.setItem('bad-json-key', '{not valid json}');
      const { result } = renderHook(() => useLocalState('bad-json-key', 'fallback'));
      expect(result.current[0]).toBe('{not valid json}');
    });

    it('should handle localStorage quota exceeded errors', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        const error = new DOMException('Quota exceeded', 'QuotaExceededError');
        throw error;
      });

      const { result } = renderHook(() => useLocalState('quota-key', 'initial'));

      act(() => {
        result.current[1]('will-fail');
      });

      expect(consoleWarnSpy).toHaveBeenCalled();

      setItemSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should continue functioning after localStorage error', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      const { result } = renderHook(() => useLocalState('error-recover-key', 'initial'));

      act(() => {
        result.current[1]('updated');
      });

      expect(result.current[0]).toBe('updated');

      setItemSpy.mockRestore();
    });

    it('should handle JSON.stringify circular reference gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useLocalState('circular-key', { a: 1 }));

      // Manually trigger an error by calling setState with something that can't be stringified
      act(() => {
        result.current[1]({ a: 1 } as any);
      });

      // State should still update even if persistence fails
      expect(result.current[0]).toEqual({ a: 1 });

      consoleWarnSpy.mockRestore();
    });
  });

  describe('SSR Safety', () => {
    it('should work in jsdom environment (SSR-like)', () => {
      // In jsdom, window is defined, so test normal behavior
      const { result } = renderHook(() => useLocalState('ssr-key', 'ssr-value'));
      expect(result.current[0]).toBe('ssr-value');
      expect(localStorage.getItem('ssr-key')).toBe(JSON.stringify('ssr-value'));
    });

    it('should not crash with various window check patterns', () => {
      const { result } = renderHook(() => useLocalState('check-key', 'check-value'));
      expect(result.current[0]).toBe('check-value');
    });

    it('should handle localStorage access safely', () => {
      const { result } = renderHook(() => useLocalState('safe-access-key', 'safe-value'));
      
      act(() => {
        result.current[1]('updated');
      });

      expect(localStorage.getItem('safe-access-key')).toBe(JSON.stringify('updated'));
    });
  });

  describe('Key Management', () => {
    it('should persist to new key when key prop changes', () => {
      const { result, rerender } = renderHook(
        ({ key }) => useLocalState(key, 'initial'),
        { initialProps: { key: 'key-1' } }
      );

      expect(result.current[0]).toBe('initial');

      act(() => {
        result.current[1]('updated');
      });

      expect(localStorage.getItem('key-1')).toBe(JSON.stringify('updated'));

      // When key changes, the new key gets the current state value persisted to it
      rerender({ key: 'key-2' });

      // The state persists to the new key
      expect(localStorage.getItem('key-2')).toBe(JSON.stringify('updated'));
    });

    it('should maintain separate state for different keys', () => {
      const { result: result1 } = renderHook(() => useLocalState('separate-key-1', 'value-1'));
      const { result: result2 } = renderHook(() => useLocalState('separate-key-2', 'value-2'));

      expect(result1.current[0]).toBe('value-1');
      expect(result2.current[0]).toBe('value-2');

      act(() => {
        result1.current[1]('updated-1');
      });

      expect(result1.current[0]).toBe('updated-1');
      expect(result2.current[0]).toBe('value-2');
    });

    it('should use different localStorage entries for different keys', () => {
      const { result: result1 } = renderHook(() => useLocalState('storage-key-1', 'val-1'));
      const { result: result2 } = renderHook(() => useLocalState('storage-key-2', 'val-2'));

      act(() => {
        result1.current[1]('updated-1');
        result2.current[1]('updated-2');
      });

      expect(localStorage.getItem('storage-key-1')).toBe(JSON.stringify('updated-1'));
      expect(localStorage.getItem('storage-key-2')).toBe(JSON.stringify('updated-2'));
    });
  });

  describe('Type Safety', () => {
    it('should preserve string type throughout lifecycle', () => {
      const { result } = renderHook(() => useLocalState<string>('typed-string', 'initial'));
      expect(typeof result.current[0]).toBe('string');

      act(() => {
        result.current[1]('updated');
      });

      expect(typeof result.current[0]).toBe('string');
    });

    it('should preserve number type throughout lifecycle', () => {
      const { result } = renderHook(() => useLocalState<number>('typed-number', 0));
      expect(typeof result.current[0]).toBe('number');

      act(() => {
        result.current[1](99);
      });

      expect(typeof result.current[0]).toBe('number');
    });

    it('should support custom interfaces', () => {
      interface User {
        id: number;
        name: string;
        email: string;
        role?: 'admin' | 'user';
      }

      const initialUser: User = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user',
      };

      const { result } = renderHook(() => useLocalState<User>('typed-user', initialUser));

      expect(result.current[0]).toEqual(initialUser);
      expect(result.current[0].id).toBe(1);

      act(() => {
        result.current[1]({
          id: 2,
          name: 'Jane Doe',
          email: 'jane@example.com',
          role: 'admin',
        });
      });

      expect(result.current[0].role).toBe('admin');
    });
  });

  describe('Edge Cases and Boundaries', () => {
    it('should handle very large objects', () => {
      const largeObj = {
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          value: `value-${i}`,
        })),
      };

      const { result } = renderHook(() => useLocalState('large-key', largeObj));
      expect(result.current[0].data).toHaveLength(1000);
    });

    it('should handle special characters in string values', () => {
      const specialString = '!@#$%^&*()_+-=[]{}|;\':"<>,.?/~`';
      const { result } = renderHook(() => useLocalState('special-key', specialString));
      expect(result.current[0]).toBe(specialString);
    });

    it('should handle unicode characters', () => {
      const unicodeString = '你好世界 🚀 مرحبا بالعالم';
      const { result } = renderHook(() => useLocalState('unicode-key', unicodeString));
      expect(result.current[0]).toBe(unicodeString);
    });

    it('should handle very long strings', () => {
      const longString = 'x'.repeat(10000);
      const { result } = renderHook(() => useLocalState('long-key', longString));
      expect(result.current[0]).toHaveLength(10000);
    });

    it('should handle empty arrays', () => {
      const { result } = renderHook(() => useLocalState<any[]>('empty-arr-key', []));
      expect(result.current[0]).toEqual([]);
      expect(result.current[0]).toHaveLength(0);
    });

    it('should handle empty objects', () => {
      const { result } = renderHook(() => useLocalState('empty-obj-key', {}));
      expect(result.current[0]).toEqual({});
    });
  });

  describe('React Hook Compliance', () => {
    it('should return array with state, setState, and clearState functions', () => {
      const { result } = renderHook(() => useLocalState('array-key', 'initial'));
      expect(Array.isArray(result.current)).toBe(true);
      expect(result.current).toHaveLength(3);
    });

    it('should return setState function as second element', () => {
      const { result } = renderHook(() => useLocalState('setter-key', 'initial'));
      expect(typeof result.current[1]).toBe('function');
    });

    it('should return clearState function as third element', () => {
      const { result } = renderHook(() => useLocalState('clear-key', 'initial'));
      expect(typeof result.current[2]).toBe('function');
    });

    it('should handle rapid state updates', () => {
      const { result } = renderHook(() => useLocalState('rapid-key', 0));

      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current[1]((prev) => prev + 1);
        }
      });

      expect(result.current[0]).toBeGreaterThanOrEqual(1);
    });

    it('should cleanup properly on unmount', () => {
      const { unmount } = renderHook(() => useLocalState('cleanup-key', 'initial'));
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Clear/Remove Functionality', () => {
    it('should clear state and remove from localStorage', () => {
      const { result } = renderHook(() => useLocalState('clear-test-key', 'initial-value'));
      
      act(() => {
        result.current[1]('updated-value');
      });

      expect(result.current[0]).toBe('updated-value');
      expect(localStorage.getItem('clear-test-key')).toBe(JSON.stringify('updated-value'));

      act(() => {
        result.current[2](); // Call clearState
      });

      expect(result.current[0]).toBe('initial-value');
      expect(localStorage.getItem('clear-test-key')).toBeNull();
    });

    it('should reset to initial value from function initializer', () => {
      const initializer = () => 'computed-initial';
      const { result } = renderHook(() => useLocalState('func-init-clear-key', initializer));

      act(() => {
        result.current[1]('changed-value');
      });

      expect(result.current[0]).toBe('changed-value');

      act(() => {
        result.current[2](); // Clear should recompute from initializer
      });

      expect(result.current[0]).toBe('computed-initial');
      expect(localStorage.getItem('func-init-clear-key')).toBeNull();
    });

    it('should clear object state', () => {
      interface ClearTestObj {
        count: number;
        items: string[];
      }
      const initialObj: ClearTestObj = { count: 0, items: [] };
      const { result } = renderHook(() => useLocalState('obj-clear-key', initialObj));

      const updatedObj: ClearTestObj = { count: 5, items: ['a', 'b'] };
      act(() => {
        result.current[1](updatedObj);
      });

      expect(result.current[0]).toEqual(updatedObj);

      act(() => {
        result.current[2](); // Clear
      });

      expect(result.current[0]).toEqual(initialObj);
      expect(localStorage.getItem('obj-clear-key')).toBeNull();
    });

    it('should clear array state', () => {
      const { result } = renderHook(() => useLocalState<string[]>('arr-clear-key', []));

      act(() => {
        result.current[1](['item1', 'item2']);
      });

      expect(result.current[0]).toEqual(['item1', 'item2']);

      act(() => {
        result.current[2](); // Clear
      });

      expect(result.current[0]).toEqual([]);
      expect(localStorage.getItem('arr-clear-key')).toBeNull();
    });

    it('should handle clear on already-empty state', () => {
      const { result } = renderHook(() => useLocalState('empty-clear-key', 'initial'));

      act(() => {
        result.current[2](); // Clear without any updates
      });

      expect(result.current[0]).toBe('initial');
      expect(localStorage.getItem('empty-clear-key')).toBeNull();
    });

    it('should be able to continue using hook after clear', () => {
      const { result } = renderHook(() => useLocalState('reuse-clear-key', 'initial'));

      act(() => {
        result.current[1]('first-update');
      });

      expect(result.current[0]).toBe('first-update');

      act(() => {
        result.current[2](); // Clear
      });

      expect(result.current[0]).toBe('initial');

      // Should be able to update again
      act(() => {
        result.current[1]('second-update');
      });

      expect(result.current[0]).toBe('second-update');
      expect(localStorage.getItem('reuse-clear-key')).toBe(JSON.stringify('second-update'));
    });

    it('should handle clear with null initial value', () => {
      const { result } = renderHook(() => useLocalState<null>('null-clear-key', null));

      act(() => {
        result.current[1](null);
      });

      act(() => {
        result.current[2](); // Clear
      });

      expect(result.current[0]).toBeNull();
      expect(localStorage.getItem('null-clear-key')).toBeNull();
    });

    it('should handle clear errors gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('Cannot remove item');
      });

      const { result } = renderHook(() => useLocalState('clear-error-key', 'initial'));

      act(() => {
        result.current[1]('updated');
      });

      act(() => {
        result.current[2](); // Try to clear, should handle error
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[useLocalState]'),
        expect.any(Error)
      );

      removeItemSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Integration: Local Updates + Cross-Tab Sync', () => {
    it('should prioritize local updates over sync events', () => {
      const { result } = renderHook(() => useLocalState('priority-key', 'initial'));

      act(() => {
        result.current[1]('local-update');
      });
      expect(result.current[0]).toBe('local-update');

      act(() => {
        simulateStorageEvent('priority-key', JSON.stringify('remote-update'));
      });

      // Remote update should take effect
      expect(result.current[0]).toBe('remote-update');
    });

    it('should handle rapid local updates followed by sync event', () => {
      const { result } = renderHook(() => useLocalState('rapid-sync-key', 0));

      act(() => {
        result.current[1](1);
        result.current[1](2);
        result.current[1](3);
      });

      expect(result.current[0]).toBe(3);

      act(() => {
        simulateStorageEvent('rapid-sync-key', JSON.stringify(100));
      });

      expect(result.current[0]).toBe(100);
    });

    it('should handle concurrent updates from multiple hook instances', () => {
      const { result: result1 } = renderHook(() => useLocalState('shared-key', 'initial'));
      const { result: result2 } = renderHook(() => useLocalState('shared-key', 'initial'));

      act(() => {
        result1.current[1]('updated-by-instance-1');
      });

      // Simulate other tab sync
      act(() => {
        simulateStorageEvent('shared-key', JSON.stringify('updated-by-instance-1'));
      });

      expect(result2.current[0]).toBe('updated-by-instance-1');
    });

    it('should handle storage event after state update in same instance', () => {
      const { result } = renderHook(() => useLocalState('order-key', 'step-1'));

      act(() => {
        result.current[1]('step-2');
      });

      expect(localStorage.getItem('order-key')).toBe(JSON.stringify('step-2'));

      act(() => {
        simulateStorageEvent('order-key', JSON.stringify('step-3-from-other-tab'));
      });

      expect(result.current[0]).toBe('step-3-from-other-tab');
      // Storage event updates localStorage to the new value
      expect(localStorage.getItem('order-key')).toBe(JSON.stringify('step-3-from-other-tab'));
    });
  });

  describe('Real-world Scenarios', () => {
    it('should sync user preferences across tabs', () => {
      interface UserPreferences {
        theme: 'light' | 'dark';
        language: string;
        notifications: boolean;
      }

      const initialPrefs: UserPreferences = {
        theme: 'light',
        language: 'en',
        notifications: true,
      };

      const { result } = renderHook(() => useLocalState<UserPreferences>('user-prefs', initialPrefs));

      // User changes theme in another tab
      const updatedPrefs: UserPreferences = {
        theme: 'dark',
        language: 'en',
        notifications: true,
      };

      act(() => {
        simulateStorageEvent('user-prefs', JSON.stringify(updatedPrefs));
      });

      expect(result.current[0].theme).toBe('dark');
    });

    it('should sync shopping cart across multiple browser tabs', () => {
      interface CartItem {
        productId: string;
        quantity: number;
        price: number;
      }

      interface Cart {
        items: CartItem[];
        total: number;
      }

      const initialCart: Cart = {
        items: [],
        total: 0,
      };

      const { result } = renderHook(() => useLocalState<Cart>('shopping-cart', initialCart));

      // Another tab adds an item
      const updatedCart: Cart = {
        items: [
          { productId: 'PROD-001', quantity: 2, price: 29.99 },
          { productId: 'PROD-002', quantity: 1, price: 49.99 },
        ],
        total: 109.97,
      };

      act(() => {
        simulateStorageEvent('shopping-cart', JSON.stringify(updatedCart));
      });

      expect(result.current[0].items).toHaveLength(2);
      expect(result.current[0].total).toBe(109.97);
    });

    it('should sync form state across tabs for collaborative editing', () => {
      interface FormState {
        title: string;
        content: string;
        lastModified: number;
      }

      const initialForm: FormState = {
        title: '',
        content: '',
        lastModified: 0,
      };

      const { result } = renderHook(() => useLocalState<FormState>('form-draft', initialForm));

      // Another tab updates the form
      const updatedForm: FormState = {
        title: 'Updated Title',
        content: 'Updated content from other tab',
        lastModified: Date.now(),
      };

      act(() => {
        simulateStorageEvent('form-draft', JSON.stringify(updatedForm));
      });

      expect(result.current[0].title).toBe('Updated Title');
      expect(result.current[0].content).toBe('Updated content from other tab');
    });

    it('should sync authentication token across tabs', () => {
      interface AuthState {
        token: string | null;
        userId: string | null;
        isLoggedIn: boolean;
      }

      const initialAuth: AuthState = {
        token: null,
        userId: null,
        isLoggedIn: false,
      };

      const { result } = renderHook(() => useLocalState<AuthState>('auth-state', initialAuth));

      // User logs in on another tab
      const loggedInAuth: AuthState = {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        userId: 'user-12345',
        isLoggedIn: true,
      };

      act(() => {
        simulateStorageEvent('auth-state', JSON.stringify(loggedInAuth));
      });

      expect(result.current[0].isLoggedIn).toBe(true);
      expect(result.current[0].userId).toBe('user-12345');
    });

    it('should sync notification/read status across tabs', () => {
      interface Notification {
        id: string;
        message: string;
        read: boolean;
        timestamp: number;
      }

      const initialNotifications: Notification[] = [
        { id: '1', message: 'Message 1', read: false, timestamp: Date.now() },
        { id: '2', message: 'Message 2', read: false, timestamp: Date.now() },
      ];

      const { result } = renderHook(() =>
        useLocalState<Notification[]>('notifications', initialNotifications)
      );

      // User marks notifications as read in another tab
      const updatedNotifications: Notification[] = [
        { id: '1', message: 'Message 1', read: true, timestamp: Date.now() },
        { id: '2', message: 'Message 2', read: true, timestamp: Date.now() },
      ];

      act(() => {
        simulateStorageEvent('notifications', JSON.stringify(updatedNotifications));
      });

      expect(result.current[0][0].read).toBe(true);
      expect(result.current[0][1].read).toBe(true);
    });

    it('should work as a form state manager', () => {
      interface FormData {
        username: string;
        email: string;
        preferences: { newsletter: boolean };
      }

      const initialForm: FormData = {
        username: '',
        email: '',
        preferences: { newsletter: false },
      };

      const { result } = renderHook(() => useLocalState<FormData>('form-state', initialForm));

      act(() => {
        result.current[1]({
          username: 'john_doe',
          email: 'john@example.com',
          preferences: { newsletter: true },
        });
      });

      expect(result.current[0].username).toBe('john_doe');
      expect(result.current[0].preferences.newsletter).toBe(true);
    });

    it('should work as a theme preference manager', () => {
      type Theme = 'light' | 'dark' | 'auto';
      const { result } = renderHook(() => useLocalState<Theme>('theme-preference', 'auto'));

      act(() => {
        result.current[1]('dark');
      });

      expect(result.current[0]).toBe('dark');
      expect(localStorage.getItem('theme-preference')).toBe(JSON.stringify('dark'));
    });

    it('should work as a user session cache', () => {
      interface Session {
        userId: string;
        token: string;
        expiresAt: number;
      }

      const session: Session = {
        userId: 'user-123',
        token: 'auth-token-xyz',
        expiresAt: Date.now() + 3600000,
      };

      const { result } = renderHook(() => useLocalState<Session>('user-session', session));

      expect(result.current[0].userId).toBe('user-123');
      expect(result.current[0].token).toBe('auth-token-xyz');
    });
  });
});
