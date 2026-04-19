# 🏥 PFBC Issue Tracker

**Point Fortin Borough Corporation — Public Health Administration Issue Tracker**

A mobile-first, full-stack web application for managing Public Health issues, staff, food vendors, food establishments, leave requests, and administrative operations across all districts of the Point Fortin Borough Corporation catchment area.

---

## ✨ Features

- **Role-Based Access Control (RBAC)** — Dynamic, database-driven permissions (view / write / admin) per module per role
- **Issue Registry** — Log, track, and resolve public health issues with statuses, priorities, districts, notes, subtasks, and media attachments
- **Staff Management** — User accounts with district assignments, role management, and credential editing
- **Food Vendors** — Mobile vendor registration and licence tracking
- **Food Establishments** — Fixed premises registration with inspection history
- **Leave Tracker** — Staff leave requests, types, and approvals
- **Admin Panel** — Districts, categories, roles, permission matrix, and system settings
- **Media Attachments** — Photo and document attachments on issue notes
- **Dark/Light Mode** — Glassmorphism design system, mobile-first responsive layout

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Backend / DB | [Convex](https://convex.dev) (serverless, real-time) |
| Styling | Vanilla CSS (custom design system) |
| Auth | Custom session-based auth (Convex) |
| Routing | React Router v6 |

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- A free [Convex](https://dashboard.convex.dev) account

### 1. Clone and install

```bash
git clone https://github.com/SurendraDhanraj/PFBC-Issue-Tracker.git
cd PFBC-Issue-Tracker
npm install
```

### 2. Set up Convex

```bash
npx convex dev
```

This will prompt you to log in to Convex and link or create a new deployment. It also starts the Convex backend in watch mode.

### 3. Start the frontend

In a separate terminal:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### 4. Seed initial data

Once Convex is running, open the Convex dashboard and run these mutations in order:

```
seed:seedAll       ← creates roles, districts, categories, leave types, and admin users
seed:seedIssues    ← adds 20 sample public health issues
seed:seedIssues2   ← adds 20 more issues with photo/document attachments
```

### Default Admin Credentials

After running `seedAll`, log in with:

| Email | Password | Role |
|---|---|---|
| `admin@pfbc.gov.tt` | `Admin@2025!` | Medical Officer of Health |
| `phi3@pfbc.gov.tt` | `PHI3@2025!` | PHI III |

> ⚠️ Change these credentials immediately in a production deployment.

---

## 📁 Project Structure

```
PF/
├── convex/           # Convex backend functions and schema
│   ├── schema.ts     # Database schema
│   ├── auth.ts       # Authentication (login, session)
│   ├── issues.ts     # Issue CRUD + media upload
│   ├── users.ts      # Staff management
│   ├── roles.ts      # Role + permission management
│   ├── seed.ts       # Data seeding mutations
│   └── ...
├── src/
│   ├── context/      # AuthContext + permission hooks
│   ├── components/   # Shared UI components (Sidebar, Modal, etc.)
│   ├── pages/        # Application pages
│   └── index.css     # Global design system
├── public/
│   └── demo/         # Demo images for seeded issues
└── README.md
```

---

## 🔐 Permission System

Roles are fully configurable through the Admin Panel. Each role can be granted per-module permissions:

| Level | Description |
|---|---|
| `none` | No access — module hidden from sidebar |
| `view` | Read-only access |
| `write` | Can create and edit |
| `admin` | Full access including destructive actions |

---

## 📝 License

Internal use — Point Fortin Borough Corporation, Trinidad and Tobago.
