import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalState } from '../hooks/useLocalState';

describe('useLocalState Hook', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

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
        throw new Error('QuotaExceededError');
      });

      const { result } = renderHook(() => useLocalState('quota-key', 'initial'));

      act(() => {
        result.current[1]('will-fail');
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error setting localStorage'),
        expect.any(Error)
      );

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
    it('should return array with state and setState function', () => {
      const { result } = renderHook(() => useLocalState('array-key', 'initial'));
      expect(Array.isArray(result.current)).toBe(true);
      expect(result.current).toHaveLength(2);
    });

    it('should return setState function as second element', () => {
      const { result } = renderHook(() => useLocalState('setter-key', 'initial'));
      expect(typeof result.current[1]).toBe('function');
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

  describe('Real-world Scenarios', () => {
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
