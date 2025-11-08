<!--
Document Type: Learning Notes
Purpose: Comprehensive guide to understanding factory functions in TypeScript/JavaScript
Context: Learning session on factory functions, closures, state management, and async patterns
Key Topics: Factory functions, closures, private state, method syntax, async/await, comparison with classes
Target Use: Reference guide for understanding and implementing factory function patterns
-->

# Factory Functions in TypeScript/JavaScript

## What Are Factory Functions?

**A factory function is a regular function that creates and returns an object.**

It's called a "factory" because it manufactures objects for you, just like a real factory manufactures products.

### Simplest Example

```typescript
// This is a factory function
function createPerson(name: string) {
  return {
    name: name,
    sayHello() {
      console.log(`Hello, I'm ${name}`);
    }
  };
}

// Using the factory
const alice = createPerson('Alice');
const bob = createPerson('Bob');

alice.sayHello(); // "Hello, I'm Alice"
bob.sayHello();   // "Hello, I'm Bob"
```

**Key points:**
- `createPerson` is a regular function (uses `function` keyword)
- It returns an object with properties and methods
- Each call creates a new, independent object

## Why Use Factory Functions?

### Problem: Code Repetition

```typescript
// Without factory - lots of duplication!
const user1 = {
  name: 'Alice',
  email: 'alice@example.com',
  greet() {
    console.log(`Hi, I'm Alice`);
  }
};

const user2 = {
  name: 'Bob',
  email: 'bob@example.com',
  greet() {
    console.log(`Hi, I'm Bob`);
  }
};
```

### Solution: Factory Function

```typescript
// With factory - clean and reusable!
function createUser(name: string, email: string) {
  return {
    name,
    email,
    greet() {
      console.log(`Hi, I'm ${name}`);
    }
  };
}

const user1 = createUser('Alice', 'alice@example.com');
const user2 = createUser('Bob', 'bob@example.com');
```

## Functions vs Methods: What's the Difference?

Before we dive deeper, let's clarify a fundamental concept:

### What Is a Function?

A **function** is a standalone, independent piece of code that you can call directly.

```typescript
// This is a FUNCTION
function greet(name: string) {
  return `Hello, ${name}!`;
}

// Call it directly - no object needed
greet('Alice'); // "Hello, Alice!"
```

**Characteristics of functions:**
- Defined standalone (not attached to an object)
- Called directly by name: `functionName()`
- Takes arguments, runs code, returns output
- Independent - doesn't belong to anything

### What Is a Method?

A **method** is a function that belongs to an object (it's a property of an object whose value is a function).

```typescript
// This is a METHOD (belongs to the person object)
const person = {
  name: 'Alice',
  greet(name: string) {  // This is a method!
    return `Hello, ${name}!`;
  }
};

// Call it THROUGH the object - needs the object!
person.greet('Bob'); // "Hello, Bob!"
```

**Characteristics of methods:**
- Attached to an object (it's a property)
- Called through the object: `object.methodName()`
- Takes arguments, runs code, returns output
- Belongs to an object

### Key Difference: Ownership

**The difference is about ownership and how you call it:**

```typescript
// FUNCTION - standalone, call it directly
function add(a: number, b: number) {
  return a + b;
}

add(2, 3); // ✅ Call directly
// ❌ Can't do: something.add(2, 3) - it doesn't belong to anything!

// METHOD - belongs to an object, call through object
const calculator = {
  add(a: number, b: number) {
    return a + b;
  }
};

calculator.add(2, 3); // ✅ Call through object
// ❌ Can't do: add(2, 3) - the method doesn't exist standalone!
```

### Visual Comparison

```typescript
// FUNCTION: Lives independently
function saveData(data: string) {
  console.log(`Saving: ${data}`);
}

saveData('hello'); // ✅ Direct call


// METHOD: Lives inside an object
const database = {
  saveData(data: string) {  // Same logic, but now it's a method
    console.log(`Saving: ${data}`);
  }
};

database.saveData('hello'); // ✅ Call through object
```

### Real-World Examples

```typescript
// Built-in JavaScript functions (standalone)
parseInt('42');        // Function
parseFloat('3.14');    // Function
console.log('hello');  // Wait! log is actually a METHOD of console object!

