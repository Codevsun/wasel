/**
 * Full reading articles for internship plan tasks.
 * Displayed as plain text with whitespace-pre-wrap in the app.
 */

export const ARTICLES = {
  howTheWebWorks: `HOW THE WEB WORKS
=================

When you type a URL into your browser and press Enter, a remarkable chain of events unfolds in milliseconds. Understanding this flow is the foundation of every frontend developer's mental model.

THE REQUEST JOURNEY
-------------------

1. DNS lookup
   Your browser asks: "What IP address hosts example.com?" DNS (Domain Name System) acts like a phone book for the internet, translating human-readable domain names into numeric addresses like 93.184.216.34.

2. TCP connection
   The browser opens a reliable connection to the server at that IP address, typically on port 443 for HTTPS.

3. TLS handshake (HTTPS)
   Before any data is sent, your browser and the server agree on encryption keys. This protects passwords, cookies, and personal data from eavesdropping.

4. HTTP request
   The browser sends an HTTP request. A GET request asks for a resource. A POST request sends data (like a login form). Every request includes headers: User-Agent (browser info), Accept (content types wanted), Cookie (session data), and more.

5. Server processing
   The server (often nginx or similar) routes the request to an application. That app may query a database, call other services, or read static files from disk.

6. HTTP response
   The server replies with a status code, headers, and a body. Common codes:
   • 200 OK — success
   • 301/302 — redirect elsewhere
   • 404 Not Found — resource doesn't exist
   • 500 Internal Server Error — something broke server-side

7. Browser rendering
   For HTML responses, the browser parses the document, discovers linked CSS and JavaScript, fetches those too, builds the DOM tree, applies styles, runs scripts, and paints pixels on screen.

THE THREE LAYERS OF A WEB PAGE
-------------------------------

HTML — Structure
  Defines what things are: headings, paragraphs, forms, images. HTML gives meaning (semantics) to content. A <nav> tells assistive technology "this is navigation." A <button> is interactive by default.

CSS — Presentation
  Controls how things look: colors, spacing, layout, animations. CSS separates appearance from structure so you can redesign without rewriting HTML.

JavaScript — Behavior
  Adds interactivity: form validation, fetching data without reload, animations, single-page app routing. JS runs in a sandboxed environment inside the browser for security.

USING DEVTOOLS
--------------

Open Chrome or Firefox DevTools (F12 or right-click → Inspect):

Network tab — Watch every request as the page loads. Filter by XHR/Fetch to see API calls. Check status codes, response times, and response bodies. Disable cache to simulate first visit.

Elements tab — Inspect the live DOM. See which CSS rules apply. Edit styles live to experiment.

Console tab — Run JavaScript, see errors and log output.

KEY TAKEAWAYS
-------------

• The web is request/response at its core, even when apps feel instant.
• Status codes tell you what happened; learn to read them.
• HTML, CSS, and JS have distinct jobs — keep them separated in your thinking.
• DevTools Network tab is your best friend when debugging "why isn't data showing?"`,

  accessibleForms: `ACCESSIBLE FORMS: A PRACTICAL GUIDE
===================================

Forms are where users give you their data — names, emails, passwords, preferences. If a form is hard to use with a keyboard or screen reader, you lose users and may violate accessibility law. Good form design helps everyone.

LABELS ARE NON-NEGOTIABLE
-------------------------

Every input needs a visible, programmatically associated label.

The correct pattern:
  <label for="email">Email address</label>
  <input id="email" type="email" name="email" />

The for attribute on <label> must match the input's id. When a user clicks the label text, focus moves to the input — larger click target, better usability.

Never rely on placeholder text alone as a label. Placeholders disappear when typing and have poor contrast. Screen readers may not treat them as labels.

GROUPING RELATED FIELDS
-----------------------

Use <fieldset> and <legend> for related groups:

  <fieldset>
    <legend>Shipping address</legend>
    <!-- address fields -->
  </fieldset>

This announces the group context to screen reader users before each field inside.

REQUIRED FIELDS
---------------

HTML5 required attribute triggers browser validation. For accessibility, also indicate visually (e.g. asterisk with legend "Fields marked * are required").

aria-required="true" mirrors required for custom widgets but prefer native required on standard inputs.

ERROR MESSAGES
--------------

• Tie errors to fields with aria-describedby pointing to the error element's id.
• Don't clear the user's input when validation fails.
• Show errors after submit or on blur — not before the user has typed.
• Use clear language: "Enter a valid email" not "Invalid input."

KEYBOARD NAVIGATION
-------------------

Tab order should follow visual order. Users must reach every field and the submit button with Tab alone.

• Don't use positive tabindex values — they break natural order.
• Custom dropdowns and date pickers must support arrow keys and Enter.
• Focus styles must be visible — never remove outline without a replacement.

INPUT TYPES MATTER
------------------

Use the right type for better mobile keyboards and built-in validation:
  type="email"    — email keyboard, basic format check
  type="tel"      — phone keypad
  type="number"   — numeric input with constraints
  type="password" — masked characters

AUTOCOMPLETE
------------

Add autocomplete attributes so browsers can fill known data:
  autocomplete="email"
  autocomplete="current-password"
  autocomplete="name"

This reduces friction and errors for all users.

CHECKLIST BEFORE YOU SHIP
-------------------------

☐ Every input has a <label for="...">
☐ Groups use fieldset/legend where appropriate
☐ Tab through the entire form without a mouse
☐ Errors are readable and linked to fields
☐ Required fields are marked clearly
☐ Focus ring is visible on every interactive element`,

  cssFundamentals: `CSS FUNDAMENTALS FOR FRONTEND DEVELOPERS
==========================================

CSS (Cascading Style Sheets) controls presentation. Mastering a few core concepts prevents hours of "why won't this align?" debugging.

THE CASCADE
-----------

When two rules target the same element, the browser picks a winner using:
1. Importance (!important — avoid unless you must)
2. Specificity (how precisely the selector targets the element)
3. Source order (later rules win if specificity is equal)

SPECIFICITY SCORES (simplified)
  Inline style          — 1000
  #id                   — 100
  .class, [attr], :pseudo — 10
  element, ::pseudo-element — 1

Example: #header .nav a (1 + 10 + 1 = 12) beats .nav a (11).

Prefer classes over IDs for styling — IDs are hard to override and tie you to one element.

INHERITANCE
-----------

Some properties inherit from parent to child: color, font-family, line-height.
Others don't: margin, padding, background, border.

Use inherit keyword when a child should match parent:
  color: inherit;

THE BOX MODEL
-------------

Every element is a rectangular box with four layers (inside → out):
  Content  — text, images
  Padding  — space inside the border
  Border   — visible edge
  Margin   — space outside, between elements

box-sizing: border-box makes width/height include padding and border — use this globally:

  *, *::before, *::after { box-sizing: border-box; }

DISPLAY TYPES
-------------

block — Takes full width, stacks vertically (div, p, h1)
inline — Flows with text, ignores width/height (span, a)
inline-block — Inline flow but respects width/height
flex — One-dimensional layout (row OR column)
grid — Two-dimensional layout (rows AND columns)
none — Removed from layout entirely

UNITS THAT SCALE
----------------

px   — Fixed pixels; fine for borders, avoid for typography
rem  — Relative to root font-size (usually 16px). 1.5rem = 24px if root is 16px.
em   — Relative to parent font-size — compounds nested, use carefully
%    — Percentage of parent (width, height context matters)
vw/vh — Viewport width/height percentage

Prefer rem for font-size and spacing — respects user browser settings.

FLEXBOX QUICK START
-------------------

  .container {
    display: flex;
    gap: 1rem;
    align-items: center;    /* cross-axis alignment */
    justify-content: space-between; /* main-axis distribution */
  }

Default flex-direction is row. Use flex-direction: column for vertical stacks.

flex: 1 on a child makes it grow to fill available space.

COMMON PITFALLS
---------------

• Margin collapse — adjacent vertical margins combine into one
• Percentage height needs defined parent height
• Specificity wars — add classes instead of !important
• Forgetting box-sizing: border-box on layout components

PRACTICE MINDSET
----------------

Read styles in DevTools Computed panel. When something looks wrong, check: display, box model values, and which rule won the cascade.`,

  mobileFirstCss: `MOBILE-FIRST RESPONSIVE DESIGN
==============================

More than half of web traffic comes from phones. Mobile-first CSS means you design for small screens first, then add rules for larger viewports — not the other way around.

WHY MOBILE-FIRST?
-----------------

• Forces prioritization — only essential content on small screens
• Performance — base CSS is lean; desktop gets enhancements
• Progressive enhancement — works everywhere, better on big screens

THE CORE TECHNIQUE: MIN-WIDTH MEDIA QUERIES
-------------------------------------------

Write base styles for mobile (no media query). Add breakpoints as min-width:

  /* Base: mobile */
  .sidebar { display: none; }
  .main { width: 100%; }

  /* Tablet and up */
  @media (min-width: 768px) {
    .sidebar { display: block; width: 240px; }
    .main { width: calc(100% - 240px); }
  }

  /* Desktop */
  @media (min-width: 1024px) {
    .container { max-width: 1200px; margin: 0 auto; }
  }

Common breakpoints (guidelines, not rules):
  640px  — large phones / small tablets
  768px  — tablets
  1024px — laptops
  1280px — desktops

FLUID TYPOGRAPHY
----------------

Avoid fixed font sizes that feel tiny on mobile or huge on desktop:

  html { font-size: 100%; } /* respects user preference */

  h1 {
    font-size: clamp(1.75rem, 4vw + 1rem, 3rem);
  }

clamp(min, preferred, max) scales smoothly between breakpoints.

FLEXIBLE LAYOUTS
----------------

• Use flex-wrap so items wrap instead of overflow
• Use minmax() in grid: grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
• Avoid fixed widths in pixels for containers — use %, fr, or max-width

IMAGES AND MEDIA
----------------

  img { max-width: 100%; height: auto; }

Use srcset and sizes for responsive images serving appropriate file sizes.

TOUCH TARGETS
-------------

Buttons and links need at least 44×44px touch area on mobile. Add padding if the visual is smaller.

CONTAINER QUERIES (MODERN)
--------------------------

Style a component based on its container width, not the viewport:

  .card-container { container-type: inline-size; }

  @container (min-width: 400px) {
    .card { flex-direction: row; }
  }

Useful when a sidebar makes the main column narrow even on a wide monitor.

TESTING CHECKLIST
-----------------

☐ Test at 375px width (iPhone SE class)
☐ No horizontal scroll on any page
☐ Text readable without zooming
☐ Interactive elements reachable with thumb
☐ DevTools device toolbar + real device if possible`,

  modernJavaScript: `MODERN JAVASCRIPT SYNTAX ESSENTIALS
===================================

JavaScript powers interactivity on the web. ES6+ (2015 and later) added syntax that makes code shorter, safer, and easier to read. This is the dialect you'll use daily.

LET AND CONST
-------------

var is function-scoped and hoisted — avoid it.

let — block-scoped, can be reassigned
const — block-scoped, cannot be reassigned

  const API_URL = "https://api.example.com";
  let count = 0;
  count += 1; // OK

const prevents rebinding, not mutation:
  const user = { name: "Sara" };
  user.name = "Ali"; // OK — object contents can change

ARROW FUNCTIONS
---------------

  // Traditional
  function double(n) { return n * 2; }

  // Arrow
  const double = (n) => n * 2;

Shorter syntax. No own 'this' binding — important in React class components (less relevant with hooks).

DESTRUCTURING
-------------

Pull values from objects and arrays:

  const { name, email } = user;
  const [first, second] = items;

Function parameters:
  function greet({ name }) {
    return \`Hello, \${name}\`;
  }

SPREAD AND REST
---------------

Spread expands iterables:
  const merged = [...arr1, ...arr2];
  const updated = { ...user, role: "admin" };

Rest collects remaining items:
  const [head, ...tail] = numbers;

TEMPLATE LITERALS
-----------------

  const msg = \`Welcome, \${name}! You have \${count} tasks.\`;

Multi-line strings without concatenation.

ARRAY METHODS YOU MUST KNOW
---------------------------

map — transform each item, returns new array
  const names = users.map(u => u.name);

filter — keep items that pass a test
  const active = users.filter(u => u.status === "active");

find — first matching item (or undefined)
  const admin = users.find(u => u.role === "admin");

some / every — boolean checks
  const hasAdmin = users.some(u => u.role === "admin");

forEach — side effects only (no return value) — use map when you need a new array

OPTIONAL CHAINING & NULLISH COALESCE
------------------------------------

  const city = user?.address?.city;
  const label = input ?? "default";

?. stops if left side is null/undefined.
?? uses right side only when left is null or undefined (not for 0 or "").

MODULES
-------

  // export from utils.js
  export function formatDate(d) { ... }

  // import elsewhere
  import { formatDate } from "./utils.js";

Keep files focused. One component or utility per module when possible.`,

  promisesAsyncAwait: `PROMISES AND ASYNC/AWAIT
========================

JavaScript runs on a single thread. When you fetch data from a server, read a file, or wait on a timer, you can't block the UI. Asynchronous patterns let work happen in the background and resume when ready.

THE PROBLEM WITH CALLBACKS
--------------------------

Nested callbacks create "callback hell":

  getUser(id, (user) => {
    getOrders(user.id, (orders) => {
      getItems(orders[0].id, (items) => { ... });
    });
  });

Hard to read, hard to error-handle. Promises and async/await fix this.

PROMISES
--------

A Promise represents a value that will exist later. Three states:
  pending   — in progress
  fulfilled — success, has a value
  rejected  — failed, has a reason (error)

  fetch("https://api.example.com/users")
    .then(response => response.json())
    .then(data => console.log(data))
    .catch(error => console.error("Failed:", error));

fetch returns a Promise. .then chains handle success steps. .catch handles any rejection in the chain.

ASYNC / AWAIT
-------------

Syntactic sugar over promises — reads like synchronous code:

  async function loadUsers() {
    try {
      const response = await fetch("https://api.example.com/users");
      if (!response.ok) {
        throw new Error(\`HTTP \${response.status}\`);
      }
      const users = await response.json();
      return users;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

async marks a function as returning a Promise.
await pauses until the Promise settles.
try/catch handles rejections and thrown errors.

ALWAYS CHECK response.ok
--------------------------

fetch does NOT reject on 404 or 500 — only on network failure. Check status:

  if (!response.ok) throw new Error(response.statusText);

FETCHING JSON — FULL PATTERN
----------------------------

  async function getData() {
    const res = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) throw new Error(\`Error: \${res.status}\`);
    return res.json();
  }

POST with JSON body:

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Sara" }),
  });

PARALLEL REQUESTS
-----------------

Sequential (slow):
  const a = await fetchA();
  const b = await fetchB();

Parallel (faster):
  const [a, b] = await Promise.all([fetchA(), fetchB()]);

UI PATTERNS
-----------

While waiting for data, show loading state. On error, show message and retry option. Never leave the user staring at a blank screen.

  setLoading(true);
  try {
    const data = await fetchData();
    setItems(data);
  } catch (e) {
    setError(e.message);
  } finally {
    setLoading(false);
  }

This try/catch/finally pattern appears in every real app's data layer.`,

  reactComponentsPropsState: `REACT: COMPONENTS, PROPS, AND STATE
====================================

React builds UIs from composable pieces. Instead of manipulating the DOM directly, you describe what the UI should look like for a given state — React updates the DOM when state changes.

WHAT IS A COMPONENT?
--------------------

A component is a function that returns JSX (HTML-like syntax in JavaScript):

  function Welcome({ name }) {
    return <h1>Hello, {name}</h1>;
  }

Use components like HTML tags: <Welcome name="Sara" />

JSX RULES
---------

• One root element per return (or use Fragment: <>...</>)
• className instead of class
• camelCase for attributes: onClick, htmlFor, tabIndex
• JavaScript expressions in { curly braces }
• Close all tags: <img />, <br />

PROPS — DATA FROM PARENT
------------------------

Props are read-only inputs. Parent passes data down:

  function Avatar({ src, alt, size = 48 }) {
    return <img src={src} alt={alt} width={size} height={size} />;
  }

  <Avatar src="/photo.jpg" alt="Sara" size={64} />

Never modify props inside the child. If you need to change data, the parent owns it.

STATE — DATA THAT CHANGES
-------------------------

useState adds local memory to a component:

  import { useState } from "react";

  function Counter() {
    const [count, setCount] = useState(0);

    return (
      <div>
        <p>Count: {count}</p>
        <button onClick={() => setCount(count + 1)}>+1</button>
      </div>
    );
  }

• count is the current value
• setCount updates it and triggers a re-render
• Never mutate state directly: count++ is wrong; setCount(count + 1) is right

ONE-WAY DATA FLOW
-----------------

Data flows parent → child via props.
Events flow child → parent via callback props:

  function Parent() {
    const [text, setText] = useState("");
    return <Child value={text} onChange={setText} />;
  }

  function Child({ value, onChange }) {
    return <input value={value} onChange={e => onChange(e.target.value)} />;
  }

Predictable data flow makes bugs easier to find.

WHEN TO SPLIT COMPONENTS
------------------------

Extract a component when:
• A section has its own logic or state
• The same UI pattern repeats
• A file exceeds ~200 lines and hurts readability

CONDITIONAL RENDERING
---------------------

  {isLoggedIn ? <Dashboard /> : <Login />}
  {error && <p className="error">{error}</p>}
  {items.length === 0 ? <Empty /> : <List items={items} />}

LISTS AND KEYS
--------------

  {users.map(user => (
    <li key={user.id}>{user.name}</li>
  ))}

key must be stable and unique among siblings — use database id, not array index (unless list is static).

NEXT STEPS
----------

Once props and state click, learn useEffect for side effects and lifting state when siblings need to share data.`,

  reactUseEffectForms: `USEEFFECT AND FORMS IN REACT
=============================

After mastering props and state, two patterns dominate real React apps: side effects (data fetching, subscriptions) and forms (controlled inputs).

CONTROLLED INPUTS
-----------------

React controls the input value via state:

  function SignupForm() {
    const [email, setEmail] = useState("");

    return (
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
    );
  }

The input always reflects email state. Single source of truth — easy to validate, reset, or submit.

For many fields, one state object works:

  const [form, setForm] = useState({ name: "", email: "", password: "" });

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  <input value={form.name} onChange={e => update("name", e.target.value)} />

HANDLE SUBMIT
-------------

  function handleSubmit(e) {
    e.preventDefault(); // don't reload the page
    // send form to API
  }

  <form onSubmit={handleSubmit}>...</form>

LIFTING STATE UP
----------------

When two siblings need the same data, move state to their common parent:

  function App() {
    const [query, setQuery] = useState("");
    return (
      <>
        <SearchBox value={query} onChange={setQuery} />
        <ResultsList filter={query} />
      </>
    );
  }

Parent owns query. SearchBox writes it. ResultsList reads it.

USEEFFECT — SIDE EFFECTS
------------------------

useEffect runs code after render when dependencies change:

  import { useEffect, useState } from "react";

  function UserList() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let cancelled = false;

      async function load() {
        setLoading(true);
        try {
          const res = await fetch("/api/users");
          const data = await res.json();
          if (!cancelled) setUsers(data);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      load();
      return () => { cancelled = true; }; // cleanup on unmount
    }, []); // empty array = run once on mount

    if (loading) return <p>Loading...</p>;
    return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
  }

DEPENDENCY ARRAY
----------------

[]           — run once on mount
[userId]     — run when userId changes
no array     — run after every render (rarely what you want)

COMMON MISTAKES
---------------

• Forgetting e.preventDefault() on forms
• Uncontrolled + controlled mix (switching value from undefined to string)
• Missing keys in lists
• useEffect without cleanup for subscriptions (memory leaks)
• Infinite loops: useEffect that setStates without proper dependencies

FORMS AT SCALE
--------------

For large forms, consider libraries (React Hook Form, Formik) later. Master controlled inputs first — the concepts transfer directly.`,

  whyGitMatters: `WHY GIT MATTERS
==============

Before Git, developers emailed zip files or overwrote shared folders. Teams lost work, couldn't trace who changed what, and feared experimenting. Version control — especially Git — solved this.

WHAT IS VERSION CONTROL?
------------------------

Version control records snapshots of your project over time. Each snapshot (commit) has:
• A unique ID (hash)
• Author and timestamp
• A message describing the change
• A pointer to the previous snapshot

You can travel back in time, compare versions, and branch to try ideas safely.

GIT IS DISTRIBUTED
------------------

Every developer has a full copy of the repository history on their machine. You commit locally, then sync with a remote (like GitHub) via push and pull. You can work offline. If the server dies, everyone's clone is a backup.

THE THREE AREAS
---------------

Working directory — files you edit right now
Staging area (index) — changes selected for the next commit
Repository — committed history

  edit file → git add → git commit

git status shows where files sit in this pipeline.

COMMITS ARE SNAPSHOTS, NOT DIFFS
--------------------------------

A commit captures the entire project state (with efficient storage). Think photograph, not incremental save. Good commit messages explain why:

  Bad:  "fix stuff"
  Good: "Fix login redirect when session expires"

BRANCHES — PARALLEL UNIVERSES
-----------------------------

main (or master) is the primary line. A branch is a movable pointer to a commit:

  git branch feature/login
  git switch feature/login

Work on the feature without touching main. Merge when ready.

WHY TEAMS REQUIRE GIT
---------------------

• Accountability — who changed what, when
• Collaboration — many people, one codebase
• Safety — revert bad deploys, recover deleted code
• Code review — inspect changes before merge
• CI/CD — automated tests on every push

GIT vs GITHUB
-------------

Git is the tool on your computer. GitHub (or GitLab, Bitbucket) hosts remotes, pull requests, issues, and permissions. You need Git locally; the host is where the team coordinates.

FIRST WEEK HABITS
-----------------

• Commit small, logical chunks — not one giant Friday commit
• Pull before you start work each day
• Read git status constantly
• Never force-push to shared branches until you understand the consequences`,

  branchesAndMerges: `BRANCHES AND MERGES
===================

Branches let you isolate work. Merging combines branches back together. This is the daily rhythm of professional development.

CREATING AND SWITCHING BRANCHES
-------------------------------

  git branch              # list branches
  git branch feature/nav  # create branch
  git switch feature/nav  # move to it (Git 2.23+)
  # or: git checkout feature/nav

  git switch -c feature/nav   # create and switch in one step

Commits on a branch advance only that branch pointer. main stays put until you merge.

THE FEATURE BRANCH WORKFLOW
---------------------------

1. Start from updated main: git switch main && git pull
2. Create branch: git switch -c feature/user-profile
3. Make commits on the branch
4. Push branch: git push -u origin feature/user-profile
5. Open pull request for review
6. Merge to main after approval
7. Delete branch when done

MERGING
-------

  git switch main
  git merge feature/user-profile

Fast-forward merge
  When main hasn't moved since you branched, Git just moves the main pointer forward. History stays linear.

Merge commit
  When both branches have new commits, Git creates a merge commit with two parents joining the lines.

  git log --oneline --graph shows the shape.

MERGE CONFLICTS
---------------

Conflict happens when the same lines changed differently on both branches. Git marks files:

  <<<<<<< HEAD
  Your version on main
  =======
  Their version on branch
  >>>>>>> feature/nav

Steps to resolve:
1. Open the file, choose correct code (or combine both)
2. Remove conflict markers
3. git add the file
4. git commit (or complete merge)

Prevention: pull main often, keep branches short-lived, communicate on shared files.

REBASE (AWARENESS)
------------------

git rebase replays your commits on top of updated main — linear history. Never rebase commits already pushed to a shared branch unless the team agrees. For interns: merge is safer.

USEFUL COMMANDS
---------------

  git log --oneline --graph --all -20
  git diff main...feature/nav    # what's different on the branch
  git branch -d feature/nav      # delete merged branch locally

DISCIPLINE WINS
---------------

Small branches (hours to days, not weeks) merge cleanly. One feature per branch. Descriptive names: fix/checkout-bug, feature/dark-mode.`,

  githubFlow: `GITHUB FLOW FOR TEAM PROJECTS
=============================

GitHub adds collaboration layers on top of Git: hosting, pull requests, code review, issues, and permissions. Understanding the flow prevents "I pushed but nothing happened" confusion.

CLONE AND REMOTE
----------------

  git clone https://github.com/org/project.git

Creates a local repo with remote named origin pointing to GitHub.

  git remote -v    # verify URLs

PUSH AND PULL
-------------

  git push origin main        # send your commits to GitHub
  git pull origin main        # fetch + merge remote changes

Pull before starting work. Push when your branch is ready for others to see.

PULL REQUESTS (PRs)
-------------------

A PR says: "Please merge my branch into main." It shows:
• Every commit on the branch
• File-by-file diff
• Discussion thread
• CI check results (tests passing?)

Typical flow:
1. Push your feature branch
2. GitHub offers "Compare & pull request"
3. Write description: what, why, how to test
4. Request reviewers
5. Address feedback with new commits on same branch
6. Squash or merge when approved

CODE REVIEW ETIQUETTE
---------------------

As author:
• Keep PRs small and focused
• Explain non-obvious decisions
• Respond to comments professionally
• Don't take feedback personally

As reviewer:
• Be specific: "This could throw if user is null" beats "this is wrong"
• Distinguish blocker vs nitpick
• Approve when good enough — perfection blocks shipping

ISSUES
------

Link PRs to issues with "Fixes #42" in the description — GitHub auto-closes the issue on merge.

FORKING (OPEN SOURCE)
---------------------

Fork copies a repo to your account. Push to your fork, PR back to upstream. Common for contributing to libraries.

BRANCH PROTECTION
-----------------

Teams often block direct pushes to main. You must use PRs + passing tests. This is why your push might be rejected — it's intentional.

SECURITY REMINDER
-----------------

Never commit passwords, API keys, or .env files. Git history remembers forever. Use .gitignore and environment variables.`,

  gitignoreConventionalCommits: `.GITIGNORE, CONVENTIONAL COMMITS & STASH
==========================================

Professional repos stay clean, readable, and safe. Three practices help: ignoring junk files, writing consistent commit messages, and parking work-in-progress safely.

.GITIGNORE
----------

Tells Git which files to never track. Create .gitignore in repo root:

  node_modules/
  dist/
  .env
  .env.local
  *.log
  .DS_Store
  coverage/

Patterns:
  *        matches anything in one path segment
  **       matches across directories
  !file    negate — track this exception

If you accidentally committed a secret:
1. Rotate/revoke the secret immediately
2. Remove from history (git filter-repo or BFG) — ask a senior
3. Never just delete and commit — history still has it

CONVENTIONAL COMMITS
--------------------

Standardized prefix format:

  feat: add user profile page
  fix: prevent double submit on login
  docs: update README setup steps
  chore: upgrade vite to 6
  refactor: extract useAuth hook
  test: add unit tests for formatDate

Benefits: readable history, automated changelogs, semantic versioning tools.

Format: type(scope): description

  feat(auth): support password reset email

Keep subject under 72 characters. Body optional for detail.

GIT STASH
---------

Park uncommitted changes without committing:

  git stash              # save and clean working tree
  git stash list
  git stash pop          # restore most recent
  git stash push -m "wip nav redesign"

Use when you must switch branches but aren't ready to commit. Don't stash for days — stashes are easy to forget.

COMMIT HYGIENE
--------------

• One logical change per commit
• Don't commit commented-out code "for later"
• Run linter/tests before push
• Review your own diff before opening PR: git diff main

TEAM .GITIGNORE
---------------

Start from github.com/github/gitignore templates for your stack (Node, Python, etc.) and customize. Commit .gitignore early — first commit if possible.`,

  mlVsAiVsLlms: `AI, MACHINE LEARNING, AND LARGE LANGUAGE MODELS
================================================

These terms overlap in marketing but mean different things technically. Clear vocabulary helps you choose the right tool and set realistic expectations.

ARTIFICIAL INTELLIGENCE (AI)
----------------------------

The broad goal: machines performing tasks that typically require human intelligence — perception, reasoning, language, planning.

AI is a field, not a single product. A chess engine, a spam filter, and ChatGPT are all "AI" in different ways.

MACHINE LEARNING (ML)
---------------------

A subset of AI: systems that learn patterns from data instead of following only hand-written rules.

Traditional programming:  rules + data → answers
Machine learning:        data + answers → rules (model)

Example: instead of writing "if email contains 'winner', it's spam," you train on thousands of labeled emails and the model learns patterns.

DEEP LEARNING
-------------

ML using neural networks with many layers. Powers image recognition, speech, translation, and large language models. Requires lots of data and compute but handles messy real-world inputs well.

LARGE LANGUAGE MODELS (LLMs)
----------------------------

Models trained on vast text to predict the next token. GPT, Claude, Llama, and similar are LLMs. They generate fluent text, code, and summaries — but they don't "know" facts like a database; they approximate patterns from training data.

Key behaviors:
• Strong at language, code structure, explanation
• Weak at guaranteed truth, math without tools, real-time events
• Can hallucinate — confident-sounding false statements

TRAINING VS INFERENCE
---------------------

Training — adjusting billions of weights using GPUs over weeks/months. Done by labs (OpenAI, Anthropic, etc.).

Inference — using the trained model to generate output for your prompt. What you do via API or chat UI. You pay per token or subscription.

SUPERVISED LEARNING
-------------------

Learn from labeled examples: emails labeled spam/not spam, images labeled cat/dog. Most practical business ML is supervised or fine-tuned from it.

RESPONSIBLE USE
---------------

• Verify important claims — especially medical, legal, financial
• Disclose AI assistance when required
• Watch for bias and privacy issues in training data
• Don't paste confidential data into public tools without policy approval

MENTAL MODEL
------------

AI = the ambition
ML = learning from data
Deep learning = neural networks at scale
LLMs = language-specialized models you prompt daily as a developer

Use LLMs as accelerators, not oracles.`,

  datasetsAndBias: `DATASETS, BIAS, AND MODEL EVALUATION
======================================

Machine learning quality depends more on data than on algorithm choice. Bad data produces bad models — sometimes harmfully so.

TRAIN / VALIDATION / TEST SPLITS
--------------------------------

Never evaluate on the same data you trained on — the model memorized those answers.

Typical split:
  Training   70–80%  — model learns here
  Validation 10–15%  — tune hyperparameters, pick best version
  Test       10–15%  — final unbiased score (touch once)

Random split works for simple cases. Use stratified split when classes are imbalanced (rare fraud cases).

OVERFITTING
-----------

Model memorizes training noise instead of general patterns. Signs:
• Near-perfect training accuracy, poor test accuracy
• Fails on slightly different real-world inputs

Fixes: more data, simpler model, regularization, early stopping, data augmentation.

UNDERFITTING
------------

Model too simple to capture the pattern. Both train and test performance are low. Try more features or a more capable model.

BIAS IN DATA
------------

Data reflects the world — including historical injustice and skewed sampling.

Examples:
• Hiring model trained on past promotions discriminates against groups previously excluded
• Face recognition trained mostly on light skin tones fails on darker skin
• Medical data from one country doesn't generalize globally

Bias isn't only "unfair labels" — it's also missing representation.

FAIRNESS IS CONTEXTUAL
----------------------

Fairness metrics can conflict. Fixing one dimension may hurt another. Stakeholders must define what "fair" means for their use case.

EVALUATION BEYOND ACCURACY
--------------------------

Accuracy misleads on imbalanced data. If 99% of transactions are legit, a model that always says "legit" is 99% accurate but useless.

Better metrics:
  Precision — of predicted positives, how many correct?
  Recall    — of actual positives, how many caught?
  F1 score  — balance of precision and recall
  Confusion matrix — see false positives vs false negatives

For ranking: AUC, NDCG. For generation: human eval, rubrics, benchmark suites.

DATA QUALITY CHECKLIST
----------------------

☐ Representative of production users
☐ Labels audited for errors
☐ Documented collection method and consent
☐ Versioned datasets (DVC, snapshots)
☐ Privacy: PII removed or protected

WHY THIS MATTERS FOR DEVELOPERS
------------------------------

Even if you don't train models, you integrate them. Ask vendors: what data, what metrics, what failure modes, what monitoring. You're responsible for how the product behaves in production.`,

  promptEngineeringBasics: `PROMPT ENGINEERING BASICS
=========================

Prompt engineering is the practice of writing instructions that reliably steer LLM output. It's not magic — it's clear communication with constraints.

THE PARTS OF A PROMPT
---------------------

System message — sets role and global rules (in APIs):
  "You are a senior TypeScript reviewer. Be concise. Flag security issues."

User message — the actual task:
  "Review this function for bugs: ..."

Context — background the model needs:
  "We use React 19 and Supabase. Follow our error handling pattern: ..."

Techniques work in chat UIs too — you just combine them in one message.

ROLE PROMPTING
--------------

  "You are an experienced technical writing coach helping junior developers."

Roles prime tone, depth, and vocabulary. Don't overdo fantasy roles — be specific about expertise.

FEW-SHOT EXAMPLES
-----------------

Show input → output pairs before the real task:

  Input: "fix teh login bug"
  Output: "Fix the login bug"

  Input: "add dark mode"
  Output: "Add dark mode support"

  Now fix: "implement user avatars"

The model pattern-matches your examples. Quality of examples matters enormously.

CHAIN-OF-THOUGHT
----------------

Ask the model to reason step by step before the final answer:

  "Solve this step by step, then give the final answer:"

Improves multi-step logic, math, and debugging. You can hide reasoning from users and show only the conclusion.

OUTPUT FORMAT CONSTRAINTS
---------------------------

  "Respond with valid JSON only, no markdown:
   { \"title\": string, \"tasks\": string[] }"

  "Use exactly three bullet points."

  "Maximum 150 words."

Structured output reduces parsing headaches in apps. Validate JSON after receiving it — models still slip up.

DECOMPOSITION
-------------

Big task → chain of smaller prompts:

1. "List the files I need to change for feature X"
2. "Write the database migration for step 1"
3. "Write the React component for step 2"

Better than one vague "build feature X."

ITERATION LOOP
--------------

1. Write baseline prompt
2. Run on 3–5 real examples
3. Note failures (wrong format, hallucinated API, too verbose)
4. Add constraints or examples targeting failures
5. Repeat

WHAT DOESN'T WORK
-----------------

• Vague "make it better"
• Assuming the model knows your private codebase without context
• Trusting outputs without verification
• Extremely long prompts with contradictory instructions

PROMPTS IN PRODUCTS
-------------------

Store prompts in version control. A/B test changes. Log inputs/outputs (redact PII). Treat prompts like code — they regress when models update.`,

  aiInYourWorkflow: `USING AI IN YOUR DEVELOPMENT WORKFLOW
======================================

AI assistants can speed up boilerplate, exploration, and documentation — but they can also introduce subtle bugs and security holes. The goal is leverage with verification.

WHERE AI HELPS
--------------

• Scaffolding — project setup, repetitive components
• Explaining unfamiliar code or error messages
• Writing tests from specifications
• Drafting docs, commit messages, PR descriptions
• Refactoring suggestions with human review
• Regex, SQL, and config you use once

WHERE TO STAY CAUTIOUS
----------------------

• Security-critical code (auth, crypto, payments)
• Complex business logic without tests
• Copy-pasting dependencies you don't understand
• Accepting large diffs without reading line by line

THE VERIFY EVERYTHING RULE
--------------------------

Treat AI output like a junior developer's PR:
1. Read the full diff
2. Run the app and tests
3. Check edge cases (null, empty, errors)
4. Search for hallucinated APIs — functions that don't exist
5. Confirm licenses of suggested libraries

NEVER PASTE SECRETS
-------------------

Don't put in prompts:
• API keys, passwords, tokens
• Customer data, internal URLs with credentials
• Proprietary algorithms under NDA

If your employer provides an enterprise AI tool, use that for internal code. Public chat tools may train on inputs.

EFFECTIVE PROMPTING FOR CODE
----------------------------

Bad:  "fix my app"

Good: "In React 19 + Vite, Login.jsx throws 'user is null' after signOut. Here's the component: [paste]. Suggest a minimal fix."

Include: stack, file, error, what you already tried.

USE AI FOR TESTS
----------------

  "Given this function [paste], write Jest tests for: happy path, empty input, invalid email."

Tests lock in behavior and catch AI mistakes on refactor.

PAIR PROGRAMMING PATTERN
------------------------

1. You write the plan and interfaces
2. AI drafts implementation
3. You edit for style, security, edge cases
4. You write or request tests
5. You own the commit — you're accountable, not the model

WHEN NOT TO USE AI
------------------

• Learning fundamentals for the first time — typing it yourself builds skill
• Interview whiteboards unless allowed
• When you'd learn nothing by skipping the struggle

AI multiplies productivity when you already know what good looks like. Build that judgment through labs and code review.

TEAM NORMS
----------

Agree with your team: which tools are approved, what must be disclosed in PRs, and documentation standards when AI assisted.`,

  callingLlmApis: `CALLING LLM APIs FROM YOUR APPLICATIONS
=========================================

Chat interfaces are demos. Production apps call APIs programmatically — sending messages, receiving completions, handling errors and cost.

CHAT COMPLETIONS MODEL
----------------------

Most providers expose a similar shape:

  POST /v1/chat/completions
  {
    "model": "gpt-4o-mini",
    "messages": [
      { "role": "system", "content": "You summarize text in 3 bullets." },
      { "role": "user", "content": "Long article here..." }
    ],
    "temperature": 0.3,
    "max_tokens": 500
  }

Response includes choices[0].message.content with the assistant reply.

MESSAGE ROLES
-------------

system    — behavior, constraints, persona
user      — end-user input
assistant — model's previous replies (for multi-turn context)

Multi-turn: append each exchange to messages array. Context window is finite — summarize or truncate old turns.

KEY PARAMETERS
--------------

temperature (0–2)
  Low (0–0.3): deterministic, factual — good for code, extraction
  High (0.7–1): creative — good for brainstorming

max_tokens — cap output length (controls cost and runaway generation)

top_p, frequency_penalty — fine-tuning diversity; start with defaults

AUTHENTICATION
--------------

API key in header:
  Authorization: Bearer YOUR_API_KEY

Store keys in environment variables:

  // Node
  const key = process.env.OPENAI_API_KEY;

Never expose keys in frontend JavaScript bundled to browsers. Call the LLM from your backend or a Supabase Edge Function; frontend hits your API.

RATE LIMITS AND ERRORS
----------------------

429 — too many requests; exponential backoff retry
500/503 — provider issue; retry with limit
400 — bad request; fix your payload

Log errors without logging full prompts containing PII.

COST AWARENESS
--------------

Billing is usually per token (input + output). Rough habits:
• Shorter system prompts
• Summarize long documents before sending
• Cheaper models for simple tasks
• Cache identical requests when possible

STREAMING
---------

Stream tokens as they're generated for better UX in chat UIs. SSE or provider SDK stream methods. Still accumulate full text server-side if you need to save it.

MINIMAL NODE EXAMPLE (PSEUDOCODE)
---------------------------------

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${process.env.OPENAI_API_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const json = await res.json();
  const text = json.choices[0].message.content;

Wrap in try/catch, validate res.ok, timeout long requests.

PRODUCTION CHECKLIST
------------------

☐ Keys in env, not git
☐ Backend proxy, not client-side keys
☐ Input length limits
☐ Output validation
☐ Logging and monitoring
☐ Fallback when API is down`,

  planYourAiFeature: `PLANNING YOUR AI CAPSTONE FEATURE
=================================

Before writing code, define what you're building and how you'll know it succeeded. A focused micro-app beats a vague "AI chatbot."

PICK ONE CLEAR USE CASE
-----------------------

Good scopes:
• Study flashcard generator from pasted notes
• Code explainer for a single file upload
• FAQ bot grounded in one markdown doc you provide
• Meeting notes → action items extractor

Too broad for a capstone:
• "ChatGPT clone"
• "AI that does everything"
• Anything requiring live web search without an API plan

USER STORIES
------------

Write 3–5 stories as: As a [user], I want [action], so that [benefit].

Example:
• As an intern, I want to paste my reading notes and get 10 quiz questions, so that I can self-test before the real quiz.
• As an intern, I want to see loading state while generating, so that I know the app didn't freeze.

DEFINITION OF DONE
------------------

• One happy path works end-to-end
• Error shown when API fails or input empty
• API key only in server/edge function
• README with setup steps
• Honest limitations section

ARCHITECTURE SKETCH
-------------------

Typical pattern for this program:

  React UI  →  your backend / Edge Function  →  LLM API

UI collects input, shows output.
Backend holds the secret key and validates input.
Never call OpenAI/Anthropic directly from Vite frontend.

RISKS TO DOCUMENT
-----------------

• Hallucinated answers — mitigate with "ground in provided text only" prompts
• Cost overrun — cap max_tokens, limit requests per user
• Slow responses — show spinner, consider streaming
• Privacy — warn users not to paste secrets

SUCCESS CRITERIA (MEASURABLE)
-----------------------------

• Generates useful output on 3 test inputs you define in advance
• Loads in under 3 seconds excluding model time (or shows progress)
• Trainer can run locally from README without your help
• You can explain every file in the repo

TIMELINE SUGGESTION
-------------------

Day 1–2: wire API proxy + hello prompt
Day 3–4: build UI + error handling
Day 5: polish, README, demo screenshots

Ship small, then enhance if time allows.

REFLECTION QUESTIONS
--------------------

• What would break if the model returns garbage?
• How does a user recover from errors?
• What would you do differently with two more weeks?

Answer these in your README limitations section — it shows maturity.`,
}
