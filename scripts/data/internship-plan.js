/**
 * Three separate plan templates: Frontend, Git, and AI.
 * Each plan is one track — assign the right plan per cohort in Cohort Builder.
 * Consumed by scripts/seed-plans.js
 */

import { ARTICLES } from "./articles.js"

function q(id, question, options, correct_index) {
  return { id, question, options, correct_index }
}

export const LEGACY_PLAN_NAMES = ["Wasel Internship Program"]

export const PLAN_TEMPLATES = [
  {
    name: "Frontend",
    tracks: [
      {
        label: "Frontend",
        category: "frontend",
        order: 0,
        modules: [
        {
          title: "HTML & Web Semantics",
          order: 0,
          weeks: [
            {
              title: "Document structure",
              week_number: 1,
              tasks: [
                {
                  title: "How the Web Works",
                  type: "reading",
                  content: ARTICLES.howTheWebWorks,
                },
                {
                  title: "Build a semantic landing page",
                  type: "lab",
                  content:
                    "Create a single HTML page using header, nav, main, section, article, footer.\n\n" +
                    "Include: one h1, logical heading hierarchy, alt text on images, a contact form with labels.",
                },
                {
                  title: "HTML fundamentals quiz",
                  type: "quiz",
                  content: "Test your understanding of semantic HTML and document structure.",
                  quiz: {
                    passing_score: 70,
                    questions: [
                      q("fe-h1-q1", "Which element should wrap the primary page heading?", ["<div>", "<h1>", "<header>", "<title>"], 1),
                      q("fe-h1-q2", "What is the purpose of the alt attribute?", ["Styling images", "Describing image content for accessibility", "Lazy loading", "SEO only"], 1),
                      q("fe-h1-q3", "Which tag groups related navigation links?", ["<section>", "<nav>", "<aside>", "<menu>"], 1),
                    ],
                  },
                },
              ],
            },
            {
              title: "Forms & accessibility",
              week_number: 2,
              tasks: [
                {
                  title: "Accessible forms",
                  type: "reading",
                  content: ARTICLES.accessibleForms,
                },
                {
                  title: "Registration form lab",
                  type: "submission",
                  content:
                    "Build an accessible registration form (name, email, password, role select).\n\n" +
                    "Submit: link to your HTML file or repo. Include validation messages tied to fields.",
                },
              ],
            },
          ],
        },
        {
          title: "CSS & Layout",
          order: 1,
          weeks: [
            {
              title: "Selectors & the box model",
              week_number: 1,
              tasks: [
                {
                  title: "CSS fundamentals",
                  type: "reading",
                  content: ARTICLES.cssFundamentals,
                },
                {
                  title: "Card component styling",
                  type: "lab",
                  content:
                    "Style a card with hover state, consistent spacing, and a responsive image.\n\n" +
                    "Use flexbox for the card body layout.",
                },
                {
                  title: "CSS layout quiz",
                  type: "quiz",
                  content: "Box model, flexbox basics, and specificity.",
                  quiz: {
                    passing_score: 70,
                    questions: [
                      q("fe-c1-q1", "Which property adds space outside the border?", ["padding", "margin", "gap", "outline"], 1),
                      q("fe-c1-q2", "display: flex affects which axis by default?", ["Block axis", "Inline (row) axis", "Z-axis", "Grid axis"], 1),
                      q("fe-c1-q3", "Which selector has highest specificity here?", [".btn", "#save", "button", "*"], 1),
                    ],
                  },
                },
              ],
            },
            {
              title: "Responsive design",
              week_number: 2,
              tasks: [
                {
                  title: "Mobile-first CSS",
                  type: "reading",
                  content: ARTICLES.mobileFirstCss,
                },
                {
                  title: "Responsive dashboard mockup",
                  type: "submission",
                  content:
                    "Build a simple dashboard layout that stacks on mobile and uses a sidebar on desktop (≥768px).\n\n" +
                    "Submit a repo link or deployed URL.",
                },
              ],
            },
          ],
        },
        {
          title: "JavaScript Essentials",
          order: 2,
          weeks: [
            {
              title: "Language basics",
              week_number: 1,
              tasks: [
                {
                  title: "Modern JavaScript syntax",
                  type: "reading",
                  content: ARTICLES.modernJavaScript,
                },
                {
                  title: "DOM manipulation lab",
                  type: "lab",
                  content:
                    "Build a todo list: add items, mark complete, delete. Use event delegation on the list container.\n\n" +
                    "No frameworks — vanilla JS only.",
                },
                {
                  title: "JavaScript basics quiz",
                  type: "quiz",
                  content: "Variables, arrays, and DOM APIs.",
                  quiz: {
                    passing_score: 70,
                    questions: [
                      q("fe-j1-q1", "Which method returns a new array of transformed items?", ["forEach", "map", "push", "splice"], 1),
                      q("fe-j1-q2", "document.querySelector accepts what?", ["Only IDs", "A CSS selector string", "Only classes", "An array"], 1),
                      q("fe-j1-q3", "const prevents what?", ["Mutation of objects", "Reassignment of the binding", "Both always", "Neither"], 1),
                    ],
                  },
                },
              ],
            },
            {
              title: "Async & fetch",
              week_number: 2,
              tasks: [
                {
                  title: "Promises and async/await",
                  type: "reading",
                  content: ARTICLES.promisesAsyncAwait,
                },
                {
                  title: "API data display",
                  type: "lab",
                  content:
                    "Fetch data from jsonplaceholder.typicode.com/users and render a list with loading and error states.\n\n" +
                    "Show name and email for each user.",
                },
                {
                  title: "Mini capstone: user directory",
                  type: "submission",
                  content:
                    "Combine HTML, CSS, and fetch into a searchable user directory page.\n\n" +
                    "Requirements: search input filters client-side, loading spinner, empty state.",
                },
              ],
            },
          ],
        },
        {
          title: "React & Components",
          order: 3,
          weeks: [
            {
              title: "React foundations",
              week_number: 1,
              tasks: [
                {
                  title: "Components, props, and state",
                  type: "reading",
                  content: ARTICLES.reactComponentsPropsState,
                },
                {
                  title: "Counter & toggle components",
                  type: "lab",
                  content:
                    "In a Vite + React app, build: (1) a counter with increment/decrement, (2) a theme toggle that switches a CSS class on the root.",
                },
                {
                  title: "React fundamentals quiz",
                  type: "quiz",
                  content: "Components, props, state, and JSX.",
                  quiz: {
                    passing_score: 70,
                    questions: [
                      q("fe-r1-q1", "Where should mutable component state live?", ["Global window", "useState in the component", "props", "CSS"], 1),
                      q("fe-r1-q2", "Props flow in which direction?", ["Child to parent", "Parent to child", "Sibling to sibling", "Random"], 1),
                      q("fe-r1-q3", "JSX expressions use which delimiters?", ["{{ }}", "{ }", "[ ]", "( )"], 1),
                    ],
                  },
                },
              ],
            },
            {
              title: "Lists, effects, and forms",
              week_number: 2,
              tasks: [
                {
                  title: "useEffect and forms in React",
                  type: "reading",
                  content: ARTICLES.reactUseEffectForms,
                },
                {
                  title: "Notes app (React)",
                  type: "submission",
                  content:
                    "Build a notes app: add note, list notes, delete note. Persist to localStorage.\n\n" +
                    "Submit repo link. README should include setup steps.",
                },
              ],
            },
          ],
        },
      ],
    },
    ],
  },
  {
    name: "Git",
    tracks: [
      {
        label: "Git",
        category: "git",
        order: 0,
        modules: [
        {
          title: "Version Control Basics",
          order: 0,
          weeks: [
            {
              title: "Repositories & commits",
              week_number: 1,
              tasks: [
                {
                  title: "Why Git matters",
                  type: "reading",
                  content: ARTICLES.whyGitMatters,
                },
                {
                  title: "First repository",
                  type: "lab",
                  content:
                    "Initialize a repo, create README.md, make 3 commits with clear messages, view log with git log --oneline.\n\n" +
                    "Push to a new GitHub repository.",
                },
                {
                  title: "Git basics quiz",
                  type: "quiz",
                  content: "Commits, staging, and repository concepts.",
                  quiz: {
                    passing_score: 70,
                    questions: [
                      q("git-1-q1", "git add stages changes in which area?", ["Working directory → staging", "Staging → remote", "Remote → local", "Nowhere"], 0),
                      q("git-1-q2", "A commit is best described as?", ["A cloud backup", "A snapshot of staged changes", "A branch rename", "A merge conflict"], 1),
                      q("git-1-q3", "Which command shows commit history?", ["git status", "git log", "git diff", "git remote"], 1),
                    ],
                  },
                },
              ],
            },
            {
              title: "Branching & merging",
              week_number: 2,
              tasks: [
                {
                  title: "Branches and merges",
                  type: "reading",
                  content: ARTICLES.branchesAndMerges,
                },
                {
                  title: "Feature branch workflow",
                  type: "lab",
                  content:
                    "From main, create feature/add-footer, add a footer, merge back to main. Create a second branch that touches the same line and resolve the conflict.",
                },
                {
                  title: "Branching exercise write-up",
                  type: "submission",
                  content:
                    "Submit a short markdown doc: steps you used, screenshot of git log --graph, and one tip for avoiding painful merges.",
                },
              ],
            },
          ],
        },
        {
          title: "GitHub Collaboration",
          order: 1,
          weeks: [
            {
              title: "Remotes & pull requests",
              week_number: 1,
              tasks: [
                {
                  title: "GitHub flow",
                  type: "reading",
                  content: ARTICLES.githubFlow,
                },
                {
                  title: "Open your first PR",
                  type: "lab",
                  content:
                    "On a practice repo: create an issue, branch fix/typo-readme, fix a typo, push, open PR, request review from trainer.",
                },
                {
                  title: "Collaboration quiz",
                  type: "quiz",
                  content: "Remotes, PRs, and team workflow.",
                  quiz: {
                    passing_score: 70,
                    questions: [
                      q("git-2-q1", "git pull typically does what?", ["Only fetch", "Fetch and merge/rebase", "Delete remote", "Create tag"], 1),
                      q("git-2-q2", "A pull request is used to?", ["Deploy production", "Propose merging changes for review", "Delete branches", "Reset history"], 1),
                      q("git-2-q3", "origin usually refers to?", ["Local folder", "Default remote repository", "A branch name", "A commit"], 1),
                    ],
                  },
                },
              ],
            },
            {
              title: "Team hygiene",
              week_number: 2,
              tasks: [
                {
                  title: ".gitignore & conventional commits",
                  type: "reading",
                  content: ARTICLES.gitignoreConventionalCommits,
                },
                {
                  title: "Team simulation",
                  type: "submission",
                  content:
                    "With a peer (or solo two branches): one adds a feature, one fixes a bug, both merge via PRs.\n\n" +
                    "Submit links to both PRs and describe the review feedback you gave/received.",
                },
              ],
            },
          ],
        },
      ],
    },
    ],
  },
  {
    name: "AI",
    tracks: [
      {
        label: "AI",
        category: "ai",
        order: 0,
        modules: [
        {
          title: "AI Foundations",
          order: 0,
          weeks: [
            {
              title: "Concepts & terminology",
              week_number: 1,
              tasks: [
                {
                  title: "ML vs AI vs LLMs",
                  type: "reading",
                  content: ARTICLES.mlVsAiVsLlms,
                },
                {
                  title: "Explore an ML playground",
                  type: "lab",
                  content:
                    "Use Google Teachable Machine or a similar tool to train a tiny image or sound classifier.\n\n" +
                    "Document: what data you used, accuracy/limitations, one failure case.",
                },
                {
                  title: "AI foundations quiz",
                  type: "quiz",
                  content: "Core vocabulary and limitations of AI systems.",
                  quiz: {
                    passing_score: 70,
                    questions: [
                      q("ai-1-q1", "An LLM generates text by?", ["Looking up fixed answers", "Predicting likely next tokens", "Querying a spreadsheet", "Random selection"], 1),
                      q("ai-1-q2", "A hallucination is when a model?", ["Runs out of memory", "Produces plausible but false info", "Trains too slowly", "Uses too much GPU"], 1),
                      q("ai-1-q3", "Supervised learning requires?", ["No data", "Labeled examples", "Only GPUs", "Blockchain"], 1),
                    ],
                  },
                },
              ],
            },
            {
              title: "Data & evaluation",
              week_number: 2,
              tasks: [
                {
                  title: "Datasets and bias",
                  type: "reading",
                  content: ARTICLES.datasetsAndBias,
                },
                {
                  title: "Bias case study",
                  type: "submission",
                  content:
                    "Pick one public AI failure/bias story. Write 300–500 words: what went wrong, who was affected, one mitigation.",
                },
              ],
            },
          ],
        },
        {
          title: "Prompting & AI Tools",
          order: 1,
          weeks: [
            {
              title: "Effective prompting",
              week_number: 1,
              tasks: [
                {
                  title: "Prompt engineering basics",
                  type: "reading",
                  content: ARTICLES.promptEngineeringBasics,
                },
                {
                  title: "Prompt iteration lab",
                  type: "lab",
                  content:
                    "Take one coding task (e.g. parse CSV). Write 3 prompt versions: vague, better, best.\n\n" +
                    "Save outputs and note which constraints improved quality.",
                },
                {
                  title: "Prompting quiz",
                  type: "quiz",
                  content: "Techniques for reliable LLM outputs.",
                  quiz: {
                    passing_score: 70,
                    questions: [
                      q("ai-2-q1", "Few-shot prompting means?", ["Zero examples", "Providing example input/output pairs", "Disabling the model", "Using images only"], 1),
                      q("ai-2-q2", "Asking for JSON output helps because?", ["Models love brackets", "It constrains structure", "It uses less tokens", "It trains the model"], 1),
                      q("ai-2-q3", "Chain-of-thought is useful for?", ["Image generation", "Multi-step reasoning tasks", "Database indexing", "Git merges"], 1),
                    ],
                  },
                },
              ],
            },
            {
              title: "AI-assisted development",
              week_number: 2,
              tasks: [
                {
                  title: "Using AI in your workflow",
                  type: "reading",
                  content: ARTICLES.aiInYourWorkflow,
                },
                {
                  title: "AI pair programming session",
                  type: "submission",
                  content:
                    "Use an AI assistant to implement a small feature in your React notes app. Submit: prompt transcript, final diff, what you corrected manually.",
                },
              ],
            },
          ],
        },
        {
          title: "Building with LLM APIs",
          order: 2,
          weeks: [
            {
              title: "APIs & integration",
              week_number: 1,
              tasks: [
                {
                  title: "Calling LLM APIs",
                  type: "reading",
                  content: ARTICLES.callingLlmApis,
                },
                {
                  title: "CLI summarizer",
                  type: "lab",
                  content:
                    "Build a tiny Node or Python script that reads a text file and prints an AI-generated summary.\n\n" +
                    "Load the API key from environment — never commit it.",
                },
                {
                  title: "LLM API quiz",
                  type: "quiz",
                  content: "API concepts and safe integration.",
                  quiz: {
                    passing_score: 70,
                    questions: [
                      q("ai-3-q1", "API keys should be stored in?", ["GitHub README", "Environment variables", "HTML comments", "Public chat"], 1),
                      q("ai-3-q2", "Higher temperature generally makes output?", ["More deterministic", "More random/creative", "Faster only", "Shorter only"], 1),
                      q("ai-3-q3", "The system message typically sets?", ["User password", "Model behavior and constraints", "Database URL", "CSS theme"], 1),
                    ],
                  },
                },
              ],
            },
            {
              title: "Capstone project",
              week_number: 2,
              tasks: [
                {
                  title: "Plan your AI feature",
                  type: "reading",
                  content: ARTICLES.planYourAiFeature,
                },
                {
                  title: "AI micro-app capstone",
                  type: "submission",
                  content:
                    "Build a small web app that calls an LLM API for one clear purpose.\n\n" +
                    "Deliverables: repo link, README (setup + env vars), 2-min demo video or screenshots, limitations section.",
                },
              ],
            },
          ],
        },
      ],
    },
    ],
  },
]
