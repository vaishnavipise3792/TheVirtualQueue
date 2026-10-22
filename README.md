# Queueless — The Virtual Queue

Queueless is a web-based virtual queue management system that helps hospitals, banks, and public service centres manage queues digitally. Customers can join a queue online, receive a token, and track their waiting status without standing in a physical line.

The system provides a customer-facing website, a staff dashboard, queue-management APIs, and Random Forest-based prediction for service duration and waiting time.

## ✨ Features

### Customer Portal
- Select a service sector: Hospital, Bank, or Service Centre.
- Browse available organizations, branches, and services.
- Join a queue online and receive a token.
- Track token status and estimated waiting time.
- View queue position and customers ahead.
- Access a public display board without exposing customer names or phone numbers.
- Receive live queue updates.

### Staff Dashboard
- View waiting, called, in-service, completed, skipped, and no-show tokens.
- Call the next customer.
- Recall a token, start service, or complete service.
- Skip a token, mark a customer as a no-show, or requeue an eligible token.
- Register walk-in customers.
- Change queue priority with audit logging.
- Manage service counters and service settings.

### Queue Priority
The application supports configurable queue priorities, including:

| Category | Example Weight |
|---|---:|
| Apex Wealth / Priority Banking | 100 |
| Senior Citizen & Specially Abled | 50 |
| Standard Customer | 10 |

Priority weights control queue ordering according to configured business rules. Priority handling is separate from machine-learning predictions.

### Random Forest Machine Learning
Queueless includes a Random Forest regression implementation for predicting service duration and estimating waiting time.

The model can use features such as:
- Queue priority weight.
- Configured average service duration.
- Task-duration information.
- Time of day and day of week.
- Queue depth.
- Historical completed service records.

The application also includes model-status and retraining endpoints.

**Strict ML requirement:** Random Forest must be the only machine-learning algorithm used for predictions. If a trained Random Forest model is unavailable, the application should clearly report that a prediction is unavailable rather than silently switching to another algorithm or presenting a heuristic estimate as an ML prediction.

> Model quality depends on the quality and quantity of historical queue data. Synthetic training data may be useful for development but must not be represented as real-world validation.

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| Frontend | React |
| Development server and build | Vite |
| Styling | CSS |
| Backend API | Node.js and Express |
| Database | SQLite through the backend database module |
| Machine Learning | Random Forest Regression using `ml-random-forest` |
| Queue updates | Server-Sent Events (SSE) |
| QR code generation | `qrcode` |
| Icons | `lucide-react` |
| Testing | Node.js test runner |

## 📋 Prerequisites

Install the following before running the application:

- Node.js compatible with the project's dependencies.
- npm.
- Git.

Use a recent Node.js LTS version to improve compatibility with current Vite dependencies.

## 🚀 Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/vaishnavipise3792/Queueless-the-virtual-queue-.git
cd Queueless-the-virtual-queue-
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the application

```bash
npm run dev
```

The development command starts the frontend and backend concurrently.

Based on the current project configuration:

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001

Keep the terminal open while running the application.

## 📦 Available Commands

| Command | Description |
|---|---|
| `npm install` | Installs project dependencies. |
| `npm run dev` | Starts the frontend and backend. |
| `npm run client` | Starts the Vite frontend. |
| `npm run server` | Starts the Express backend. |
| `npm run seed` | Seeds the database with initial demonstration data. |
| `npm test` | Runs the configured acceptance tests. |

If you add a production build script to `package.json`, use `npm run build` to generate the optimized frontend bundle.

## 🔌 API Overview

### Public Customer APIs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/public/sectors` | Lists service sectors and organizations. |
| GET | `/api/public/org/:orgId` | Returns organization details, branches, services, and queue metrics. |
| POST | `/api/public/join` | Creates a queue entry and issues a token. |
| GET | `/api/public/track/:code` | Retrieves public tracking information. |
| POST | `/api/public/track/:code/cancel` | Cancels a queue entry. |
| GET | `/api/public/display/:serviceId` | Retrieves public queue display information. |
| GET | `/api/events` | Provides live queue updates through Server-Sent Events. |