// Built-in JavaScript methods (belong to objects)
const text = 'hello';
text.toUpperCase();    // Method (belongs to string object)
text.slice(0, 2);      // Method (belongs to string object)

const numbers = [1, 2, 3];
numbers.push(4);       // Method (belongs to array object)
numbers.map(x => x * 2); // Method (belongs to array object)

Math.random();         // Method (belongs to Math object)
Math.floor(3.7);       // Method (belongs to Math object)
```

### In Factory Functions Context

```typescript
// createUser is a FUNCTION (standalone)
function createUser(name: string) {
  return {
    // greet and updateName are METHODS (belong to the returned object)
    greet() {
      console.log(`Hi, I'm ${name}`);
    },

    updateName(newName: string) {
      name = newName;
    }
  };
}

// Calling the factory FUNCTION
const user = createUser('Alice');

// Calling the METHODS
user.greet();           // Method call
user.updateName('Bob'); // Method call
```

### Quick Summary

**All methods are functions, but not all functions are methods!**

| | Function | Method |
|---|----------|--------|
| **Definition** | Standalone code | Function attached to an object |
| **How to call** | `functionName()` | `object.methodName()` |
| **Belongs to** | Nothing (independent) | An object (property of object) |
| **Example** | `parseInt('42')` | `text.toUpperCase()` |

## Understanding What Gets Returned

### Factory Functions Return Objects (Not Just Functions)

**Important:** Factory functions return **objects that contain methods**, not just individual functions.

```typescript
function createCalculator() {
  let result = 0;

  // Returning an OBJECT
  return {           // ← Object starts here
    add(num: number) {     // ← Method 1
      result += num;
      return this;
    },
    subtract(num: number) { // ← Method 2
      result -= num;
      return this;
    },
    getResult() {          // ← Method 3
      return result;
    }
  };                 // ← Object ends here
}

const calc = createCalculator();
// calc is an object: { add: [Function], subtract: [Function], getResult: [Function] }
```

### Understanding Method Syntax

The syntax you see in factory functions is **ES6 method shorthand**:

```typescript
// Modern shorthand (what you see in examples)
const obj = {
  greet(name: string) {
    console.log(`Hello ${name}`);
  }
};

// Old way (same thing, more verbose)
const obj = {
  greet: function(name: string) {
    console.log(`Hello ${name}`);
  }
};

// They're IDENTICAL! Just different syntax.
```

## The Power of Closures: Private State

This is the **key feature** that makes factory functions powerful!

### What Is a Closure?

A **closure** is when a function "remembers" variables from its outer scope, even after that outer scope has finished executing.

```typescript
function createCounter() {
  let count = 0;  // This variable is PRIVATE (enclosed by closure)

  return {
    increment() {
      count++;  // Can access count via closure
      console.log(count);
    },
    decrement() {
      count--;
      console.log(count);
    },
    getCount() {
      return count;
    }
  };
}

const counter = createCounter();
counter.increment(); // 1
counter.increment(); // 2
counter.decrement(); // 1

console.log(counter.getCount()); // 1

// You CANNOT access count directly - it's truly private!
console.log(counter.count); // undefined
```

**How it works:**
1. `count` is defined in `createCounter`'s scope
2. The returned methods reference `count`
3. JavaScript keeps `count` alive because the methods still need it
4. `count` is trapped inside - only the returned methods can access it

### Methods Can Mutate Factory-Defined Variables

```typescript
function createBankAccount(initialBalance: number) {
  let balance = initialBalance; // Factory-defined variable

  return {
    deposit(amount: number) {
      balance += amount; // ✅ Mutating the private variable
      return balance;
    },

    withdraw(amount: number) {
      if (amount > balance) {
        console.log('Insufficient funds');
        return balance;
      }
      balance -= amount; // ✅ Mutating the private variable
      return balance;
    },

    getBalance() {
      return balance; // ✅ Reading the private variable
    }
  };
}

const account = createBankAccount(1000);
account.deposit(500);   // balance becomes 1500
account.withdraw(200);  // balance becomes 1300
console.log(account.getBalance()); // 1300

