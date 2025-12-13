# Tech Stack & Deployment Guide

## Tech Stack with Specific Versions

### Frontend

#### Core Framework & Build Tools
- **React**: `^18.3.1`
- **React DOM**: `^18.3.1`
- **Vite**: `^7.1.12` (Build tool and dev server)
- **Node.js**: (Latest LTS recommended)

#### UI Libraries & Components
- **Tailwind CSS**: `^4.1.7`
- **Radix UI Components**: 
  - `@radix-ui/react-avatar`: `^1.1.10`
  - `@radix-ui/react-checkbox`: `^1.3.2`
  - `@radix-ui/react-dialog`: `^1.1.14`
  - `@radix-ui/react-dropdown-menu`: `^2.1.15`
  - `@radix-ui/react-progress`: `^1.1.7`
  - `@radix-ui/react-tabs`: `^1.1.12`
  - `@radix-ui/react-tooltip`: `^1.2.6`
  - And more Radix UI components
- **Framer Motion**: `^12.12.2` (Animations)
- **Lucide React**: `^0.508.0` (Icons)
- **Sonner**: `^2.0.3` (Toast notifications)
- **React Hot Toast**: `^2.5.2`

#### Form & Validation
- **React Hook Form**: `^7.56.4`
- **Zod**: `^3.25.3` (Schema validation)
- **@hookform/resolvers**: `^5.0.1`

#### Routing & State Management
- **React Router DOM**: `^7.5.3`
- **Next Themes**: `^0.4.6` (Theme management)

#### Data Visualization & Utilities
- **Recharts**: `^2.15.3` (Charts)
- **Axios**: `^1.9.0` (HTTP client)
- **Date-fns**: `^3.6.0` (Date utilities)
- **jspdf**: `^3.0.1` (PDF generation)
- **dom-to-image**: `^2.6.0` (DOM to image conversion)
- **ONNX Runtime Web**: `^1.21.1` (ML model inference)

#### Development Dependencies
- **ESLint**: `^9.25.0`
- **TypeScript Types**: `^19.1.2`
- **Vite React Plugin**: `^4.4.1`
- **PostCSS**: `^8.5.3`
- **Autoprefixer**: `^10.4.21`

### Backend

#### Core Framework
- **Python**: `3.11`
- **Flask**: `2.3.3`
- **Werkzeug**: `2.3.7`
- **Gunicorn**: `21.2.0` (WSGI HTTP Server)

#### Authentication & Security
- **Flask-JWT-Extended**: `4.5.3`
- **Flask-CORS**: `4.0.0`

#### Database & Storage
- **PostgreSQL** (via Supabase)
- **psycopg2-binary**: `2.9.7` (PostgreSQL adapter)
- **Supabase**: `2.15.1`

#### Computer Vision & ML
- **OpenCV**: `4.8.1.78`
- **NumPy**: `1.24.3`
- **SciPy**: `1.11.1`
- **PyTorch**: `2.1.0`
- **TorchVision**: `0.16.0`
- **Ultralytics (YOLOv8)**: `8.0.196`
- **Deep Sort Realtime**: `1.3.2`

#### Utilities
- **python-dotenv**: `1.0.0`
- **pytz**: `2023.3`
- **python-dateutil**: `2.8.2`
- **psutil**: `5.9.6`
- **ReportLab**: `4.0.4` (PDF generation)

#### AI/ML Services (Optional)
- **google-generativeai**: `>=0.7.0` (Gemini AI recommendations)
- **groq**: `>=0.4.0` (Optional - Groq AI, uncomment if using)
- **openai**: `>=1.0.0` (Optional - OpenAI, uncomment if using)

---

## Deployment Instructions

### Frontend Deployment (Vercel)

#### Prerequisites
1. Vercel account (free tier available)
2. GitHub/GitLab/Bitbucket repository connected
3. Node.js installed locally (for testing builds)

#### Deployment Steps

1. **Prepare the frontend for production:**
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. **Configure environment variables:**
   - In Vercel dashboard, go to your project settings
   - Add environment variables (if needed):
     - `VITE_API_URL` - Backend API URL

3. **Deploy via Vercel CLI:**
   ```bash
   npm install -g vercel
   cd frontend
   vercel
   ```
   Or deploy via Vercel dashboard by connecting your Git repository.

4. **Vercel Configuration:**
   - The `vercel.json` file is already configured for SPA routing
   - Build command: `npm run build`
   - Output directory: `dist`
   - Framework preset: Vite

5. **Verify deployment:**
   - Frontend will be accessible at `https://your-project.vercel.app`
   - Ensure API URL in `src/config.js` points to your backend

---

### Backend Deployment (Railway)

#### Prerequisites
1. Railway account (free tier available with $5 credit)
2. GitHub repository connected
3. Supabase account and credentials

#### Deployment Steps

