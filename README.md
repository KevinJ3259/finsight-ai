FinSight AI

FinSight AI is a full-stack personal finance application that helps users track income and expenses, plan recurring cash flow, manage budgets and savings goals, and receive AI-powered financial insights. Secure account authentication keeps each user's financial records private and separate.

Screenshots

Secure authentication

Financial dashboard

Planning and analysis tools

Features

Secure registration, login, logout, and persistent sessions

Password hashing with Argon2 and JWT bearer authentication

Complete user-data isolation across all financial records

Income and expense creation, editing, deletion, search, and filtering

Custom reporting periods and monthly spending analysis

Spending breakdowns and interactive charts

Recurring income and expense planning with multiple frequencies

Monthly cash-flow forecasts and projected ending balances

Category-based monthly budgets with progress indicators and warnings

Savings goals with contributions, withdrawals, targets, and due dates

CSV transaction import and export

AI-powered analysis of spending patterns and cash flow

Responsive interface for desktop, tablet, and mobile use

Technology Stack

Frontend

React

TypeScript

Vite

Recharts

React Markdown

Backend

Python

FastAPI

SQLAlchemy

Pydantic

PyJWT

pwdlib with Argon2

OpenAI API

Data and deployment

PostgreSQL in production

SQLite for local development

Render Web Service for the API

Render Static Site for the frontend

Architecture

flowchart TD
U[User] --> R[React frontend]
R -->|JWT bearer token| F[FastAPI backend]
F --> A[Authentication layer]
A --> P[(PostgreSQL)]
F --> O[OpenAI API]
P -->|User-owned records| F

Every protected request includes a JWT bearer token. The backend validates the token, identifies the current user, and filters database operations by that user's ID. Record ownership is checked during reads, updates, and deletions.

Local Development

Prerequisites

Python 3.10 or newer

Node.js and npm

An OpenAI API key for AI insights

1. Clone the repository

git clone https://github.com/KevinJ3259/finsight-ai.git
cd finsight-ai

2. Configure the backend

Create and activate a virtual environment.

Windows Git Bash

python -m venv .venv
source .venv/Scripts/activate

macOS or Linux

python3 -m venv .venv
source .venv/bin/activate

Install the Python dependencies:

python -m pip install --upgrade pip
python -m pip install -r requirements.txt

Create backend/.env:

OPENAI_API_KEY=your_openai_api_key
JWT_SECRET=your_long_random_jwt_secret
FRONTEND_URL=http://localhost:5173

Generate a secure JWT secret with:

python -c "import secrets; print(secrets.token_urlsafe(64))"

Start the API:

python -m uvicorn backend.main:app --reload

The API runs at http://127.0.0.1:8000, and its interactive documentation is available at http://127.0.0.1:8000/docs.

3. Configure the frontend

Open another terminal:

cd frontend
npm install
npm run dev

The frontend runs at http://localhost:5173.

To point the frontend to another API, create frontend/.env:

VITE_API_URL=http://127.0.0.1:8000

Production Configuration

The backend requires these Render environment variables:

Variable

Purpose

DATABASE_URL

PostgreSQL connection string

OPENAI_API_KEY

OpenAI API authentication

JWT_SECRET

JWT signing secret

FRONTEND_URL

Allowed production frontend origin

The frontend requires:

Variable

Purpose

VITE_API_URL

Public URL of the deployed FastAPI service

Production secrets are stored as environment variables and are not committed to source control.

Production Commands

Backend build command:

pip install -r requirements.txt

Backend start command:

uvicorn backend.main:app --host 0.0.0.0 --port $PORT

Frontend build command:

npm ci && npm run build

Frontend publish directory:

frontend/dist

Security

Passwords are hashed and never stored as plain text.

Protected endpoints require a valid signed JWT.

Database queries are scoped to the authenticated user.

Users cannot access records owned by another account.

API keys, database credentials, and signing secrets are stored outside the repository.

Financial data is sent to the AI endpoint only when an authenticated user explicitly requests an analysis.

This project is intended as a portfolio application and educational personal-finance tool. It does not provide financial, investment, tax, legal, or credit advice.

Future Improvements

Email verification and password reset

Login rate limiting and account lockout protections

Refresh-token rotation and secure cookie-based sessions

Database migrations with Alembic

Automated backend and frontend test suites

Additional accessibility and performance improvements

Author

Kevin Jordan

GitHub

FinSight AI
