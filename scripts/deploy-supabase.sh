#!/bin/bash
#
# Deploy Supabase resources (migrations and Edge Functions)
#
# Usage:
#   Local:  ./scripts/deploy-supabase.sh
#   CI/CD:  SUPABASE_ACCESS_TOKEN=xxx SUPABASE_PROJECT_ID=xxx ./scripts/deploy-supabase.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Supabase Deployment ===${NC}"

# Use npx to run Supabase CLI (no global install needed)
SUPABASE="npx supabase"

# Check for required environment variables in CI mode
if [ -n "$CI" ]; then
    if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
        echo -e "${RED}Error: SUPABASE_ACCESS_TOKEN is required in CI mode${NC}"
        exit 1
    fi
    if [ -z "$SUPABASE_PROJECT_ID" ]; then
        echo -e "${RED}Error: SUPABASE_PROJECT_ID is required in CI mode${NC}"
        exit 1
    fi
fi

# Link to project if PROJECT_ID is provided
if [ -n "$SUPABASE_PROJECT_ID" ]; then
    echo -e "${YELLOW}Linking to Supabase project: $SUPABASE_PROJECT_ID${NC}"
    $SUPABASE link --project-ref "$SUPABASE_PROJECT_ID"
fi

# Deploy database migrations
echo -e "\n${YELLOW}Deploying database migrations...${NC}"
$SUPABASE db push

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Migrations deployed successfully${NC}"
else
    echo -e "${RED}✗ Migration deployment failed${NC}"
    exit 1
fi

# Deploy Edge Functions
echo -e "\n${YELLOW}Deploying Edge Functions...${NC}"

# List of Edge Functions to deploy
FUNCTIONS=(
    "nse-quotes"
    "get-buybacks"
    "create-access-token"
)

for func in "${FUNCTIONS[@]}"; do
    echo -e "  Deploying ${func}..."
    $SUPABASE functions deploy "$func" --no-verify-jwt

    if [ $? -eq 0 ]; then
        echo -e "  ${GREEN}✓ ${func} deployed${NC}"
    else
        echo -e "  ${RED}✗ ${func} deployment failed${NC}"
        exit 1
    fi
done

echo -e "\n${GREEN}=== Deployment Complete ===${NC}"
echo -e "All migrations and Edge Functions have been deployed."
