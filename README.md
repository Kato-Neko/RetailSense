# Project Setup Instructions

## Backend Setup

1. Navigate to the backend directory:

   ```bash
   cd backend
   ```

2. Create a virtual environment:

   ```bash
   python -m venv .venv
   ```

3. Activate the virtual environment:

   ```bash
   .venv\Scripts\Activate.ps1
   ```

4. Install the required packages:

   ```bash
   pip install -r requirements.txt
   ```

5. Navigate to the heatmap_maker directory and run the application:
   ```bash
   cd heatmap_maker
   python app.py
   ```

## Frontend Setup

1. Open a new terminal and navigate to the frontend directory:

   ```bash
   cd frontend
   ```

2. Install Vite:

   ```bash
   npm install vite@latest
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

If you want to add more shadcn components to use, visit the website https://ui.shadcn.com/docs/components/accordion. Adding components are as easy as follows

```bash
1.) Navigate to your frontend folder
      cd frontend
2.) Paste the CLI command from the component you want to add.
    For example, you want to add button.
      npx shadcn@latest add button

The button.jsx will be automatically added into the src/components/ui
```

## Supabase Setup

1. Send a private message to either of the collaborators of this project:
   ```bash
   nickcarter.lacanglacang@cit.edu
   louiejames.carbungco@cit.edu
   ```

Now you should be all set up to run the project!