1. **Prepare environment variables:**
   Create a `.env` file or set these in Railway dashboard:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_key
   FLASK_SECRET_KEY=your_secret_key
   JWT_SECRET_KEY=your_jwt_secret_key
   GMAIL_USER=your_gmail_address
   GMAIL_PASS=your_gmail_app_password
   USE_AI_RECOMMENDATIONS=false  # or true if using AI
   AI_PROVIDER=groq  # or gemini, openai
   GROQ_API_KEY=your_groq_key  # if using Groq
   GEMINI_API_KEY=your_gemini_key  # if using Gemini
   OPENAI_API_KEY=your_openai_key  # if using OpenAI
   DATABASE_URL=your_postgres_url  # if using external DB
   PORT=8080
   ALLOWED_ORIGINS=your_frontend_url,*
   ```

2. **Deploy via Railway:**
   
   **Option A: Via Railway Dashboard**
   - Go to Railway dashboard
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Select the `backend` directory as root
   - Railway will auto-detect Python and use the Dockerfile
   
   **Option B: Via Railway CLI**
   ```bash
   npm install -g @railway/cli
   railway login
   cd backend
   railway init
   railway up
   ```

3. **Railway Configuration:**
   - The `railway.toml` is configured with Nixpacks builder
   - Dockerfile is available for custom builds
   - Procfile defines the gunicorn command
   - Port is automatically assigned by Railway (use `$PORT` env var)

4. **Configure build settings:**
   - Build command: Railway auto-detects or uses Dockerfile
   - Start command: `gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 2 --timeout 600 --keep-alive 5 main.app:app`
   - Health check: `/api/health` (if implemented)

5. **Database Setup:**
   - Railway PostgreSQL (recommended): Create a PostgreSQL service in Railway
   - Or use Supabase PostgreSQL: Use your Supabase connection string
   - Update `DATABASE_URL` in environment variables

6. **Storage Setup:**
   - Use Supabase Storage for file storage
   - Ensure `SUPABASE_URL` and `SUPABASE_KEY` are set
   - Create a bucket named `projectresults` in Supabase

7. **Verify deployment:**
   - Backend will be accessible at `https://your-project.railway.app`
   - Test endpoints: `/api/login`, `/api/register`
   - Check logs in Railway dashboard for any errors

---

### Backend Deployment (Docker/Other Platforms)

#### Using Docker

1. **Build the Docker image:**
   ```bash
   cd backend
   docker build -t retailsense-backend .
   ```

2. **Run the container:**
   ```bash
   docker run -d \
     -p 8080:8080 \
     -e SUPABASE_URL=your_url \
     -e SUPABASE_KEY=your_key \
     -e FLASK_SECRET_KEY=your_secret \
     -e JWT_SECRET_KEY=your_jwt_secret \
     -e PORT=8080 \
     --name retailsense-backend \
     retailsense-backend
   ```

3. **For Docker Compose:**
   ```yaml
   version: '3.8'
   services:
     backend:
       build: ./backend
       ports:
         - "8080:8080"
       environment:
         - SUPABASE_URL=${SUPABASE_URL}
         - SUPABASE_KEY=${SUPABASE_KEY}
         - FLASK_SECRET_KEY=${FLASK_SECRET_KEY}
         - JWT_SECRET_KEY=${JWT_SECRET_KEY}
         - PORT=8080
       restart: unless-stopped
   ```

---

### Alternative Deployment Options

#### Frontend Alternatives
- **Netlify**: Similar to Vercel, supports SPA routing
- **Cloudflare Pages**: Free, fast CDN
- **AWS S3 + CloudFront**: For advanced users

#### Backend Alternatives
- **Heroku**: Requires credit card, similar to Railway
- **Render**: Free tier available
- **AWS EC2/ECS**: For production scale
- **Google Cloud Run**: Serverless container platform
- **Azure App Service**: Microsoft cloud platform

---

### Post-Deployment Checklist

1. **Frontend:**
   - [ ] Verify all API endpoints are accessible
   - [ ] Test authentication flow
   - [ ] Check CORS configuration
   - [ ] Verify environment variables
   - [ ] Test responsive design

2. **Backend:**
   - [ ] Verify all environment variables are set
   - [ ] Test database connection
   - [ ] Verify Supabase storage access
   - [ ] Test API endpoints
   - [ ] Check logs for errors
   - [ ] Verify file upload/download works
   - [ ] Test video processing (if applicable)

3. **Integration:**
   - [ ] Frontend can communicate with backend
   - [ ] CORS is properly configured
   - [ ] Authentication tokens work correctly
   - [ ] File uploads work end-to-end

---

### Environment Variables Reference

#### Frontend (.env or Vercel Environment Variables)
```env
VITE_API_URL=https://your-backend.railway.app
```

#### Backend (.env or Railway Environment Variables)
```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key

# Flask Configuration
FLASK_SECRET_KEY=generate-a-random-secret-key
JWT_SECRET_KEY=generate-a-random-jwt-secret
PORT=8080

# Email Configuration (for OTP)
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-app-password

# AI Configuration (Optional)
USE_AI_RECOMMENDATIONS=false
AI_PROVIDER=groq
GROQ_API_KEY=your-groq-key
GEMINI_API_KEY=your-gemini-key
OPENAI_API_KEY=your-openai-key

# CORS Configuration
ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://localhost:5173

# Database (if not using Supabase)
DATABASE_URL=postgresql://user:pass@host:port/dbname
```

---

### Troubleshooting

#### Frontend Issues
- **Build fails**: Check Node.js version (should be LTS)
- **API calls fail**: Verify `VITE_API_URL` is correct
- **CORS errors**: Check backend CORS configuration

#### Backend Issues
- **Import errors**: Verify `PYTHONPATH=/app` in Dockerfile
- **Database connection fails**: Check `DATABASE_URL` or Supabase credentials
- **File upload fails**: Verify Supabase storage bucket exists
- **Out of memory**: Railway free tier has memory limits; consider upgrading

#### General Issues
- **Deployment timeout**: Increase timeout in gunicorn config
- **Slow builds**: Consider using Docker layer caching
- **Environment variables not loading**: Ensure they're set in deployment platform

