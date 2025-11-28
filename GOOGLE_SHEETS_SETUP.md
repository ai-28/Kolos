# Google Sheets Database Setup Guide

This project now uses Google Sheets as the database instead of Airtable.

## Setup Steps

### 1. Create Google Cloud Project and Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable the **Google Sheets API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

4. Create a Service Account:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Give it a name (e.g., "kolos-sheets-service")
   - Click "Create and Continue"
   - Skip optional steps and click "Done"

5. Create and Download JSON Key:
   - Click on the service account you just created
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - Choose "JSON" format
   - Download the JSON file
   - Save it as `google-credentials.json` in your project root

### 2. Create Google Sheet

1. Create a new Google Sheet
2. Create 3 tabs (sheets) with these exact names:
   - **Profiles**
   - **Signals**
   - **Deals**

3. Set up the headers in each tab:

#### Profiles Tab Headers (Row 1):
```
id, name, company, email, role, industries, regions, check_size, goals, partner_types, active_deal, constraints, city, created_at
```

#### Signals Tab Headers (Row 1):
```
profile_id, date, headline_source, url, category, signal_type, scores_R_O_A, overall, next_step
```

#### Deals Tab Headers (Row 1):
```
profile_id, company_name, source_signal_id, contact_person, stage, owner, next_step, next_step_date, estimated_value
```

4. Share the Google Sheet with your Service Account:
   - Click "Share" button in Google Sheets
   - Add the service account email (found in the JSON file, looks like: `your-service-account@project-id.iam.gserviceaccount.com`)
   - Give it "Editor" permissions
   - Click "Send"

5. Get the Spreadsheet ID:
   - The Spreadsheet ID is in the URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
   - Copy the `SPREADSHEET_ID` part

### 3. Environment Variables

#### For Local Development

Add these to your `.env.local` file:

```env
GOOGLE_SHEET_ID=your_spreadsheet_id_here
GOOGLE_CREDENTIALS_PATH=./kolos-project-40696a085f6e.json
```

#### For Production (Vercel/Serverless)

**Important:** In production, you cannot use the credentials file. You must use the `GOOGLE_CREDENTIALS` environment variable instead.

1. Open your credentials JSON file (`kolos-project-40696a085f6e.json`)
2. Copy the entire JSON content
3. In your production environment (e.g., Vercel):
   - Go to Settings → Environment Variables
   - Add these variables:
     - `GOOGLE_SHEET_ID` = your spreadsheet ID
     - `GOOGLE_CREDENTIALS` = paste the entire JSON content as a string (keep all quotes, brackets, etc.)

**Example for Vercel:**
```
GOOGLE_SHEET_ID=1LEDcpsJHbPAxsykJFiAzeJ4QkJqECkjFw7I3Jix4sSQ
GOOGLE_CREDENTIALS={"type":"service_account","project_id":"kolos-project",...}
```

**Note:** The `GOOGLE_CREDENTIALS` should be the entire JSON object as a single-line string. You can use a tool like [JSON Minifier](https://jsonformatter.org/json-minify) to convert it to a single line if needed.

### 4. Security

Make sure `kolos-project-40696a085f6e.json` is in your `.gitignore` file (it should already be there). Never commit credentials to git!

## API Endpoints

### Profiles
- `GET /api/airtable/clients` - Get all profiles
- `GET /api/airtable/clients/[id]` - Get profile by ID

### Signals
- Signals are automatically saved when recommendations are generated via `POST /api/recommendations`

### Deals
- `GET /api/deals` - Get all deals (optional query: `?profile_id=xxx` to filter)
- `POST /api/deals` - Create a new deal

## Data Structure

### Profile Object
```javascript
{
  id: "profile_1234567890_abc123",
  name: "John Doe",
  company: "Acme Corp",
  email: "john@acme.com",
  role: "Investor",
  industries: "Tech, Healthcare",
  regions: "US, Europe",
  check_size: "5-15 million",
  goals: "Expand portfolio",
  partner_types: "LPs, Operators",
  active_deal: "Looking for Series A opportunities",
  constraints: "No crypto",
  city: "New York",
  created_at: "2025-11-28T16:00:00.000Z"
}
```

### Signal Object
```javascript
{
  profile_id: "profile_1234567890_abc123",
  date: "2025-11-28",
  headline_source: "Mass layoff wave hits ~1,300 Texans",
  url: "https://example.com/article",
  category: "colaberry_opportunity",
  signal_type: "event",
  scores_R_O_A: "5,5,4",
  overall: 5,
  next_step: "Pull latest TWC WARN list; offer reskill cohorts"
}
```

### Deal Object
```javascript
{
  profile_id: "profile_1234567890_abc123",
  company_name: "Target Company Inc",
  source_signal_id: "signal_id_here",
  contact_person: "Jane Smith",
  stage: "New", // Options: New, Outreach, Meeting, Negotiation, Closed won, Closed lost
  owner: "Vol",
  next_step: "Schedule intro call",
  next_step_date: "2025-12-01",
  estimated_value: "500000"
}
```

## Migration Notes

- The old Airtable routes (`/api/airtable/clients`) still work but now read from Google Sheets
- You may want to migrate existing Airtable data to Google Sheets manually
- The recommendations endpoint now saves to Google Sheets instead of Airtable webhook