// State is maintained across method calls!
```

## Progressive Examples

### Example 1: Todo List

```typescript
function createTodoList() {
  let todos: string[] = []; // Private state

  return {
    add(task: string) {
      todos.push(task);
      console.log(`Added: ${task}`);
    },

    remove(task: string) {
      const index = todos.indexOf(task);
      if (index > -1) {
        todos.splice(index, 1);
        console.log(`Removed: ${task}`);
      }
    },

    list() {
      console.log('Current tasks:');
      todos.forEach((task, i) => {
        console.log(`${i + 1}. ${task}`);
      });
    },

    count() {
      return todos.length;
    }
  };
}

// Usage
const myTodos = createTodoList();
myTodos.add('Buy groceries');
myTodos.add('Walk the dog');
myTodos.list();
// Current tasks:
// 1. Buy groceries
// 2. Walk the dog
```

### Example 2: Calculator with Chaining

```typescript
function createCalculator() {
  let result = 0;

  return {
    add(num: number) {
      result += num;
      return this; // Allows method chaining!
    },

    subtract(num: number) {
      result -= num;
      return this;
    },

    multiply(num: number) {
      result *= num;
      return this;
    },

    getResult() {
      return result;
    },

    reset() {
      result = 0;
      return this;
    }
  };
}

// Usage with chaining
const calc = createCalculator();
const answer = calc.add(10).multiply(2).subtract(5).getResult();
console.log(answer); // 15
```

### Example 3: Logger with Configuration

```typescript
interface LoggerOptions {
  prefix?: string;
  logLevel?: 'debug' | 'info' | 'error';
}

function createLogger(options: LoggerOptions = {}) {
  const prefix = options.prefix || '[LOG]';
  const logLevel = options.logLevel || 'info';

  return {
    debug(message: string) {
      if (logLevel === 'debug') {
        console.log(`${prefix} [DEBUG] ${message}`);
      }
    },

    info(message: string) {
      if (logLevel === 'debug' || logLevel === 'info') {
        console.log(`${prefix} [INFO] ${message}`);
      }
    },

    error(message: string) {
      console.error(`${prefix} [ERROR] ${message}`);
    }
  };
}

// Usage
const appLogger = createLogger({ prefix: '[APP]', logLevel: 'debug' });
appLogger.debug('App started'); // [APP] [DEBUG] App started

const apiLogger = createLogger({ prefix: '[API]', logLevel: 'error' });
apiLogger.debug('This won\'t show'); // (nothing - log level is error)
apiLogger.error('Connection failed'); // [API] [ERROR] Connection failed
```

## Private Helper Functions

You can define helper functions inside the factory that are completely private:

```typescript
function createFormatter() {
  // Private helper functions
  function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function truncate(str: string, maxLength: number) {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength) + '...';
  }

  // Public API
  return {
    formatName(firstName: string, lastName: string) {
      // Uses private helpers
      return `${capitalize(firstName)} ${capitalize(lastName)}`;
    },

    formatPreview(text: string) {
      // Uses private helper
      return truncate(text, 50);
    }
  };
}

const formatter = createFormatter();
console.log(formatter.formatName('john', 'doe')); // "John Doe"

