<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Foam CRM Pro

A comprehensive CRM and project management application for foam insulation contractors. Built with React, TypeScript, and Supabase.

View your app in AI Studio: https://ai.studio/apps/drive/1ROizMe-9bo1K-SF5Mcc1w3MwxrsVNlSy

## Run Locally

**Prerequisites:**  Node.js 20+

1. Install dependencies:
   ```bash
   npm install
   ```

2. (Optional) Set the `GEMINI_API_KEY` in `.env.local` for AI features:
   ```bash
   cp .env.example .env.local
   # Edit .env.local and add your Gemini API key
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to `http://localhost:3000`

## Build for Production

Build the application for production:

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Deploy to Google Cloud Run

This application is ready to deploy to Google Cloud Run with minimal configuration.

### Prerequisites

- [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install) installed
- A Google Cloud Project with billing enabled
- Docker installed (for local testing)

### Quick Deploy

1. Set your Google Cloud project ID:
   ```bash
   export PROJECT_ID=your-gcp-project-id
   ```

2. Run the deployment script:
   ```bash
   ./deploy.sh
   ```

The script will:
- Enable required Google Cloud APIs
- Create an Artifact Registry repository
- Build the Docker image
- Push the image to Artifact Registry
- Deploy to Cloud Run
- Display the service URL

### Manual Deployment

If you prefer to deploy manually:

1. Build the Docker image:
   ```bash
   docker build -t gcr.io/${PROJECT_ID}/foamapppppp .
   ```

2. Push to Google Container Registry:
   ```bash
   docker push gcr.io/${PROJECT_ID}/foamapppppp
   ```

3. Deploy to Cloud Run:
   ```bash
   gcloud run deploy foamapppppp \
     --image gcr.io/${PROJECT_ID}/foamapppppp \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --port 8080
   ```

### Configuration

- **Service Configuration**: Edit `cloudrun.yaml` to customize Cloud Run settings
- **Environment Variables**: Set environment variables in Cloud Run console or via `gcloud` commands
- **Scaling**: Configure auto-scaling in `cloudrun.yaml` (default: 0-10 instances)

### Environment Variables

See `.env.example` for available configuration options.

## Architecture

- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite
- **UI Components**: Lucide React icons
- **Charts**: Recharts
- **Backend**: Supabase (database and authentication)
- **Deployment**: Nginx on Alpine Linux in Docker container

## License

Private
