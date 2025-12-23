#!/bin/bash

# Test script for the cron endpoint
# Usage: ./scripts/test-cron-endpoint.sh

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Testing Cron Endpoint${NC}\n"

# Check if required environment variables are set
if [ -z "$KOLOS_API_URL" ]; then
    echo -e "${RED}❌ Error: KOLOS_API_URL environment variable is not set${NC}"
    echo -e "   Set it with: export KOLOS_API_URL=http://localhost:3000"
    exit 1
fi

if [ -z "$CRON_SECRET" ]; then
    echo -e "${RED}❌ Error: CRON_SECRET environment variable is not set${NC}"
    echo -e "   Set it with: export CRON_SECRET=your_secret_key"
    exit 1
fi

echo -e "${BLUE}📡 API URL:${NC} $KOLOS_API_URL"
echo -e "${BLUE}🔑 Secret:${NC} ${CRON_SECRET:0:8}... (hidden)"
echo -e ""

# Test 1: Unauthorized request (no auth header)
echo -e "${YELLOW}Test 1: Unauthorized request (no auth header)${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    "$KOLOS_API_URL/api/signals/update-all")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ Passed:${NC} Got 401 Unauthorized as expected"
else
    echo -e "${RED}❌ Failed:${NC} Expected 401, got $HTTP_CODE"
fi
echo -e ""

# Test 2: Invalid secret
echo -e "${YELLOW}Test 2: Invalid secret${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer invalid_secret" \
    "$KOLOS_API_URL/api/signals/update-all")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ Passed:${NC} Got 401 Unauthorized as expected"
else
    echo -e "${RED}❌ Failed:${NC} Expected 401, got $HTTP_CODE"
fi
echo -e ""

# Test 3: Valid request (dry run - will actually update signals)
echo -e "${YELLOW}Test 3: Valid authenticated request${NC}"
echo -e "${YELLOW}⚠️  Warning: This will actually update signals!${NC}"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Sending request...${NC}"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $CRON_SECRET" \
        -d '{}' \
        "$KOLOS_API_URL/api/signals/update-all")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ Passed:${NC} Got 200 OK"
        echo -e "${BLUE}Response:${NC}"
        echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    else
        echo -e "${RED}❌ Failed:${NC} Expected 200, got $HTTP_CODE"
        echo -e "${RED}Response:${NC}"
        echo "$BODY"
    fi
else
    echo -e "${YELLOW}Skipped${NC}"
fi
echo -e ""

# Test 4: Request with specific profile IDs (optional)
echo -e "${YELLOW}Test 4: Request with specific profile IDs (optional)${NC}"
read -p "Enter profile IDs to test (comma-separated, or press Enter to skip): " PROFILE_IDS

if [ -n "$PROFILE_IDS" ]; then
    IFS=',' read -ra IDS <<< "$PROFILE_IDS"
    JSON_ARRAY=$(printf ',"%s"' "${IDS[@]}")
    JSON_ARRAY="[${JSON_ARRAY:1}]"
    
    echo -e "${BLUE}Sending request for profiles: $PROFILE_IDS${NC}"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $CRON_SECRET" \
        -d "{\"profile_ids\": $JSON_ARRAY}" \
        "$KOLOS_API_URL/api/signals/update-all")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ Passed:${NC} Got 200 OK"
        echo -e "${BLUE}Response:${NC}"
        echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    else
        echo -e "${RED}❌ Failed:${NC} Expected 200, got $HTTP_CODE"
        echo -e "${RED}Response:${NC}"
        echo "$BODY"
    fi
else
    echo -e "${YELLOW}Skipped${NC}"
fi
echo -e ""

echo -e "${BLUE}🎉 Testing complete!${NC}"

