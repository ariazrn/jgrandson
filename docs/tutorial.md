# Tutorial: Building your first JGrandson App

Welcome to JGrandson! In this tutorial, we will build a simple counter application.

## 1. Create a new project

Use the CLI to scaffold a new project:

\`\`\`bash
jg create my-counter
cd my-counter
npm install
\`\`\`

## 2. Write some code

Open `src/App.jg` and replace its contents with:

\`\`\`jg
page CounterApp {
  state {
    count: number = 0
  }

  div {
    style {
      padding: "20px"
      fontFamily: "sans-serif"
    }
    
    h1 {
      text { content: "Counter: " + count }
    }

    button {
      onClick() {
        count = count + 1
      }
      text { content: "Increment" }
    }
  }
}
\`\`\`

## 3. Run the development server

Run the following command to start the live preview:

\`\`\`bash
npm run dev
\`\`\`

Open your browser to `http://localhost:5173`. You should see your counter! Every time you save `App.jg`, the browser will automatically refresh.

## 4. Build for production

When you're ready to deploy, run:

\`\`\`bash
npm run build
\`\`\`

This will compile your JGrandson code into highly optimized React/TSX files in the `dist` directory, ready to be bundled by Vite.