// Private functions are not accessible
formatter.capitalize('test'); // ERROR: capitalize doesn't exist on returned object
```

## Async Factory Functions

Factory functions and their methods **can absolutely be async**!

### Pattern 1: Async Methods Inside Sync Factory

```typescript
function createApiClient(apiKey: string) {
  const baseUrl = 'https://api.example.com';

  return {
    // ✅ Async method
    async fetchUser(id: string) {
      const response = await fetch(`${baseUrl}/users/${id}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      return response.json();
    },

    // ✅ Another async method
    async createUser(data: { name: string; email: string }) {
      const response = await fetch(`${baseUrl}/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      return response.json();
    },

    // Regular sync method
    getBaseUrl() {
      return baseUrl;
    }
  };
}

// Usage
const client = createApiClient('my-api-key'); // Factory call is sync
const user = await client.fetchUser('123');    // Method call is async
await client.createUser({ name: 'Alice', email: 'alice@example.com' });
```

### Pattern 2: Async Factory Function

```typescript
// Factory itself is async (when setup requires async work)
async function createDatabaseClient(connectionString: string) {
  // Async initialization
  const connection = await connectToDatabase(connectionString);

  return {
    async query(sql: string) {
      return connection.execute(sql);
    },

    async close() {
      return connection.close();
    }
  };
}

// Usage - must await the factory call!
const db = await createDatabaseClient('postgresql://localhost/mydb');
await db.query('SELECT * FROM users');
await db.close();
```

### Pattern 3: File Logger with Async

```typescript
function createFileLogger(filename: string) {
  let buffer: string[] = [];

  return {
    // Async method - writes to file
    async log(message: string) {
      const timestamp = new Date().toISOString();
      const line = `[${timestamp}] ${message}\n`;
      buffer.push(line);

      // Async file write
      await fs.promises.appendFile(`logs/${filename}`, line);
    },

    // Async method - flushes buffer
    async flush() {
      if (buffer.length === 0) return;

      const content = buffer.join('');
      await fs.promises.appendFile(`logs/${filename}`, content);
      buffer = [];
    },

    // Sync method - returns buffer size
    getBufferSize() {
      return buffer.length;
    }
  };
}

// Usage
const logger = createFileLogger('app.log');
await logger.log('Application started');
await logger.log('User logged in');
await logger.flush();
```

### When to Use Async?

| Scenario | Use Async? | Example |
|----------|-----------|---------|
| Factory does file I/O during setup | ✅ Yes | `async function createLogger()` |
| Factory just sets variables | ❌ No | `function createCounter()` |
| Method fetches from API | ✅ Yes | `async fetchUser()` |
| Method just returns a variable | ❌ No | `getCount()` |
| Method writes to database | ✅ Yes | `async saveData()` |
| Method does simple math | ❌ No | `add(x, y)` |

**Rule:** Use `async` whenever you need to use `await` inside!

## Multiple Independent Instances

Each factory call creates a completely independent instance:

```typescript
function createTimer(name: string) {
  let seconds = 0;
  let intervalId: NodeJS.Timeout | null = null;

  return {
    start() {
      if (intervalId) return;

      intervalId = setInterval(() => {
        seconds++;
        console.log(`${name}: ${seconds}s`);
      }, 1000);
    },

    stop() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },

    getTime() {
      return seconds;
    }
  };
}

// Create multiple independent timers
const timer1 = createTimer('Timer 1');
const timer2 = createTimer('Timer 2');

timer1.start(); // Timer 1: 1s, 2s, 3s...
timer2.start(); // Timer 2: 1s, 2s, 3s...

// Each has its own private state!
// They run completely independently
```

## Factory Functions vs Classes

Same functionality, different style:

### Factory Function Approach

```typescript
function createDog(name: string, breed: string) {
  let energy = 100; // Private state

  return {
    bark() {
      console.log(`${name} says: Woof!`);
      energy -= 5;
    },

    sleep() {
      console.log(`${name} is sleeping...`);
      energy = 100;
    },

    getEnergy() {
      return energy;
    }
  };
}

const dog = createDog('Rex', 'Labrador');
dog.bark(); // Rex says: Woof!
console.log(dog.getEnergy()); // 95
```

### Class Approach

```typescript
class Dog {
  private energy = 100;

  constructor(private name: string, private breed: string) {}

  bark() {
    console.log(`${this.name} says: Woof!`);
    this.energy -= 5;
  }

  sleep() {
    console.log(`${this.name} is sleeping...`);
    this.energy = 100;
  }

  getEnergy() {
    return this.energy;
  }
}

const dog = new Dog('Rex', 'Labrador');
dog.bark(); // Rex says: Woof!
console.log(dog.getEnergy()); // 95
```

### Comparison

| Aspect | Factory Function | Class |
|--------|------------------|-------|
| **Privacy** | True privacy (closures) | Convention-based (`private` keyword) |
| **Syntax** | Simpler, functional | More formal, OOP |
| **this binding** | No `this` - no issues! | Need to be careful with `this` |
| **Instantiation** | `createDog('Rex')` | `new Dog('Rex')` |
| **Inheritance** | Composition | `extends` keyword |
| **Memory** | Slightly more efficient | Uses prototype chain |

### The `this` Problem (Why Factory Functions Avoid It)

```typescript
// Class - can have `this` binding issues
class Counter {
  private count = 0;

