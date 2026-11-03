# Deployment Guide - Render CI/CD

This document explains how to deploy the VMC Road Management System to Render with automatic CI/CD on every commit.

## Prerequisites

1. **GitHub Repository**: Your code must be pushed to GitHub
2. **Render Account**: Sign up at [render.com](https://render.com)
3. **MongoDB Atlas Account**: For production database (or use Render MongoDB)

## Step 1: Push Code to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/vadodara_roads.git
git push -u origin main
```

## Step 2: Set Up MongoDB

### Option A: MongoDB Atlas (Recommended)
1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster (free tier)
3. Create a database user with read/write permissions
4. Get your connection string: `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority`

### Option B: Render MongoDB
1. In Render dashboard, click "New" → "MongoDB"
2. Choose a region and instance type
3. Copy the internal connection string

## Step 3: Deploy to Render

### Using render.yaml (Recommended)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Blueprint"
3. Connect your GitHub repository
4. Render will automatically detect `render.yaml`
5. Review the configuration and click "Apply"

### Manual Deployment

1. Click "New" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: vmc-roads
   - **Region**: Choose nearest to your users
   - **Branch**: main
   - **Root Directory**: `.` (leave empty)
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

## Step 4: Configure Environment Variables

In your Render web service, add these environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/vmc` |
| `MONGODB_DB` | Database name | `vmc_roads` |
| `JWT_SECRET_KEY` | Secret for JWT tokens | Generate a random string |
| `JWT_ALGORITHM` | JWT algorithm | `HS256` |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiry | `30` |
| `MAPILLARY_TOKEN` | Mapillary API token (optional) | Your token |
| `APP_ENV` | Environment | `production` |

**Important**: Generate a secure `JWT_SECRET_KEY`:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Step 5: Get Render Deploy Hook

1. In Render dashboard, go to your web service
2. Scroll to "Deploys" section
3. Click "Add Deploy Hook"
4. Name it: `github-auto-deploy`
5. Copy the **full URL** (e.g., `https://api.render.com/deploy/srv-xxxxx`)

## Step 6: Add GitHub Secrets

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions → New repository secret
3. Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `RENDER_DEPLOY_HOOK` | The deploy hook URL from Step 5 |
| `RENDER_SERVICE_ID` | Your service ID (from Render URL: `https://dashboard.render.com/web/srv-XXXXX`) |

### How It Works

- Every push to `main` or `master` branch triggers the GitHub Action
- The action calls Render's API to trigger a new deployment
- Render automatically pulls the latest code and rebuilds
- Zero manual intervention required

## Step 7: Test CI/CD

Push any change to trigger the pipeline:

```bash
git add .
git commit -m "Test CI/CD"
git push
```

Go to GitHub → "Actions" tab to watch the pipeline run (build → test → deploy).

## Step 8: Verify Deployment

1. Check Render dashboard for deployment status
2. Visit your Render URL (e.g., `https://vmc-roads.onrender.com`)
3. Test the health endpoint: `https://your-app.onrender.com/health`
4. Should return: `{"status": "healthy", "service": "VMC Road Management System"}`

## Troubleshooting

### Build Fails
- Check Render logs in the dashboard
- Ensure `requirements.txt` is up to date
- Verify all dependencies are compatible with Python 3.11

### Database Connection Error
- Verify `MONGODB_URI` is correct
- Check MongoDB Atlas whitelist allows Render's IP (0.0.0.0/0)
- Ensure database user has correct permissions

### Deployment Not Triggering
- Verify GitHub secrets are set correctly
- Check GitHub Actions logs for errors
- Ensure the workflow file is in `.github/workflows/deploy.yml`

## Monitoring

- **Render Dashboard**: View logs, metrics, and deployment history
- **GitHub Actions**: View CI/CD workflow runs
- **Health Check**: `/health` endpoint for uptime monitoring

## Cost

- **Render Web Service**: Free tier available (spins down after inactivity)
- **MongoDB Atlas**: Free tier available (512MB storage)
- **Total**: Can be completely free for development/testing

## Security Notes

- Never commit `.env` file to GitHub
- Use strong, randomly generated secrets
- Enable IP whitelisting on MongoDB if possible
- Use HTTPS (Render provides SSL automatically)