### Staff and Admin APIs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/staff/queues` | Retrieves queue entries for staff. |
| POST | `/api/staff/call-next` | Calls the next eligible token. |
| POST | `/api/staff/start-service` | Starts serving a customer. |
| POST | `/api/staff/complete` | Marks service as completed. |
| POST | `/api/staff/skip` | Skips a token. |
| POST | `/api/staff/no-show` | Marks a customer as a no-show. |
| POST | `/api/staff/requeue` | Requeues an eligible token. |
| POST | `/api/staff/walkin` | Registers a walk-in customer. |
| GET | `/api/admin/analytics` | Returns queue analytics. |
| GET | `/api/admin/services` | Lists service configuration. |
| GET | `/api/admin/audit-logs` | Retrieves organization audit logs. |

### Random Forest APIs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/ml/status` | Returns model status and reported metrics. |
| POST | `/api/ml/retrain` | Retrains the Random Forest model. |
| POST | `/api/ml/simulate` | Runs a wait-time simulation using supplied durations. |
| POST | `/api/superadmin/toggle-ml` | Changes ML availability for demonstration/testing. |

### Check model status

```bash
curl http://localhost:3001/api/ml/status
```

### Run a wait-time simulation

```bash
curl -X POST http://localhost:3001/api/ml/simulate \
  -H "Content-Type: application/json" \
  -d "{\"personDurations\":[3,7],\"activeCounters\":1}"
```

The simulation accepts durations as inputs. Its result should not be confused with a duration prediction made by the trained model.

## 🧠 How Random Forest Works

Random Forest is an ensemble machine-learning method that combines predictions from multiple decision trees.

In Queueless, the intended workflow is:

1. Collect completed queue records with actual service-start and completion timestamps.
2. Prepare valid historical features and actual service-duration targets.
3. Train the Random Forest regression model.
4. Use the trained model to predict relevant service durations.
5. Estimate a customer's waiting time using predictions for people ahead and the number of active counters.
6. Refresh the estimate as the queue changes.

Predictions should be evaluated on held-out historical records. Report metrics such as MAE, RMSE, and R² only when they have been calculated using an appropriate evaluation process.

The current code includes a synthetic-data initialization path and a heuristic fallback. For strict Random Forest-only operation, the fallback must be changed to report that a prediction is unavailable when the trained model cannot be used.

## 🗂️ Project Structure

```text
Queueless-the-virtual-queue-/
├── data/                 # Project data
├── dist/                 # Built frontend files, when generated
├── server/
│   ├── index.js           # Express API and application routes
│   ├── waitTimeService.js # Random Forest wait-time service
│   ├── queueEngine.js     # Queue processing and status transitions
│   ├── db.js              # Database setup and queries
│   ├── seed.js            # Demo data seeding
│   └── auditLogger.js     # Audit logging
├── src/                   # React frontend source
├── tests/                 # Automated tests
├── index.html
├── package.json
├── package-lock.json
└── vite.config.js
```

## 🧪 Testing

Run the configured test suite:

```bash
npm test
```

Test the core workflows before deployment:

- A customer can join a queue and receive a token.
- Queue entries persist in the database.
- Staff can advance, skip, and complete tokens.
- Customer tracking reflects the current queue state.
- The Random Forest model can be trained and loaded.
- Model unavailability is reported clearly.
- Predictions are not falsely labelled as Random Forest output when a fallback is used.
- Public endpoints do not expose customer names or phone numbers.
- Queue priority rules work as expected.

## 🔐 Security and Privacy

- Keep secrets and credentials out of source control.
- Validate incoming API requests.
- Apply appropriate authentication and authorization to staff and admin endpoints before public deployment.
- Avoid collecting unnecessary personal information.
- Do not expose customer names or phone numbers through public tracking and display endpoints.
- Protect administrative and retraining endpoints.
- Review CORS and deployment configuration before making the application publicly accessible.

## 🚢 Production Deployment

Before deployment:

1. Configure environment variables and production database settings.
2. Build and test the frontend.
3. Deploy the backend behind HTTPS.
4. Configure appropriate access controls for staff and admin operations.
5. Verify queue persistence, live updates, and error handling.
6. Validate Random Forest performance on representative historical records.
7. Remove or disable demonstration-only controls and endpoints where appropriate.
8. Verify that ML failure does not break core queue operations.

## 🤝 Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make your changes and add tests.
4. Run the available test suite.
5. Submit a pull request describing your changes.

## 📄 License

The current `package.json` declares the project license as `ISC`. Confirm the repository's intended license and include the corresponding license file before publishing or redistributing the project.

## 📬 Contact

For bugs, feature requests, or project questions, please open an issue in the [Queueless GitHub repository](https://github.com/vaishnavipise3792/Queueless-the-virtual-queue-).