  increment() {
    this.count++;
  }
}

const counter = new Counter();
const incrementFn = counter.increment; // Extract method
incrementFn(); // ERROR! `this` is undefined

// You need to bind it:
const incrementFn = counter.increment.bind(counter); // Annoying!
```

```typescript
// Factory - no `this` binding issues
function createCounter() {
  let count = 0;

  return {
    increment() {
      count++; // No `this`!
    }
  };
}

const counter = createCounter();
const incrementFn = counter.increment; // Extract method
incrementFn(); // ✅ Works perfectly!
```

## When to Use Factory Functions

### ✅ Use Factory Functions When:

- You want true private state
- You don't need inheritance
- You want to avoid `this` binding issues
- You prefer functional style (common in React/Next.js)
- You're building utilities, SDK clients, or stateful tools
- You want simple, clean code

### Use Classes When:

- You need inheritance (`extends`)
- You're working with frameworks that expect classes (Angular)
- You're modeling domain entities with complex inheritance
- Your team prefers OOP patterns

## Common Patterns

### Pattern: Validation and Error Handling

```typescript
function createBankAccount(initialBalance: number) {
  if (initialBalance < 0) {
    throw new Error('Initial balance cannot be negative');
  }

  let balance = initialBalance;
  let transactions: string[] = [];

  function recordTransaction(type: string, amount: number) {
    const timestamp = new Date().toISOString();
    transactions.push(`[${timestamp}] ${type}: $${amount}`);
  }

  return {
    deposit(amount: number) {
      if (amount <= 0) {
        console.log('Error: Amount must be positive');
        return false;
      }

      balance += amount;
      recordTransaction('Deposit', amount);
      return true;
    },

    withdraw(amount: number) {
      if (amount <= 0) {
        console.log('Error: Amount must be positive');
        return false;
      }

      if (amount > balance) {
        console.log('Error: Insufficient funds');
        return false;
      }

      balance -= amount;
      recordTransaction('Withdrawal', amount);
      return true;
    },

    getBalance() {
      return balance;
    },

    getTransactionHistory() {
      return [...transactions]; // Return copy, not reference
    }
  };
}

// Usage
const account = createBankAccount(1000);
account.deposit(500);
account.withdraw(2000); // Error: Insufficient funds
console.log(account.getBalance()); // 1500
```

### Pattern: Lazy Initialization

```typescript
function createExpensiveResource() {
  let resource: any = null; // Not initialized yet

  return {
    async initialize() {
      if (resource) {
        console.log('Already initialized');
        return;
      }

      console.log('Initializing expensive resource...');
      // Simulate expensive operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      resource = { data: 'expensive data' };
      console.log('Initialized!');
    },

    async use() {
      if (!resource) {
        throw new Error('Resource not initialized. Call initialize() first.');
      }

      return resource;
    }
  };
}

// Usage
const expensive = createExpensiveResource();
// Resource is not created yet - fast factory call!

await expensive.initialize(); // Now it's created
const data = await expensive.use();
```

## Key Takeaways

✅ **Factory functions are regular functions that return objects**

✅ **Use closures to create truly private state**

✅ **Returned methods can access and mutate factory-defined variables**

✅ **No `new` keyword needed**

✅ **No `this` binding issues**

✅ **Can be sync or async (both factory and methods)**

✅ **Simple, flexible, and functional**

✅ **Perfect for modern TypeScript/React/Next.js projects**

## Practice Exercise

Try creating this factory function:

```typescript
// Create a shopping cart factory
function createShoppingCart() {
  // TODO: Add private state for items and total

  return {
    // TODO: Add methods:
    // - async addItem(name: string, price: number)
    // - removeItem(name: string)
    // - getTotal()
    // - getItems()
    // - clear()
  };
}
```

Solution available upon request! 🎯
