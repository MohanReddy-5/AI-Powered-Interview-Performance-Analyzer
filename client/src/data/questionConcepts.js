/**
 * Question Concept Map
 * Maps each interview question to its KEY CONCEPTS for accurate feedback.
 * Used by the semantic brain for question-specific "What's missing" feedback
 * instead of generic keyword extraction.
 */

const QUESTION_CONCEPTS = {
    // ═══════════════════════════════════════════════
    //  FRONTEND DEVELOPER
    // ═══════════════════════════════════════════════
    "Explain the Virtual DOM and how it improves performance.": [
        "the diffing algorithm", "reconciliation process",
        "batch updates for multiple state changes", "selective DOM patching"
    ],
    "How does React's Virtual DOM work under the hood?": [
        "virtual tree structure in memory", "diffing algorithm comparing old and new trees",
        "reconciliation to patch real DOM", "minimal change detection"
    ],
    "What performance benefits does the Virtual DOM provide?": [
        "batch updates combining state changes", "selective rendering of changed elements",
        "reduced browser reflows and repaints", "efficient diffing heuristics"
    ],
    "What is the difference between local and global state?": [
        "component scope vs application-wide scope", "prop drilling problem",
        "tools like Redux, Context API, or Zustand", "when to use each based on data needs"
    ],
    "When would you use Redux versus Context API?": [
        "complex state logic with reducers", "middleware for side effects (Thunk/Saga)",
        "time-travel debugging with DevTools", "boilerplate vs simplicity tradeoff"
    ],
    "How do you decide between component state and global state?": [
        "prop drilling as a signal to lift state", "data persistence across routes",
        "starting local and lifting when needed", "single source of truth principle"
    ],
    "Explain the useEffect hook dependency array.": [
        "cleanup function for preventing memory leaks", "empty array [] for mount-only effects",
        "shallow comparison to detect changes", "omitted array runs every render"
    ],
    "How does the dependency array in useEffect control execution?": [
        "shallow comparison using Object.is", "cleanup function before re-runs",
        "synchronizing with external systems", "controlling when side effects execute"
    ],
    "What happens if you omit the dependency array in useEffect?": [
        "effect runs after every single render", "risk of infinite loops from state updates",
        "performance degradation", "always specify dependencies as best practice"
    ],
    "What are Higher-Order Components (HOCs)?": [
        "function that takes and returns a component", "cross-cutting concerns like auth and logging",
        "code reuse without modifying original component", "largely replaced by hooks in modern React"
    ],
    "Can you give an example of a Higher-Order Component?": [
        "withAuth for route protection", "withLoading for loading states",
        "spreading props to wrapped component", "reusable logic wrapper pattern"
    ],
    "How do you optimize a React application that renders slowly?": [
        "React.memo() to prevent unnecessary re-renders", "code splitting with React.lazy() and Suspense",
        "list virtualization with react-window", "React DevTools Profiler to identify bottlenecks"
    ],
    "What techniques can improve React app performance?": [
        "memoization (React.memo, useMemo, useCallback)", "code splitting and lazy loading",
        "list virtualization for long lists", "proper key usage for reconciliation"
    ],
    "Explain the concept of Lifting State Up.": [
        "moving state to closest common ancestor", "single source of truth for shared data",
        "passing state and updater function via props", "keeping sibling components synchronized"
    ],
    "When should you lift state up in React?": [
        "sibling components needing shared data", "avoiding unnecessary state lifting",
        "start local and lift only when needed", "temperature converter as classic example"
    ],
    "What is the difference between useMemo and useCallback?": [
        "useMemo caches a computed value", "useCallback caches a function reference",
        "dependency-based recalculation", "preventing unnecessary child re-renders"
    ],
    "When would you use useMemo versus useCallback?": [
        "useMemo for expensive computations", "useCallback for function props to memoized children",
        "premature optimization warning", "useCallback(fn, deps) equals useMemo(() => fn, deps)"
    ],
    "How does React handle events differently than standard HTML?": [
        "Synthetic Events as cross-browser wrappers", "camelCase event naming convention",
        "event delegation at the root container", "e.preventDefault() instead of return false"
    ],
    "What are Synthetic Events in React?": [
        "cross-browser normalization layer", "event delegation at root container",
        "event pooling for performance", "consistent API across all browsers"
    ],
    "Explain server-side rendering versus client-side rendering.": [
        "initial load time vs subsequent navigation speed", "SEO implications for search indexing",
        "blank screen while JavaScript loads with CSR", "Next.js hybrid approach combining both"
    ],
    "What are the benefits of server-side rendering?": [
        "faster First Contentful Paint", "better SEO with fully rendered HTML",
        "works without JavaScript enabled", "social media preview cards with meta tags"
    ],
    "What are React Portals and when would you use them?": [
        "ReactDOM.createPortal for rendering outside parent DOM", "solving z-index and overflow: hidden issues",
        "modals, tooltips, and dropdown use cases", "event bubbling still works through React tree"
    ],
    "How do you create modals that render outside the component tree?": [
        "createPortal to a modal-root div", "avoiding CSS stacking context issues",
        "React tree event propagation preserved", "separate DOM mount point in index.html"
    ],
    "Explain the difference between var, let, and const.": [
        "function scope vs block scope", "temporal dead zone for let/const",
        "const creates immutable binding (not value)", "best practice: const by default, let when needed"
    ],
    "What is block scoping in JavaScript?": [
        "let/const only exist within {} blocks", "var leaks out of blocks (function-scoped)",
        "preventing variable leakage", "predictable code with block scope"
    ],
    "What is a Closure in JavaScript?": [
        "function retaining access to outer scope after return", "lexical environment preservation",
        "data privacy and encapsulation pattern", "function factories and maintaining state"
    ],
    "Can you provide a practical use case for closures?": [
        "counter with private state variable", "data encapsulation without classes",
        "module pattern for private variables", "each call creates independent closure instance"
    ],
    "Explain the Event Loop, Microtasks, and Macrotasks.": [
        "microtask queue (Promises) vs macrotask queue (setTimeout)", "microtasks always processed before next macrotask",
        "Promise.resolve() executes before setTimeout(0)", "event loop drains all microtasks first"
    ],
    "How does JavaScript handle asynchronous operations?": [
        "Web APIs handle operations outside JS thread", "callback queue for completed operations",
        "event loop checks if call stack is empty", "single-threaded non-blocking model"
    ],
    "What is the difference between == and === in JavaScript?": [
        "== performs type coercion before comparison", "=== checks both value and type strictly",
        "unexpected bugs from type coercion", "always use === as best practice"
    ],
    "Explain promises and async/await in JavaScript.": [
        "three Promise states: pending, fulfilled, rejected", "async/await as syntactic sugar over Promises",
        "eliminating .then() chains for readability", "try/catch for error handling with await"
    ],
    "How do you handle errors in async/await?": [
        "try/catch blocks wrapping await calls", "Promise.allSettled for multiple promises",
        "preventing unhandled promise rejections", "error propagation through async call chain"
    ],
    "What is event delegation in JavaScript?": [
        "single listener on parent instead of each child", "event bubbling from child to parent",
        "handling dynamically added content", "performance improvement with fewer listeners"
    ],
    "Explain the CSS Box Model.": [
        "content, padding, border, margin layers", "box-sizing: border-box includes padding in width",
        "width/height calculation differences", "collapsing margins between elements"
    ],
    "What is the difference between display: none and visibility: hidden?": [
        "display:none removes from document flow", "visibility:hidden keeps space in layout",
        "layout reflow implications", "accessibility and screen reader differences"
    ],
    "Explain Flexbox and Grid. When would you use each?": [
        "Flexbox for 1D layouts (row or column)", "Grid for 2D layouts (rows and columns)",
        "Flexbox for navigation bars and alignment", "Grid for full page layouts and galleries"
    ],
    "What are CSS preprocessors like SASS/SCSS?": [
        "variables and nesting for cleaner code", "mixins for reusable style patterns",
        "compilation to standard CSS", "maintainability and organization benefits"
    ],
    "How do you implement responsive design?": [
        "media queries for breakpoints", "mobile-first design approach",
        "flexible grids and responsive images", "viewport meta tag configuration"
    ],
    "What is debouncing and throttling?": [
        "debouncing delays until pause in events (search input)", "throttling limits to once per interval (scroll events)",
        "performance optimization for frequent events", "implementation with setTimeout and timestamps"
    ],
    "Explain the this keyword in JavaScript.": [
        "execution context determines this value", "arrow functions inherit parent scope's this",
        "strict mode returns undefined (not window)", "bind/call/apply for explicit this binding"
    ],
    "What are Web Workers and when would you use them?": [
        "background thread execution separate from UI", "preventing main thread blocking",
        "heavy computation use cases (data processing)", "communication via postMessage API"
    ],
    "Explain localStorage, sessionStorage, and cookies.": [
        "localStorage persists indefinitely across sessions", "sessionStorage clears when tab closes",
        "cookies sent with every HTTP request automatically", "storage size limits and security considerations"
    ],
    "What is Cross-Site Scripting (XSS) and how do you prevent it?": [
        "malicious script injection into web pages", "input sanitization and HTML escaping",
        "Content Security Policy headers", "React's auto-escaping as built-in protection"
    ],
    "Explain the critical rendering path.": [
        "DOM and CSSOM tree construction", "Render Tree combining both trees",
        "layout calculation and pixel painting", "optimization: defer scripts, inline critical CSS"
    ],
    "What are Progressive Web Apps (PWAs)?": [
        "Service Workers for offline functionality", "Web App Manifest for installability",
        "HTTPS requirement for security", "native app-like behavior on web"
    ],
    "How do you optimize website performance?": [
        "image optimization (lazy loading, WebP, compression)", "code splitting and tree shaking",
        "CDN for static asset delivery", "caching strategies and minimizing HTTP requests"
    ],
    "What is tree shaking in webpack?": [
        "dead code elimination from bundles", "requires ES6 module syntax (import/export)",
        "production mode enables it automatically", "sideEffects: false marking in package.json"
    ],
    "Explain the concept of controlled vs uncontrolled components.": [
        "controlled: React state drives the input (value + onChange)", "uncontrolled: DOM refs access values directly",
        "controlled preferred for validation and dynamic behavior", "form handling patterns in React"
    ],
    "What is the purpose of keys in React lists?": [
        "stable unique IDs help React track changes", "aids reconciliation algorithm performance",
        "prevents rendering bugs with reordering", "never use array index or random values as keys"
    ],
    "How does React Fiber improve React?": [
        "incremental rendering (pause and resume work)", "priority-based updates for responsiveness",
        "better error boundaries with component stack traces", "concurrent mode foundation"
    ],

    // ═══════════════════════════════════════════════
    //  BACKEND DEVELOPER
    // ═══════════════════════════════════════════════
    "Explain the difference between a list and a tuple in Python.": [
        "tuples are hashable and can be dictionary keys", "tuples use less memory and are faster",
        "mutability vs immutability implications", "use case: tuples for fixed data like coordinates"
    ],
    "When would you use a tuple instead of a list?": [
        "fixed collections like coordinates or RGB values", "dictionary keys require hashable types",
        "signaling intent that data shouldn't change", "performance advantage of immutability"
    ],
    "What are Python Decorators and how do they work?": [
        "function wrapping to add behavior without modification", "@syntax as syntactic sugar",
        "practical examples like @timer or @login_required", "closure-based wrapper mechanism"
    ],
    "Can you give an example of using decorators in Python?": [
        "@login_required for authentication checks", "@lru_cache for automatic memoization",
        "parameterized decorators like @app.route", "wrapped function preserving original behavior"
    ],
    "Explain the Global Interpreter Lock (GIL).": [
        "mutex allowing only one thread to execute at a time", "CPython memory management safety reason",
        "I/O-bound (threading works) vs CPU-bound (use multiprocessing)", "alternative interpreters without GIL"
    ],
    "How does Python handle concurrency with the GIL?": [
        "threading for I/O-bound tasks (GIL released during I/O)", "multiprocessing for CPU-bound parallelism",
        "async/await for I/O concurrency without threads", "GIL-free alternatives like PyPy"
    ],
    "What is the difference between an Interface and Abstract Class in Java?": [
        "interface for contracts across unrelated classes", "abstract class for shared code in class hierarchies",
        "multiple interface implementation vs single inheritance", "Java 8 default methods blurring the line"
    ],
    "When should you use an interface versus an abstract class?": [
        "interface for capabilities (Runnable, Comparable)", "abstract class for shared code with constructors and state",
        "is-a relationship vs can-do capability distinction", "multiple interface support for flexibility"
    ],
    "Explain the Java Memory Model - Heap vs Stack.": [
        "stack stores method frames and local variables per thread", "heap stores objects shared across all threads",
        "stack is LIFO with automatic cleanup on method return", "StackOverflowError vs OutOfMemoryError"
    ],
    "How does garbage collection work in Java?": [
        "generational collection (Young Gen and Old Gen)", "Mark-and-Sweep algorithm for unreachable objects",
        "Minor GC vs Major GC frequency and cost", "G1GC region-based collection strategy"
    ],
    "How does Node.js handle concurrency if single-threaded?": [
        "non-blocking I/O delegated via libuv", "event loop processes callbacks when call stack empties",
        "handles thousands of concurrent connections efficiently", "Worker Threads for CPU-intensive tasks"
    ],
    "Explain Node.js event-driven architecture.": [
        "event loop phases (timers, I/O, poll, check)", "libuv delegates async operations to OS/thread pool",
        "callback registration and queue processing", "ideal for I/O-heavy applications like web servers"
    ],
    "Explain ACID properties in databases.": [
        "Atomicity: all-or-nothing (bank transfer example)", "Isolation: concurrent transactions don't interfere",
        "Durability: committed data survives crashes via WAL", "contrast with NoSQL's BASE model"
    ],
    "What does ACID stand for in database systems?": [
        "Atomicity with rollback guarantees", "Isolation levels preventing race conditions",
        "Durability through write-ahead logging", "BASE model as the NoSQL alternative"
    ],
    "Difference between SQL and NoSQL databases?": [
        "relational tables with schemas vs flexible documents", "ACID transactions vs eventual consistency",
        "vertical scaling vs horizontal scaling", "PostgreSQL/MySQL vs MongoDB/Cassandra use cases"
    ],
    "When should you use SQL versus NoSQL?": [
        "SQL for complex joins and data integrity needs", "NoSQL for massive scale and flexible schemas",
        "polyglot persistence combining both approaches", "consistency vs availability tradeoff decision"
    ],
    "What is Database Indexing and how does it work?": [
        "B-Tree structure for O(log n) lookups", "avoiding full table scans on queries",
        "composite indexes for multi-column queries", "index maintenance cost on write operations"
    ],
    "What are the tradeoffs of database indexing?": [
        "faster reads but slower writes", "additional storage overhead for index data",
        "index maintenance on every INSERT/UPDATE/DELETE", "strategic indexing based on query patterns"
    ],
    "What is the CAP Theorem?": [
        "only 2 of 3 guarantees during network partitions", "network partitions are inevitable in distributed systems",
        "CP vs AP as the real choice (MongoDB vs Cassandra)", "concrete database examples for each tradeoff"
    ],
    "Explain the tradeoffs in the CAP theorem.": [
        "CP: rejects writes during partitions for consistency", "AP: allows temporary inconsistency for availability",
        "tunable consistency in modern databases", "CA is impossible in distributed systems"
    ],
    "What is REST API design?": [
        "resource-based URLs (/users/123 not /getUser)", "HTTP methods for CRUD (GET/POST/PUT/DELETE)",
        "stateless communication principle", "standard status codes (200, 404, 500)"
    ],
    "What are REST API best practices?": [
        "plural nouns for resources (/users not /user)", "API versioning (/v1/users)",
        "pagination, filtering, and sorting support", "proper HTTP methods and status codes"
    ],
    "Explain GraphQL versus REST.": [
        "single endpoint vs multiple REST endpoints", "client specifies exact data needed",
        "eliminates over-fetching and under-fetching", "strongly typed schema with introspection"
    ],
    "What are the advantages of GraphQL?": [
        "precise data fetching reduces bandwidth", "single request for nested/related data",
        "self-documenting schema with introspection", "real-time subscriptions built-in"
    ],
    "What is database normalization?": [
        "eliminating data redundancy across tables", "preventing update/insert/delete anomalies",
        "progressive normal forms (1NF through BCNF)", "tradeoff: more joins needed for queries"
    ],
    "Explain the different normal forms in databases.": [
        "1NF: atomic values, no repeating groups", "2NF: no partial dependencies on composite keys",
        "3NF: no transitive dependencies between non-key columns", "most databases target 3NF as practical balance"
    ],
    "What is database denormalization and when to use it?": [
        "adding redundancy for faster read performance", "read-heavy system optimization strategy",
        "faster reads vs update complexity tradeoff", "reporting and analytics use cases"
    ],
    "Explain database transactions and isolation levels.": [
        "Read Uncommitted through Serializable spectrum", "dirty reads, phantom reads, non-repeatable reads",
        "higher isolation means less concurrency", "choosing level based on consistency requirements"
    ],
    "What is the N+1 query problem?": [
        "1 query + N individual queries instead of a single JOIN", "ORM lazy loading as the common cause",
        "eager loading or JOIN queries as the fix", "massive performance impact (101 queries vs 2)"
    ],
    "How do you prevent the N+1 query problem?": [
        "eager loading (includes/prefetch_related)", "JOIN queries for batch data fetching",
        "DataLoader batching pattern for GraphQL", "query logging to detect N+1 patterns"
    ],
    "What is connection pooling?": [
        "reusing database connections instead of creating new ones", "reducing connection setup overhead",
        "configuring pool size based on expected load", "connection lifecycle management"
    ],
    "Explain microservices architecture.": [
        "each service owns its own database", "communication via APIs or message queues",
        "independent deployment and scaling per service", "tradeoffs: distributed complexity and data consistency"
    ],
    "What are the pros and cons of microservices?": [
        "independent scaling and fault isolation as pros", "technology diversity per service",
        "distributed system complexity and debugging difficulty", "data consistency challenges across services"
    ],
    "What is message queue and when to use it?": [
        "asynchronous communication between services", "decoupling producers from consumers",
        "background job processing and load leveling", "event-driven architecture enablement"
    ],
    "Explain pub/sub messaging pattern.": [
        "publisher-subscriber decoupling through topics", "subscribers receive only relevant messages",
        "enabling event-driven architecture", "scalable message distribution"
    ],
    "What is API rate limiting?": [
        "restricting requests per time period", "preventing abuse and ensuring fair usage",
        "token bucket or sliding window algorithms", "Redis counters for implementation"
    ],
    "How do you implement authentication in APIs?": [
        "JWT for stateless token-based auth", "OAuth for third-party authentication",
        "session cookies vs API keys comparison", "security vs scalability tradeoff"
    ],
    "What is database sharding?": [
        "horizontal data distribution across databases", "shard key selection strategy",
        "improved write scalability", "cross-shard query complexity tradeoff"
    ],
    "Explain horizontal vs vertical scaling.": [
        "horizontal: adding more machines (scale out)", "vertical: upgrading hardware (scale up)",
        "horizontal handles single points of failure better", "vertical has hardware ceiling limits"
    ],
    "What is caching and different caching strategies?": [
        "cache-aside (lazy loading on miss)", "write-through (synchronous cache + DB write)",
        "write-back (async cache then DB)", "cache invalidation strategies and TTL"
    ],
    "What is webhook versus polling?": [
        "polling repeatedly checks (wastes resources)", "webhooks push notifications on events",
        "webhook efficiency for real-time updates", "reliability and retry mechanisms for webhooks"
    ],
    "Explain SQL injection and prevention.": [
        "malicious SQL code via unsanitized user input", "parameterized queries and prepared statements",
        "ORM usage as automatic protection", "least privilege database access principle"
    ],
    "What is database replication?": [
        "master-slave for read scaling", "master-master for write availability",
        "data consistency across replicas", "replication lag considerations"
    ],
    "Explain eventual consistency.": [
        "data becomes consistent over time, not immediately", "availability prioritized over instant consistency",
        "suitable for social media feeds and shopping carts", "contrast with strong consistency for banking"
    ],
    "What is load balancing?": [
        "distributing traffic across multiple servers", "algorithms: round-robin, least connections, IP hash",
        "improving availability and fault tolerance", "health checks and failover mechanisms"
    ],
    "Explain containerization with Docker.": [
        "packaging apps with all dependencies", "consistency across dev/staging/prod environments",
        "isolation and portability benefits", "lighter than virtual machines (shared OS kernel)"
    ],
    "What is the difference between Docker and VMs?": [
        "containers share host OS kernel (lighter)", "VMs virtualize entire hardware stack",
        "containers start in seconds vs minutes for VMs", "application-level vs hardware-level isolation"
    ],
    "What is CI/CD pipeline?": [
        "CI: automated testing on every commit", "CD: automated deployment to production",
        "tools like Jenkins, GitHub Actions, GitLab CI", "automated quality gates before release"
    ],
    "Explain the purpose of monitoring and logging.": [
        "system health tracking with metrics", "event recording for debugging and auditing",
        "observability for incident response", "alerting thresholds for proactive detection"
    ],
    "What is the difference between synchronous and asynchronous processing?": [
        "synchronous blocks until operation completes", "asynchronous continues with callbacks/promises",
        "async improves responsiveness and throughput", "choosing based on operation type (I/O vs CPU)"
    ],

    // ═══════════════════════════════════════════════
    //  FULL STACK DEVELOPMENT
    // ═══════════════════════════════════════════════
    "What is the Virtual DOM in React and why is it important?": [
        "lightweight DOM copy kept in memory", "diffing algorithm to detect changes",
        "selective updates to real DOM only", "batching for performance optimization"
    ],
    "Explain the difference between props and state in React.": [
        "props are read-only from parent to child", "state is mutable and local to component",
        "props flow down the component tree", "state changes trigger re-renders"
    ],
    "What is the difference between let, const, and var in JavaScript?": [
        "var is function-scoped and hoisted", "let/const are block-scoped",
        "const prevents reassignment", "const by default, let when reassignment needed"
    ],
    "What are closures in JavaScript?": [
        "function accessing outer scope variables after return", "lexical scope preservation",
        "data privacy and state maintenance patterns", "practical use in callbacks and event handlers"
    ],
    "What is the event loop in JavaScript?": [
        "concurrency model for single-threaded JavaScript", "checks call stack and callback queue",
        "enables async behavior without multi-threading", "microtask vs macrotask priority"
    ],
    "Explain CSS Flexbox and when you would use it.": [
        "one-dimensional layout (row or column)", "justify-content for main axis alignment",
        "align-items for cross axis alignment", "navigation bars and centering use cases"
    ],
    "What is responsive web design?": [
        "adapting layout to all device sizes", "media queries for breakpoint styling",
        "viewport meta tag configuration", "mobile-first progressive enhancement"
    ],
    "What are React hooks? Name 3 commonly used hooks.": [
        "useState for state in functional components", "useEffect for side effects (API calls, subscriptions)",
        "useContext for accessing context data", "useRef, useMemo, useCallback for optimization"
    ],
    "What is a RESTful API? Explain its key principles.": [
        "HTTP methods for CRUD (GET/POST/PUT/DELETE)", "stateless client-server communication",
        "resource-based URL design (/users, /posts)", "uniform interface principle"
    ],
    "What is the difference between SQL and NoSQL databases?": [
        "relational tables with fixed schemas vs flexible documents", "ACID vs eventual consistency models",
        "SQL for complex queries, NoSQL for horizontal scaling", "choosing based on data structure and scale needs"
    ],
    "Explain middleware in Express.js or any web framework.": [
        "functions executing between request and response", "modify req/res objects or end the cycle",
        "authentication, logging, and CORS use cases", "next() function for chain continuation"
    ],
    "What is an ORM and why would you use one?": [
        "maps database tables to code objects", "write queries in your language instead of SQL",
        "automatic SQL injection prevention", "abstraction can hurt complex query performance"
    ],
    "What are environment variables and why are they important?": [
        "configuration stored outside source code", "API keys and secrets never in code repositories",
        "different configs per environment (dev/staging/prod)", "accessed via process.env in Node.js"
    ],
    "Explain the difference between authentication and authorization.": [
        "authentication verifies identity (who are you)", "authorization determines access (what can you do)",
        "authentication always comes first", "JWT for auth, role-based access for authorization"
    ],
    "What is CORS and how do you fix CORS errors?": [
        "browser security blocking cross-origin requests", "Access-Control-Allow-Origin header on server",
        "cors() middleware in Express.js", "preflight OPTIONS requests for non-simple methods"
    ],
    "How would you handle authentication — JWT vs Sessions?": [
        "sessions store state server-side (easier revocation)", "JWT is stateless (better for microservices)",
        "JWT scalability vs session revocation simplicity", "token storage and security considerations"
    ],
    "What is the difference between HTTP and HTTPS?": [
        "HTTPS encrypts data with TLS/SSL", "prevents man-in-the-middle attacks",
        "required for modern web security standards", "SEO ranking factor for search engines"
    ],
    "What are WebSockets and when would you use them?": [
        "full-duplex bidirectional communication", "server can push data to client (unlike HTTP)",
        "real-time chat, live notifications, stock tickers", "persistent connection vs HTTP request-response"
    ],
    "What is Git branching strategy? Explain feature branches.": [
        "feature branches isolate new work", "merge via pull requests with code review",
        "Git Flow (develop/release) vs trunk-based development", "main/master branch represents production"
    ],
    "How would you deploy a full-stack application?": [
        "frontend to CDN (Vercel, Netlify)", "backend containerized to cloud (AWS, Heroku)",
        "managed database service (RDS, MongoDB Atlas)", "CI/CD pipeline for automated testing and deployment"
    ],
    "Design a ride-sharing service like Uber.": [
        "geo-hashing for nearby driver matching", "WebSocket for real-time location tracking",
        "Cassandra for high-throughput trip data", "surge pricing algorithm and payment integration"
    ],
    "How do you implement geolocation matching?": [
        "geo-hashing for spatial proximity queries", "real-time location updates via WebSocket",
        "spatial indexing for efficient search", "distance calculation with Haversine formula"
    ],
    "Design a parking lot system.": [
        "OOP classes: ParkingLot, Level, Spot, Vehicle", "park/unpark operations with ticket system",
        "Strategy pattern for dynamic pricing", "HashMap for O(1) spot lookup"
    ],
    "Design an elevator system.": [
        "SCAN (elevator) algorithm for scheduling", "direction-first queue optimization",
        "minimizing total wait time across floors", "edge cases: fire mode, overweight detection"
    ],
    "Explain database sharding strategies.": [
        "hash-based for even data distribution", "range-based for efficient range queries",
        "geography-based for regional data locality", "tradeoff between balance and query efficiency"
    ],
    "Design a job scheduler.": [
        "priority queue for job ordering", "worker pool polling from the queue",
        "cron expressions for time-based scheduling", "exponential backoff retry with dead letter queue"
    ],
    "What is eventual consistency in distributed systems?": [
        "data becomes consistent over time, not immediately", "availability prioritized over instant consistency",
        "Amazon cart showing briefly stale data as example", "contrast with strong consistency for critical data"
    ],
    "Design a global counter service.": [
        "centralized Redis (simple but single bottleneck)", "distributed shard counters for scalability",
        "periodic aggregation for approximate counts", "accuracy vs scalability tradeoff"
    ],
    "Explain the two-phase commit protocol.": [
        "prepare phase: coordinator asks all participants", "commit phase: all agree then finalize",
        "atomic distributed transactions guarantee", "blocking risk on coordinator failure"
    ],
    "Design a logging and monitoring system.": [
        "agents on servers collecting logs", "Kafka for log stream aggregation",
        "ELK stack (Elasticsearch, Logstash, Kibana)", "threshold-based alerting and dashboards"
    ],
    "What is the circuit breaker pattern?": [
        "prevents cascading failures across services", "three states: closed, open, half-open",
        "fast failure when downstream service is down", "automatic recovery testing in half-open state"
    ],
    "Design a distributed lock.": [
        "Redis SETNX with expiration for safety", "Redlock algorithm for multi-master reliability",
        "ensuring single execution of critical sections", "timeout and deadlock prevention mechanisms"
    ],
    "Explain the saga pattern for distributed transactions.": [
        "compensating actions for rollback on failure", "choreography (events) vs orchestration (coordinator)",
        "step-by-step transaction with undo capability", "eventual consistency across microservices"
    ],
    "Design a content delivery network (CDN).": [
        "edge servers geographically close to users", "origin pull vs push content strategies",
        "caching popular content at the edge", "DNS/Anycast routing to nearest server"
    ],
    "What is database partitioning?": [
        "horizontal partitioning splits rows (sharding)", "vertical partitioning splits columns",
        "improves performance for large datasets", "partition key selection strategy"
    ],
    "Design a real-time analytics system.": [
        "Kafka for stream data ingestion", "Apache Flink/Spark for stream processing",
        "time-series database (InfluxDB) for storage", "Grafana dashboards for visualization"
    ],
    "Explain the bulkhead pattern.": [
        "resource isolation between services", "separate connection pools per service",
        "prevents one failure from consuming all resources", "inspired by ship compartmentalization"
    ],
    "Design an API gateway.": [
        "single entry point routing to microservices", "authentication and rate limiting at the edge",
        "request aggregation from multiple services", "protocol translation and centralized logging"
    ],
    "What is service discovery in microservices?": [
        "services register with discovery server (Consul/Eureka)", "clients query to find available instances",
        "client-side vs server-side discovery patterns", "dynamic scaling with automatic registration"
    ],
    "Design a distributed key-value store.": [
        "consistent hashing for data distribution", "replication factor for availability",
        "vector clocks for conflict resolution", "gossip protocol for cluster membership"
    ],
    "Explain the CQRS pattern.": [
        "separate read and write data models", "optimized queries for each side independently",
        "independent scaling of reads and writes", "eventual consistency complexity between models"
    ],
    "Design a distributed transaction system.": [
        "2PC for strong consistency (blocking risk)", "Saga pattern for eventual consistency",
        "Event Sourcing for complete audit trail", "choosing based on consistency requirements"
    ],
    "What is backpressure in stream processing?": [
        "slow consumers signaling producers to slow down", "buffering, dropping, or blocking strategies",
        "preventing system overload from fast data streams", "reactive streams specification"
    ],
    "Design a deployment pipeline.": [
        "stages: code → build → test → stage → production", "automated tests and manual approval gates",
        "blue-green or canary deployment strategies", "instant rollback to previous version"
    ],
    "Explain idempotency in distributed systems.": [
        "same result from repeated identical operations", "critical for safe retry logic",
        "unique request IDs prevent duplicate processing", "exactly-once semantics implementation"
    ],
    "Design a multi-tenant system.": [
        "separate DB per tenant vs shared DB with tenant_id", "row-level security and tenant context isolation",
        "custom domains and white-labeling support", "usage-based billing per tenant"
    ],
    "What is the strangler fig pattern?": [
        "incrementally replacing legacy system piece by piece", "routing new features to new system",
        "gradual migration until old system fully replaced", "reducing risk compared to big-bang rewrites"
    ],

    // ═══════════════════════════════════════════════
    //  BEHAVIORAL / HR
    // ═══════════════════════════════════════════════
    "Tell me about a time you had a conflict with a coworker.": [
        "specific situation with clear context", "actions taken: 1-on-1 conversation and active listening",
        "measurable positive outcome for the team", "growth in the working relationship"
    ],
    "How do you handle disagreements in a team?": [
        "specific example of a real disagreement", "constructive resolution approach taken",
        "collaborative outcome benefiting the team", "what you learned from the experience"
    ],
    "Describe a situation where you met a tight deadline.": [
        "prioritization strategy (MVP first, cut non-essentials)", "proactive communication with stakeholders",
        "specific actions and time management", "successful delivery result"
    ],
    "How do you prioritize when everything is urgent?": [
        "prioritization framework (impact vs effort matrix)", "stakeholder communication about tradeoffs",
        "cutting non-essentials to focus on core value", "delivering incrementally on the most critical items"
    ],
    "Tell me about a time you failed. What did you learn?": [
        "genuine vulnerability with a real failure", "root cause analysis of what went wrong",
        "concrete behavior or process change afterward", "evidence that you don't repeat the mistake"
    ],
    "Describe a mistake you made and how you handled it.": [
        "honest admission of the specific mistake", "immediate steps taken to fix the situation",
        "systemic improvement implemented to prevent recurrence", "growth mindset demonstration"
    ],
    "Tell me about a time you showed leadership.": [
        "initiative taken beyond your role", "mentoring or process improvement actions",
        "measurable impact on team performance", "standards or practices you established"
    ],
    "How do you mentor junior developers?": [
        "structured guidance approach (pairing, reviews)", "fostering independence over time",
        "measuring mentee growth and confidence", "creating psychological safety to ask questions"
    ],
    "Describe a time you had to learn something new quickly.": [
        "specific learning strategy employed", "leveraging documentation and pair programming",
        "timeline from beginner to productive", "sharing knowledge with the team afterward"
    ],
    "How do you stay updated with technology?": [
        "concrete learning channels (blogs, courses, conferences)", "hands-on experimentation with new tools",
        "community involvement (meetups, open source)", "applying learnings to real work projects"
    ],
    "Tell me about a time you improved a process.": [
        "identifying the specific inefficiency", "proposing and implementing the solution",
        "measurable improvement (time saved, bugs reduced)", "team adoption of the new process"
    ],
    "How do you handle constructive criticism?": [
        "active listening without defensiveness", "asking clarifying questions for specifics",
        "implementing concrete changes based on feedback", "following up to show improvement"
    ],
    "Describe your ideal team culture.": [
        "psychological safety to take risks", "continuous learning and knowledge sharing",
        "work-life balance and sustainable pace", "diverse perspectives and open communication"
    ],
    "How do you handle working with difficult personalities?": [
        "maintaining professional focus on work goals", "finding common ground and shared objectives",
        "setting appropriate boundaries", "empathy and understanding their perspective"
    ],
    "Tell me about a time you went above and beyond.": [
        "specific critical situation requiring extra effort", "root cause analysis beyond the immediate fix",
        "successful outcome and impact", "preventing similar issues in the future"
    ],
    "What motivates you in your work?": [
        "specific motivators tied to the role", "connecting personal values to company mission",
        "growth and continuous learning drive", "team collaboration and building quality products"
    ],
    "How do you handle stress and pressure?": [
        "specific coping strategies (task prioritization, time-boxing)", "proactive communication about realistic timelines",
        "breaking problems into manageable pieces", "maintaining work-life balance for sustainability"
    ],
    "Describe a time you had to make a difficult decision.": [
        "clear decision framework used", "stakeholder consultation and input gathering",
        "tradeoff analysis with pros and cons", "ownership of the outcome and lessons learned"
    ],
    "How do you ensure code quality?": [
        "code reviews and pair programming practices", "automated testing (unit, integration, e2e)",
        "linting and consistent coding standards", "continuous integration catching issues early"
    ],
    "Tell me about a time you received negative feedback.": [
        "listening without getting defensive", "asking for specific actionable examples",
        "implementing concrete changes based on feedback", "following up to demonstrate growth"
    ],
    "What are your career goals?": [
        "specific growth trajectory (senior/lead/architect)", "deep technical expertise in chosen area",
        "mentoring and developing others", "staying current and adapting to industry changes"
    ],
    "How do you approach problem-solving?": [
        "understanding the problem before jumping to solutions", "breaking into smaller components",
        "research and prototyping before committing", "iterating with testing and team review"
    ],
    "Describe your communication style.": [
        "adapting communication to the audience", "active listening as a core habit",
        "using documentation and visual aids", "openness to feedback and adjustment"
    ],
    "How do you handle multiple projects?": [
        "prioritization framework (urgency vs importance)", "time blocking for focused work",
        "realistic estimates and saying no when needed", "project management tools for tracking"
    ],
    "Tell me why you want to work here.": [
        "specific company research demonstrating interest", "mission alignment with personal values",
        "technology stack and technical challenges appeal", "growth opportunities within the company"
    ],
    "What is your greatest strength?": [
        "specific relevant strength with evidence", "concrete example demonstrating it in action",
        "measurable impact of that strength", "self-awareness about how you leverage it"
    ],
    "What is your greatest weakness?": [
        "genuine weakness (not a disguised strength)", "specific improvement actions you're taking",
        "progress you've made on addressing it", "self-awareness and growth mindset"
    ],
    "How do you handle ambiguity?": [
        "asking clarifying questions to reduce uncertainty", "making documented assumptions",
        "iterating based on feedback as clarity emerges", "staying flexible and adapting plans"
    ],
    "Describe a time you influenced without authority.": [
        "built a compelling demo or proof of concept", "addressed stakeholder concerns proactively",
        "gradually built consensus through data and results", "positive adoption outcome"
    ],
    "How do you balance technical debt with new features?": [
        "assessing debt impact and risk systematically", "allocating sprint percentage to debt reduction",
        "making technical debt visible in planning", "advocating with data on long-term cost"
    ],
    "What questions do you have for me?": [
        "team structure and engineering culture questions", "technology challenges and growth plans",
        "career development opportunities", "deployment process and code review practices"
    ],
    "Tell me about yourself.": [
        "concise professional summary (2-3 minutes)", "key relevant experiences and achievements",
        "skills aligned to the specific role", "clear statement of why this opportunity interests you"
    ],
    "Why are you leaving your current job?": [
        "growth-focused positive framing", "specific new challenges you're seeking",
        "staying positive about current/past employers", "forward-looking motivation"
    ],
    "How do you handle work-life balance?": [
        "setting clear boundaries between work and personal time", "time management strategies",
        "prioritizing health and sustainability", "communicating needs with team and manager"
    ],
    "Describe a time you collaborated across teams.": [
        "cross-team coordination approach (regular syncs)", "shared documentation and API contracts",
        "aligning on interfaces and expectations", "smooth integration outcome"
    ],
    "How do you give feedback to peers?": [
        "timely and specific (not vague or delayed)", "private for criticism, public for praise",
        "focusing on behavior not person", "actionable suggestions for improvement"
    ],
    "What makes you a good fit for this role?": [
        "matching your skills to specific job requirements", "citing concrete experience evidence",
        "showing enthusiasm for the role's challenges", "explaining the unique value you'd add"
    ],
    "How do you handle changing requirements?": [
        "staying flexible and understanding the reason for change", "assessing impact on timeline and scope",
        "communicating with all affected stakeholders", "adjusting plans and documenting changes"
    ],
    "Tell me about a time you took initiative.": [
        "identifying an improvement opportunity independently", "researching and proposing a concrete solution",
        "implementing without waiting to be asked", "measurable positive result from your initiative"
    ],
    "How do you measure success?": [
        "user impact and satisfaction metrics", "code quality and system reliability",
        "team collaboration effectiveness", "business value and goals delivered"
    ],
    "Describe your debugging process.": [
        "reproduce the issue first", "read error logs and stack traces",
        "binary search to isolate the cause", "root cause analysis (not just symptom fix)"
    ],
    "How do you handle production incidents?": [
        "stay calm and assess severity immediately", "communicate status to stakeholders",
        "fix or rollback to restore service", "post-mortem with prevention measures"
    ],
    "What do you do when you don't know the answer?": [
        "honest admission without shame", "structured approach to finding the answer",
        "consulting documentation and domain experts", "documenting and sharing learnings with team"
    ],
    "How do you ensure you're building the right thing?": [
        "user research and requirements gathering", "prototyping and getting early feedback",
        "iterating based on real user data", "aligning with stakeholders on success metrics"
    ],
    "Tell me about a time you had to convince someone.": [
        "data-driven persuasion with evidence", "demonstrating benefits through proof of concept",
        "addressing concerns and objections directly", "positive outcome and adoption"
    ],
    "How would your colleagues describe you?": [
        "collaborative team player", "reliable and consistent delivery",
        "strong communicator and problem-solver", "specific examples backing up each quality"
    ],
    "What's the most impactful project you've worked on?": [
        "clear problem statement and context", "your specific role and contributions",
        "technologies used and challenges overcome", "measurable business or user impact"
    ],
    "How do you keep your team motivated?": [
        "recognizing achievements publicly", "providing clear goals and removing blockers",
        "creating growth and learning opportunities", "inclusive culture that celebrates wins"
    ],
    "Describe your approach to code reviews.": [
        "constructive feedback explaining the why", "suggesting alternatives not just pointing problems",
        "security and performance as review priorities", "appreciating good patterns and clever solutions"
    ],
    "What technology are you most excited about?": [
        "specific technology with clear reasoning", "what problems it solves and why it matters",
        "what you're learning or building with it", "how it applies to the role you're interviewing for"
    ],

    // ═══════════════════════════════════════════════
    //  DATA SCIENCE & ML
    // ═══════════════════════════════════════════════
    "Explain the bias-variance tradeoff.": [
        "high bias causes underfitting (model too simple)", "high variance causes overfitting (model too complex)",
        "minimizing total error at the sweet spot", "regularization to control variance"
    ],
    "How do you balance bias and variance in models?": [
        "regularization techniques to reduce variance", "cross-validation for detecting imbalance",
        "ensemble methods addressing both simultaneously", "model complexity tuning"
    ],
    "What is Overfitting and how do you prevent it?": [
        "learning noise instead of true signal", "cross-validation for early detection",
        "regularization (L1/L2) to constrain complexity", "dropout and early stopping techniques"
    ],
    "How do you detect overfitting in your model?": [
        "gap between training and test accuracy", "learning curves showing divergence",
        "cross-validation scoring across folds", "validation set monitoring during training"
    ],
    "Explain supervised versus unsupervised learning.": [
        "supervised: labeled data with known outputs", "unsupervised: finding hidden patterns without labels",
        "classification and regression as supervised examples", "clustering and PCA as unsupervised examples"
    ],
    "What is the difference between classification and regression?": [
        "classification predicts categorical labels", "regression predicts continuous values",
        "accuracy vs MSE as evaluation metrics", "logistic regression vs linear regression examples"
    ],
    "Explain cross-validation and its importance.": [
        "k-fold splitting and rotation across folds", "more robust than single train-test split",
        "prevents overfitting to a particular test set", "stratified CV for imbalanced class distribution"
    ],
    "What is k-fold cross-validation?": [
        "data split into k equal folds", "train on k-1 folds, validate on remaining",
        "performance averaged across all k iterations", "common choice k=5 or k=10"
    ],
    "Explain precision versus recall.": [
        "precision: TP/(TP+FP) — accuracy of positive predictions", "recall: TP/(TP+FN) — coverage of actual positives",
        "F1-score as harmonic mean balancing both", "optimize precision for spam, recall for disease detection"
    ],
    "When would you optimize for precision vs recall?": [
        "high precision when false positives are costly", "high recall when false negatives are dangerous",
        "F1-score for balanced optimization", "threshold tuning to shift the balance"
    ],
    "What is regularization?": [
        "penalty term added to loss function for complexity", "L1 (Lasso) drives coefficients to zero",
        "L2 (Ridge) shrinks coefficients uniformly", "prevents overfitting by constraining model"
    ],
    "Explain L1 vs L2 regularization.": [
        "L1 produces sparse models (feature selection)", "L2 keeps all features but shrinks weights",
        "L1 for automatic feature elimination", "L2 better for multicollinearity handling"
    ],
    "What is gradient descent?": [
        "iteratively following negative gradient toward minimum", "learning rate controls step size",
        "converges to minimum of loss function", "batch, stochastic, and mini-batch variants"
    ],
    "Explain different types of gradient descent.": [
        "batch: uses all data (stable but slow)", "stochastic: one sample (noisy but fast convergence)",
        "mini-batch: best of both (practical default)", "learning rate scheduling for better convergence"
    ],
    "What is a confusion matrix?": [
        "TP/FP/TN/FN in a 2x2 table", "basis for computing precision, recall, accuracy",
        "visual assessment of classification performance", "extends to multi-class with NxN matrix"
    ],
    "How do you evaluate a classification model?": [
        "confusion matrix: TP/FP/TN/FN analysis", "precision, recall, F1-score metrics",
        "ROC curve and AUC for threshold analysis", "cross-validation for robust evaluation"
    ],
    "Explain decision trees and random forests.": [
        "trees split data on feature thresholds", "random forests: ensemble of trees on random subsets",
        "bagging reduces variance vs single tree", "built-in feature importance ranking"
    ],
    "What are the advantages of random forests?": [
        "handles non-linear relationships well", "reduces variance compared to single decision tree",
        "built-in feature importance scores", "robust to overfitting through ensemble averaging"
    ],
    "What is feature engineering?": [
        "creating predictive features from raw data", "encoding categorical variables (one-hot, label)",
        "scaling and normalizing numerical features", "domain knowledge-driven transformations"
    ],
    "How do you handle categorical variables?": [
        "one-hot encoding for nominal categories", "label encoding for ordinal categories",
        "target encoding for high-cardinality features", "ordinal vs nominal distinction matters"
    ],
    "Explain Principal Component Analysis (PCA).": [
        "finding orthogonal axes of maximum variance", "dimensionality reduction preserving information",
        "visualization of high-dimensional data", "noise reduction and training speedup"
    ],
    "When would you use dimensionality reduction?": [
        "high-dimensional data visualization (PCA, t-SNE)", "reducing noise in features",
        "speeding up model training time", "mitigating the curse of dimensionality"
    ],
    "What is the difference between bagging and boosting?": [
        "bagging: parallel ensemble (Random Forest)", "boosting: sequential, focuses on errors (XGBoost)",
        "bagging reduces variance, boosting reduces bias", "boosting often achieves higher accuracy"
    ],
    "Explain ensemble methods.": [
        "combining multiple models for better predictions", "bagging (parallel) vs boosting (sequential)",
        "voting and averaging aggregation strategies", "reduced overfitting through model diversity"
    ],
    "What is A/B testing?": [
        "random user assignment to control and treatment", "measuring statistical significance of differences",
        "sample size and test duration planning", "business metric impact quantification"
    ],
    "How do you determine statistical significance?": [
        "p-value calculation against significance threshold", "confidence intervals for effect size",
        "sample size requirements for statistical power", "multiple testing correction (Bonferroni)"
    ],
    "Explain the central limit theorem.": [
        "sample means approach normal distribution", "works regardless of population distribution shape",
        "foundation for statistical inference", "larger samples improve the normal approximation"
    ],
    "What is a p-value?": [
        "probability of results assuming null hypothesis is true", "p < 0.05 as common significance threshold",
        "does not measure effect size or practical importance", "multiple testing inflates false positive rate"
    ],
    "Explain type I and type II errors.": [
        "Type I: false positive (rejecting true null)", "Type II: false negative (accepting false null)",
        "significance level (alpha) controls Type I rate", "statistical power (1 - beta) controls Type II rate"
    ],
    "What is feature selection?": [
        "filter methods based on correlation/statistics", "wrapper methods (forward/backward selection)",
        "embedded methods like Lasso regularization", "reduces overfitting and speeds up training"
    ],
    "How do you handle imbalanced datasets?": [
        "SMOTE oversampling for minority class", "class weights to penalize majority class errors",
        "evaluation with F1-score instead of accuracy", "ensemble methods specialized for imbalance"
    ],
    "What is the ROC curve?": [
        "True Positive Rate vs False Positive Rate plot", "AUC measures overall model discrimination",
        "higher AUC (closer to 1.0) means better model", "threshold selection for operating point"
    ],
    "Explain neural networks basics.": [
        "interconnected layers of artificial neurons", "forward pass computes predictions",
        "backpropagation updates weights via gradient descent", "activation functions add non-linearity (ReLU)"
    ],
    "What is backpropagation?": [
        "chain rule computing gradients through layers", "propagates error backward to update weights",
        "loss function minimization through iteration", "learning rate and optimizer selection"
    ],
    "What is the vanishing gradient problem?": [
        "gradients shrink exponentially in deep networks", "early layers stop learning effectively",
        "ReLU activation as the primary solution", "batch normalization and residual connections help"
    ],
    "Explain different activation functions.": [
        "Sigmoid (0-1, suffers vanishing gradient)", "ReLU (most common, avoids vanishing gradient)",
        "Softmax for multi-class output probabilities", "Leaky ReLU prevents dead neuron problem"
    ],
    "What is dropout in neural networks?": [
        "randomly disabling neurons during training", "forces network to learn robust features",
        "acts as regularization to prevent overfitting", "disabled during inference (prediction time)"
    ],
    "Explain batch normalization.": [
        "normalizes layer inputs for stable learning", "enables faster training with higher learning rates",
        "provides regularization effect", "reduces internal covariate shift problem"
    ],
    "What is transfer learning?": [
        "pre-trained model as starting point for new task", "fine-tuning on domain-specific data",
        "requires much less training data", "leveraging features learned from large datasets"
    ],
    "Explain convolutional neural networks (CNNs).": [
        "convolution layers detecting spatial features", "pooling layers for dimension reduction",
        "image classification and object detection applications", "hierarchical feature learning from simple to complex"
    ],
    "What are recurrent neural networks (RNNs)?": [
        "processing sequential data with memory/state", "LSTM for capturing long-term dependencies",
        "GRU as simpler alternative to LSTM", "NLP and time series as primary applications"
    ],
    "Explain the attention mechanism.": [
        "dynamically weighting input importance", "foundation of the Transformer architecture",
        "allowing focus on relevant parts of input", "enabling parallel processing (unlike RNNs)"
    ],
    "What is the transformer architecture?": [
        "self-attention mechanism without recurrence", "positional encoding for sequence awareness",
        "powers BERT, GPT, and modern NLP models", "encoder-decoder structure for sequence tasks"
    ],
    "How do you handle missing data?": [
        "removing rows vs imputation tradeoff", "mean/median/mode or KNN imputation methods",
        "predictive models to fill missing values", "flagging missingness as a feature itself"
    ],
    "What is data normalization vs standardization?": [
        "normalization scales features to [0,1] range", "standardization centers at mean=0, std=1",
        "normalization for bounded ranges and neural networks", "standardization when data follows normal distribution"
    ],
    "Explain hyperparameter tuning.": [
        "grid search vs random search approaches", "Bayesian optimization for efficiency",
        "cross-validation to prevent overfitting during tuning", "key hyperparameters: learning rate, regularization, architecture"
    ],
    "What is the curse of dimensionality?": [
        "data becomes exponentially sparse in high dimensions", "distance metrics lose discriminative power",
        "need exponentially more data as dimensions increase", "dimensionality reduction as the solution"
    ],
    "Explain recommendation systems.": [
        "collaborative filtering (user/item similarity)", "content-based filtering using item features",
        "hybrid approach combining both methods", "cold start problem for new users/items"
    ],
    "What is time series forecasting?": [
        "trend, seasonality, and residual decomposition", "ARIMA and exponential smoothing methods",
        "LSTM for capturing complex temporal patterns", "stationarity requirement for classical methods"
    ],
    "How do you detect anomalies?": [
        "statistical methods like z-score thresholds", "isolation forest for high-dimensional data",
        "autoencoders learning normal patterns", "fraud detection and system monitoring applications"
    ],
    "What is reinforcement learning?": [
        "agent learning through environment interaction", "reward/penalty feedback signals",
        "maximizing cumulative long-term reward", "applications in games, robotics, and optimization"
    ],
    "Explain model deployment considerations.": [
        "model versioning and reproducibility", "monitoring for performance degradation",
        "retraining strategy and schedule", "data drift detection in production"
    ],

    // ═══════════════════════════════════════════════
    //  JAVA PROGRAMMING (BASIC)
    // ═══════════════════════════════════════════════
    "What is the difference between JDK, JRE, and JVM?": [
        "JDK contains compiler (javac) and dev tools", "JRE contains libraries and runtime environment",
        "JVM executes bytecode for platform independence", "containment: JDK includes JRE includes JVM"
    ],
    "Explain the main method signature in Java.": [
        "public for universal accessibility", "static so JVM calls without creating an object",
        "void because it returns nothing to the JVM", "String[] args accepts command-line arguments"
    ],
    "What are the primitive data types in Java?": [
        "8 types: byte/short/int/long/float/double/char/boolean", "stored directly in memory (not as objects)",
        "specific bit sizes for each type", "wrapper classes (Integer, Double) for object usage"
    ],
    "What is the difference between int and Integer?": [
        "int is a primitive stored directly in memory", "Integer is a wrapper class (object on heap)",
        "autoboxing/unboxing converts between them automatically", "Integer needed for collections and can hold null"
    ],
    "Explain String immutability in Java.": [
        "value cannot change once String is created", "enables String pool for memory efficiency",
        "provides thread safety for concurrent access", "use StringBuilder for mutable string operations"
    ],
    "What is the difference between String, StringBuilder, and StringBuffer?": [
        "String: immutable and thread-safe", "StringBuilder: mutable, fast, not thread-safe",
        "StringBuffer: mutable, synchronized, thread-safe", "use StringBuilder for loops, String for constants"
    ],
    "What are access modifiers in Java?": [
        "public: accessible from anywhere", "private: only within the same class",
        "protected: same package plus subclasses", "default/package-private: same package only"
    ],
    "Explain the concept of encapsulation.": [
        "private fields with public getters/setters", "hiding internal implementation details",
        "protecting data integrity from external code", "allows changing implementation without breaking callers"
    ],
    "What is a constructor in Java?": [
        "special method called on object creation with new", "same name as class with no return type",
        "default constructor provided if none defined", "initializes object state and fields"
    ],
    "What is constructor overloading?": [
        "multiple constructors with different parameter lists", "allows creating objects in different ways",
        "Java selects constructor based on arguments", "this() for calling another constructor in same class"
    ],
    "What is the 'this' keyword in Java?": [
        "refers to the current object instance", "distinguishes instance variables from parameters",
        "this() calls other constructors in same class", "can pass current object as method parameter"
    ],
    "What is method overloading?": [
        "same method name with different parameter lists", "compile-time polymorphism (resolved at compile time)",
        "return type alone is not enough to overload", "Java selects method based on argument types"
    ],
    "What is the difference between == and equals()?": [
        "== compares references (memory addresses)", "equals() compares content/values",
        "classic String trap: new String == new String is false", "override equals() for custom equality logic"
    ],
    "Explain the if-else statement in Java.": [
        "boolean condition-based branching", "else-if chains for multiple conditions",
        "first true condition block executes", "braces recommended even for single statements"
    ],
    "What is a switch statement and when to use it?": [
        "selects code block based on variable value", "works with byte/short/int/char/String/enum",
        "break prevents fall-through to next case", "more readable than multiple if-else chains"
    ],
    "Explain the for loop in Java.": [
        "three parts: initialization, condition, update", "condition checked before each iteration",
        "enhanced for-each for collections/arrays", "use when iteration count is known"
    ],
    "What is a while loop?": [
        "repeats while boolean condition is true", "condition checked before each iteration",
        "may execute zero times if initially false", "must ensure condition eventually becomes false"
    ],
    "What is the difference between while and do-while loops?": [
        "while checks condition before body execution", "do-while checks condition after (runs at least once)",
        "do-while useful for menu-driven programs", "syntax includes semicolon after while condition"
    ],
    "What is an array in Java?": [
        "fixed-size container for same-type elements", "zero-indexed access with arr[index]",
        "arr.length gives the fixed size", "cannot resize after creation (use ArrayList instead)"
    ],
    "How do you iterate through an array?": [
        "traditional for loop with index variable", "enhanced for-each loop for read-only",
        "Arrays.stream() for functional operations", "choose based on whether index is needed"
    ],
    "What is a multidimensional array?": [
        "array of arrays in nested structure", "2D arrays: matrix[row][col] access pattern",
        "jagged arrays with different row lengths possible", "nested loops for iteration"
    ],
    "What is the difference between break and continue?": [
        "break exits the entire loop immediately", "continue skips current iteration to next",
        "both work in for, while, and do-while", "labeled break/continue for nested loops"
    ],
    "What is a class in Java?": [
        "blueprint or template for creating objects", "defines properties (fields) and behaviors (methods)",
        "implements OOP: encapsulation, inheritance, polymorphism", "every Java program has at least one class"
    ],
    "What is an object in Java?": [
        "instance of a class created with new keyword", "has state (field values) and behavior (methods)",
        "stored in heap memory", "each object has its own copy of instance variables"
    ],
    "What is inheritance in Java?": [
        "child extends parent (is-a relationship)", "inherits fields and methods from parent class",
        "Java supports single inheritance only", "super keyword accesses parent members"
    ],
    "What is the 'super' keyword?": [
        "refers to the parent class", "super() calls parent constructor (must be first line)",
        "super.method() calls overridden parent method", "accessing parent fields hidden by child"
    ],
    "What is method overriding?": [
        "subclass provides specific implementation of parent method", "must have same name, return type, and parameters",
        "@Override annotation ensures correct overriding", "runtime polymorphism (JVM decides at runtime)"
    ],
    "What is polymorphism in Java?": [
        "compile-time: method overloading", "runtime: method overriding with parent reference",
        "Animal a = new Dog(); calls Dog's methods", "enables flexible, extensible code design"
    ],
    "What is an abstract class?": [
        "declared with abstract keyword, cannot be instantiated", "abstract methods: no body, subclass must implement",
        "can also have concrete methods with implementation", "partial abstraction for shared code in hierarchies"
    ],
    "What is an interface in Java?": [
        "contract defining methods a class must implement", "supports multiple implementation (unlike extends)",
        "all methods implicitly public and abstract (pre-Java 8)", "defines capabilities unrelated classes can share"
    ],
    "What is the difference between abstract class and interface?": [
        "abstract class can have constructors and state (fields)", "interface supports multiple implementation",
        "abstract for is-a hierarchies, interface for can-do capabilities", "Java 8 default methods reduced the distinction"
    ],
    "What is a package in Java?": [
        "namespace organizing related classes and interfaces", "prevents naming conflicts across projects",
        "controls access with package-level visibility", "import statement to use classes from other packages"
    ],
    "What is the import statement?": [
        "enables using classes without full qualified names", "import specific class or wildcard (*)",
        "compile-time feature with no runtime overhead", "avoids java.util.ArrayList verbose references"
    ],
    "What is exception handling in Java?": [
        "try-catch-finally blocks for error management", "prevents program crashes from runtime errors",
        "catch specific exceptions for targeted handling", "finally runs cleanup code regardless of exceptions"
    ],
    "What is the difference between checked and unchecked exceptions?": [
        "checked: compiler forces handling (IOException)", "unchecked: runtime errors (NullPointerException)",
        "checked = recoverable conditions, unchecked = bugs", "throws keyword declares checked exceptions"
    ],
    "What is the finally block?": [
        "executes regardless of exception occurrence", "cleanup code: closing files, connections",
        "runs even after return statements in try/catch", "only System.exit() or fatal errors prevent it"
    ],
    "What is the throw keyword?": [
        "explicitly creates and throws an exception object", "signals errors in your code intentionally",
        "custom exception classes for domain-specific errors", "used with validation: if invalid, throw exception"
    ],
    "What is the throws keyword?": [
        "declares method may throw checked exceptions", "passes handling responsibility to caller",
        "required by compiler for checked exceptions", "documents potential error conditions"
    ],
    "What is a static variable?": [
        "belongs to the class, not individual instances", "shared among all objects of that class",
        "accessed via ClassName.variableName", "initialized once when class is loaded into memory"
    ],
    "What is a static method?": [
        "belongs to class, called without creating object", "only accesses other static members directly",
        "cannot use this or super keywords", "utility methods like Math.sqrt() are static"
    ],
    "What is the final keyword?": [
        "final variable: constant, cannot be reassigned", "final method: cannot be overridden by subclasses",
        "final class: cannot be inherited", "static final for compile-time constants"
    ],
    "What is a static block?": [
        "executes once when class is first loaded", "used for complex static variable initialization",
        "runs before any constructor or static method call", "multiple static blocks execute in declaration order"
    ],
    "What is the difference between ArrayList and Array?": [
        "ArrayList is dynamic (auto-resizes), array is fixed", "arrays can hold primitives directly",
        "ArrayList provides add/remove/contains methods", "ArrayList uses generics for type safety"
    ],
    "How do you create an ArrayList?": [
        "ArrayList<Type> with generics for type safety", "add/get/remove/size core methods",
        "part of java.util Collections Framework", "import java.util.ArrayList required"
    ],
    "What is the difference between = and == operators?": [
        "= is assignment (assigns value to variable)", "== is equality comparison (returns boolean)",
        "confusing them is a common source of bugs", "use .equals() for object content comparison"
    ],
    "What are logical operators in Java?": [
        "&& (AND), || (OR), ! (NOT) operators", "short-circuit evaluation skips second operand when possible",
        "combining multiple boolean conditions", "operator precedence: ! higher than && higher than ||"
    ],
    "What is the ternary operator?": [
        "shorthand if-else: condition ? true : false", "returns a value (it's an expression)",
        "avoid nesting for readability", "useful for simple conditional assignments"
    ],
    "What is type casting in Java?": [
        "widening (implicit): int to double, automatic", "narrowing (explicit): double to int, requires cast",
        "data loss risk when narrowing (decimal truncation)", "object casting between parent and child classes"
    ],
    "What is autoboxing and unboxing?": [
        "autoboxing: int to Integer automatically", "unboxing: Integer to int automatically",
        "happens in assignments, method calls, collections", "NullPointerException risk when unboxing null"
    ],
    "What is a NullPointerException?": [
        "calling methods or accessing fields on null reference", "most common runtime exception in Java",
        "prevent with null checks: if (obj != null)", "Optional class as modern alternative to null checks"
    ],

    // ═══════════════════════════════════════════════
    //  PYTHON PROGRAMMING (BASIC)
    // ═══════════════════════════════════════════════
    "What is Python and why is it popular?": [
        "interpreted language with no compilation step", "dynamically typed (no variable type declarations)",
        "versatile: web, data science, AI, automation", "large community and extensive package ecosystem (PyPI)"
    ],
    "What are Python's key features?": [
        "easy-to-read syntax with significant whitespace", "multiple paradigm support (OOP, functional)",
        "extensive standard library built-in", "interpreted with rapid development cycle"
    ],
    "What is the difference between Python 2 and Python 3?": [
        "print() is a function in Python 3 (not statement)", "division: 5/2 = 2.5 in Python 3 (not 2)",
        "strings are Unicode by default in Python 3", "Python 2 reached end-of-life in January 2020"
    ],
    "What are variables in Python?": [
        "created on assignment (no declaration needed)", "dynamically typed: type determined at runtime",
        "can change type by reassignment", "naming convention: lowercase_with_underscores"
    ],
    "What are Python's basic data types?": [
        "int, float, str, bool, None as core types", "type() to check variable's type",
        "type conversion functions: int(), str(), float()", "Python infers type automatically"
    ],
    "What is the difference between list and tuple?": [
        "lists are mutable [], tuples are immutable ()", "tuples are faster and use less memory",
        "tuples can be dictionary keys (hashable)", "lists for dynamic collections, tuples for fixed data"
    ],
    "How do you create and use a list?": [
        "square brackets with mixed types allowed", "append/remove/pop for modification",
        "slicing: list[start:stop:step]", "zero-indexed access and len() for size"
    ],
    "What is a dictionary in Python?": [
        "key-value pairs in curly braces {}", "access values by unique keys",
        "mutable: add, modify, delete entries", "keys(), values(), items() for iteration"
    ],
    "What is a set in Python?": [
        "unordered collection with unique elements only", "automatic duplicate removal",
        "union/intersection/difference operations", "fast membership testing with 'in' operator"
    ],
    "What are strings in Python?": [
        "immutable sequences of characters", "slicing: s[start:stop:step]",
        "methods: upper(), lower(), strip(), split(), replace()", "f-string formatting: f'Hello {name}'"
    ],
    "How do you format strings in Python?": [
        "f-strings: fastest and most readable (Python 3.6+)", ".format() method with placeholders",
        "% operator for legacy formatting", "format specifiers for numbers: {:.2f}"
    ],
    "What are Python operators?": [
        "arithmetic: +, -, *, /, //, %, **", "comparison: ==, !=, <, >, <=, >=",
        "logical: and, or, not", "membership (in) and identity (is) operators"
    ],
    "What is the difference between == and is?": [
        "== compares values (content equality)", "is compares identity (same object in memory)",
        "use is for None checks: if x is None", "two equal lists are == but not 'is'"
    ],
    "What are conditional statements in Python?": [
        "if/elif/else with indentation-based blocks", "logical operators (and/or/not) for combining",
        "truthy/falsy evaluation of values", "ternary expression: value_if_true if condition else value_if_false"
    ],
    "What is a for loop in Python?": [
        "iterates over sequences (lists, tuples, strings)", "range() for number sequences",
        "enumerate() for index and value together", "for-each style (no manual indexing needed)"
    ],
    "What is the range() function?": [
        "generates number sequences: range(start, stop, step)", "returns an iterator (not a list directly)",
        "range(5) gives 0,1,2,3,4 (excludes stop)", "commonly paired with for loops"
    ],
    "What is a while loop?": [
        "repeats while condition remains True", "condition checked before each iteration",
        "break to exit early, continue to skip iteration", "must ensure condition eventually becomes False"
    ],
    "What are break and continue statements?": [
        "break exits the loop entirely and immediately", "continue skips to the next iteration",
        "both work in for and while loops", "use break for early exit on found condition"
    ],
    "What is a function in Python?": [
        "defined with def keyword", "parameters for input, return for output",
        "default parameter values allowed", "promotes code reuse and organization"
    ],
    "What are function arguments and parameters?": [
        "positional arguments matched by order", "keyword arguments matched by name",
        "*args for variable positional, **kwargs for keyword", "default values for optional parameters"
    ],
    "What is the return statement?": [
        "sends value back from function to caller", "exits function immediately when reached",
        "returns None if no return statement", "can return multiple values as a tuple"
    ],
    "What are lambda functions?": [
        "anonymous one-line functions: lambda x: expression", "used with map(), filter(), sorted()",
        "shorthand for simple operations", "prefer def for complex logic"
    ],
    "What is list comprehension?": [
        "[expression for item in iterable if condition] syntax", "more readable and faster than equivalent loops",
        "conditional filtering with if clause", "equivalent to map/filter but more Pythonic"
    ],
    "What are Python modules?": [
        "files containing reusable Python code", "import with 'import module_name'",
        "built-in modules: math, random, os, datetime", "organizing code into logical, reusable files"
    ],
    "How do you import modules?": [
        "import module: full module import", "from module import function: specific import",
        "import module as alias: shorthand naming", "avoid wildcard 'from module import *' in production"
    ],
    "What is the difference between append() and extend()?": [
        "append() adds single element to end", "extend() adds multiple elements from iterable",
        "append([1,2]) creates nested list", "extend([1,2]) merges items into the list"
    ],
    "What are Python exceptions?": [
        "runtime errors like NameError, TypeError, ValueError", "IndexError for invalid list index",
        "KeyError for invalid dictionary key", "handled with try-except to prevent crashes"
    ],
    "How do you handle exceptions in Python?": [
        "try-except-else-finally structure", "catch specific exception types for targeted handling",
        "else block runs only if no exception", "finally always runs (cleanup like closing files)"
    ],
    "What is the difference between remove(), pop(), and del?": [
        "remove(value): removes first occurrence by value", "pop(index): removes by index and returns item",
        "del list[index]: removes by index, no return", "pop() without index removes last element"
    ],
    "What is a class in Python?": [
        "blueprint defined with class keyword", "__init__ constructor initializes state",
        "attributes (data) and methods (behavior)", "creating multiple independent object instances"
    ],
    "What is the __init__ method?": [
        "constructor called automatically on object creation", "initializes instance attributes with self.name = value",
        "self refers to the newly created instance", "can accept parameters for customized initialization"
    ],
    "What is 'self' in Python?": [
        "represents the current class instance", "first parameter in all instance methods",
        "access instance variables and methods via self", "convention name (not a keyword)"
    ],
    "What is inheritance in Python?": [
        "class Child(Parent) syntax for inheriting", "child gets all parent attributes and methods",
        "super() to call parent methods explicitly", "Python supports multiple inheritance"
    ],
    "What are Python decorators?": [
        "functions that modify other functions without changing code", "@decorator syntax above function definition",
        "common examples: @staticmethod, @property, @classmethod", "wrapping mechanism using closures"
    ],
    "What is the difference between a method and a function?": [
        "function is independent (defined outside classes)", "method belongs to a class (defined inside)",
        "methods have self as first parameter", "all methods are functions but not vice versa"
    ],
    "What are *args and **kwargs?": [
        "*args collects extra positional arguments as tuple", "**kwargs collects keyword arguments as dictionary",
        "enables flexible function signatures", "unpacking with func(*list, **dict) for passing back"
    ],
    "What is the difference between local and global variables?": [
        "local: defined inside function, only accessible there", "global: defined outside, accessible everywhere",
        "global keyword needed to modify global from inside function", "prefer parameters and return values over globals"
    ],
    "What are Python file operations?": [
        "open(filename, mode) with modes: r/w/a/r+", "read(), readline(), readlines() for reading",
        "write() for writing content", "with statement for automatic closing"
    ],
    "What is the 'with' statement?": [
        "context manager ensuring proper resource cleanup", "automatic close even when errors occur",
        "implements __enter__ and __exit__ protocol", "prevents resource leaks from forgotten close()"
    ],
    "What is the difference between shallow and deep copy?": [
        "shallow copy: new object, same nested references", "deep copy: fully independent recursive copy",
        "copy.copy() vs copy.deepcopy()", "deep copy needed when modifying nested structures"
    ],
    "What are Python's built-in functions?": [
        "print/len/type/range/int/str core utilities", "sum/max/min for numeric operations",
        "sorted/enumerate/zip for iteration helpers", "always available without any imports"
    ],
    "What is the enumerate() function?": [
        "adds counter to iterable: (index, value) pairs", "replaces range(len()) anti-pattern",
        "start parameter for custom starting index", "cleaner loop syntax for indexed iteration"
    ],
    "What is the zip() function?": [
        "combines multiple iterables into tuples", "stops at the shortest iterable",
        "unzip with zip(*zipped_data)", "parallel iteration over multiple lists"
    ],
    "What is the map() function?": [
        "applies function to every item in iterable", "returns an iterator (not a list directly)",
        "with lambda for inline transformations", "list comprehension as readable alternative"
    ],
    "What is the filter() function?": [
        "filters items by True/False predicate function", "returns iterator of matching items",
        "with lambda for inline conditions", "list comprehension alternative: [x for x if condition]"
    ],
    "What are Python comments?": [
        "# for single-line comments", "triple quotes for multi-line/docstrings",
        "comments should explain WHY not WHAT", "keep comments updated when code changes"
    ],
    "What is None in Python?": [
        "Python's null value (singleton NoneType)", "check with 'is' not == (is None)",
        "functions without return statement return None", "falsy in boolean context"
    ],
    "What are Python's boolean values?": [
        "True and False (capitalized)", "falsy values: False, None, 0, empty collections",
        "truthy: everything else is True", "logical operators: and, or, not"
    ],
    "What is the pass statement?": [
        "null statement that does nothing", "placeholder preventing syntax errors",
        "used in empty functions/classes/loops", "development placeholder during code scaffolding"
    ],
    "What is string slicing?": [
        "string[start:stop:step] extraction syntax", "negative indices count from end",
        "[::-1] reverses the entire string", "slicing creates new string (original unchanged)"
    ],
};

/**
 * Look up key concepts for a question.
 * Returns list of concept phrases or empty array.
 */
export const getQuestionConcepts = (questionText) => {
    if (!questionText) return [];

    // Try exact match first
    const concepts = QUESTION_CONCEPTS[questionText];
    if (concepts) return concepts;

    // Try case-insensitive match
    const qLower = questionText.toLowerCase().trim();
    for (const [key, val] of Object.entries(QUESTION_CONCEPTS)) {
        if (key.toLowerCase().trim() === qLower) return val;
    }

    // Try prefix match (first 40 chars)
    const qPrefix = qLower.slice(0, 40);
    for (const [key, val] of Object.entries(QUESTION_CONCEPTS)) {
        if (key.toLowerCase().slice(0, 40) === qPrefix) return val;
    }

    return [];
};

export default QUESTION_CONCEPTS;
