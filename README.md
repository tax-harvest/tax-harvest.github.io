# India Tax Harvesting Tool

A web application for Indian equity investors to optimize tax liability through systematic tax loss harvesting. Upload your Zerodha Tradebook CSV files to view holdings classified as Short-Term or Long-Term, identify loss harvesting opportunities, and execute orders via Kite Publisher.

## Features

- **Accurate ST/LT Classification**: Uses actual purchase dates from Tradebook CSV for proper Short-Term (<=12 months) and Long-Term (>12 months) classification
- **FIFO Calculation**: Applies First-In-First-Out logic to calculate current holdings from trade history
- **Multi-File Support**: Upload up to 2 Tradebook files (Current FY + Last FY) for complete ST/LT classification
- **Privacy First**: All tradebook data is processed locally in your browser - never uploaded to any server
- **Tax Harvesting Opportunities**: Identifies STCL and LTCL opportunities with potential tax savings
- **One-Click Execution**: Execute sell orders via Kite Publisher basket - no OAuth setup required
- **Buyback Reminders**: Track sold positions and get reminders to buy back next trading day
- **CSV Export**: Download holdings and opportunities for offline analysis

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or later) - [Download](https://nodejs.org/)
- **Kite Connect API Key** - [Register at Zerodha Developers](https://developers.kite.trade/)

## Local Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd india-tax-harvesting
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the example environment file and update with your values:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# Supabase Configuration
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Kite Connect API Key (for Kite Publisher basket)
PUBLIC_KITE_API_KEY=your-kite-api-key
```

### 4. Set Up Supabase

#### Option A: Use Supabase Cloud (Recommended)

1. Create a new project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key from Settings > API
3. Link your local project:

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
```

4. Run database migrations:

```bash
npx supabase db push
```

5. Deploy the Edge Function:

```bash
npx supabase functions deploy nse-quotes
```

#### Option B: Use Local Supabase (for development)

1. Start local Supabase:

```bash
npx supabase start
```

2. Run migrations:

```bash
npx supabase db push
```

3. Serve Edge Functions locally:

```bash
npx supabase functions serve
```

### 5. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run check` | Run TypeScript and Svelte checks |
| `npm run check:watch` | Run checks in watch mode |

## Supabase Setup

### Database Migrations

The project includes migrations in `supabase/migrations/`:

- `001_buyback_records.sql` - Creates the buyback_records table with RLS policies

To apply migrations:

```bash
# For cloud Supabase
npx supabase db push

# For local Supabase
npx supabase db reset
```

### Edge Functions

The project includes Edge Functions in `supabase/functions/`:

- `nse-quotes` - Fetches current stock prices via Yahoo Finance API (supports NSE and BSE symbols)
- `get-buybacks` - Retrieves buyback records using a recovery token (for anonymous access)
- `create-access-token` - Creates a recovery token for the authenticated user

Deploy all functions:

```bash
# Deploy all at once
./scripts/deploy-supabase.sh

# Or deploy individually
npx supabase functions deploy nse-quotes --no-verify-jwt
npx supabase functions deploy get-buybacks --no-verify-jwt
npx supabase functions deploy create-access-token --no-verify-jwt
```

### Enable Anonymous Sign-in

This app uses anonymous authentication for a frictionless experience. Enable it in your Supabase dashboard:

1. Go to **Authentication > Providers**
2. Enable **Anonymous Sign-ins** under "Anonymous Sign-in"
3. Save changes

## Deployment

### Frontend Deployment

The application can be deployed to any static hosting platform that supports SvelteKit.

#### Vercel

1. Connect your repository to Vercel
2. Add environment variables in Vercel dashboard:
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`
   - `PUBLIC_KITE_API_KEY`
3. Deploy

```bash
npm install -g vercel
vercel
```

#### Netlify

1. Connect your repository to Netlify
2. Add environment variables in Netlify dashboard
3. Set build command: `npm run build`
4. Set publish directory: `build`

### Backend Deployment (Supabase)

#### Manual Deployment

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Link and deploy using the deploy script:

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
./scripts/deploy-supabase.sh
```

#### Automated Deployment (GitHub Actions)

The project includes a GitHub Actions workflow that automatically deploys Supabase resources when changes are pushed to the `main` branch.

**Setup:**

1. **Get your Supabase Access Token:**
   - Go to [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)
   - Click "Generate new token"
   - Copy the token (you won't see it again!)

2. **Get your Project ID:**
   - Go to your Supabase project dashboard
   - Navigate to Settings > General
   - Copy the "Reference ID"

3. **Add Secrets to GitHub:**
   - Go to your GitHub repo > Settings > Secrets and variables > Actions
   - Add these secrets:
     - `SUPABASE_ACCESS_TOKEN` - The token from step 1
     - `SUPABASE_PROJECT_ID` - The project reference ID from step 2

4. **Trigger Deployment:**
   - Push changes to the `supabase/` directory on `main` branch, OR
   - Manually trigger from Actions tab > "Deploy Supabase" > "Run workflow"

The workflow will deploy:
- Database migrations
- All Edge Functions (nse-quotes, get-buybacks, create-access-token)

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PUBLIC_SUPABASE_URL` | Your Supabase project URL | Yes |
| `PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous key | Yes |
| `PUBLIC_KITE_API_KEY` | Kite Connect API key for Publisher basket | Yes |

### Getting Your Keys

#### Supabase
1. Go to [supabase.com](https://supabase.com) and create a project
2. Navigate to Settings > API
3. Copy the Project URL and anon public key

#### Kite Connect
1. Register at [developers.kite.trade](https://developers.kite.trade/)
2. Create an app to get your API key
3. Only the API key is needed (no API secret required for Publisher mode)

## How It Works

### Tax Loss Harvesting

Tax loss harvesting is a strategy to reduce tax liability by:
1. Selling loss-making holdings to realize capital losses
2. Using these losses to offset capital gains
3. Buying back the same stocks (next trading day to avoid intraday treatment)

In India:
- **STCL (Short-Term Capital Loss)**: Can offset both STCG and LTCG
- **LTCL (Long-Term Capital Loss)**: Can only offset LTCG
- Unused losses can be carried forward for up to 8 years

### Why Tradebook CSV?

The Kite Holdings API does not provide individual lot purchase dates, making accurate ST/LT classification impossible via API alone. By using the Tradebook CSV from Zerodha Console, we get complete trade history with exact dates for accurate classification.

### Usage Flow

1. **Download Tradebook**: Get your Tradebook CSV from [Zerodha Console](https://console.zerodha.com/reports/tradebook)
2. **Upload Files**: Upload up to 2 Tradebook files - Current FY (for realized gains & holdings) and Last FY (for long-term holdings)
3. **Analyze**: The app calculates holdings using FIFO and classifies as ST/LT
4. **Fetch Prices**: Current prices are fetched via Yahoo Finance
5. **Identify Opportunities**: View loss-making holdings by category
6. **Execute**: Select holdings to harvest and execute via Kite Publisher
7. **Track Buyback**: Get reminders to buy back sold stocks the next trading day

## Tech Stack

- **Frontend**: SvelteKit with TypeScript
- **Styling**: TailwindCSS
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **External APIs**: Yahoo Finance (prices), Kite Publisher (order execution)

## License

MIT
